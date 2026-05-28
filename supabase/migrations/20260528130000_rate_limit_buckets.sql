-- ============================================================================
-- Rate limit bucket table + atomic check function
-- ----------------------------------------------------------------------------
-- A lightweight Postgres-backed fixed-window rate limiter. Used to throttle
-- public endpoints that an attacker could otherwise flood:
--
--   - Embed submit (per IP, per IP+event)
--   - Completion form submit (per IP, per token)
--   - /pay/[bookingId] page render (per IP+booking)
--   - /api/booking-status polling (per IP+booking)
--
-- Design:
--   - One row per (bucket_key) where bucket_key encodes the action + the
--     identifier (e.g. "embed_submit:ip:1.2.3.4").
--   - `window_started_at` marks the start of the current fixed window.
--   - `hit_count` is incremented on every call inside the same window.
--   - When the current window has elapsed (now - window_started_at >
--     window_seconds), the row is reset.
--
-- Atomic semantics:
--   - `check_rate_limit` uses INSERT ... ON CONFLICT DO UPDATE so a
--     concurrent call cannot both observe count = 0 and both proceed.
--   - The function returns the new hit_count + whether the call was
--     allowed under the given (window_seconds, max_hits) cap.
--
-- Service-role only writes (no anon/authenticated policies). Callers go
-- through `src/server/rate-limit/check.ts`, which uses the service-role
-- client.
-- ============================================================================

create table if not exists public.request_rate_limits (
  bucket_key         text        primary key,
  window_started_at  timestamptz not null default now(),
  hit_count          integer     not null default 0
);

comment on table public.request_rate_limits is
  'Fixed-window rate limit buckets. bucket_key encodes action + identifier (e.g. "embed_submit:ip:1.2.3.4"). Reset implicitly when the current window elapses.';

create index if not exists request_rate_limits_window_idx
  on public.request_rate_limits (window_started_at);

alter table public.request_rate_limits enable row level security;
-- No SELECT/INSERT/UPDATE/DELETE policies: service-role only.


create or replace function public.check_rate_limit(
  p_bucket_key      text,
  p_window_seconds  integer,
  p_max_hits        integer
)
returns table (allowed boolean, hit_count integer, window_started_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now             timestamptz := now();
  v_window_started  timestamptz;
  v_hit_count       integer;
begin
  if p_window_seconds <= 0 or p_max_hits <= 0 then
    raise exception 'check_rate_limit: window_seconds and max_hits must be positive';
  end if;

  insert into public.request_rate_limits (bucket_key, window_started_at, hit_count)
    values (p_bucket_key, v_now, 1)
    on conflict (bucket_key) do update
      set
        window_started_at = case
          when v_now - public.request_rate_limits.window_started_at
                 > make_interval(secs => p_window_seconds)
            then v_now
          else public.request_rate_limits.window_started_at
        end,
        hit_count = case
          when v_now - public.request_rate_limits.window_started_at
                 > make_interval(secs => p_window_seconds)
            then 1
          else public.request_rate_limits.hit_count + 1
        end
    returning
      public.request_rate_limits.window_started_at,
      public.request_rate_limits.hit_count
    into v_window_started, v_hit_count;

  return query
    select
      (v_hit_count <= p_max_hits) as allowed,
      v_hit_count                 as hit_count,
      v_window_started            as window_started_at;
end;
$$;

comment on function public.check_rate_limit(text, integer, integer) is
  'Atomic fixed-window rate limit check. Returns (allowed, hit_count, window_started_at). Uses SECURITY DEFINER + locked search_path so it is safe to call from any role; in practice the wrapper TS module routes it through the service-role client.';

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;


-- ----------------------------------------------------------------------------
-- Optional cleanup helper. Old buckets (window started > 24h ago) cannot
-- carry meaningful state anymore — every short window has reset many
-- times — and just take up space. Call this from any periodic cron to
-- keep the table bounded; safe to never call (table stays small in
-- practice because primary key is shared per bucket).
-- ----------------------------------------------------------------------------
create or replace function public.prune_rate_limit_buckets(p_older_than_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.request_rate_limits
    where window_started_at < now() - make_interval(hours => p_older_than_hours);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_rate_limit_buckets(integer) from public;
grant execute on function public.prune_rate_limit_buckets(integer) to service_role;

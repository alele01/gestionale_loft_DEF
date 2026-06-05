/**
 * Helpers to convert between a wall-clock `datetime-local` string (no
 * timezone, e.g. "2026-06-12T16:00") interpreted in **Europe/Rome** and a
 * UTC ISO-8601 instant.
 *
 * Why this exists: `<input type="datetime-local">` emits a timezone-less
 * string. Calling `new Date(str)` interprets it in the RUNTIME's local
 * zone — which on Vercel is UTC. That stored the admin's "16:00 Rome" as
 * "16:00Z", and the UI (which always renders in Europe/Rome) showed it as
 * 18:00 in summer. These helpers anchor the conversion to Europe/Rome on
 * both ends, regardless of where the code runs (server or browser).
 *
 * Pure (only uses `Intl`), so safe to import from both client and server.
 */

const ROME_TZ = "Europe/Rome";

/**
 * Offset (in ms) to ADD to a UTC instant to obtain Europe/Rome wall time,
 * at the given instant. +1h in winter (CET), +2h in summer (CEST).
 */
function romeOffsetMs(instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // Some engines emit hour "24" for midnight; normalize to 0.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    hour,
    map.minute,
    map.second
  );
  return asUtc - instant.getTime();
}

/**
 * Convert a Europe/Rome wall-clock `datetime-local` string to a UTC ISO
 * instant. e.g. "2026-06-12T16:00" (CEST) → "2026-06-12T14:00:00.000Z".
 *
 * Uses a two-pass offset resolution so instants near a DST transition are
 * handled correctly.
 */
export function romeLocalToUtcIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    local.trim()
  );
  if (!m) {
    // Not the expected shape — fall back to native parsing so callers still
    // get a value (validation upstream should prevent reaching here).
    return new Date(local).toISOString();
  }
  const [, y, mo, d, hh, mm, ss] = m;
  const naiveUtc = Date.UTC(+y, +mo - 1, +d, +hh, +mm, ss ? +ss : 0);
  // First guess using the offset at the naive instant, then refine once to
  // settle DST boundary cases.
  const off1 = romeOffsetMs(new Date(naiveUtc));
  const off2 = romeOffsetMs(new Date(naiveUtc - off1));
  return new Date(naiveUtc - off2).toISOString();
}

/**
 * Convert a UTC ISO instant to a Europe/Rome wall-clock `datetime-local`
 * string suitable for an `<input type="datetime-local">` value.
 * e.g. "2026-06-12T14:00:00Z" → "2026-06-12T16:00".
 */
export function utcIsoToRomeLocal(iso: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

import "server-only";

import { redirect } from "next/navigation";

import { getServerSupabase, getServiceClient } from "../supabase";

/**
 * Identity attached to every admin-authenticated request. The cached
 * `auth.users` data plus the `admin_users` row are returned together so
 * downstream code never has to re-query.
 */
export type AdminIdentity = {
  user: {
    id: string;
    email: string;
  };
  adminUser: {
    id: string;
    email: string;
    role: string;
  };
};

/**
 * Resolves and returns the current admin identity, or redirects to the
 * login screen when no valid admin session is present.
 *
 * Rules (see docs/SECURITY.md §3.1):
 *   1. Supabase session must exist (cookie-bound client + getUser()).
 *   2. A row in `public.admin_users` matching the user id with
 *      role='admin' must exist; otherwise the visitor is treated as
 *      unauthenticated, no matter how valid their Supabase session is.
 *
 * The admin_users lookup uses the service-role client because RLS denies
 * any direct SELECT for the unauthenticated role and we want a uniform
 * lookup that does not depend on the SELECT policy mutating in future
 * phases.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/admin/login");
  }

  const admin = getServiceClient();
  const { data: adminRow, error } = await admin
    .from("admin_users")
    .select("id, email, role")
    .eq("id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    // Surface as auth failure rather than leaking the DB error to the UI.
    // eslint-disable-next-line no-console
    console.error("[requireAdmin] admin_users lookup failed", error);
    redirect("/admin/login?error=auth");
  }

  if (!adminRow) {
    // Authenticated Supabase user but NOT in admin_users: treated as guest.
    // Sign out to avoid the "logged in to Supabase but locked out of UI"
    // limbo, then redirect.
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_admin");
  }

  return {
    user: { id: user.id, email: user.email },
    adminUser: adminRow,
  };
}

/**
 * Variant that returns null instead of redirecting. Useful in pages that
 * need to render guest-friendly content (e.g. the login page itself).
 */
export async function getAdminIdentityOrNull(): Promise<AdminIdentity | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const admin = getServiceClient();
  const { data: adminRow } = await admin
    .from("admin_users")
    .select("id, email, role")
    .eq("id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRow) return null;

  return {
    user: { id: user.id, email: user.email },
    adminUser: adminRow,
  };
}

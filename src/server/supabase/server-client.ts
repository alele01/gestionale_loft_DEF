import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "../env";

import type { Database } from "./database.types";

/**
 * Cookie-bound Supabase client for server components, server actions, and
 * route handlers. Reads/writes the auth cookies via Next.js `cookies()`.
 *
 * IMPORTANT (see docs/SECURITY.md §3.1):
 *  - This client uses the ANON key and respects RLS. It is used to verify
 *    the current admin session (Supabase Auth) and to refresh tokens.
 *  - It is NOT the privileged writer. Mutations on operational tables go
 *    through `getServiceClient()` (service-role) after `requireAdmin()`
 *    has validated the session + admin_users membership.
 *  - Marker `server-only` blocks accidental client imports.
 *
 * Some Next.js runtimes treat `cookies().set()` as a no-op outside of a
 * route handler / server action; we swallow the throw to keep this helper
 * usable from plain server components.
 */
export async function getServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as CookieOptions);
            }
          } catch {
            // `cookies()` is read-only in plain Server Components; the middleware
            // owns the actual refresh, so dropping the write here is safe.
          }
        },
      },
    }
  );
}

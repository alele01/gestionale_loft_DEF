import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireServiceRoleKey, serverEnv } from "../env";

import type { Database } from "./database.types";

/**
 * Service-role Supabase client. Server-only.
 *
 * IMPORTANT (see docs/SECURITY.md §9):
 *   - This client uses the SUPABASE_SERVICE_ROLE_KEY, which BYPASSES RLS.
 *   - It MUST NEVER be imported from any client component, client module, or
 *     code path that ends up in the browser bundle. The `import "server-only"`
 *     directive at the top of this file is enforced by Next.js at build time.
 *   - In Phase 4+, this client will be invoked exclusively by the booking
 *     state machine (`src/modules/booking-state/`) and by webhook handlers.
 *     UI components and Server Components MUST NOT import it directly.
 *
 * Configuration:
 *   - `autoRefreshToken: false` because the service role does not have a user
 *     session.
 *   - `persistSession: false` to avoid leaking any session into Node memory.
 */

let cachedClient: SupabaseClient<Database> | null = null;

export function getServiceClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  cachedClient = createClient<Database>(
    serverEnv.SUPABASE_URL,
    requireServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          "X-Client-Info": "cooker-loft-v1/server",
        },
      },
    }
  );

  return cachedClient;
}

export type ServiceClient = SupabaseClient<Database>;

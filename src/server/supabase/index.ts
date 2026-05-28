import "server-only";

/**
 * Public barrel for the server-only Supabase layer.
 *
 * Re-exports the three clients we use and the generated types. The
 * `server-only` marker propagates: anything that imports from this module
 * (or any file under `src/server/`) cannot end up in the client bundle.
 *
 * Client roles:
 *  - getServiceClient: service-role, bypasses RLS, used for all writes and
 *    privileged reads by the state machine and server actions. Always
 *    behind `requireAdmin()` for admin-triggered flows.
 *  - getServerSupabase: cookie-bound, anon key, used to read the current
 *    Supabase Auth session inside server components / actions / route
 *    handlers.
 *  - createMiddlewareSupabase: cookie-bound, used only inside middleware.ts
 *    to refresh the session and gate /admin/* routes.
 *
 * See docs/SECURITY.md §3.1 and §9 for the rationale.
 */

export { getServiceClient } from "./admin";
export type { ServiceClient } from "./admin";
export { getServerSupabase } from "./server-client";
export { createMiddlewareSupabase } from "./middleware-client";
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";

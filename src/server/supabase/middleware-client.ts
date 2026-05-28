import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "../env";

import type { Database } from "./database.types";

/**
 * Builds a Supabase client wired to the request/response cookie store, plus
 * the response object that should be returned from the middleware. The
 * caller MUST return the provided `response` (or one derived from it) so
 * that any refreshed auth cookies are sent back to the browser.
 *
 * Pattern follows the official @supabase/ssr Next.js middleware example.
 */
export function createMiddlewareSupabase(request: NextRequest): {
  supabase: SupabaseClient<Database>;
  response: NextResponse;
} {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options as CookieOptions);
          }
        },
      },
    }
  );

  return { supabase, response };
}

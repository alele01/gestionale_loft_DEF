import { NextResponse, type NextRequest } from "next/server";

import { createMiddlewareSupabase } from "@/server/supabase";

/**
 * Refreshes the Supabase auth cookies on every admin navigation and gates
 * /admin/* behind a session check. Pages additionally enforce admin_users
 * membership via `requireAdmin()` (deeper check that requires a DB lookup).
 *
 * Public surfaces (/, /embed/*, /complete/*, /payment/*, static assets) are
 * left untouched: zero auth, anonymous traffic flows through directly.
 *
 * See docs/SECURITY.md §3.1 for the wider auth model.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes bypass auth entirely. We still refresh the session for
  // any /admin path so that protected pages get fresh tokens.
  const isAdminPath = pathname.startsWith("/admin");
  if (!isAdminPath) {
    return NextResponse.next({ request });
  }

  const { supabase, response } = createMiddlewareSupabase(request);

  // `getUser()` re-validates the JWT against Supabase and refreshes cookies
  // when needed. Use it instead of `getSession()` per Supabase guidance.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPath = pathname === "/admin/login";
  const isLogoutPath = pathname === "/admin/logout";

  // Logged-in users hitting /admin/login get bounced to the dashboard so we
  // never show the form to an already authenticated admin.
  if (user && isLoginPath) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // Guests on a protected /admin/* route → bounce to login, preserving the
  // intended target for an optional post-login redirect.
  if (!user && !isLoginPath && !isLogoutPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    if (pathname !== "/admin") {
      loginUrl.searchParams.set("next", pathname + (request.nextUrl.search ?? ""));
    }
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static assets. We
    // narrow the actual logic above by checking `pathname`.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

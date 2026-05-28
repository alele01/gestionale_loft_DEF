import { NextResponse } from "next/server";

import { getServerSupabase } from "@/server/supabase";

/**
 * POST /admin/logout — signs the current admin out of Supabase Auth and
 * redirects to /admin/login. POST-only to avoid CSRF via link prefetch.
 */
export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  const url = new URL("/admin/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}

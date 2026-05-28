/* eslint-disable no-console */

/**
 * RLS smoke check for Cooker Loft V1.
 *
 * Acts as a standalone Node script (not a Next.js route) and asserts that the
 * Supabase anon role cannot read any row from any operational table.
 *
 * This is the operational gate listed in docs/QA_CHECKLIST.md (Supabase
 * Foundation baseline) and the security checklist in docs/SECURITY.md §18
 * ("Supabase RLS enabled on every table; manual smoke test from the anon
 * role returns no rows").
 *
 * Usage:
 *   pnpm rls:check
 *
 * Requires .env.local to be populated with:
 *   - SUPABASE_URL
 *   - SUPABASE_ANON_KEY
 *
 * Exit codes:
 *   0  every table denied access to anon as expected.
 *   1  any table returned rows (RLS regression) or env is missing.
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error(
    "[rls:check] Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local"
  );
  process.exit(1);
}

const OPERATIONAL_TABLES = [
  "admin_users",
  "events",
  "booking_requests",
  "bookings",
  "fiscal_profiles",
  "payments",
  "xml_exports",
  "xml_export_items",
  "audit_log",
  "app_settings",
  "email_log",
] as const;

type Result = {
  table: string;
  passed: boolean;
  rowsReturned: number;
  error: string | null;
};

async function main(): Promise<void> {
  const client = createClient(url!, anon!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: Result[] = [];

  for (const table of OPERATIONAL_TABLES) {
    const { data, error } = await client.from(table).select("*").limit(1);
    // Under RLS deny, the anon role gets `data = []` (no rows visible) rather
    // than a permission error. Both outcomes are acceptable; what matters is
    // that no row is leaked.
    const rowsReturned = data?.length ?? 0;
    const passed = rowsReturned === 0;
    results.push({
      table,
      passed,
      rowsReturned,
      error: error ? error.message : null,
    });
  }

  const failed = results.filter((r) => !r.passed);

  console.log("\nRLS smoke check — Cooker Loft V1\n");
  for (const r of results) {
    const mark = r.passed ? "OK  " : "FAIL";
    const err = r.error ? ` (error: ${r.error})` : "";
    console.log(
      `  ${mark}  ${r.table.padEnd(20)} rows=${r.rowsReturned}${err}`
    );
  }
  console.log();

  if (failed.length > 0) {
    console.error(
      `[rls:check] ${failed.length} table(s) leaked rows to the anon role:`,
      failed.map((r) => r.table).join(", ")
    );
    process.exit(1);
  }

  console.log("[rls:check] All operational tables deny anon access. ✓");
  process.exit(0);
}

main().catch((err) => {
  console.error("[rls:check] Unexpected failure:", err);
  process.exit(1);
});

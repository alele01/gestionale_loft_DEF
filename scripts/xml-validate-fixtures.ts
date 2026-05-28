/**
 * Validate every fixture in `tmp/xml-fixtures/*.xml` against the
 * official FatturaPA FPR12 XSD using `xmllint` (preinstalled on macOS;
 * available via `brew install libxml2` or `apt install libxml2-utils`).
 *
 * Prerequisites:
 *   1. `pnpm xml:fixtures` to (re)generate the fixtures.
 *   2. `reference/xml/Schema_VFPR12.xsd` exists. Download the official
 *      schema from
 *      https://www.fatturapa.gov.it/export/documenti/Schema_del_file_xml_FatturaPA_v1.2.1.xsd
 *      and save it to that path. See `reference/xml/README.md`.
 *
 * Usage:
 *   pnpm xml:validate
 *
 * Exits non-zero on any validation failure.
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function main() {
  const xsdPath = path.resolve("reference/xml/Schema_VFPR12.xsd");
  const fixturesDir = path.resolve("tmp/xml-fixtures");

  // Sanity: XSD must exist
  try {
    statSync(xsdPath);
  } catch {
    console.error(
      `Missing FatturaPA XSD at ${xsdPath}. See reference/xml/README.md.`
    );
    process.exit(2);
  }

  let files: string[];
  try {
    files = readdirSync(fixturesDir).filter((f) => f.endsWith(".xml"));
  } catch {
    console.error(
      `Missing fixtures directory at ${fixturesDir}. Run \`pnpm xml:fixtures\` first.`
    );
    process.exit(2);
  }

  if (files.length === 0) {
    console.error(
      `No fixtures found in ${fixturesDir}. Run \`pnpm xml:fixtures\` first.`
    );
    process.exit(2);
  }

  let failed = 0;
  for (const f of files) {
    const full = path.join(fixturesDir, f);
    const res = spawnSync(
      "xmllint",
      ["--noout", "--schema", xsdPath, full],
      { encoding: "utf8" }
    );
    if (res.status === 0) {
      console.log(`  ✓ ${f}`);
    } else {
      failed++;
      console.error(`  ✗ ${f}`);
      if (res.stderr) console.error(res.stderr);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed}/${files.length} fixtures failed XSD validation.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} fixtures pass XSD validation.`);
}

main();

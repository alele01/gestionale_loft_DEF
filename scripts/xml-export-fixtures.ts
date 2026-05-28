/**
 * Generate the XML fixtures under `tmp/xml-fixtures/`.
 *
 * Usage:
 *   pnpm xml:fixtures
 *
 * The script writes one `.xml` file per entry in `ALL_FIXTURES`. The
 * files are committed to `.gitignore` (see repo root) so the working
 * tree stays clean; upload them to https://www.fatturacheck.it/ for the
 * manual smoke test described in docs/QA_CHECKLIST.md.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildInvoiceXml } from "@/modules/xml-export";

import { ALL_FIXTURES } from "../src/modules/xml-export/__tests__/fixtures";

async function main() {
  const outDir = path.resolve("tmp/xml-fixtures");
  await mkdir(outDir, { recursive: true });

  const lines: string[] = [];
  for (const [name, input] of Object.entries(ALL_FIXTURES)) {
    const { filename, content } = buildInvoiceXml(input);
    const friendly = `${name}__${filename}`;
    await writeFile(path.join(outDir, friendly), content, "utf8");
    lines.push(friendly);
  }
  // eslint-disable-next-line no-console
  console.log(
    `[xml:fixtures] wrote ${lines.length} files to ${outDir}\n${lines
      .map((l) => `  - ${l}`)
      .join("\n")}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

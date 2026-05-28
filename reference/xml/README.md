# XML reference assets

This folder contains the artefacts the FatturaPA / SDI module relies on:

## `fattura reference.xml`

Sample of a valid FPR12 invoice supplied by the accountant (Studio Aliantis).
It is the canonical source of truth for the **element order** the generator
must respect. Treat it as binding — any structural deviation in
[`src/modules/xml-export/xml-builder.ts`](../../src/modules/xml-export/xml-builder.ts)
must be reviewed against this file first.

## `Schema_VFPR12.xsd` (not committed)

Official AdE schema for `versione="FPR12"`. Download it once from:

> https://www.fatturapa.gov.it/export/documenti/Schema_del_file_xml_FatturaPA_v1.2.1.xsd

and place it in this folder as `Schema_VFPR12.xsd`. It is gitignored so the
repo stays light.

The schema is consumed by [`scripts/xml-validate-fixtures.ts`](../../scripts/xml-validate-fixtures.ts),
which validates every generated fixture through `xmllint`. Without the
schema the validator script prints a hint and exits with code 2.

## Local validation pipeline

```bash
# 1. Generate fixtures into tmp/xml-fixtures/
pnpm xml:fixtures

# 2. Validate them against the AdE schema (requires xmllint)
pnpm xml:validate

# 3. Manual smoke test: upload the same files to https://www.fatturacheck.it/
#    Mark the results in docs/QA_CHECKLIST.md (XML SDI export section).
```

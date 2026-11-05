# Testing VERA

## Local checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run check:public
```

The current unit/integration suite contains 133 tests across 19 suites. It covers ingestion, signatures and page limits; evidence and approved-plan boundaries; source injection; numerical/unit parsing; private assessment projections; attempt-scoped solutions and PDFs; persisted responses; budgets and provider failures; bounded repair; figures; source binding; and vector responses. Controlled providers isolate orchestration tests from paid services.

A real original 51-page PDF was additionally extracted through the upload route with all page numbers/text preserved and all 51 page images rendered. No model calls were needed for that ingestion check. Large-course analysis tests cover section coverage, byte/image bounds, invalid citations, cancellation and approved-page generation context. Renderer normalization removes only known placeholder metadata and empty irrelevant drawing objects; substantive geometry conflicts still fail checks.

## Isolated browser checks

Use a separate credential-disabled workspace. Do not run mutation-oriented browser tests against a student's normal data.

After building, start a second server in a separate PowerShell terminal:

```powershell
$env:MODEL_API_KEY=''
$env:VERA_TEST_WORKSPACE='1'
$env:VERA_DATA_DIR='.vera/browser-tests'
$env:VERA_BUDGET_DIR='.vera/browser-tests'
$env:VERA_PORT='3001'
npm start
```

With Chrome installed, run the desired harness **serially** in another terminal:

```powershell
node scripts/browser-check.mjs
node scripts/browser-v2.mjs
node scripts/browser-preparation.mjs
node scripts/browser-illustrated.mjs
node scripts/browser-vector-response.mjs
node scripts/browser-muse-images.mjs
node scripts/browser-cleanup.mjs
node scripts/browser-pdf.mjs
```

These runners default to port 3001 and require the isolated test-workspace flag. They exercise upload/plan approval, keyboard and narrow-screen behavior, practice/recovery, image/source access, review and PDF export. Results and screenshots go to ignored `output/`. A prior complete browser regression covered 274 assertions; it predates the latest ingestion/metadata refinements and is not represented as a fresh live generation benchmark.

## Provider and evaluation checks

`npm run probe` exercises the actual configured account and uses paid Meta requests. Frozen comparison protocols, source hashes, retained failures, cost scope and denominators are documented in [MIT-EVALUATION.md](MIT-EVALUATION.md) and [OCW-EVALUATION.md](OCW-EVALUATION.md). Do not infer whole-exam verification from a few passing claims or relabel an older frozen candidate as the current engine.

Automatic checks establish software behavior and bounded correctness. Model visual review can miss invalid scientific symbols; source matching checks wording/location rather than interpretation. Student usability, expert essay quality and learning improvement require separate studies.

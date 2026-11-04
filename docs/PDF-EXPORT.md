# Readable PDF exports

Exam preview offers **Download PDF**. Review offers **Download review PDF** only for a server-submitted attempt. Question papers contain prompts, options, mathematics, writing space, vector response grids, relevant reference sheets, source names/pages and checking limits. Shared references print once; raster figures preserve their proportions. Submitted review PDFs add the actual server-saved response, drawn vectors, rubric, suggested solution and separate automatic/self-scored/pending labels. AI feedback is not silently incorporated into a grade.

The question-paper renderer first applies the explicit public assessment allowlist. It never serializes the private exam into the page, hides answers with CSS, or fetches an unsubmitted solution endpoint. Review authorization is checked at the API and document boundary. Export is a snapshot and does not sync paper answers to the app.

## Local rendering and setup

The application declares Playwright as a runtime dependency. It uses installed Chrome, falling back to Playwright Chromium (`npm run setup:pdf`). `VERA_PDF_BROWSER` optionally selects an absolute executable path. No agent runtime paths are required. Node 24 is recommended. PDF creation makes no Meta calls and has no model cost.

The server creates self-contained HTML with escaped evidence/question text, untrusted KaTeX commands disabled, embedded math fonts and hash-checked local PNGs. Chromium runs headless with JavaScript disabled, offline mode, blocked requests and restrictive document CSP. No source-supplied URLs or markup execute. One local render runs at a time; browser launch, document load and rendering have deadlines. Missing browsers/images, integrity failures and concurrent requests return a recoverable error. The API returns `application/pdf`, attachment disposition and `no-store`.

PDF layout uses print typography, a readable text measure, letter pages, numbered footers and vector SVG figures. Very long questions/references can span pages. It is not a form-filling or handwritten-answer import feature. Tagged Chromium output is helpful structure, not a PDF/UA accessibility certification.

## Validation

`npm test` covers key/solution/private-artifact canaries, submitted-only review, hostile source markup, rendered mathematics, source names, missing images, vector responses, safe download names and complete circle/path/segment data. `node scripts/browser-pdf.mjs` runs only against an isolated credential-disabled test server: actual downloaded PDF bytes/headers, preparation failures/retry, authorization, submitted review, narrow-screen export and no browser exceptions.

Private local renders in `output/pdf/` exercise the loaded linear-algebra diagnostic, historical-source analysis, Muse Image Physics copy and generated vector question. They include private source-derived content and are excluded from Git/distributable demonstration packets. Inspect page PNGs and extracted text after layout changes; passing HTML tests alone is insufficient. Final validation counts are recorded in `VALIDATION.md`.

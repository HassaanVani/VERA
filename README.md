# VERA

**Verified Exam and Revision Architect** — a standalone local assessment studio with original questions, coherent supporting exhibits, and visible checking results.

Materials → Exam plan → Practice → Review → Targeted practice.

## Run locally

Use **Node.js 24 LTS** (minimum 22.13). Older Node versions may require experimental SQLite flags; the launcher supplies those flags. VERA uses the built-in `node:sqlite` API.

```powershell
npm install --legacy-peer-deps
Copy-Item .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The launcher starts both Next.js and the durable local worker. It binds to loopback. Stop both with Ctrl+C. For a production build use `npm run build`, then `npm start`.

The `--legacy-peer-deps` installation option avoids a peer-resolution crash observed with npm 10.9. A lockfile is included. A clean installation can use `npm ci --legacy-peer-deps`.

Open **Explore a saved example** and choose **Try evidence & decisions**, **Explore diagrams & documents**, or **Try vector drawing**. Review and approve its plan, then load the saved demonstration. These original authored examples make **no Meta calls** and are not evidence of model quality. Legacy transformation-lab records remain readable.

## PDF downloads

Choose **Download PDF** in an exam preview. After submitting an attempt, choose **Download review PDF** from its review. The paper contains no answer keys or worked solutions; the review requires server-confirmed submission. References are printed once on named sheets, and vector questions include a coordinate grid. PDF export runs locally, without Meta calls or external network access.

Install Google Chrome, or install a separate Chromium runtime once:

```powershell
npm run setup:pdf
```

VERA first tries installed Chrome and then Playwright's Chromium. For a custom installation, set `VERA_PDF_BROWSER` to its absolute executable path. A missing browser or image produces a retryable error. A PDF is a snapshot; writing on it does not sync answers back to VERA. See [PDF behavior and validation](docs/PDF-EXPORT.md).

## Enable live Meta generation

Add `MODEL_API_KEY` to `.env.local`, leave `META_MODEL=muse-spark-1.3` as the candidate Standard-mode model, and restart. Run:

```powershell
npm run probe
```

The probe exercises text, a mathematical page image, and JSON-schema output with your account. It records its result under `output/meta-probe.json` and only marks the model capability-tested if all cases pass. A configured key is not proof of account access. Live text/image capability probes have passed on the development account. Cross-subject comparisons, independent arithmetic audits and limitations are documented in [OCW-EVALUATION.md](docs/OCW-EVALUATION.md). A passing probe is not a guarantee of exam quality.

See [Meta integration](docs/META.md) for supported API shapes, pricing, usage accounting, data-use settings, and failure behavior.

## Supported workflow

- Local PDF, PNG, and JPEG uploads: 8 files, 10 MB each, 30 MB / 40 pages per packet, and 180,000 extracted characters. Use focused excerpts, not an entire textbook.
- Explicit document roles, per-page text and images, source inspection, and exact normalized-text duplicate detection.
- Editable evidence-backed blueprint with observed/inferred/student-selected labels and citations validated against real uploaded pages.
- Versioned, subject-independent plans and exams with choice, numeric, short-answer, worked-response and essay questions. Optional diagrams now support exact segments/arrows, polygons, sampled polylines and circles; uploaded source passages retain page links and literal-excerpt checks. See [diagrams and retrieval](docs/DIAGRAMS.md) for supported bounds and limits. Legacy 2×2 transformation examples remain readable.
- One-question preview and practice, a bounded reading column, relevant reference sheets beside the question, a mobile question/reference switch and an optional hidden timer. Near-black surfaces use clear light-blue actions with dark labels.
- Select **Diagram rendering → Muse Image** in a live exam plan for agentic Meta image generation. Precise SVG remains available. Actual generated PNGs receive separate provisional visual review and stay outside the public directory. See the [image integration and retained trial results](docs/MUSE-IMAGE-TRIAL.md); circuit-symbol reliability remains limited.
- Structural, evidence-location, bounded arithmetic/polynomial, table/coordinate and legacy matrix checks; independent solving with the key withheld; provisional model review; and two bounded repair cycles with retained intermediate artifacts.
- Timed or untimed practice, server-acknowledged autosave with browser recovery, key-based choice/numeric grading, rubric-guided written self-scoring, reported feedback disputes and editable targeted plans requiring approval.
- Vector construction on a precise diagram using drag, touch start/end or exact coordinates, with saved geometry/explanation, refresh recovery and read-only rubric review. This is self-scored; arbitrary handwriting/raster annotation is not supported. See the [drawing and source-handling limits](docs/DIAGRAMS.md) and [real historical-source capability example](docs/HUMANITIES-CAPABILITY.md).
- Readable question-paper PDF downloads with mathematics, precise diagrams, Muse images and attributed reference sheets. Submitted attempts also support a review PDF with saved responses, solutions, criteria and separate automatic/self-score labels. Keys, worked solutions, rubrics, numeric grading specifications and review answers stay private until an attempt is submitted; solutions open through an attempt-scoped endpoint.

Course evidence is sent to Meta when you explicitly request analysis, generation or AI feedback; analysis also accompanies live generation in the benchmark. The app attaches extracted text and relevant rendered pages for analysis/generation. Pages carrying explicit rights-restriction notices are omitted from model inputs; this filter does not establish a blanket license for other pages. Unreadable or over-limit files are rejected with an error. Uploaded content is not application instructions. AI-generated reference material is excluded from course analysis.

## Data and execution

All local data lives in ignored `.vera/` by default:

- `vera.sqlite` in WAL mode: packets, blueprint revisions, jobs, exams, attempts, feedback/disputes, intermediate pipeline artifacts and model probes.
- `budget.sqlite`: shared usage reservations and persistent additional-evaluation spending caps. Legacy app and MIT-evaluation ledger entries are imported idempotently; source databases remain intact. Set `VERA_BUDGET_DIR` consistently when using a custom data directory.
- `uploads/<packet-id>/<document-id>/`: original files and rendered page images.
- `generated-images/<asset-id>.png`: private generated figures, exposed only through their linked assessment's local image endpoint. Specifications, hashes, image reviews and repair provenance are retained in SQLite.

The background worker claims one local SQLite lease and processes jobs sequentially. Heartbeats keep the lease active. A new worker marks previously running jobs interrupted and preserves uncertain cost reservations. Source packets and blueprint revisions survive refreshes and process restarts. Queued jobs run when the worker reconnects. Cancellation aborts an active provider call and prevents result publication.

No Google, Firebase, Stripe, or JEFF service access is required. This is a single-user local application, not a production multi-user deployment. There is no account system or shared hosting configuration. Use the UI to inspect sources; the API does not accept arbitrary filesystem paths.

## Validation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run evaluate
```

`npm run evaluate` performs three paired direct-Meta/VERA attempts against the frozen original development source, keeping every failure. It estimates maximum batch call counts before running and writes artifacts to `output/evaluation/`. Without a key it writes a **pending-credentials** report and makes no requests. Human grading remains required for conceptual correctness, semantic originality, and topic alignment. It is a small development comparison, not a held-out instructor evaluation or a learning-outcome study.

See [validation results and limitations](docs/VALIDATION.md), [demo narrative](docs/DEMO.md), and [reuse disclosure](docs/FOUNDATIONS.md).

The optional `scripts/browser-check.mjs` uses Playwright. Supply `VERA_PLAYWRIGHT_MODULE` and `VERA_BROWSER_EXECUTABLE` to use an existing installation, or install Playwright and Chromium separately. It runs against the local server and writes screenshots and a report to `output/browser/`. It expects a local workspace without a configured Meta key for its missing-key recovery case and creates clearly named test packets.

See [interface research and overhaul](docs/UI-OVERHAUL.md) for the design rationale, source references, and UX copy decisions.

## Known limits

- Subject-independent generation is available, with initial cross-subject evaluation on four selected OCW courses. This does not establish reliable coverage of every subject. Plans currently support up to 12 top-level questions and 200 points; use focused practice rather than promise full-exam equivalence.
- Deterministic checks verify bounded structured claims and locations; they do not prove formula relevance, factual entailment or every written step. The model passes can share failure modes. Unsupported reasoning is explicitly unverified; known blocking failures prevent practice.
- Originality checking uses lexical overlap. It cannot guarantee a new reasoning structure or detect every paraphrase.
- Duplicate detection requires substantial identical normalized text. It does not match all different scans or extractors.
- Vision can misread mathematical notation. Users should inspect citations and final answers.
- Written scores are self-reported; AI feedback never changes automatic scores. Practice results do not establish mastery or learning gains.
- No automatic free-response grading, cloud synchronization, or public access controls are included.
- Hackathon submission readiness is pending confirmation of the official pre-existing-code rules; the public event overview did not establish that policy.

The builder's supplied textbook and JEFF-generated exam are not redistributed. The JEFF exam is excluded from instructor-format inference and held-out evaluation.

Interaction principles and the research-to-implementation audit: [UX.md](UX.md) and [UX-RESEARCH.md](docs/UX-RESEARCH.md).

Live evaluation on public course material: [MIT OpenCourseWare protocol and results](docs/MIT-EVALUATION.md). Worker and evaluation commands accept ignored .env or .env.local files.


## Cross-subject evaluation

The reproducible development/final comparison covers linear algebra, microeconomics, psychology and history. History evaluates writing support without an official key. No fine-tuning is performed. Frozen sources, candidate hashes and public summaries live under `fixtures/ocw-cross-subject/`; raw PDFs, prompts, outputs and private databases remain ignored.

    npm run evaluate:ocw -- status
    npm run evaluate:feedback -- <unique-feedback-batch>

See [OCW-EVALUATION.md](docs/OCW-EVALUATION.md) for preparation, freezing, paid-run commands, verification coverage and interpretation. Reproduction consumes budget and requires new batch IDs. The first additional campaign is capped at USD 20 inside the existing USD 90 development allocation; the USD 30 reserve remains locked.

The original demo narrative is in [DEMO.md](docs/DEMO.md), and API/checking boundaries are in [ASSESSMENT-V2.md](docs/ASSESSMENT-V2.md). Browser runners (`scripts/browser-check.mjs`, `scripts/browser-v2.mjs`, `scripts/browser-cleanup.mjs`) require a credential-disabled server with `VERA_TEST_WORKSPACE=1` and a `VERA_DATA_DIR` different from the normal `.vera` directory. Set a separate `VERA_BUDGET_DIR`, use port 3001 and point `VERA_TEST_URL` there. They refuse the normal workspace before creating records.

## Remove old development data from the library

Old saved examples and byte-matched browser smoke-test uploads can be archived reversibly. Preview the exact candidates first:

```text
node --experimental-sqlite --import tsx scripts/archive-development.ts
node --experimental-sqlite --import tsx scripts/archive-development.ts --apply
node --experimental-sqlite --import tsx scripts/archive-development.ts --restore <course-id>
```

Archiving writes visibility metadata and a private manifest under the data directory. It preserves the source records, uploads, attempts, verification history and spending. The command only selects known authored demonstration names or the exact browser-test name/file bytes; unrelated real courses stay visible. Existing links to archived courses show an unavailable-course message rather than selecting a different course.

## Reproduce the silent workflow preflight

This recording is a software check, not the final narrated submission video. It uses original authored examples and makes no Meta requests. In a separate PowerShell terminal after building:

```powershell
$env:MODEL_API_KEY=''
$env:VERA_TEST_WORKSPACE='1'
$env:VERA_DATA_DIR='.vera/demo-preflight'
$env:VERA_BUDGET_DIR='.vera/demo-preflight'
$env:VERA_PORT='3001'
npm start
```

In another terminal with Chrome installed:

```powershell
npx playwright install ffmpeg
node scripts/record-demo.mjs
```

The recorder refuses a normal or credential-enabled workspace. Output is ignored under `output/demo-preflight/`: a captioned WebM, original question paper, submitted review and scene/error report. It creates its own authored example, completes only that isolated attempt and leaves the follow-up unapproved. Use a fresh test workspace and run browser suites serially because some existing harnesses assume their attempt is the latest record.

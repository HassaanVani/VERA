# VERA

**Verified Exam and Revision Architect** — a standalone local assessment studio with original questions, coherent supporting exhibits, and visible checking results.

Upload → Understand → Blueprint → Generate → Check → Practice → Improve.

## Run locally

Use **Node.js 24 LTS** (minimum 22.13). Older Node versions may require experimental SQLite flags; the launcher supplies those flags. VERA uses the built-in `node:sqlite` API.

```powershell
npm install --legacy-peer-deps
Copy-Item .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The launcher starts both Next.js and the durable local worker. It binds to loopback. Stop both with Ctrl+C. For a production build use `npm run build`, then `npm start`.

The `--legacy-peer-deps` installation option avoids a peer-resolution crash observed with npm 10.9. A lockfile is included. A clean installation can use `npm ci --legacy-peer-deps`.

Click **Open sample course** to load VERA's original synthetic development packet. Review and approve the exam plan, then generate the **saved demonstration**. This path makes **no Meta calls**, and every relevant view labels it as such. The authored fixtures are not evidence of model quality. Edit fixture settings to explore the workflow; fixture questions remain examples in the supported linear algebra domain.

## Enable live Meta generation

Add `MODEL_API_KEY` to `.env.local`, leave `META_MODEL=muse-spark-1.3` as the candidate Standard-mode model, and restart. Run:

```powershell
npm run probe
```

The probe exercises text, a mathematical page image, and JSON-schema output with your account. It records its result under `output/meta-probe.json` and only marks the model capability-tested if all cases pass. A configured key is not proof of account access. **The initial implementation environment had no exposed Meta key**, so live capability/quality evaluation is pending; no model performance claims are made.

See [Meta integration](docs/META.md) for supported API shapes, pricing, usage accounting, data-use settings, and failure behavior.

## Supported first workflow

- Local PDF, PNG, and JPEG uploads: 8 files, 10 MB each, 30 MB / 40 pages per packet, and 180,000 extracted characters. Use focused excerpts, not an entire textbook.
- Explicit document roles, per-page text and images, source inspection, and exact normalized-text duplicate detection.
- Editable evidence-backed blueprint with observed/inferred/student-selected labels and citations validated against real uploaded pages.
- A shared 2×2 transformation scenario, exact programmatic measurement tables and SVG diagrams, MC/free-response questions, worked solutions, and marking rubrics.
- Structural checks, numerical claims, an independent solve with the answer key withheld, a separate solution comparison, and two bounded targeted repair cycles.
- Timed practice, locally autosaved answers, deterministic MC scoring, rubric-guided self-scoring, and follow-up for the lowest-scoring topics.
- JSON export of an assessment, its scenario, solutions, and checking report.

An uploaded packet is sent to Meta only when you request analysis. The app attaches page images as well as extracted text so matrix layout is available to the model. Unreadable or over-limit files are rejected with an error. Uploaded content is not application instructions. AI-generated reference material is excluded from course analysis.

## Data and execution

All local data lives in ignored `.vera/` by default:

- `vera.sqlite` in WAL mode: packets, blueprint revisions, jobs, exams, attempts, model probes, and usage.
- `uploads/<packet-id>/<document-id>/`: original files and rendered page images.

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

- First domain: real 2×2 linear algebra transformation scenarios. Physics II and broad course generation are deferred.
- Deterministic checks verify structured numerical claims and derived exhibits; they do not prove every statement in a model's prose. The separate model passes can share failure modes.
- Originality checking uses lexical overlap. It cannot guarantee a new reasoning structure or detect every paraphrase.
- Duplicate detection requires substantial identical normalized text. It does not match all different scans or extractors.
- Vision can misread mathematical notation. Users should inspect citations and final answers.
- Free-response scores are self-reported; practice results do not establish mastery or improved learning.
- No PDF export, automatic free-response grading, cloud synchronization, or public access controls are included.
- Hackathon submission readiness is pending confirmation of the official pre-existing-code rules; the public event overview did not establish that policy.

The builder's supplied textbook and JEFF-generated exam are not redistributed. The JEFF exam is excluded from instructor-format inference and held-out evaluation.

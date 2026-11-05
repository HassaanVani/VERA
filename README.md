# VERA

**Verified Exam and Revision Architect** — a local assessment studio that turns course materials into an editable exam plan, practice, review, and targeted revision.

**Materials → Exam plan → Practice → Review → Targeted practice**

## Run locally

Use Node.js 24 LTS (minimum 22.13).

```powershell
npm ci --legacy-peer-deps
Copy-Item .env.example .env.local
npm run dev
```

Open [localhost:3000](http://127.0.0.1:3000). The launcher starts Next.js and a durable local worker. For a production build, run `npm run build`, then `npm start`.

For real generation, add `MODEL_API_KEY` to `.env.local`, confirm the configured Meta model identifiers, and restart. Credentials stay server-side. `npm run probe` tests text, mathematical image inputs, and structured output with the configured account; it makes paid requests. See [Meta integration](docs/META.md).

**Explore a saved example** offers original authored examples without API calls: evidence-based questions, diagrams and documents, and vector drawing. These examples demonstrate software behavior separately from model output quality.

## What VERA does

- Accepts PDF, PNG and JPEG materials with explicit roles and original page references. Limits: eight files, 10 MB each, 30 MB per course, 200 pages, and 600,000 extracted characters. Large materials are analyzed in sections; generation uses the approved plan's cited pages.
- Builds subject-independent plans with topics, objectives, question formats, points, time and evidence. Changes require approval before generation.
- Generates multiple-choice, numeric, short-answer, worked-response and essay questions. Optional exhibits include tables, exact SVG geometry, source passages and Meta Muse Image figures.
- Runs supported deterministic checks, separate key-withheld solving, model comparison and up to two targeted repair cycles. Displays per-question checking coverage and retained run evidence.
- Supports timed/untimed practice, autosaved responses, refresh recovery, flags and submission review. Solutions remain private until submission.
- Supports bounded vector drawing with pointer, touch and exact coordinates. Written/drawn work uses rubric self-scoring; objective key matches remain separate.
- Exports readable question-paper and submitted-review PDFs, then proposes editable focused practice.

## PDF export

Install Google Chrome or run:

```powershell
npm run setup:pdf
```

Choose **Download PDF** in exam preview, or **Download review PDF** after submission. The question paper omits generated keys and worked solutions. A custom browser path can be set with `VERA_PDF_BROWSER`. Export runs locally. See [PDF behavior](docs/PDF-EXPORT.md).

## Data and execution

Uploaded documents, generated figures, SQLite databases, responses, private model artifacts and usage records live under ignored `.vera/` by default. Set `VERA_DATA_DIR` and `VERA_BUDGET_DIR` for custom locations. Materials are sent to Meta when analysis, generation or AI feedback is requested. Model identifiers, spending reservations, deadlines, retries and cancellation are handled server-side.

VERA binds to loopback and has no public account/access-control system. A public source repository is separate from a publicly hosted application. Keep `.env`, local study data and private production notes outside Git.

## Verify and evaluate

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run check:public
```

[Testing documentation](docs/TESTING.md) covers meaningful regressions and isolated browser checks. Reproducible source-frozen comparisons against direct Meta generation are documented in [MIT evaluation](docs/MIT-EVALUATION.md) and [cross-subject evaluation](docs/OCW-EVALUATION.md). Their commands make paid calls, retain failures and use the shared spending ledger. The evaluations are not model fine-tuning.

## Checking scope

Deterministic checks establish bounded calculations, supported structure and source locations. Model reviews can share mistakes and remain separate from those checks. Unsupported reasoning is labeled; known blocking errors prevent practice. Originality uses lexical checks rather than a guarantee. Written scores are self-reported. Equivalent exam difficulty, expert essay correctness and learning gains have not been established.

## Technical documentation

- [Assessment contracts and solution access](docs/ASSESSMENT-V2.md)
- [Meta adapters and usage accounting](docs/META.md)
- [Diagrams, vector responses and source passages](docs/DIAGRAMS.md)
- [Design rationale](docs/DESIGN.md) and [interaction rules](UX.md)
- [Testing and regression scope](docs/TESTING.md)
- [Foundations and reuse disclosure](docs/FOUNDATIONS.md)

Raw course packets and private study records are not distributed. Original authored examples are included. Third-party dependencies and fonts retain their own licenses; JEFF foundations are disclosed separately.

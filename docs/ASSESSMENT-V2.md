# Subject-independent assessments and feedback

New live analyses produce schema version 2. Subject is a string rather than a linear-algebra discriminator. Plans retain evidence-backed observations, explicit setting origins, objectives, sections, question formats, points and minutes. The current focus limit is 12 top-level questions, 200 points and 180 minutes; subparts must sum to their parent item's points. This is a focused-practice interface, not a promise to reproduce an arbitrarily large instructor exam.

## Compatibility and public API

Old JSON records remain readable without being rewritten on read. Legacy `free-response` items and transformation scenarios keep their historical checking status. New checks are not retroactively claimed for a legacy record.

- `GET /api/workspace` returns public assessment projections. An explicit allowlist omits keys, solutions, rubrics, numeric grading specifications, claims, independent model answers, private diagnostic values and scenario eigenpairs. Public TypeScript types are distinct from private assessment types.
- `POST /api/attempts` accepts `examId` and `mode` (`timed` by default, or `untimed`). An existing open attempt is resumed. Mode cannot be changed through answer updates. Untimed attempts have no deadline in the UI or server submission logic.
- `GET /api/attempts/:id/solutions` requires server-confirmed submission of that specific attempt. It returns the private assessment, persisted criterion feedback and provisional AI suggestions. Merely reaching a deadline does not unlock solutions until the attempt is closed on the server.
- `POST /api/attempts/:id/feedback` queues one background feedback job. It requires a submitted attempt. Suggestions must quote actual saved answer text, reference a real rubric criterion and use permitted question-level source pages. They remain model suggestions; no score update is accepted from this pipeline.
- `POST /api/feedback/:id` appends a feedback report with `reason`. The original feedback text, checker/model version, response hash and any model job ID remain linked. Reports never change automatic scores.
- `POST /api/follow-up` returns an unapproved revision, not an automatically generated exam. It selects missed objectives using key-based and self-reported scores. If no points were missed, the proposal explicitly requests transfer practice. Approval is required before queuing generation.
- `POST /api/packets/:id/roles` changes a document role and invalidates plan approval. Active operations must finish or be cancelled first.

These endpoints retain loopback-host validation, local-request write headers, request-size limits and server-side credentials. The application is single-user and local; these are not account-level access controls for public hosting.

## Verification capabilities

Every new result records a question, claim index, method, result, artifact, checker version and limitation. Results are `passed`, `failed`, or `unsupported`. Each question also carries an explicit unsupported written-reasoning result so a few true numeric claims cannot be mistaken for complete verification.

| Method | What it checks | What it does not establish |
| --- | --- | --- |
| Arithmetic | Bounded expressions with numbers, parentheses, arithmetic operations and integer powers | That the chosen formula models the question correctly |
| Polynomial | One-variable identities through degree six, with division by constants and floating-point coefficient tolerances | General symbolic equivalence, domains with poles, or proofs |
| Numeric answer | Key match with stated absolute/relative tolerance and required unit | Physical dimensional correctness or implicit unit conversion |
| Source location | Existing permitted document/page and normalized quotation presence | Entailment, relevance or interpretation |
| Exhibit consistency | A declared table cell or coordinate matches the shared data | All numerical prose in the question or exhibit |
| Legacy matrix | Real 2×2 products, determinant, trace and eigenpair residuals | General-dimensional matrix reasoning |

Numeric items require a matching, successfully checked arithmetic claim before entering practice. Choice and numeric grading are explicitly all-or-nothing key matches; method-based partial credit requires a written-response format. Model-authored method criteria are a review guide, not automatically graded derivations. Choice grading means a match to the published key; semantic correctness still depends on the quality of that key. Written grading remains rubric-guided self-report. Unsupported reasoning is visible and available for practice; known blocking errors prevent readiness.

Shared passages, tables and coordinate diagrams are optional. Text is rendered as text/KaTeX with trust disabled; diagrams are generated from structured coordinates, not model-authored executable SVG or HTML. Tables and coordinate lists share one assessment data object. Checks reject missing references, inconsistent table dimensions, duplicate IDs, known answer-bearing labels and declared data contradictions.

Originality defenses include exact duplicate stems, eight-word overlap warnings and known serialized matrix reuse. They do not extract every mathematical dataset from every PDF, prove semantic novelty or detect all answer hints. The model review remains a separate provisional consistency check and can share the generator's mistakes.

## Persistence and recovery

Worked-response questions may optionally carry a public, answer-free `responseDiagram` configuration when their approved slot selects vector drawing. `VERA_VECTOR_V1:` response strings contain a version, bounded vector endpoints and reasoning; existing text responses remain readable. The server rejects malformed/non-finite/out-of-bounds/excessive vectors before storing the patch. The same autosave, browser backup, server acknowledgment, submission lock and self-scoring flow applies. A missing drawing is not a successful automatic answer. Review reconstructs the saved vectors; provisional feedback quotes a readable coordinate description and still cannot assign points. See [DIAGRAMS.md](DIAGRAMS.md).

The records database stores plans, revisions, immutable stage outputs, deterministic snapshots, independent solutions, comparison results, repair replacements and feedback. Every repair cycle retains its before/replacement records; no more than two cycles are permitted. Completion checks cancellation inside the publication transaction. An interrupted provider call retains uncertain spending rather than assuming it was free.

The shared budget database imports old app and MIT-evaluation usage rows by ID, without rewriting either source database. New reservations use one SQLite transaction across concurrent app/evaluation calls. The additional OCW campaign has a persistent USD 20 cap within the USD 90 development allocation. A repeated process or new batch name does not reset that cap; original USD 30 demo and reserve allocations remain protected.

Browser backup remains separate from server-saved responses. Feedback reports preserve typed text after a failed save. Simultaneous editing of the same attempt in several tabs is not coordinated, and storage availability is not guaranteed.

## Source handling

Source roles and original page numbers are preserved. PDF preparation can select focused pages internally while retaining the original one-based references. Rights-notice filtering omits an entire page from future model requests when it explicitly says that material is excluded from the Creative Commons license or all rights are reserved. The filter is conservative and cannot establish the rights status of every other page. The original private file remains available for source inspection; the filter does not edit it.

No fine-tuning is performed. Official solutions in benchmark packets stay separate from generation sources. A valid official key is useful evidence, but reference conflicts must remain visible rather than silently changing the source or presenting key agreement as complete truth.

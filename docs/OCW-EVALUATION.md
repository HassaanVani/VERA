# Cross-subject OCW evaluation — November 3, 2026

VERA now uses subject-independent assessment contracts. This evaluation tests selected materials from linear algebra, microeconomics, psychology and history; it does not establish reliable performance on every subject. No fine-tuning was performed. The [public machine-readable summary](../fixtures/ocw-cross-subject/results-2026-11-03.json) contains denominators, hashes, per-run statuses and reconciled costs without redistributing source PDFs or full model/student responses.

## Design and source separation

Eight focused packets were frozen before paid comparisons: one development packet and a separate evaluation packet for each course. Published metadata includes original download URLs, file hashes and selected one-based PDF pages. Rebuilding those eight packets in a separate directory reproduced every normalized packet hash. Raw instructor questions and solutions were downloaded into private storage; the harness extracts a target question only after every generation attempt for that phase is saved. Official keys never enter generation inputs.

| Course | Generation evidence | Evaluation reference and limits |
| --- | --- | --- |
| [18.06 / 18.06SC Linear algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/pages/exams/) | Focused eigenvalue/determinant summaries and separate excerpts of a prior quiz | Development Quiz 2 and final-phase Quiz 3. The earlier Quiz 2 was already inspected in the preceding exploratory evaluation. Cross-semester notes do not support chronological prediction claims. |
| [14.01SC Microeconomics](https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011/) | Midterm summary notes and practice-exam excerpts, using separate units for each phase | Real midterms have broader conceptual, mathematical and graphical requirements than the selected three-question practice. |
| [9.00SC Psychology](https://ocw.mit.edu/courses/9-00sc-introduction-to-psychology-fall-2011/) | Research-method and memory lecture excerpts plus prior exam excerpts | References are the corresponding full course exams; historical course framing and possible key conflicts remain relevant. |
| [21H.001 History](https://ocw.mit.edu/courses/21h-001-how-to-stage-a-revolution-fall-2013/pages/lecture-notes/) | Separate focused lecture-note excerpts on imperial conflict and race/revolution | Writing assignments, not keyed exams. No automatic expert essay grade is claimed. |

Attribution: Gilbert Strang; Jonathan Gruber and William Wheaton; John D. E. Gabrieli; Craig Steven Wilder, Malick Ghachem and Jeffrey S. Ravel; and MIT OpenCourseWare. Source notices and [MIT's terms](https://ocw.mit.edu/terms/) apply; MIT does not endorse VERA. Some lecture pages contain material expressly excluded from the course's Creative Commons license. The initial development run preceded the new notice filter. The final candidate omits pages carrying explicit rights-restriction notices from model inputs. This heuristic does not establish rights for every other page. Original private files and notices remain intact; none form part of the distributable demo packet.

Both candidates use Muse Spark 1.3 Standard mode, low reasoning, a 16,000-token output ceiling, identical explicit target settings, and the same permitted course evidence. Each target requests three questions, 30 points and 30 minutes, with subject-appropriate formats. These student-selected settings do not measure instructor-format inference accuracy or reproduce full exam coverage. Direct generation makes one structured generation call. VERA additionally analyzes sources, solves independently with the key withheld, compares solutions and permits two repair cycles. Both final artifacts receive common deterministic checks. Extra compute is part of the workflow comparison.

There were two development pairs per course, followed by three final pairs per course. Order alternates within each course; two courses run concurrently. All completed, failed and blocked attempts remain in the denominator. The development evidence informed schema, prompt and checking changes. The candidate was frozen before the final run, and every frozen implementation hash still matches. No candidate generation/checking code was tuned against the final outcomes. Later UI/service fixes do not alter these frozen generation files.

Public course material may have appeared in pretraining. This is a small exploratory workflow comparison, not a contamination-free prospective exam prediction, a representative benchmark or a learning-outcome study.

## Results

| Phase | Candidate | Common software checks passed | Mean elapsed time, failures included | Generation cost |
| --- | --- | --- | --- | --- |
| Development | Direct Meta | 5/8 | 31.9 s | $0.2054 |
| Development | VERA | 6/8 | 160.2 s | $1.0014 |
| Frozen final | Direct Meta | 10/12 | 29.9 s | $0.3019 |
| Frozen final | VERA | 12/12 | 96.5 s | $0.9883 |

| Final course | Direct Meta | VERA |
| --- | --- | --- |
| Linear algebra | 3/3 | 3/3 |
| Microeconomics | 1/3 | 3/3 |
| Psychology | 3/3 | 3/3 |
| History writing support | 3/3 | 3/3 |

The final pairwise difference is **software readiness on these packets**, not a demonstrated overall accuracy advantage. Both blocked direct-generation outputs failed source-quotation checks. A missing literal match can reflect invented/paraphrased quoting or extraction differences; it is not by itself proof of an incorrect economic explanation. Six VERA final outputs used one repair cycle; the others used none. Intermediate requests, responses, check snapshots, independent solutions and repair replacements are retained privately.

The independent Python AST/Fraction audit checked 17 mathematical claims in development: 16 passed and one arithmetic error failed. Thirteen additional mathematical claims were unsupported. In the final cohort, **27/27 supported mathematical claims passed**, with **two unsupported claims**. Only 20 of the 72 final questions contained a successfully checked numerical claim. Every question's complete written reasoning remains outside automatic proof verification. This limited coverage is intentional and visible in the product.

No eight-word source-overlap warnings were raised. That does not establish semantic originality, diverse reasoning structures or freedom from answer hints. Source-reference resolution does not establish factual entailment. Qualitative comparison with real assessments was performed by a model and is provisional; full raw judgments stay local. The real references span broader topics, formats and reasoning demands than the focused practice targets. No equal-difficulty claim is made.

## Feedback reliability and a reference conflict

Twelve VERA-authored controlled responses per course cover correct/incorrect intent, partial, blank, alternative and ambiguous responses. These are not copied MIT exam questions. Written-case category labels describe the intended test scenario, not an expert grade on the sample prose.

- **48/48 scoring-boundary controls passed** in the application and an independent Python audit.
- **18/18 objective keys passed** independent arithmetic or literal source-word checks. The psychology control is deliberately a source-location question, not a broad conceptual correctness test.
- All 48 model suggestions passed publication validation for actual-answer excerpts, rubric criteria and permitted page references. Scores remained unchanged. These checks do not prove the suggestions were helpful, conceptually correct or entailed by the cited passage.
- Written and essay responses stayed ungraded automatically. Automatic choice/numeric grades are explicitly all-or-nothing key matches; method-based partial credit requires a written format.

After all 24 final generation artifacts were saved, a separate post-hoc probe solved four questions on the actual psychology Exam 2, with its key withheld. The official colored answers were visually inspected and transcribed before the call. Raw key agreement was **3/4**. One item was quarantined before the solve: the official key's chess-memory answer conflicts with the direction described in [primary research on random-position recall](https://pubmed.ncbi.nlm.nih.gov/24213863/). The model selected a different option, but that does not establish its interpretation as conclusively correct. Agreement on the three non-quarantined items was 3/3. This is reference agreement on a tiny selected sample, not a full MIT grade or VERA generation score. The reference remains unchanged and the conflict remains visible for expert review.

## Budget and reproduction

Meta Spark Standard pricing was rechecked on November 3, 2026: $1.25/M input and $4.25/M output; cache discounts are ignored conservatively. [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits).

| Work | Accounted cost, attributed by persisted job IDs |
| --- | --- |
| Development generation and provisional alignment | $1.25056725 |
| Final generation and provisional alignment | $1.33532375 |
| Four feedback-control calls | $0.078146 |
| Supplemental reference solve | $0.008812 |
| **Additional campaign total** | **$2.672849** |

Lifetime recorded usage is $3.7845685, including $1.1117195 from preceding work; zero calls remain uncertain/reserved at this audit. The persistent additional cap is $20 inside the existing $90 development allocation. The $30 demo allocation and $30 reserve remain protected. These are application token/reservation estimates, not a billing-dashboard reconciliation.

Development generation and feedback ran concurrently. Their raw before/after ledger-window totals overlap and must not be added. The public report reconciles ownership using persisted job IDs; historical raw reports were not rewritten to conceal the overlap.

For a clean checkout, use the required Node version, configure ignored server credentials and restore the published inputs without overwriting the public freeze:

```text
npm run evaluate:restore
npm run evaluate:ocw -- status
npm run evaluate:ocw -- final <unique-final-batch>
python scripts/audit-ocw.py output/ocw-cross-subject/<unique-final-batch>
npm run evaluate:feedback -- <unique-feedback-batch>
python scripts/audit-feedback.py output/ocw-feedback/<unique-feedback-batch>
```

Each paid rerun needs a new output directory; it cannot replace existing artifacts or reset the persistent cap. Current source bytes, packet hashes, model settings and candidate hashes must match. Use `prepare` only when creating a new unpublished protocol; `evaluate:restore` is the tested route for the published corpus. The optional restore `--root=<ignored-directory>` verifies a separate reconstruction without affecting the active freeze. Generation and feedback use isolated records but share the app's budget ledger.

`scripts/ocw-reference.ts <completed-final-batch>` performs the separately labeled reference probe. `scripts/report-ocw.py` recomputes public summaries and cost ownership without exporting raw course or student content. Keep final-generation metrics distinct from that post-hoc probe and from development controls.

The next evidence needed for stronger claims is independent subject review of reasoning, rubrics and feedback, plus actual student usability and retention studies. Automated regression passes do not substitute for either.

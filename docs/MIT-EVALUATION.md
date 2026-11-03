# MIT OpenCourseWare exploratory evaluation

This evaluation uses course materials attributed to Gilbert Strang and MIT OpenCourseWare. It does not imply MIT endorsement. Sources carry their resource notices and MIT OCW's [CC BY-NC-SA terms](https://ocw.mit.edu/terms/). Downloaded PDFs, extracted text, page images, and full generated artifacts stay in ignored local storage; they are excluded from the distributable demonstration packet. No model training or fine-tuning is performed.

## Questions being tested

1. Can VERA ingest real mathematical lecture pages and prior instructor assessment material with page provenance?
2. Under identical sources, model settings, and student-selected slots, how often do direct Meta generation and VERA's generation/review/repair pipeline produce an exam that passes the software checks?
3. Are generated scenario values and numerical claims correct under a separate exact-arithmetic implementation?
4. How does this constrained practice differ from an actual MIT test in coverage and reasoning demands?

The test is exploratory. The evaluator inspected the held-out exam while designing the comparison; it is withheld from generation calls, not unknown to the evaluator. Public course materials may have appeared in the model's training. This is not a prospective exam prediction, a representative benchmark, or a learning-outcome study.

## Source separation

The allowed generation packet has 13 pages:

- [18.06SC Fall 2011, Lecture 21 summary](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/resources/mit18_06scf11_ses2-8sum/): eigenvalues, eigenvectors, trace, and related matrix action.
- [18.06SC Fall 2011, Lecture 18 summary](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/resources/mit18_06scf11_ses2-5sum/): determinants and their properties.
- [18.06 Spring 2010, Quiz 1](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/resources/mit18_06s10_exam1_s10/): prior instructor assessment evidence.

[18.06 Spring 2010, Quiz 2](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/resources/mit18_06s10_exam2_s10/) and its [official solutions](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/resources/mit18_06s10_exam2_s10_soln/) are evaluation-only files. They never enter the generation packet. The harness extracts the target question text only after all six generation attempts are saved. The official key is reserved for reference checking and is not sent to the generation pipeline.

The lecture summaries are from 2011 and the assessments from 2010. This cross-semester selection supports development evaluation, not a claim about information available before a 2010 exam.

## Frozen design

The protocol and source hashes live in `fixtures/mit-ocw/`. The downloaded files are checked against those hashes. Changing a frozen source or protocol stops execution. Each live run requires a new batch ID and cannot overwrite an existing result directory. Failures, including missing outputs and unresolved exams, remain in the denominator.

There are three pairs, with candidate order alternating. Both arms use Muse Spark 1.3 Standard mode, identical source text/page images, the same schemas, and explicit student-selected settings: three written questions, 100 points, 60 minutes, confined to real 2×2 determinants/trace, eigenpairs, and transformation reasoning. These settings override the prior paper's structure and do not establish instructor-format inference accuracy.

Direct Meta makes one structured generation request. VERA additionally analyzes evidence, builds the shared scenario, runs deterministic checks, solves independently with the answer key withheld, compares solutions, and permits two targeted repair cycles. This compares workflows with different compute and cost. Both final outputs receive the same deterministic checks; VERA's internal model review is not treated as an external ground-truth grade.

Pricing was checked against [Meta's pricing page](https://dev.meta.ai/docs/pricing-rate-limits) on November 3, 2026: Spark Standard input USD 1.25/M and output USD 4.25/M. The run reserves uncertain charges and has a USD 12 batch ceiling within the development allocation. Evaluation uses a separate SQLite data directory; reconcile its ledger with the application's ledger when tracking the overall USD 90 development allocation. The evaluation cap is not an additional allocation.

## Reproduction

Use the project-required Node version. Put credentials in ignored `.env` or `.env.local`; existing shell variables take precedence. The worker and CLI tools now use the same Next.js environment loader as the application.

```text
npm run evaluate:mit -- prepare --profile=configured-v2
npm run evaluate:mit -- status --profile=configured-v2
npm run evaluate:mit -- run <unique-batch-id> --profile=configured-v2
```

`prepare` downloads frozen PDFs and renders the allowed sources through VERA's normal ingestion path. Run it once for the protocol ID; it refuses to overwrite an existing freeze. `run` makes paid calls and writes every attempt to `output/mit-ocw/<batch-id>/`. The frozen protocol, recorded candidate order, hashes, failures, timing, usage snapshots, and final metrics must be retained together.

## Interpretation

The reference quiz requires 3D projection geometry, general least-squares and QR reasoning, and properties of an n-by-n matrix family. VERA's current domain only supports a narrower 2×2 scenario. Matching question count, point total, or duration is not evidence of matching topic coverage or difficulty.

Numerical claims can be checked automatically. Correct claims can coexist with incorrect prose, missing explanations, or weak rubrics. Full conceptual correctness, difficulty equivalence, and semantic originality require independent expert review. Low lexical overlap is not proof of originality. Three pairs on one selected source packet do not establish general superiority.

## November 3, 2026 results

The immutable initial batch is first-live-2026-11-03; the separate configuration follow-up is configured-v2/configured-2026-11-03. The [machine-readable summary](../fixtures/mit-ocw/results-2026-11-03.json) records both, including hashes and limitations. Raw artifacts remain in their ignored output directories.

| Configuration | Candidate | Software checks passed | Mean elapsed time, failures included | Total accounted cost |
| --- | --- | --- | --- | --- |
| Initial: 9,000 output tokens, automatic reasoning | Direct Meta | 0/3 | 56.8 s | $0.2258 |
| Initial: 9,000 output tokens, automatic reasoning | VERA | 0/3 | 106.1 s | $0.3273 |
| Follow-up: 16,000 output tokens, low reasoning | Direct Meta | 3/3 | 24.2 s | $0.1547 |
| Follow-up: 16,000 output tokens, low reasoning | VERA | 3/3 | 104.1 s | $0.3526 |

All six initial attempts exhausted the output allowance and produced no complete published exam. They are failures, not zero-error correct outputs. The changed inference settings were selected after observing that failure; the follow-up is development iteration rather than confirmatory evidence.

The follow-up produced 18 questions. A separate Python Fraction implementation checked all 39 recorded numerical claims and all 12 scenario eigenpairs: zero failures. It uses generic Gaussian-elimination determinants and direct residuals, independent of VERA's TypeScript arithmetic. One VERA attempt used one repair cycle; the other two used none. These final artifacts do not preserve every pre-repair question, so no specific repaired error type is claimed.

Both candidates had zero eight-word source-overlap warnings and zero detected target-question lexical overlap. Post-hoc agent inspection nevertheless found:

- Five of six exams used exhibit labels that identify eigenvector or invariant directions, making some questions easier by revealing an intended answer.
- One VERA scenario reused the exact matrix from lecture summary page 2 despite the instruction to choose a different source matrix.
- Direct Meta used one unique matrix across its three runs; VERA used two. This is limited diversity, not a semantic originality guarantee.
- The actual MIT test requires projection geometry in three dimensions, least-squares/QR derivations, projection in five dimensions, and a general n-by-n matrix argument. The constrained generated practice does not cover those tasks in full. Matching its selected count, points, and duration does not establish comparable difficulty.

These findings are explicitly post-hoc checks, not preregistered outcome metrics. The source-matrix dictionary records the inspected page references and does not represent a general matrix-extraction engine or a plagiarism judgment.

## Separate real-test solve

After all generation attempts were saved, the underlying Meta model was given the held-out question PDF and its rendered pages without the official answer key. It completed in 14.7 seconds at an accounted cost of $0.02285. The separate Fraction audit passed nine numeric groups: the projector, image/kernel bases, projection eigenvalues and trace, finite determinant-family spot checks, an inverse entry, and the requested eigenpairs.

**This is not a 100% MIT exam grade and is not a VERA generation score.** The symbolic proofs, full explanations, and grading rubrics are outside those nine checks. Agent inspection found an invalid intermediate equality in part 2b: after substituting A=QR, the model omitted R in one expression for the projected vector, although its final QQ-transpose formula was correct. A counterexample with Q=I, R=diag(2,3), and b=(1,1) gives (1/2,1/3) for the bad intermediate versus (1,1) for the correct projection.

The published reference also needs care: the question and solution PDFs use different point allocations, and solution page 2 prints a nullspace equation inconsistent with its own projection direction and basis. Direct calculation gives 2x+y+3z=0. The original files are retained; none were edited to conceal the discrepancy.

Run the separate solve and audit only after the six-attempt generation batch finishes:

    node --import tsx scripts/mit-solve.ts <completed-batch-id> --profile=configured-v2
    python scripts/verify-mit.py output/mit-ocw/configured-v2/<completed-batch-id>

The initial profile is retained with its original bytes and source hashes. Reproducing its inference settings requires VERA_MAX_OUTPUT_TOKENS=9000 and META_REASONING_EFFORT=auto; it cannot run under different settings without a new profile. Frozen JSON files preserve their bytes through Git checkouts via .gitattributes.

## Product implications

There is no demonstrated accuracy advantage for VERA in these three follow-up pairs. Its additional analysis/review/repair consumed about 2.28 times the accounted tokens' cost and 4.30 times the elapsed time. The evidence supports a narrow statement: the live pipeline works on this selected packet after inference configuration was corrected, and its machine-readable numerical answers pass the exercised checks.

The next engineering priorities are deterministic prevention of answer-bearing exhibit labels and known source-matrix reuse, richer verification of written algebraic steps, and broader domain support for subspaces, projections, least squares, and general-dimensional matrices. Keep a separately authored demonstration packet and obtain independent student/expert evaluation before making stronger quality or preparation claims.

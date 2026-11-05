# VERA interaction context

Use this context when changing the interface. The black-blue identity and light exhibit sheets remain the visual foundation. Interaction decisions must be justified by the student's task and the actual application state.

## Student and task

The intended student brings course material, checks an inferred practice plan, works through timed or untimed practice with supporting material when useful, and reviews their reasoning. This audience and task come from the product brief. They have not yet been validated through interviews or a student usability study.

The student's immediate questions are: What do I do next? What are you basing this on? Have my changes been saved? What happens if I leave? What do I need to fix?

## Interaction rules

- Use a quiet, unboxed brand/settings header and course-local links only for destinations that are available. The VERA wordmark returns to the library; generation settings remain in the header. Avoid a second generic page sidebar or duplicate upload actions.
- Materials and Exam plan use a centered, responsive page boundary up to 1,440px, with header and content edges aligned. Give file lists and question plans a primary column and related guidance a narrower companion column. Do not stretch related labels and actions to opposite edges of an unlimited canvas. The question workspace retains its separate reading/reference measures.
- In exam preview and practice, show one question in a reading column up to 760px. Use the remaining desktop space for the relevant reference sheet. Center exams with no separate references; keep a stable column in mixed-reference exams when an individual question has no reference. Keep question navigation with the question, rather than below a long exhibit. Use quiet separators, readable serif assessment text and clear light-blue actions with dark labels on a near-black workspace. Avoid gray-violet action colors.
- Show exact diagram data and a text description. Source passages must link to the original uploaded page; a resolving citation and a literal excerpt do not establish authenticity or interpretation. On mobile, practice switches between the question and its relevant material without clearing responses. A hidden timer returns for the final minute.
- Muse Image figures need essential givens as text, full-size access, a synthetic label and visible provisional-review limits. Pixel geometry stays not automatically verified. Failed visual checks block practice. Narrow-screen previews show the question before a long image sheet; active practice retains its pane switch.
- Keep the question near the top of a compact exam workspace. Use modest prompt buffers and a stable preview footer rather than centering each question vertically. Navigation returns to a consistent page position with the timer still available. Preserve figure proportions, including tall or wide diagrams, and do not crop away labels to remove image whitespace.
- Vector answers use a precise, bounded coordinate diagram with pointer, touch and exact coordinate entry. Save coordinates and reasoning together through the existing attempt recovery flow; show the saved drawing in review. Bounds validation is not correctness grading. Source passages may be bound to exact uploaded text using only whitespace/typographic-quote equivalence; retain the proposal and binding artifact and reject changed words.
- Open the library on the student's courses. Saved examples require an explicit collection or disclosure choice. Uploads start with a blank course name and unassigned document roles; require role selection before review.
- Use midnight-black workspace surfaces with restrained blue accents and the approved geometric brand mark. Avoid blue panel fills, framed header islands, decorative connection dots and redundant course selectors. Light source/exhibit sheets remain readable within that workspace. Show uploaded files and one next action before advanced document controls. Present proposed plan topics before their editing fields; validation must open the relevant editor and preserve focus while the student corrects it.
- Organize navigation around Materials → Exam plan → Practice exam → Review & improve. Model calls, numerical checking, and repair are operations within those tasks.
- Make reachable study steps clickable. Explain prerequisites in empty states and beside unavailable actions. Never quietly select another course when a URL names a missing course.
- Keep topic, format, points, and minutes visible in the plan. Put evidence detail, difficulty explanations, and instructions behind clearly named disclosures. Never hide checking failures or uncertainty behind a success badge.
- Preserve unfinished plan edits by revision and unsaved practice answers by attempt in browser storage when available. Only the server's acknowledgment counts as a saved answer. Browser backup is separate from the scored record.
- Offer timed and untimed practice before starting; keep solutions private until submission in both modes. Use an explicit timer-start action. Previewing does not start an attempt. Leaving and refreshing do not pause a running attempt.
- Let students revisit questions, flag them, and review unanswered questions before submission. Flags and navigation position are convenience state for this browser tab.
- Keep save errors beside the answer and offer retry. Do not replace failed status with a success indicator when a request finishes unsuccessfully.
- Distinguish a partial score from a completed score. Written scores are self-reported; show the rubric and the student's actual answer together.
- Use native modal focus containment, Escape dismissal when an action is not in flight, visible focus styles, descriptive controls, and status announcements that do not read every timer tick.
- Avoid decorative metrics, fabricated progress percentages or durations, unsupported mastery claims, dead controls, redundant heroes, and generic marketing copy in task screens.

## Verification before handoff

Exercise both successful and interrupted paths. Include upload review/back, plan validation and refresh, approval invalidation, start/cancel, answer save failure/retry/refresh, practice resume, question-level finish review, and incomplete grading. Inspect screenshots at desktop and narrow widths in addition to asserting DOM state. Run lint, type checking, the relevant tests, and a production build.

Read [the design rationale](docs/DESIGN.md) for context and limitations. A browser regression pass is not evidence of usability with real students.


## Cross-subject review rules

- The product serves test preparation across subjects. Do not force matrix scenarios or exhibits into every assessment.
- Display the basis of plan settings. User edits become student-selected; source evidence still needs validation.
- Arrange review around the saved answer, criterion, feedback, evidence and next action. Keep automatically checked key matches, self-scores and pending written work separate.
- Treat model feedback as provisional, including when citations resolve. Reports preserve the original feedback and do not change scores.
- Target missed objectives with an editable proposal. Require approval before generating follow-up; a perfect score can lead to explicitly labeled transfer practice instead.
- Failed checks need a concrete recovery route without exposing answer keys in workspace or practice payloads.

## November 4 export and judging refinements

Question papers download as readable PDFs, with mathematics, complete diagram geometry, named shared reference sheets and explicit checking limits. Submitted review PDFs include server-saved responses, criteria and suggested solutions; they require server-confirmed submission. A PDF is a snapshot, not an answer-sync mechanism. Missing renderers/images need a concrete retry/setup action.

On ready exam previews, a compact checking count and provenance label precede the question, with a direct link to the detailed checking/run evidence below. This keeps mobile questions visible earlier while preserving the complete report. Blocking errors remain before the question. Per-course run evidence includes retained failed generations and separates rechecks, inherited repair history and unresolved reservations. It must not present a curated copy as an unedited generation success.

Approved page boundaries apply to question evidence, source claims and referenced source passages. Matching plan metadata or a literal source location still does not establish semantic alignment, historical interpretation or whole-answer correctness. Evidence descriptions and private checker artifacts do not belong in pre-submission question data.

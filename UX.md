# VERA interaction context

Use this context when changing the interface. The black-blue identity and light exhibit sheets remain the visual foundation. Interaction decisions must be justified by the student's task and the actual application state.

## Student and task

The intended student brings course material, checks an inferred practice plan, works through a timed exam with exhibits, and reviews their reasoning. This audience and task come from the product brief. They have not yet been validated through interviews or a student usability study.

The student's immediate questions are: What do I do next? What are you basing this on? Have my changes been saved? What happens if I leave? What do I need to fix?

## Interaction rules

- Organize navigation around Materials → Exam plan → Practice exam → Review & improve. Model calls, numerical checking, and repair are operations within those tasks.
- Make reachable study steps clickable. Explain prerequisites in empty states and beside unavailable actions. Never quietly select another course when a URL names a missing course.
- Keep topic, format, points, and minutes visible in the plan. Put evidence detail, difficulty explanations, and instructions behind clearly named disclosures. Never hide checking failures or uncertainty behind a success badge.
- Preserve unfinished plan edits by revision and unsaved practice answers by attempt in browser storage when available. Only the server's acknowledgment counts as a saved answer. Browser backup is separate from the scored record.
- Use an explicit timer-start action. Previewing does not start an attempt. Leaving and refreshing do not pause a running attempt.
- Let students revisit questions, flag them, and review unanswered questions before submission. Flags and navigation position are convenience state for this browser tab.
- Keep save errors beside the answer and offer retry. Do not replace failed status with a success indicator when a request finishes unsuccessfully.
- Distinguish a partial score from a completed score. Written scores are self-reported; show the rubric and the student's actual answer together.
- Use native modal focus containment, Escape dismissal when an action is not in flight, visible focus styles, descriptive controls, and status announcements that do not read every timer tick.
- Avoid decorative metrics, fabricated progress percentages or durations, unsupported mastery claims, dead controls, redundant heroes, and generic marketing copy in task screens.

## Verification before handoff

Exercise both successful and interrupted paths. Include upload review/back, plan validation and refresh, approval invalidation, start/cancel, answer save failure/retry/refresh, practice resume, question-level finish review, and incomplete grading. Inspect screenshots at desktop and narrow widths in addition to asserting DOM state. Run lint, type checking, the relevant tests, and a production build.

Read [the research and audit](docs/UX-RESEARCH.md) for the rationale and limitations. A browser regression pass is not evidence of usability with real students.

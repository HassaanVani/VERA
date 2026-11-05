# Design rationale

VERA organizes the student's work as Materials → Exam plan → Practice → Review → Targeted practice. The interface answers the next practical question: what is available, what needs approval, what has saved, and what should happen next.

## Workspace and reading

Materials and planning use aligned centered boundaries with a main working column and a compact supporting column. Assessment text has a bounded reading width; relevant references occupy an adjacent sheet. Exams without separate references stay centered. Narrow screens offer an explicit question/material switch while preserving the response.

Near-black surfaces, light-blue actions, high-contrast text and light exhibit sheets separate workspace controls from source/assessment content. Typography, spacing and restrained separators carry hierarchy. Precise geometry keeps equal coordinate scales, while raster figures retain their aspect ratio and full-size access.

## Agency and evidence

Students choose document roles, inspect original pages, edit the proposed plan and approve revisions. Settings distinguish observed evidence, inference and student choices. Evidence opens without discarding plan edits. A valid page link establishes location, not correctness of its interpretation.

Generation progress reflects persisted jobs. Cancellation, retry, interrupted work and blocking errors keep recovery actions visible. Per-question checks identify their method and scope; model review remains distinct from deterministic checks.

## Practice and review

Timed and untimed modes start explicitly. Responses autosave with separate server acknowledgment and browser recovery state. Students can flag questions, resume and review omissions before submission. Solutions open only after the server confirms submission.

Vector construction supports pointer, touch and coordinate entry. Source passages include attribution and page access. Review presents the response, criterion, feedback and next action, with automatic key matches, self-scores and pending work kept separate. Focused practice begins as an editable plan.

## Accessibility and validation

The implementation uses visible focus, semantic controls, modal focus containment and Escape dismissal, readable contrast, textual diagram data and status announcements. These are engineering choices and scoped browser checks, not a complete accessibility certification or evidence of improved student learning. See [UX.md](../UX.md) for interaction requirements and [TESTING.md](TESTING.md) for regression scope.

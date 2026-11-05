# Foundations and hackathon disclosure

VERA is a separate product and directory. JEFF was read as an architectural reference and was not modified.

Reference foundation: JEFF, commit `505fac640783dfafdbb021dd7ee34cf5871bcb96`.

## Adapted from existing JEFF work

- Analyze → evidence-backed blueprint → constrained generation → checking → targeted repair → practice/follow-up architecture.
- Evidence-bound persona, document-role semantics, distinction between top-level questions/subparts, uncertainty preservation, original-question constraints, math-delimiter rules, and targeted-repair instructions from `lib/gemini/prompts.ts`.
- Blueprint slot, point, time, and sequential-numbering invariant patterns from `lib/jeff/blueprint.ts` and schema validation from `lib/gemini/validation.ts`.
- Eight-word source-overlap algorithm and 35% flag threshold from `lib/jeff/originality.ts`.
- Topic-level practice/follow-up idea from `lib/jeff/adaptive.ts`, adapted to point-weighted results and explicit self-reporting.
- Lessons from JEFF benchmark reassessment: retained failures, source separation, frozen inputs, model-matched baseline, and no inherited performance claims.

## New VERA implementation

- Entire black-blue UI and all presentation components, including a light exhibit desk. No JEFF UI was copied.
- Provider-independent application schemas and Meta HTTP adapter with Standard-mode restrictions, spending reservations, usage accounting, and cancellation.
- Shared scenario data, programmatic vector tables/SVG geometry, numerical validators, and question-to-exhibit contracts.
- Independent solve with the answer key withheld, then a separate comparison pass covering MC and free-response questions.
- Standalone SQLite persistence, revision approval boundaries, durable job worker and lease, local source rendering and provenance, timer persistence, scoring, and follow-up.
- Original synthetic packet, labeled saved demonstration, model probe, development evaluation scripts, and VERA-specific tests/documentation.

The prior JEFF source has no open-source grant in its README. Reuse here follows the builder's explicit instruction and authorization; it is not a claim that JEFF is generally available under an open-source license. Third-party packages retain their own licenses.

## Submission status

The [Meta event overview](https://dev.meta.ai/events/global-hackathon) establishes the track and theme but did not establish the official rule for pre-existing code. The builder must check the accepted participant rules before submission. Preserve this disclosure and identify actual new work and dates accurately. No hackathon eligibility or submission-ready claim is made by the app.

JEFF benchmark numbers are not VERA results. The builder's JEFF-generated practice exam is neither instructor evidence nor a held-out target. Physics II demo materials are a later milestone.

## Subsequent VERA work

VERA adds versioned subject-independent assessments, attempt-scoped solution access, claim-level verification, retained repair artifacts, feedback/dispute records, shared spending reservations, frozen cross-subject comparisons, optional Muse Image figures, exact SVG diagrams, source-bound passages, bounded vector responses, PDF exports and a new study interface.

The evaluations compare VERA with direct Meta generation using matched inputs and model settings. JEFF results are not VERA results. Source attribution, verification coverage and evaluation limitations remain in the public evaluation documentation.

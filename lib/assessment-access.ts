import type { CheckedExam } from "./contracts";

const checkMessages: Record<string, string> = {
  OBJECTIVE_ALIGNMENT:
    "A question changed the approved learning objective or section. Review the plan and generate again.",
  EVIDENCE_ALIGNMENT:
    "A question used course pages outside its approved plan. Review the evidence in the plan and generate again.",
  CROSS_ITEM_LEAK:
    "A question gives away another question’s numeric result. Review the plan and generate again; practice is blocked.",
  VISUAL_MODE:
    "The generated figure did not follow your diagram preference. Review the plan and generate again.",
  IMAGE_REVIEW:
    "A generated figure has a mismatch or could not be confidently reviewed. Practice is blocked; revise the plan and generate again.",
  IMAGE_REQUIRED:
    "The requested Muse Image figures were not generated. Review the plan and try again.",
  INVALID_REFERENCE:
    "A source reference names a missing or excluded page. Review the materials and generate again.",
  NO_EVIDENCE:
    "A question is missing course-page evidence. Generate again from the approved plan.",
  EVIDENCE_ROLE:
    "A question relies on an unsuitable source role. Correct the document roles and review the plan.",
  NUMERICAL_CLAIM:
    "A calculation or source claim failed its check. The answer details stay private; generate a fresh assessment.",
  NUMERIC_KEY:
    "A numeric answer key could not be validated. Generate again; this version cannot be practiced.",
  NUMERIC_UNVERIFIED:
    "A numeric question has no successfully checked calculation for its key.",
  SOLUTION_REVIEW:
    "Independent model review found a material disagreement after bounded repairs. Generate again or revise the plan.",
  ANSWER_LEAK:
    "A supporting-material label reveals an intended answer. This assessment needs fresh material.",
  SOURCE_DATA_REUSE:
    "Shared data repeats a known source example. Generate a fresh assessment.",
  SOURCE_OVERLAP:
    "A question shares phrasing with a course source. Inspect it for copying; this is a warning, not a plagiarism judgment.",
  REVIEW_LIMIT:
    "Some reasoning could not be verified. Model review is provisional; inspect the reasoning after practice.",
};

// Explicit allowlists: future answer-bearing fields remain private by default.
export function publicExam(e: CheckedExam) {
  return {
    id: e.id,
    packetId: e.packetId,
    revisionId: e.revisionId,
    schemaVersion: e.schemaVersion,
    ready: e.ready,
    fixture: e.fixture,
    provenance: e.provenance
      ? { kind: e.provenance.kind, parentExamId: e.provenance.parentExamId }
      : undefined,
    createdAt: e.createdAt,
    imageExhibits: (e.imageExhibits ?? []).map((image) => ({
      exhibitId: image.exhibitId,
      assetId: image.assetId,
      description: image.description,
      width: image.width,
      height: image.height,
      reviewStatus: image.reviewStatus,
      url: `/api/exams/${encodeURIComponent(e.id)}/images/${encodeURIComponent(image.assetId)}`,
    })),
    repairAttempts: e.repairAttempts,
    scenario: e.scenario
      ? {
          title: e.scenario.title,
          company: e.scenario.company,
          context: e.scenario.context,
          matrix: e.scenario.matrix,
          vectors: e.scenario.vectors,
          eigenpairs: [],
        }
      : undefined,
    exam: {
      schemaVersion: e.exam.schemaVersion,
      subject: e.exam.subject,
      title: e.exam.title,
      instructions: e.exam.instructions,
      totalPoints: e.exam.totalPoints,
      minutes: e.exam.minutes,
      exhibits: e.exam.exhibits?.map(
        ({
          id,
          kind,
          title,
          content,
          readingLayout,
          columns,
          rows,
          points,
          synthetic,
          source,
          drawing,
        }) => ({
          id,
          kind,
          title,
          content,
          readingLayout,
          columns,
          rows,
          points,
          synthetic,
          source,
          drawing,
        }),
      ),
      questions: e.exam.questions.map((q) => ({
        number: q.number,
        topic: q.topic,
        type: q.type,
        points: q.points,
        minutes: q.minutes,
        question: q.question,
        options: q.options,
        exhibitIds: q.exhibitIds,
        responseDiagram: q.responseDiagram
          ? {
              exhibitId: q.responseDiagram.exhibitId,
              minX: q.responseDiagram.minX,
              maxX: q.responseDiagram.maxX,
              minY: q.responseDiagram.minY,
              maxY: q.responseDiagram.maxY,
              maxVectors: q.responseDiagram.maxVectors,
            }
          : undefined,
        objective: q.objective,
        section: q.section,
        subparts: q.subparts,
        evidence: q.evidence?.map(({ documentId, page }) => ({
          documentId,
          page,
        })),
      })),
    },
    issues: e.issues.map((i) => ({
      ...i,
      message:
        checkMessages[i.code] ??
        (i.severity === "error"
          ? "This structural check failed. Review the plan and generate again."
          : "This item needs review; inspect the source and checking limits."),
    })),
    review: { questions: [] },
    verification: e.verification?.map((v) => ({
      question: v.question,
      claim: v.claim,
      method: v.method,
      result: v.result,
      checkerVersion: v.checkerVersion,
      limitation: v.limitation,
    })),
    verificationHistory: e.verification
      ? "recorded"
      : "legacy — historical checking status preserved; no new verification claimed",
  };
}

export type PublicCheckedExam = ReturnType<typeof publicExam>;

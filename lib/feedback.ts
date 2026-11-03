import { createHash } from "node:crypto";
import type { Attempt, CheckedExam, FeedbackRecord, Packet } from "./contracts";
import { automaticGrade, CHECKER_VERSION } from "./verification";
import { get, put } from "./store";

export const responseHash = (a: Attempt) =>
  createHash("sha256").update(JSON.stringify(a.responses)).digest("hex");
export function persistFeedback(
  exam: CheckedExam,
  attempt: Attempt,
  packet: Packet,
): FeedbackRecord[] {
  if (!attempt.submittedAt)
    throw new Error("Submit the attempt before opening feedback.");
  return exam.exam.questions.map((q) => {
    const response = attempt.responses[q.number] ?? "",
      grade = automaticGrade(q, response),
      selfScore = attempt.selfScores[q.number];
    const version = createHash("sha256")
      .update(JSON.stringify([response, selfScore, CHECKER_VERSION]))
      .digest("hex")
      .slice(0, 20);
    const recordId = `feedback:${attempt.id}:${q.number}:${version}`;
    const existing = get<FeedbackRecord>("feedback", recordId);
    if (existing) return existing;
    const evidence = (q.evidence ?? []).filter((ref) =>
      packet.documents.some(
        (d) =>
          d.id === ref.documentId && d.pages.some((p) => p.number === ref.page),
      ),
    );
    const basis =
      grade !== undefined
        ? "automatically-checked"
        : selfScore !== undefined
          ? "self-scored"
          : "needs-review";
    const criterion = q.rubric
      .map((r, i) => `${i + 1}. ${r.criterion} (${r.points} points)`)
      .join("\n");
    const text =
      grade !== undefined
        ? grade
          ? "Your answer matches the answer key under the stated checking rules."
          : !response.trim()
            ? "No answer was saved for this question."
            : "Your answer does not match the key under the stated checking rules. Compare the worked solution and check the required units."
        : selfScore !== undefined
          ? `You recorded ${selfScore}/${q.points}. This is self-reported, not an independently verified grade.`
          : "Your reasoning has not been automatically graded. Compare your answer against each criterion; alternative defensible answers may be valid.";
    return put<FeedbackRecord>("feedback", {
      id: recordId,
      attemptId: attempt.id,
      examId: exam.id,
      question: q.number,
      answerExcerpt: response.slice(0, 1000),
      criterion,
      text,
      basis,
      evidence,
      nextAction:
        grade === true
          ? "Try a transfer question on the same objective."
          : "Identify the first criterion you missed, then retry this objective with new material.",
      checkerVersion: CHECKER_VERSION,
      createdAt: new Date().toISOString(),
      responseHash: responseHash(attempt),
      disputes: [],
    });
  });
}

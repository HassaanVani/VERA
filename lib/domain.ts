import type { Blueprint, CheckedExam, Exam, Issue, Packet, Scenario, Attempt } from "./contracts";

export const multiply = (a: Scenario["matrix"], v: [number, number]): [number, number] => [a[0][0] * v[0] + a[0][1] * v[1], a[1][0] * v[0] + a[1][1] * v[1]];
export const close = (a: number, b: number) => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
export function scenarioIssues(s: Scenario): Issue[] {
  return s.eigenpairs.flatMap((e, i) => {
    const v = multiply(s.matrix, e.vector);
    return (!e.vector.some(x => x !== 0) || !v.every((x, j) => close(x, e.value * e.vector[j]))) ? [{ code: "EIGENPAIR", path: `eigenpairs.${i}`, message: "Scenario eigenpair fails Av = λv or uses the zero vector.", severity: "error" as const }] : [];
  });
}
// Adapted from JEFF's blueprintInvariantIssues; all settings remain explicit.
export function blueprintIssues(b: Blueprint, packet?: Packet): Issue[] {
  const issues: Issue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message, path: "blueprint", severity: "error" });
  if (b.slots.reduce((n, s) => n + s.points, 0) !== b.totalPoints) add("POINT_SUM", "Slot points must equal total points.");
  if (b.slots.reduce((n, s) => n + s.minutes, 0) !== b.minutes) add("TIME_SUM", "Slot minutes must equal exam duration.");
  if (b.slots.some((s, i) => s.number !== i + 1)) add("NUMBERING", "Question slots must be numbered sequentially.");
  if (packet && b.slots.some(s => !s.evidence.some(ref => packet.documents.some(d => d.id === ref.documentId && !["solutions", "generated-reference"].includes(d.role))))) add("TOPIC_EVIDENCE", "Each question topic needs at least one course-content source beyond solutions or generated references.");
  for (const o of b.observations) {
    if (o.kind === "observed" && !o.evidence.length) add("NO_EVIDENCE", "Observed facts need a source reference.");
    if (packet && o.kind === "observed" && o.evidence.some(e => ["solutions", "generated-reference"].includes(packet.documents.find(d => d.id === e.documentId)?.role ?? ""))) add("EVIDENCE_ROLE", "Solutions and generated references cannot establish assessed coverage or format.");
  }
  if (packet) for (const ref of [...b.observations.flatMap(o => o.evidence), ...b.slots.flatMap(s => s.evidence)]) {
    const doc = packet.documents.find(d => d.id === ref.documentId);
    if (!doc || !doc.pages.some(p => p.number === ref.page)) add("INVALID_REFERENCE", "A source reference names a missing document or page.");
  }
  return issues;
}
// JEFF's eight-word overlap heuristic, independent of its provider types.
export function sourceOverlapRate(stem: string, source: string, size = 8): number {
  const grams = (text: string) => { const w = text.toLowerCase().match(/[a-z0-9]+/g) ?? []; return Array.from({ length: Math.max(0, w.length - size + 1) }, (_, i) => w.slice(i, i + size).join(" ")); };
  const sourceGrams = new Set(grams(source)), candidate = grams(stem);
  return candidate.length ? candidate.filter(g => sourceGrams.has(g)).length / candidate.length : 0;
}
export function checkExam(e: Exam, b: Blueprint, s: Scenario, source: string): Issue[] {
  const issues = scenarioIssues(s);
  const add = (code: string, path: string, message: string, severity: Issue["severity"] = "error") => issues.push({ code, path, message, severity });
  if (e.questions.length !== b.slots.length) add("QUESTION_COUNT", "questions", "Question count differs from the approved blueprint.");
  if (e.totalPoints !== b.totalPoints || e.questions.reduce((n, q) => n + q.points, 0) !== b.totalPoints) add("POINT_SUM", "totalPoints", "Exam points do not match the blueprint.");
  if (e.minutes !== b.minutes || e.questions.reduce((n, q) => n + q.minutes, 0) !== b.minutes) add("TIME_SUM", "minutes", "Exam duration does not match the blueprint.");
  const stems = new Set<string>();
  for (const [i, q] of e.questions.entries()) {
    const p = `questions.${i}`, slot = b.slots[i], stem = q.question.toLowerCase().replace(/\s+/g, " ");
    if (q.number !== i + 1) add("NUMBERING", p, "Question numbering is not sequential.");
    if (!slot || q.type !== slot.type || q.points !== slot.points || q.minutes !== slot.minutes || q.topic !== slot.topic) add("SLOT_ALIGNMENT", p, "Question type, topic, points, or time differs from its slot.");
    if (stems.has(stem)) add("DUPLICATE", p, "Question stem is duplicated."); stems.add(stem);
    if (q.rubric.reduce((n, r) => n + r.points, 0) !== q.points) add("RUBRIC_SUM", p, "Rubric points do not match question points.");
    if (q.type === "multiple-choice" && (q.options.length !== 4 || new Set(q.options).size !== 4 || !/^[A-D]$/.test(q.answer))) add("MC_OPTIONS", p, "Multiple choice needs four unique options and an A–D answer key.");
    if (q.type === "multiple-choice" && q.options.length === 4) {
      // Check simple scalar choices against the dataset, not merely detached claims.
      const numeric = q.options.map(o => Number(o.trim().replace(/^\$|\$$/g, "")));
      const trace = s.matrix[0][0] + s.matrix[1][1], det = s.matrix[0][0] * s.matrix[1][1] - s.matrix[0][1] * s.matrix[1][0];
      const roots = trace * trace - 4 * det;
      const expected = /(?:which value is|what is) the determinant/i.test(q.question) ? [det] : /(?:which value is|what is) the trace/i.test(q.question) ? [trace] : /which value is an eigenvalue/i.test(q.question) && roots >= 0 ? [(trace + Math.sqrt(roots)) / 2, (trace - Math.sqrt(roots)) / 2] : [];
      if (expected.length && numeric.every(Number.isFinite)) {
        const correctIndices = numeric.flatMap((value, index) => expected.some(x => close(value, x)) ? [index] : []);
        if (correctIndices.length !== 1 || correctIndices[0] !== q.answer.charCodeAt(0) - 65) add("MC_NUMERICAL_KEY", p, "The scalar MC answer key is incorrect or more than one option is correct.");
      }
    }
    if (q.type === "free-response" && q.options.length) add("FR_OPTIONS", p, "Free response must not have answer options.");
    if (sourceOverlapRate(q.question, source) >= 0.35) add("SOURCE_OVERLAP", p, "Close phrase overlap with a source; inspect for copying or a close transformation.", "warning");
    for (const claim of q.claims) {
      let valid = false;
      if (claim.kind === "image") valid = multiply(s.matrix, claim.input).every((v, j) => close(v, claim.answer[j]));
      if (claim.kind === "eigenpair") valid = claim.vector.some(v => v !== 0) && multiply(s.matrix, claim.vector).every((v, j) => close(v, claim.value * claim.vector[j]));
      if (claim.kind === "trace") valid = close(claim.answer, s.matrix[0][0] + s.matrix[1][1]);
      if (claim.kind === "determinant") valid = close(claim.answer, s.matrix[0][0] * s.matrix[1][1] - s.matrix[0][1] * s.matrix[1][0]);
      if (!valid) add("NUMERICAL_CLAIM", p, "A structured numerical claim fails against the shared scenario.");
    }
  }
  return issues;
}
export function results(exam: CheckedExam, attempt: Attempt) {
  return exam.exam.questions.map(q => ({ number: q.number, topic: q.topic, possible: q.points, earned: q.type === "multiple-choice" ? (attempt.responses[q.number] === q.answer ? q.points : 0) : Math.max(0, Math.min(q.points, attempt.selfScores[q.number] ?? 0)), selfReported: q.type === "free-response" }));
}

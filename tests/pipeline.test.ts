import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { put, get, id } from "../lib/store";
import { demoPacket, demoBlueprint, demoScenario, demoExam } from "../lib/demo";
import { runJob } from "../lib/pipeline";
import type { CheckedExam, Job, Revision } from "../lib/contracts";
import type { AssessmentProvider, ModelRequest } from "../lib/provider";
beforeAll(() => { process.env.VERA_DATA_DIR = mkdtempSync(path.join(tmpdir(), "vera-pipeline-")); });
function setup() {
  const p = put("packet", { ...demoPacket(), fixture: false }), b = demoBlueprint(p), s = demoScenario(), e = demoExam(b, s), now = new Date().toISOString();
  const r = put<Revision>("revision", { id: id(), packetId: p.id, blueprint: b, approved: true, createdAt: now });
  const j = put<Job>("job", { id: id(), kind: "generate", packetId: p.id, revisionId: r.id, status: "running", stage: "start", createdAt: now, updatedAt: now });
  return { p, b, s, e, r, j };
}
describe("generation, independent review, and bounded repair", () => {
  it("withholds the proposed answer during the independent solve", async () => {
    const { s, e, j } = setup(); let independentPrompt = "";
    const provider: AssessmentProvider = { async structured<T>(r: ModelRequest<T>) {
      let payload: unknown;
      if (r.name === "Build shared scenario") payload = s;
      else if (r.name === "Generate questions and exhibits") payload = e;
      else if (r.name.startsWith("Solve independently")) { independentPrompt = r.prompt; payload = { questions: e.questions.map(q => ({ number: q.number, answer: q.answer, reasoning: "Independent arithmetic checked." })) }; }
      else payload = { questions: e.questions.map(q => ({ number: q.number, independentAnswer: q.answer, status: "consistent", issues: [] })) };
      return r.schema.parse(payload);
    } };
    await runJob(j, provider); expect(independentPrompt).not.toContain('"solution"'); expect(independentPrompt).not.toContain('"claims"'); expect(independentPrompt).not.toContain('"eigenpairs"');
    const result = get<CheckedExam>("exam", get<Job>("job", j.id)!.resultId!)!;
    expect(result.ready).toBe(true); expect(result.review.questions).toHaveLength(5);
  });
  it("retains failures after exactly two unsuccessful repair cycles", async () => {
    const { s, e, j } = setup(); let repairCalls = 0;
    const provider: AssessmentProvider = { async structured<T>(r: ModelRequest<T>) {
      let payload: unknown;
      if (r.name === "Build shared scenario") payload = s;
      else if (r.name === "Generate questions and exhibits") payload = e;
      else if (r.name.startsWith("Solve independently")) payload = { questions: e.questions.map(q => ({ number: q.number, answer: q.answer, reasoning: "Independent answer." })) };
      else if (r.name.startsWith("Targeted repair")) { repairCalls++; payload = { questions: [e.questions[0]] }; }
      else payload = { questions: e.questions.map(q => ({ number: q.number, independentAnswer: q.answer, status: q.number === 1 ? "disputed" : "consistent", issues: q.number === 1 ? ["Answer remains inconsistent."] : [] })) };
      return r.schema.parse(payload);
    } };
    await runJob(j, provider);
    const result = get<CheckedExam>("exam", get<Job>("job", j.id)!.resultId!)!;
    expect(repairCalls).toBe(2); expect(result.ready).toBe(false); expect(result.issues.some(i => i.code === "SOLUTION_REVIEW")).toBe(true);
  });
  it("does not continue or save results for a cancelled job", async () => {
    const { j } = setup(); put("job", { ...j, status: "cancelled" });
    const provider: AssessmentProvider = { structured: async () => { throw new Error("Provider should not be called"); } };
    await expect(runJob(j, provider)).rejects.toThrow(/cancelled/);
    expect(get<Job>("job",j.id)?.resultId).toBeUndefined();
  });
});

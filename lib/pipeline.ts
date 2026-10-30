import { Blueprint, Scenario, Exam, Independent, Review, Patch } from "./contracts";
import type { Job, Packet, Revision, CheckedExam, Issue } from "./contracts";
import { get, id, put, patchJob } from "./store";
import { MetaProvider, type AssessmentProvider, type Attachment } from "./provider";
import { analysisPrompt, scenarioPrompt, generationPrompt, independentPrompt, comparisonPrompt, repairPrompt, packetText } from "./prompts";
import { blueprintIssues, scenarioIssues, checkExam } from "./domain";
import { demoBlueprint, savedDemo } from "./demo";

export async function runJob(job: Job, provider: AssessmentProvider = new MetaProvider(), signal?: AbortSignal) {
  const packet = get<Packet>("packet", job.packetId);
  if (!packet) throw new Error("Source packet no longer exists.");
  const stage = (name: string) => { signal?.throwIfAborted(); patchJob(job.id, { stage: name }); };
  const call = async <T>(name: string, schema: import("zod").z.ZodType<T>, prompt: string, attachments?: Attachment[]) => { stage(name); return provider.structured({ name, schema, prompt, attachments, jobId: job.id, signal }); };
  if (job.kind === "analyze") {
    if (!packet.documents.some(d => !["solutions", "generated-reference"].includes(d.role))) throw new Error("Add course notes, a textbook excerpt, or an instructor assessment. Solutions and generated references alone cannot establish course scope.");
    const attachments: Attachment[] = packet.documents.filter(d => d.role !== "generated-reference").flatMap(d => d.pages.filter(p => p.imagePath && !p.duplicateOf).map(p => ({ name: `${d.id}:page-${p.number}`, mime: d.mime === "image/jpeg" ? "image/jpeg" as const : "image/png" as const, path: p.imagePath! })));
    const b = packet.fixture ? demoBlueprint(packet) : await call("Understand course evidence", Blueprint, `${analysisPrompt(packet)}\nAttached image order: ${attachments.map(a => a.name).join(", ")}`, attachments);
    const problems = blueprintIssues(b, packet);
    if (problems.length) throw new Error(`Blueprint rejected: ${problems.map(p => p.message).join(" ")}`);
    stage("Save editable blueprint");
    const revision: Revision = { id: id(), packetId: packet.id, blueprint: b, approved: false, createdAt: new Date().toISOString() };
    put("revision", revision); patchJob(job.id, { status: "complete", stage: "Blueprint ready for review", resultId: revision.id }); return;
  }
  const revision = get<Revision>("revision", job.revisionId || "");
  if (!revision || revision.packetId !== packet.id || !revision.approved) throw new Error("Approve the current blueprint before generating.");
  const b = revision.blueprint;
  if (blueprintIssues(b, packet).length) throw new Error("Approved blueprint failed invariants.");
  if (packet.fixture) {
    stage("Load labeled demonstration");
    const result = savedDemo(packet, revision.id, b, job.kind === "follow-up" ? 1 : 0); put("exam", result);
    patchJob(job.id, { status: "complete", stage: "Saved demonstration ready · no model calls", resultId: result.id }); return;
  }
  const scenario = await call("Build shared scenario", Scenario, scenarioPrompt(b));
  if (scenarioIssues(scenario).length) throw new Error("The shared scenario failed numerical checks. No inconsistent exhibits were generated; retry with a new scenario.");
  let exam = await call("Generate questions and exhibits", Exam, generationPrompt(b, scenario, job.focus));
  let review: Review = { questions: [] }, issues: Issue[] = [], repairs = 0;
  for (;;) {
    stage("Run deterministic checks");
    issues = checkExam(exam, b, scenario, packetText(packet));
    const independent = await call("Solve independently · key withheld", Independent, independentPrompt(exam, scenario));
    review = await call("Compare worked solutions", Review, comparisonPrompt(exam, independent));
    for (const q of exam.questions) {
      const matches = review.questions.filter(v => v.number === q.number);
      if (matches.length !== 1 || matches[0].status !== "consistent" || matches[0].issues.length || !independent.questions.some(x => x.number === q.number && x.reasoning.trim())) issues.push({ code: "SOLUTION_REVIEW", path: `questions.${q.number - 1}`, severity: "error", message: matches[0]?.issues.join("; ") || `Question ${q.number} was disputed or not independently checked.` });
    }
    if (!issues.some(i => i.severity === "error") || repairs >= 2) break;
    const patch = await call(`Targeted repair ${repairs + 1} of 2`, Patch, repairPrompt(exam, b, scenario, issues));
    const affected = new Set(issues.filter(i => i.severity === "error").flatMap(i => { const m = /^questions\.(\d+)/.exec(i.path); return m ? [Number(m[1]) + 1] : exam.questions.map(q => q.number); }));
    if (new Set(patch.questions.map(q => q.number)).size !== patch.questions.length || patch.questions.some(q => !affected.has(q.number))) throw new Error("Repair attempted to change unaffected questions.");
    exam = Exam.parse({ ...exam, title: b.title, totalPoints: b.totalPoints, minutes: b.minutes, questions: exam.questions.map(q => patch.questions.find(p => p.number === q.number) || q) }); repairs++;
  }
  stage("Save checking report");
  const result: CheckedExam = { id: id(), packetId: packet.id, revisionId: revision.id, scenario, exam, issues, review, repairAttempts: repairs, ready: !issues.some(i => i.severity === "error"), fixture: false, createdAt: new Date().toISOString() };
  put("exam", result); patchJob(job.id, { status: "complete", stage: result.ready ? "Exam ready for practice" : "Checks unresolved · inspect report", resultId: result.id });
}

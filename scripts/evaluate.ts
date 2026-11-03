import "./environment.mjs";
import { z } from "zod";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Scenario, Exam, type Revision, type Job, type CheckedExam } from "../lib/contracts";
import { MetaProvider, modelConfig } from "../lib/provider";
import { demoPacket, demoBlueprint, demoText } from "../lib/demo";
import { get, put, id, usageSummary } from "../lib/store";
import { runJob } from "../lib/pipeline";
import { checkExam } from "../lib/domain";

const sourceHash = createHash("sha256").update(demoText).digest("hex");
const frozen = JSON.parse(await readFile("fixtures/frozen-evaluation.json", "utf8"));
if (sourceHash !== frozen.sourceSha256) throw new Error("The development source changed after evaluation freeze. Freeze and version a new evaluation set before running.");
type Run = { candidate: string; latencyMs: number; error?: string; artifact?: { issues?: { code: string; severity: string }[]; ready?: boolean } };
const report = { version: 1, sourceHash, model: modelConfig().model, createdAt: new Date().toISOString(), status: process.env.MODEL_API_KEY ? "running" : "pending_credentials", limitations: ["Synthetic development packet; not a held-out instructor exam or learning-outcome study.", "Topic alignment, originality beyond lexical overlap, and conceptual correctness require human grading.", "All failures remain in the denominator.", "Run without concurrent live application calls when comparing usage snapshots."], attempts: [] as unknown[], metrics: [] as unknown[] };
await mkdir("output/evaluation", { recursive: true });
if (!process.env.MODEL_API_KEY) console.log("PENDING: No MODEL_API_KEY. Three paired live comparisons cannot run; no performance results fabricated.");
else {
  console.log("Planned: 3 paired attempts, maximum 3 baseline + 3 analysis + 3 × 10 generation/review/repair calls. Per-call configured cap is USD 0.50 by default; development spending stops at USD 90. Actual token ceilings are reserved before every call.");
  const provider = new MetaProvider();
  for (let repeat = 1; repeat <= 3; repeat++) {
    const packet = { ...demoPacket(), fixture: false }; put("packet", packet);
    const target = demoBlueprint(packet);
    for (const candidate of ["direct-meta", "vera"] as const) {
      const started = Date.now(), usageBefore = usageSummary();
      let artifact: unknown, error: string | undefined;
      try {
        if (candidate === "direct-meta") {
          const r = await provider.structured({ schema: z.object({ scenario: Scenario, exam: Exam }), name: "direct_baseline", jobId: `eval-${id()}`, prompt: `Create an original linear algebra practice exam with a shared fictional transformation-lab dataset, coherent exhibits, complete worked solutions, and marking rubrics. Use these student-selected structural constraints (topics and slots): ${JSON.stringify(target)}. Available exhibit IDs: calibration, vectors, diagram. Include numerical claims for answer checking. Source material: ${demoText}` });
          artifact = { ...r, issues: checkExam(r.exam, target, r.scenario, demoText) };
        } else {
          const now = new Date().toISOString(), analysisJob: Job = { id: id(), kind: "analyze", packetId: packet.id, status: "running", stage: "Evaluation analysis", createdAt: now, updatedAt: now };
          put("job", analysisJob); await runJob(analysisJob, provider, AbortSignal.timeout(8 * 60_000));
          const revision = get<Revision>("revision", get<Job>("job", analysisJob.id)!.resultId!)!;
          // Freeze the same student-selected shape in both arms; retain VERA's evidence analysis.
          put("revision", { ...revision, approved: true, blueprint: { ...revision.blueprint, title: target.title, slots: target.slots, totalPoints: target.totalPoints, minutes: target.minutes } });
          const job: Job = { ...analysisJob, id: id(), kind: "generate", revisionId: revision.id }; put("job", job); await runJob(job, provider, AbortSignal.timeout(8 * 60_000));
          artifact = get<CheckedExam>("exam", get<Job>("job", job.id)!.resultId!);
        }
      } catch (e) { error = e instanceof Error ? e.message : "Evaluation failed"; }
      const result = { repeat, candidate, latencyMs: Date.now() - started, error, artifact, usageBefore, usageAfter: usageSummary() }; report.attempts.push(result);
      await writeFile(`output/evaluation/${repeat}-${candidate}.json`, JSON.stringify(result, null, 2));
      await writeFile("output/evaluation/report.json", JSON.stringify(report, null, 2));
    }
  }
  report.status = "completed_requires_human_grading";
  report.metrics = ["direct-meta", "vera"].map(candidate => {
    const runs = (report.attempts as Run[]).filter(r => r.candidate === candidate);
    const failed = runs.filter(r => r.error || r.artifact?.ready === false || r.artifact?.issues?.some(i => i.severity === "error")).length;
    return { candidate, attempts: runs.length, failed, failureRate: failed / runs.length, meanLatencyMsIncludingFailures: runs.reduce((n, r) => n + r.latencyMs, 0) / runs.length, numericalIssueCount: runs.reduce((n, r) => n + (r.artifact?.issues?.filter(i => ["NUMERICAL_CLAIM", "EIGENPAIR", "MC_NUMERICAL_KEY"].includes(i.code)).length || 0), 0), overlapWarningCount: runs.reduce((n, r) => n + (r.artifact?.issues?.filter(i => i.code === "SOURCE_OVERLAP").length || 0), 0), conceptualCorrectness: "pending_human_grading", semanticOriginality: "pending_human_grading", topicAlignment: "pending_human_grading", cost: "See per-attempt usage snapshots; uncertain reservations retained." };
  });
}
await writeFile("output/evaluation/report.json", JSON.stringify(report, null, 2)); console.log(`Evaluation status: ${report.status}`);

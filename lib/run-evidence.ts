import type { CheckedExam, Job, PipelineArtifact } from "./contracts";
import { get, list, usageDb } from "./store";

export function examProvenance(
  exam: CheckedExam,
  jobs = list<Job>("job"),
  artifacts = list<PipelineArtifact>("artifact"),
): CheckedExam["provenance"] {
  if (exam.provenance) return exam.provenance;
  const jobIds = new Set(
    jobs.filter((j) => j.resultId === exam.id).map((j) => j.id),
  );
  for (const a of artifacts.filter((a) => jobIds.has(a.jobId))) {
    if (
      !["Assistant curation diff", "Retained generation source"].includes(
        a.stage,
      )
    )
      continue;
    const payload = a.payload as { parentExamId?: unknown } | null;
    if (
      typeof payload?.parentExamId === "string" &&
      get<CheckedExam>("exam", payload.parentExamId)?.packetId === exam.packetId
    )
      return {
        kind:
          a.stage === "Assistant curation diff"
            ? "reviewed-copy"
            : "reprocessed",
        parentExamId: payload.parentExamId,
      };
  }
}

export function runEvidence(exam: CheckedExam) {
  const jobs = list<Job>("job");
  const artifacts = list<PipelineArtifact>("artifact");
  // Include failed and interrupted runs, not merely the last successful review.
  const runs = jobs
    .filter((j) => j.packetId === exam.packetId && j.kind === "generate")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const provenance = examProvenance(exam, jobs, artifacts);
  const executions = runs.map((job) => {
    const usage = usageDb()
      .prepare(
        "SELECT model,status,reserved,cost,latency_ms FROM usage WHERE job_id=?",
      )
      .all(job.id) as {
      model: string;
      status: string;
      reserved: number;
      cost: number | null;
      latency_ms: number | null;
    }[];
    const result = job.resultId
      ? get<CheckedExam>("exam", job.resultId)
      : undefined;
    return {
      jobId: job.id,
      examId: result?.id,
      current: result?.id === exam.id,
      status: job.status,
      ready: result?.ready,
      createdAt: job.createdAt,
      repairCycles: result?.fixture
        ? 0
        : artifacts.some((a) => a.jobId === job.id)
          ? artifacts.filter(
              (a) => a.jobId === job.id && a.stage === "Repair diff",
            ).length
          : null,
      source: result?.fixture
        ? ("authored-example" as const)
        : usage.length
          ? ("recorded-provider-run" as const)
          : ("usage-unavailable" as const),
      models: [...new Set(usage.map((u) => u.model))],
      recordedAttempts: usage.length || null,
      settledUsd: usage.length
        ? usage
            .filter((u) => u.status === "settled")
            .reduce((s, u) => s + (u.cost ?? 0), 0)
        : null,
      heldUsd: usage.length
        ? usage
            .filter((u) => u.status !== "settled")
            .reduce((s, u) => s + u.reserved, 0)
        : null,
      uncertainAttempts: usage.filter((u) => u.status !== "settled").length,
      providerLatencyMs: usage.some((u) => u.latency_ms !== null)
        ? usage.reduce((s, u) => s + (u.latency_ms ?? 0), 0)
        : null,
    };
  });
  return {
    provenance: provenance
      ? { kind: provenance.kind, parentExamId: provenance.parentExamId }
      : undefined,
    scope:
      "All retained generation jobs in this course, including blocked results and rechecks. Analysis and feedback spending are separate; this is not total project cost.",
    executions,
    questions: exam.exam.questions.map((q) => ({
      number: q.number,
      checks: (exam.verification ?? [])
        .filter((v) => v.question === q.number)
        .map((v) => ({
          method: v.method,
          result: v.result,
          checkerVersion: v.checkerVersion,
          limitation: v.limitation,
        })),
      modelReview: exam.fixture
        ? "not-run"
        : (exam.review.questions.find((r) => r.number === q.number)?.status ??
          "not-recorded"),
    })),
  };
}
export type RunEvidence = ReturnType<typeof runEvidence>;

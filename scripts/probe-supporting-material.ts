import "./environment.mjs";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  illustratedPacket,
  illustratedBlueprint,
} from "../lib/illustrated-demo";
import {
  MetaProvider,
  modelConfig,
  type AssessmentProvider,
} from "../lib/provider";
import { runJob } from "../lib/pipeline";
import { SYSTEM } from "../lib/prompts";
import { get, id, list, put, usageDb } from "../lib/store";
import type { Job, CheckedExam, PipelineArtifact } from "../lib/contracts";

if (!process.argv.includes("--live"))
  throw new Error(
    "Live calls require --live. This original-material capability probe is not an OCW benchmark.",
  );
// Keep the existing campaign cap and normal shared development ledger. New
// isolated records never appear in the student's workspace.
const root = path.resolve(".vera");
process.env.VERA_BUDGET_DIR = root;
process.env.VERA_BUDGET_BUCKET = "development";
process.env.VERA_DATA_DIR = path.join(
  root,
  "probes",
  `supporting-material-${id()}`,
);
const limitId = "ocw-cross-subject-v2-additional-20usd";
const limit = usageDb()
  .prepare("SELECT cap FROM spending_limits WHERE id=?")
  .get(limitId) as { cap: number } | undefined;
if (limit?.cap !== 20)
  throw new Error(
    "Existing shared $20 evaluation cap not found; no calls made.",
  );
process.env.VERA_EVALUATION_LIMIT_ID = limitId;
process.env.VERA_CALL_RESERVATION_USD = "0.20";
const cfg = modelConfig();
if (
  cfg.model !== "muse-spark-1.3" ||
  cfg.inputRate !== 1.25 ||
  cfg.outputRate !== 4.25
)
  throw new Error(
    "Recheck provider model/pricing before changing the probe configuration.",
  );
const spent = () =>
  Number(
    (
      usageDb()
        .prepare(
          "SELECT COALESCE(SUM(COALESCE(cost,reserved)),0) total FROM usage",
        )
        .get() as { total: number }
    ).total,
  );
const baseline = spent(),
  localCeiling = 1;
const meta = new MetaProvider();
const provider: AssessmentProvider = {
  async structured(request) {
    const input =
      Buffer.byteLength(
        SYSTEM +
          request.prompt +
          JSON.stringify(z.toJSONSchema(request.schema, { target: "draft-7" })),
      ) +
      (request.attachments?.length ?? 0) * 8192;
    const reservation = Math.max(
      0.02,
      (input * cfg.inputRate + cfg.maxOutputTokens * cfg.outputRate) / 1e6,
    );
    // Reserve room for all three bounded transport attempts before calling.
    if (spent() - baseline + reservation * 3 > localCeiling)
      throw new Error(
        "One-dollar probe ceiling reached before the next request.",
      );
    console.log(`Stage: ${request.name}`);
    return meta.structured(request);
  },
};
const packet = illustratedPacket();
packet.fixture = false;
packet.name = "Original supporting-material live capability probe";
const blueprint = illustratedBlueprint(packet);
blueprint.slots.forEach((slot, i) => {
  slot.pattern =
    i < 2
      ? "Require one shared synthetic field diagram with a triangle polygon, an arrow and a circle, using exact original coordinates. Include all necessary given dimensions in the accessible description."
      : "Require a literal passage excerpt from uploaded page 2, with source documentId/page. Keep the authored fictional status explicit. Ask about a claim and corroboration.";
});
put("packet", packet);
const now = new Date().toISOString();
const revision = put("revision", {
  id: id(),
  packetId: packet.id,
  blueprint,
  approved: true,
  createdAt: now,
});
const job = put<Job>("job", {
  id: id(),
  kind: "generate",
  packetId: packet.id,
  revisionId: revision.id,
  status: "running",
  stage: "start",
  createdAt: now,
  updatedAt: now,
});
const start = Date.now();
let error: string | undefined;
try {
  await runJob(job, provider, AbortSignal.timeout(240000));
} catch (cause) {
  error = cause instanceof Error ? cause.message : "Capability probe failed";
  put("job", {
    ...get<Job>("job", job.id)!,
    status: "failed",
    error,
    updatedAt: new Date().toISOString(),
  });
}
const record = get<Job>("job", job.id)!;
const exam = record.resultId
  ? get<CheckedExam>("exam", record.resultId)
  : undefined;
const artifacts = list<PipelineArtifact>("artifact").filter(
  (a) => a.jobId === job.id,
);
const diagrams =
  exam?.exam.exhibits?.filter((e) => e.kind === "diagram" && e.drawing) ?? [];
const passages =
  exam?.exam.exhibits?.filter((e) => e.kind === "passage" && e.source) ?? [];
const report = {
  checkedAt: new Date().toISOString(),
  model: cfg.model,
  pricingChecked: "2026-11-03",
  purpose:
    "One original-material capability probe; not a paired quality evaluation",
  status: error
    ? "failed"
    : exam?.ready && diagrams.length && passages.length
      ? "passed"
      : "failed",
  error,
  jobId: job.id,
  elapsedMs: Date.now() - start,
  accountedUsd: spent() - baseline,
  localCeilingUsd: localCeiling,
  ready: exam?.ready,
  repairAttempts: exam?.repairAttempts,
  questions: exam?.exam.questions.length,
  diagrams: diagrams.map((e) => ({
    points: e.points.length,
    segments: e.drawing!.segments.length,
    paths: e.drawing!.paths.length,
    circles: e.drawing!.circles.length,
  })),
  sourcePassages: passages.length,
  issues: exam?.issues,
  verification: exam?.verification,
};
await mkdir("output/supporting-material-probe", { recursive: true });
await writeFile(
  "output/supporting-material-probe/report.json",
  JSON.stringify(report, null, 2),
);
await writeFile(
  "output/supporting-material-probe/artifacts.json",
  JSON.stringify({ packet, blueprint, exam, artifacts }, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exitCode = 1;

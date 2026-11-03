import "./environment.mjs";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  Blueprint,
  Exam,
  Scenario,
  type Packet,
  type Revision,
  type Job,
  type CheckedExam,
  type Issue,
} from "../lib/contracts";
import { ingest, deduplicate } from "../lib/ingestion";
import {
  MetaProvider,
  modelConfig,
  type AssessmentProvider,
  type ModelRequest,
} from "../lib/provider";
import { get, put, id, usageSummary } from "../lib/store";
import { packetText } from "../lib/prompts";
import { runJob } from "../lib/pipeline";
import { checkExam, sourceOverlapRate } from "../lib/domain";
import {
  assertFrozen,
  countFailures,
  generationSources,
  sha256,
  type EvaluationSource,
} from "../lib/evaluation";

const profile =
  process.argv
    .find((arg) => arg.startsWith("--profile="))
    ?.slice("--profile=".length) || "initial";
if (!/^[a-z0-9-]+$/.test(profile))
  throw new Error("Invalid evaluation profile.");
const protocolDir =
  profile === "initial" ? "fixtures/mit-ocw" : `fixtures/mit-ocw/${profile}`;
const protocolPath = `${protocolDir}/protocol.json`;
const protocolBytes = await readFile(protocolPath, "utf8");
const publicFreeze = JSON.parse(
  await readFile(`${protocolDir}/frozen-sources.json`, "utf8"),
) as { protocolSha256: string; sources: { id: string; sha256: string }[] };
assertFrozen(publicFreeze.protocolSha256, protocolBytes, "Published protocol");
const protocol = JSON.parse(protocolBytes) as {
  id: string;
  model: string;
  repeats: number;
  order: ("direct-meta" | "vera")[][];
  batchCeilingUsd: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  inference?: { maxOutputTokens: number; reasoningEffort: string };
  limitations: string[];
  sources: EvaluationSource[];
};
// Deliberately separate evaluation records/usage from interactive user courses.
process.env.VERA_BUDGET_DIR ||= ".vera";
process.env.VERA_DATA_DIR = ".vera/evaluations/mit-ocw";
process.env.VERA_BUDGET_BUCKET = "development";
const root = path.resolve(process.env.VERA_DATA_DIR, protocol.id);
await mkdir(root, { recursive: true });
const frozenPath = path.join(root, "frozen.json");
const outputRoot = path.resolve(
  profile === "initial" ? "output/mit-ocw" : `output/mit-ocw/${profile}`,
);
await mkdir(outputRoot, { recursive: true });
const command = process.argv[2] || "status";
const writeJson = (file: string, value: unknown) =>
  writeFile(file, JSON.stringify(value, null, 2) + "\n");
type Frozen = {
  protocolSha256: string;
  frozenAt: string;
  sources: (EvaluationSource & { sha256: string; file: string })[];
  packet: Packet;
  packetSha256: string;
};

if (command === "prepare") {
  try {
    await access(frozenPath);
    throw new Error(
      "This evaluation is already frozen. Use the existing files or create a new protocol ID.",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const sources: Frozen["sources"] = [];
  for (const source of protocol.sources) {
    console.log(`Download ${source.id} (${source.partition})`);
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(
        `Source download failed: ${source.id}, HTTP ${response.status}`,
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      bytes.length > 10 * 1024 * 1024 ||
      Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-"
    )
      throw new Error(`Invalid source PDF: ${source.id}`);
    const expected = publicFreeze.sources.find((item) => item.id === source.id);
    if (!expected) throw new Error(`Unfrozen source: ${source.id}`);
    assertFrozen(expected.sha256, bytes, source.id);
    const file = path.join(root, `${source.id}.pdf`);
    await writeFile(file, bytes);
    sources.push({ ...source, sha256: sha256(bytes), file });
  }
  const packet: Packet = {
    id: `packet-${protocol.id}`,
    name: "MIT OCW development evidence · constrained 2×2 scope",
    createdAt: new Date().toISOString(),
    fixture: false,
    documents: [],
  };
  for (const source of generationSources(sources)) {
    const bytes = await readFile(source.file);
    const document = await ingest(
      new File([bytes], `${source.id}.pdf`, { type: "application/pdf" }),
      source.role as "lecture-notes" | "past-exam",
      packet.id,
    );
    packet.documents.push({ ...document, id: source.id, name: source.name });
  }
  deduplicate(packet.documents);
  const frozen: Frozen = {
    protocolSha256: sha256(protocolBytes),
    frozenAt: new Date().toISOString(),
    sources,
    packet,
    packetSha256: sha256(JSON.stringify(packet)),
  };
  await writeJson(frozenPath, frozen);
  await writeJson(path.join(outputRoot, "source-manifest.json"), {
    ...frozen,
    packet: undefined,
    sources: sources.map((source) => ({
      id: source.id,
      partition: source.partition,
      role: source.role,
      name: source.name,
      url: source.url,
      sha256: source.sha256,
    })),
    packetSha256: frozen.packetSha256,
    pages: packet.documents.map((document) => ({
      id: document.id,
      pages: document.pages.length,
      warnings: document.warnings,
    })),
  });
  console.log(
    `Frozen ${packet.documents.length} generation documents / ${packet.documents.reduce((sum, document) => sum + document.pages.length, 0)} pages. Held-out files are not in the packet.`,
  );
  process.exit(0);
}

const frozen = JSON.parse(await readFile(frozenPath, "utf8")) as Frozen;
assertFrozen(frozen.protocolSha256, protocolBytes, "Protocol");
assertFrozen(
  frozen.packetSha256,
  JSON.stringify(frozen.packet),
  "Source packet",
);
for (const source of frozen.sources)
  assertFrozen(source.sha256, await readFile(source.file), source.id);
const allowed = new Set(
  generationSources(frozen.sources).map((source) => source.id),
);
if (frozen.packet.documents.some((document) => !allowed.has(document.id)))
  throw new Error("Held-out source leaked into the generation packet.");
const packet = frozen.packet;
const target: Blueprint = Blueprint.parse({
  title: "Linear algebra practice · MIT OCW development evidence",
  domain: "linear-algebra",
  instructions:
    "Show all reasoning. Use the shared calibration, measurements, and diagram. This is an original constrained practice exercise, not a reproduction or prediction of an MIT exam.",
  totalPoints: 100,
  minutes: 60,
  observations: [
    {
      text: "Three written questions, 100 points, 60 minutes, and 2×2-only coverage are explicit benchmark settings.",
      kind: "student-selected",
      evidence: [],
    },
  ],
  uncertainties: [
    "This benchmark intentionally excludes projections, least squares/QR, and general n-dimensional problems.",
    "The selected practice format overrides the prior assessment format. It is not an inferred instructor requirement.",
  ],
  slots: [
    {
      number: 1,
      topic: "Determinant and trace",
      type: "free-response",
      points: 30,
      minutes: 18,
      difficulty: "transfer",
      pattern:
        "Compute determinant and trace and explain invertibility and their geometric meaning using shared calibration evidence.",
      evidence: [
        {
          documentId: "mit-determinants",
          page: 1,
          description: "Determinants and invertibility",
        },
        {
          documentId: "mit-eigenvalues",
          page: 2,
          description: "Trace and determinant relate to eigenvalues",
        },
      ],
    },
    {
      number: 2,
      topic: "Eigenvalues and eigenvectors",
      type: "free-response",
      points: 40,
      minutes: 24,
      difficulty: "synthesis",
      pattern:
        "Derive both eigenvalues and eigenvectors, verify them, and explain invariant directions without copying a source matrix.",
      evidence: [
        {
          documentId: "mit-eigenvalues",
          page: 2,
          description: "Eigenvalue and nullspace calculation",
        },
      ],
    },
    {
      number: 3,
      topic: "Matrix-vector transformation reasoning",
      type: "free-response",
      points: 30,
      minutes: 18,
      difficulty: "transfer",
      pattern:
        "Apply the matrix to a probe vector, distinguish an eigenvector from a general input, and reconcile numerical and diagram evidence.",
      evidence: [
        {
          documentId: "mit-eigenvalues",
          page: 1,
          description: "Matrix action and invariant directions",
        },
      ],
    },
  ],
});
if (command === "status") {
  console.log(
    JSON.stringify({
      protocol: protocol.id,
      frozenAt: frozen.frozenAt,
      model: modelConfig().model,
      keyConfigured: !!process.env.MODEL_API_KEY,
      generationDocuments: packet.documents.length,
      batchCeilingUsd: protocol.batchCeilingUsd,
    }),
  );
  process.exit(0);
}
if (command !== "run") throw new Error("Use prepare, status, or run.");
if (!process.env.MODEL_API_KEY)
  throw new Error("MODEL_API_KEY is required. No model requests made.");
const cfg = modelConfig();
if (
  cfg.model !== protocol.model ||
  cfg.inputRate !== protocol.inputUsdPerMillion ||
  cfg.outputRate !== protocol.outputUsdPerMillion
)
  throw new Error(
    "Configured model/pricing differs from the frozen protocol. Review pricing and version the protocol before running.",
  );
const expectedInference = protocol.inference || {
  maxOutputTokens: 9000,
  reasoningEffort: "auto",
};
if (
  cfg.maxOutputTokens !== expectedInference.maxOutputTokens ||
  (cfg.reasoningEffort || "auto") !== expectedInference.reasoningEffort
)
  throw new Error(
    "Inference settings differ from the frozen protocol. Use the matching profile and explicit environment settings.",
  );
const batchId = process.argv[3];
if (!batchId || !/^[a-zA-Z0-9_-]{1,60}$/.test(batchId))
  throw new Error("Provide a unique batch ID: run <batch-id>.");
const batchDir = path.join(outputRoot, batchId);
await mkdir(batchDir); // Never overwrite or silently replace an earlier batch.
const cost = () =>
  usageSummary().buckets.reduce(
    (sum, bucket) => sum + Number(bucket.spent || 0),
    0,
  );
const startCost = cost();
const provider = new MetaProvider();
const bounded: AssessmentProvider = {
  async structured<T>(request: ModelRequest<T>) {
    // Leave room for the maximum reservation of the next call, including its retries.
    const perCall = Number(process.env.VERA_CALL_RESERVATION_USD || 0.5);
    if (cost() - startCost + 3 * perCall > protocol.batchCeilingUsd)
      throw new Error(
        "Frozen evaluation batch spending ceiling reached; remaining attempts are failures, not replacements.",
      );
    console.log(`${request.jobId}: ${request.name}`);
    return provider.structured(request);
  },
};
type Result = {
  repeat: number;
  candidate: string;
  latencyMs: number;
  error?: string;
  artifact?: {
    scenario?: Scenario;
    exam: Exam;
    issues: Issue[];
    ready: boolean;
  };
  analysis?: Blueprint;
  costUsdIncludingUncertain: number;
  usageBefore: ReturnType<typeof usageSummary>;
  usageAfter: ReturnType<typeof usageSummary>;
};
const report = {
  protocol: protocol.id,
  protocolSha256: frozen.protocolSha256,
  frozenAt: frozen.frozenAt,
  sourcePacketSha256: frozen.packetSha256,
  startedAt: new Date().toISOString(),
  model: cfg.model,
  inference: expectedInference,
  batchCeilingUsd: protocol.batchCeilingUsd,
  status: "running",
  limitations: protocol.limitations,
  target,
  attempts: [] as Result[],
  metrics: [] as unknown[],
};
await writeJson(path.join(batchDir, "report.json"), report);
for (let repeat = 1; repeat <= protocol.repeats; repeat++) {
  for (const candidate of protocol.order[repeat - 1]) {
    const before = usageSummary(),
      beforeCost = cost(),
      started = Date.now();
    const result: Result = {
      repeat,
      candidate,
      latencyMs: 0,
      costUsdIncludingUncertain: 0,
      usageBefore: before,
      usageAfter: before,
    };
    try {
      if (candidate === "direct-meta") {
        const attachments = packet.documents.flatMap((document) =>
          document.pages
            .filter((page) => page.imagePath && !page.duplicateOf)
            .map((page) => ({
              name: `${document.id}:page-${page.number}`,
              mime: "image/png" as const,
              path: page.imagePath!,
            })),
        );
        const direct = await bounded.structured({
          name: "mit_direct_baseline",
          jobId: `${batchId}-${repeat}-direct`,
          schema: z.object({ scenario: Scenario, exam: Exam }),
          attachments,
          signal: AbortSignal.timeout(8 * 60_000),
          prompt: `Create one original linear algebra practice exam with a shared small-integer 2x2 transformation-lab scenario, coherent exhibits, complete worked solutions, and point-summing rubrics. Match the approved student settings exactly: ${JSON.stringify(target)}. Available exhibit IDs: calibration (matrix), vectors (computed input/output measurements), diagram (computed SVG). Every question must contain matching checkable image, determinant, trace, or eigenpair claims. The application derives all measurements and coordinates from your matrix. Do not copy a source matrix or question. The attached sources are the complete allowed evidence; attachment names identify document and page. UNTRUSTED_SOURCE_JSON: ${packetText(packet)}`,
        });
        const issues = checkExam(
          direct.exam,
          target,
          direct.scenario,
          packetText(packet),
        );
        result.artifact = {
          ...direct,
          issues,
          ready: !issues.some((issue) => issue.severity === "error"),
        };
      } else {
        put("packet", packet);
        const now = new Date().toISOString();
        const analysisJob: Job = {
          id: id(),
          packetId: packet.id,
          kind: "analyze",
          stage: "Evaluation analysis",
          status: "running",
          createdAt: now,
          updatedAt: now,
        };
        put("job", analysisJob);
        await runJob(analysisJob, bounded, AbortSignal.timeout(8 * 60_000));
        const analysis = get<Revision>(
          "revision",
          get<Job>("job", analysisJob.id)!.resultId!,
        )!;
        result.analysis = analysis.blueprint;
        const approved = put<Revision>("revision", {
          id: id(),
          packetId: packet.id,
          approved: true,
          createdAt: new Date().toISOString(),
          blueprint: {
            ...analysis.blueprint,
            ...target,
            observations: [
              ...analysis.blueprint.observations,
              ...target.observations,
            ],
            uncertainties: [
              ...analysis.blueprint.uncertainties,
              ...target.uncertainties,
            ],
          },
        });
        const generation: Job = {
          ...analysisJob,
          id: id(),
          kind: "generate",
          revisionId: approved.id,
        };
        put("job", generation);
        await runJob(generation, bounded, AbortSignal.timeout(8 * 60_000));
        result.artifact = get<CheckedExam>(
          "exam",
          get<Job>("job", generation.id)!.resultId!,
        );
        if (!result.artifact)
          throw new Error("Pipeline produced no published exam.");
      }
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : "Evaluation failed";
    }
    result.latencyMs = Date.now() - started;
    result.costUsdIncludingUncertain = cost() - beforeCost;
    result.usageAfter = usageSummary();
    report.attempts.push(result);
    await writeJson(path.join(batchDir, `${repeat}-${candidate}.json`), result);
    await writeJson(path.join(batchDir, "report.json"), report);
    console.log(
      `${repeat} ${candidate}: ${result.error || (result.artifact?.ready ? "checks passed" : "unresolved checks")}; ${result.latencyMs}ms; USD ${result.costUsdIncludingUncertain.toFixed(4)}`,
    );
  }
}
// Only after ALL generation artifacts are saved do we extract target text for comparison.
const { PDFParse } = await import("pdf-parse");
const targetSource = frozen.sources.find(
  (source) => source.partition === "heldout-question",
)!;
const parser = new PDFParse({
  data: new Uint8Array(await readFile(targetSource.file)),
});
let targetText = "";
try {
  targetText = (await parser.getText()).text;
} finally {
  await parser.destroy();
}
report.metrics = ["direct-meta", "vera"].map((candidate) => {
  const runs = report.attempts.filter((run) => run.candidate === candidate),
    failed = countFailures(runs);
  return {
    candidate,
    attempts: runs.length,
    failed,
    passed: runs.length - failed,
    failureRate: failed / runs.length,
    meanLatencyMsIncludingFailures:
      runs.reduce((sum, run) => sum + run.latencyMs, 0) / runs.length,
    costUsdIncludingUncertain: runs.reduce(
      (sum, run) => sum + run.costUsdIncludingUncertain,
      0,
    ),
    generatedQuestions: runs.reduce(
      (sum, run) => sum + (run.artifact?.exam.questions.length || 0),
      0,
    ),
    numericalErrors: runs.reduce(
      (sum, run) =>
        sum +
        (run.artifact?.issues.filter((issue) =>
          ["NUMERICAL_CLAIM", "EIGENPAIR", "MC_NUMERICAL_KEY"].includes(
            issue.code,
          ),
        ).length || 0),
      0,
    ),
    sourceOverlapWarnings: runs.reduce(
      (sum, run) =>
        sum +
        (run.artifact?.issues.filter((issue) => issue.code === "SOURCE_OVERLAP")
          .length || 0),
      0,
    ),
    heldoutLexicalOverlapRates: runs.map(
      (run) =>
        run.artifact?.exam.questions.map((question) => ({
          number: question.number,
          rate: sourceOverlapRate(question.question, targetText),
        })) || [],
    ),
    conceptualCorrectness:
      "Requires external assessment of full reasoning, beyond the machine-readable claims.",
    fullMitCoverage:
      "Not established: this protocol restricts both arms to VERA's 2x2 scope.",
  };
});
report.status = "completed_requires_external_grading";
await writeJson(path.join(batchDir, "report.json"), report);
console.log(
  `Saved ${report.attempts.length} attempts; USD ${(cost() - startCost).toFixed(4)} including uncertain reservations. Results: ${batchDir}`,
);

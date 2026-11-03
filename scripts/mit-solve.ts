import "./environment.mjs";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ingest } from "../lib/ingestion";
import { MetaProvider, modelConfig } from "../lib/provider";
import { usageSummary } from "../lib/store";
import { assertFrozen, type EvaluationSource } from "../lib/evaluation";

const profile =
  process.argv
    .find((arg) => arg.startsWith("--profile="))
    ?.slice("--profile=".length) || "configured-v2";
if (!/^[a-z0-9-]+$/.test(profile)) throw new Error("Invalid profile.");
const protocolDir =
  profile === "initial" ? "fixtures/mit-ocw" : `fixtures/mit-ocw/${profile}`;
const protocolBytes = await readFile(`${protocolDir}/protocol.json`, "utf8");
const protocol = JSON.parse(protocolBytes);
process.env.VERA_BUDGET_DIR ||= ".vera";
process.env.VERA_DATA_DIR = ".vera/evaluations/mit-ocw";
process.env.VERA_BUDGET_BUCKET = "development";
const frozen = JSON.parse(
  await readFile(
    path.join(process.env.VERA_DATA_DIR, protocol.id, "frozen.json"),
    "utf8",
  ),
);
assertFrozen(frozen.protocolSha256, protocolBytes, "Protocol");
const batchId = process.argv[2];
if (!batchId || !/^[a-zA-Z0-9_-]+$/.test(batchId))
  throw new Error("Supply the completed generation batch ID.");
const batchDir = path.resolve(
  profile === "initial" ? "output/mit-ocw" : `output/mit-ocw/${profile}`,
  batchId,
);
const report = JSON.parse(
  await readFile(path.join(batchDir, "report.json"), "utf8"),
);
if (
  report.status !== "completed_requires_external_grading" ||
  report.attempts.length !== 6
)
  throw new Error(
    "Complete and retain all six generation attempts before opening the held-out solve.",
  );
const destination = path.join(batchDir, "heldout-solve.json");
try {
  await access(destination);
  throw new Error("Held-out solve already exists; do not replace its result.");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const cfg = modelConfig();
if (
  cfg.model !== report.model ||
  cfg.maxOutputTokens !== report.inference.maxOutputTokens ||
  (cfg.reasoningEffort || "auto") !== report.inference.reasoningEffort
)
  throw new Error(
    "Use the same model and inference settings as the generation batch.",
  );
if (
  report.attempts.reduce(
    (sum: number, run: { costUsdIncludingUncertain: number }) =>
      sum + run.costUsdIncludingUncertain,
    0,
  ) +
    3 * Number(process.env.VERA_CALL_RESERVATION_USD || 0.5) >
  protocol.batchCeilingUsd
)
  throw new Error("Insufficient batch allowance for the held-out solve.");
const source = (
  frozen.sources as (EvaluationSource & { file: string; sha256: string })[]
).find((item) => item.partition === "heldout-question")!;
const bytes = await readFile(source.file);
assertFrozen(source.sha256, bytes, source.id);
const document = await ingest(
  new File([bytes], "heldout-quiz.pdf", { type: "application/pdf" }),
  "past-exam",
  "mit-heldout-solve-only",
);
const numeric = z.object({
  projectionMatrix: z.array(z.array(z.string())),
  columnBasis: z.array(z.array(z.string())),
  nullBasis: z.array(z.array(z.string())),
  projectionEigenvalues: z.array(z.string()),
  projectionTrace: z.string(),
  detAnExpression: z.string(),
  inverseA4FirstEntry: z.string(),
  eigenvalueOneVectorsA3: z.array(z.array(z.string())),
  otherEigenvalueA3: z.string(),
  otherEigenvectorA3: z.array(z.string()),
});
const schema = z.object({
  answers: z.array(
    z.object({ part: z.string(), answer: z.string(), reasoning: z.string() }),
  ),
  numeric,
  uncertainties: z.array(z.string()),
});
const total = () =>
  usageSummary().buckets.reduce(
    (sum, bucket) => sum + Number(bucket.spent || 0),
    0,
  );
const before = usageSummary(),
  beforeCost = total(),
  started = Date.now();
const artifact: {
  status: string;
  evaluator: string;
  model: string;
  inference: unknown;
  sourceSha256: string;
  officialSolutionsProvided: boolean;
  result?: z.infer<typeof schema>;
  error?: string;
  latencyMs?: number;
  costUsdIncludingUncertain?: number;
  usageBefore: unknown;
  usageAfter?: unknown;
} = {
  status: "running",
  evaluator: "Underlying Meta model, not the VERA generation workflow",
  model: cfg.model,
  inference: report.inference,
  sourceSha256: source.sha256,
  officialSolutionsProvided: false,
  usageBefore: before,
};
await writeFile(destination, JSON.stringify(artifact, null, 2));
try {
  artifact.result = await new MetaProvider().structured({
    jobId: `heldout-${batchId}`,
    name: "mit_heldout_independent_solve",
    schema,
    signal: AbortSignal.timeout(8 * 60_000),
    attachments: document.pages
      .filter((page) => page.imagePath)
      .map((page) => ({
        name: `question-page-${page.number}`,
        mime: "image/png" as const,
        path: page.imagePath!,
      })),
    prompt: `Independently solve every part of the attached MIT 18.06 Quiz 2 question paper. No answer key is provided. Return answers and concise reasoning for parts 1a, 1b, 1c, 2a, 2b, 2c, 3a, 3b, 3c, 3d, and flag ambiguity rather than inventing missing assumptions. Use the page images to resolve matrix layout. Provide numeric fields for independent exact-arithmetic checking. Represent every numeric matrix/vector entry as an integer or rational string such as "-2/3" with no TeX. projectionEigenvalues must include multiplicities. Give basis vectors as rows of columnBasis/nullBasis arrays. eigenvalueOneVectorsA3 must contain the two requested orthogonal eigenvectors. For detAnExpression use only n, integer constants, parentheses and + - * / ** operators, not TeX; retain a general derivation in the reasoning. The remaining symbolic formulas belong in answers. This solve measures model capability, not exam-generation fidelity. UNTRUSTED_QUESTION_PAGES: ${JSON.stringify(document.pages.map((page) => ({ page: page.number, text: page.text })))}`,
  });
  artifact.status = "completed_requires_reference_review";
} catch (error) {
  artifact.status = "failed";
  artifact.error =
    error instanceof Error ? error.message : "Held-out solve failed";
}
artifact.latencyMs = Date.now() - started;
artifact.costUsdIncludingUncertain = total() - beforeCost;
artifact.usageAfter = usageSummary();
await writeFile(destination, JSON.stringify(artifact, null, 2) + "\n");
console.log(
  JSON.stringify({
    status: artifact.status,
    error: artifact.error,
    latencyMs: artifact.latencyMs,
    costUsdIncludingUncertain: artifact.costUsdIncludingUncertain,
    output: destination,
  }),
);

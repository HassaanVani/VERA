import "./environment.mjs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  benchmarkCourses,
  benchmarkBlueprint,
  type BenchmarkSource,
} from "../lib/ocw-benchmark";
import {
  V2Exam,
  type Packet,
  type CheckedExam,
  type Job,
  type Revision,
  type PipelineArtifact,
} from "../lib/contracts";
import { ingest, deduplicate } from "../lib/ingestion";
import { sha256, assertFrozen } from "../lib/evaluation";
import {
  MetaProvider,
  modelConfig,
  type AssessmentProvider,
  type Attachment,
} from "../lib/provider";
import {
  get,
  put,
  id,
  list,
  spendingLimit,
  usageSummary,
  usageDb,
} from "../lib/store";
import { runJob } from "../lib/pipeline";
import { generalGenerationPrompt, packetText } from "../lib/prompts";
import { checkExam, sourceOverlapRate } from "../lib/domain";
import { excludedFromModel } from "../lib/source-policy";
import { verifyExam } from "../lib/verification";

const command = process.argv[2] || "status",
  batch = process.argv[3];
process.env.VERA_BUDGET_DIR ||= path.resolve(
  process.env.VERA_DATA_DIR || ".vera",
);
process.env.VERA_DATA_DIR = ".vera/evaluations/ocw-cross-subject";
process.env.VERA_BUDGET_BUCKET = "development";
const root = path.resolve(process.env.VERA_DATA_DIR),
  publicRoot = "fixtures/ocw-cross-subject";
const limitId = "ocw-cross-subject-v2-additional-20usd";
const codeFiles = [
  "lib/contracts.ts",
  "lib/prompts.ts",
  "lib/pipeline.ts",
  "lib/domain.ts",
  "lib/verification.ts",
  "lib/provider.ts",
  "lib/feedback.ts",
  "lib/source-policy.ts",
  "lib/store.ts",
  "lib/ocw-benchmark.ts",
  "scripts/ocw-evaluate.ts",
];
const json = (file: string, value: unknown) =>
  writeFile(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const exists = async (file: string) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
const spent = () =>
  usageSummary().buckets.reduce((n, b) => n + Number(b.spent), 0);
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      codeFiles.map(async (f) => [f, sha256(await readFile(f))]),
    ),
  );
const packetHash = (p: Packet) =>
  sha256(
    JSON.stringify({
      ...p,
      createdAt: "frozen",
      documents: p.documents.map((d) => ({
        ...d,
        filePath: "",
        pages: d.pages.map((p) => ({
          ...p,
          imagePath: p.imagePath ? "available" : undefined,
        })),
      })),
    }),
  );
type Frozen = {
  protocol: unknown;
  sources: (BenchmarkSource & {
    course: string;
    phase: string;
    file: string;
    downloadUrl: string;
    sha256: string;
  })[];
  packets: {
    course: string;
    phase: "development" | "evaluation";
    packet: Packet;
    hash: string;
  }[];
};
const protocol = {
  id: "ocw-cross-subject-v2",
  developmentPairsPerCourse: 2,
  finalPairsPerCourse: 3,
  questions: 3,
  points: 30,
  minutes: 30,
  additionalCapUsd: 20,
  order: ["direct-meta,vera", "vera,direct-meta", "direct-meta,vera"],
  model: "muse-spark-1.3",
  maxOutputTokens: 16000,
  reasoningEffort: "low",
  inputUsdPerMillion: 1.25,
  outputUsdPerMillion: 4.25,
  pricingChecked: "2026-11-03",
  pricingSource: "https://dev.meta.ai/docs/pricing-rate-limits",
  courses: benchmarkCourses,
  limitations: [
    "Selected course excerpts, not representative of all subjects or full MIT exams.",
    "History uses writing assignments without an official answer key.",
    "Topic/format/reasoning alignment judged by a model is provisional, not independent ground truth.",
    "Public-source pretraining contamination cannot be ruled out.",
    "The prior linear algebra development target was already inspected in an earlier evaluation.",
    "Cross-semester notes do not support chronological exam-prediction claims.",
    "Failures stay in denominators. No learning gains or difficulty equivalence are established.",
  ],
};
await mkdir(root, { recursive: true });
await mkdir(publicRoot, { recursive: true });

async function download(source: BenchmarkSource) {
  const response = await fetch(source.url, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error(`Source ${source.id}: HTTP ${response.status}`);
  if (source.html || source.url.endsWith(".pdf"))
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      url: source.url,
    };
  const html = await response.text(),
    links = [...html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)].map(
      (m) => new URL(m[1].replace(/&amp;/g, "&"), source.url).href,
    );
  const url = links.find((link) => new URL(link).hostname === "ocw.mit.edu");
  if (!url) throw new Error(`No first-party PDF download for ${source.id}`);
  const pdf = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!pdf.ok) throw new Error(`PDF ${source.id}: HTTP ${pdf.status}`);
  return { bytes: new Uint8Array(await pdf.arrayBuffer()), url };
}

if (command === "prepare") {
  if (await exists(path.join(root, "frozen.json")))
    throw new Error("Sources already frozen; refusing overwrite.");
  const frozen: Frozen = { protocol, sources: [], packets: [] };
  for (const course of benchmarkCourses)
    for (const phase of ["development", "evaluation"] as const) {
      const documents: Packet["documents"] = [];
      for (const source of course[phase]) {
        console.log(
          `Prepare ${phase}/${course.id}/${source.id} · ${source.partition}`,
        );
        const downloaded = await download(source),
          file = path.join(
            root,
            `${source.id}.${source.html ? "html" : "pdf"}`,
          );
        if (await exists(file))
          assertFrozen(
            sha256(downloaded.bytes),
            await readFile(file),
            `Partial preparation ${source.id}`,
          );
        else await writeFile(file, downloaded.bytes, { flag: "wx" });
        frozen.sources.push({
          ...source,
          course: course.id,
          phase,
          file,
          downloadUrl: downloaded.url,
          sha256: sha256(downloaded.bytes),
        });
        if (source.partition !== "generation") continue; // Never extract evaluation targets during preparation.
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(downloaded.bytes) });
        const total = (await parser.getInfo()).total;
        await parser.destroy();
        const pages = source.pages?.filter((p) => p <= total);
        const document = await ingest(
          new File([downloaded.bytes], `${source.id}.pdf`, {
            type: "application/pdf",
          }),
          source.role,
          `${course.id}-${phase}`,
          pages ? { pages } : undefined,
        );
        document.id = source.id;
        // Evaluation transmits text plus uncertain mathematical pages only; third-party slide images are not sent.
        if (course.id === "psychology" || course.id === "history")
          for (const page of document.pages) page.imagePath = undefined;
        documents.push(document);
      }
      const packet: Packet = {
        id: `${course.id}-${phase}`,
        name: `${course.subject} ${phase} OCW excerpts`,
        createdAt: new Date().toISOString(),
        fixture: false,
        documents: deduplicate(documents),
      };
      frozen.packets.push({
        course: course.id,
        phase,
        packet,
        hash: packetHash(packet),
      });
    }
  await json(path.join(root, "frozen.json"), frozen);
  await json(`${publicRoot}/protocol.json`, protocol);
  await json(`${publicRoot}/frozen-sources.json`, {
    protocolSha256: sha256(await readFile(`${publicRoot}/protocol.json`)),
    frozenAt: new Date().toISOString(),
    sources: frozen.sources.map((s) => ({
      id: s.id,
      url: s.url,
      role: s.role,
      partition: s.partition,
      pages: s.pages,
      html: s.html,
      section: s.section,
      course: s.course,
      phase: s.phase,
      downloadUrl: s.downloadUrl,
      sha256: s.sha256,
    })),
    packets: frozen.packets.map((p) => ({
      course: p.course,
      phase: p.phase,
      hash: p.hash,
      pages: p.packet.documents.map((d) => ({
        id: d.id,
        pages: d.pages.map((p) => p.number),
      })),
    })),
  });
  console.log(
    "Prepared and frozen. No paid calls; targets remain unextracted.",
  );
  process.exit(0);
}
if (!(await exists(path.join(root, "frozen.json"))))
  throw new Error("Run prepare first.");
const frozen = JSON.parse(
  await readFile(path.join(root, "frozen.json"), "utf8"),
) as Frozen;
const publicFreeze = JSON.parse(
  await readFile(`${publicRoot}/frozen-sources.json`, "utf8"),
);
assertFrozen(
  publicFreeze.protocolSha256,
  await readFile(`${publicRoot}/protocol.json`),
  "Protocol",
);
if (
  sha256(JSON.stringify(protocol)) !== sha256(JSON.stringify(frozen.protocol))
)
  throw new Error("Benchmark protocol changed after preparation.");
for (const source of frozen.sources)
  assertFrozen(source.sha256, await readFile(source.file), source.id);
for (const p of frozen.packets)
  if (p.hash !== packetHash(p.packet))
    throw new Error(`Frozen packet changed: ${p.course}/${p.phase}`);
if (command === "status") {
  console.log(
    JSON.stringify(
      {
        prepared: true,
        sources: frozen.sources.length,
        packets: frozen.packets.length,
        usage: usageSummary(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (command === "freeze") {
  if (!batch || !/^[a-z0-9-]+$/.test(batch))
    throw new Error("Supply a development batch id.");
  const development = JSON.parse(
    await readFile(`output/ocw-cross-subject/${batch}/report.json`, "utf8"),
  );
  if (development.phase !== "development" || development.runs.length !== 16)
    throw new Error(
      "Finish and retain all 16 development attempts before freezing.",
    );
  await json(`${publicRoot}/candidate.json`, {
    frozenAt: new Date().toISOString(),
    developmentBatch: batch,
    sourceFreezeSha256: sha256(
      await readFile(`${publicRoot}/frozen-sources.json`),
    ),
    files: await hashes(),
    inference: modelConfig(),
  });
  console.log(
    "Candidate frozen. Final evaluation cannot modify these implementation files.",
  );
  process.exit(0);
}
if (
  !["development", "final"].includes(command) ||
  !batch ||
  !/^[a-z0-9-]+$/.test(batch)
)
  throw new Error(
    "Commands: prepare | status | development <batch> | freeze <development-batch> | final <batch>",
  );
const phase = command === "development" ? "development" : "evaluation";
if (phase === "evaluation") {
  const candidate = JSON.parse(
    await readFile(`${publicRoot}/candidate.json`, "utf8"),
  );
  assertFrozen(
    candidate.sourceFreezeSha256,
    await readFile(`${publicRoot}/frozen-sources.json`),
    "Source freeze",
  );
  const current = await hashes();
  for (const file of codeFiles)
    if (current[file] !== candidate.files[file])
      throw new Error(`Candidate changed after freeze: ${file}`);
}
const cfg = modelConfig();
if (
  cfg.model !== protocol.model ||
  cfg.maxOutputTokens !== protocol.maxOutputTokens ||
  cfg.reasoningEffort !== protocol.reasoningEffort ||
  cfg.inputRate !== protocol.inputUsdPerMillion ||
  cfg.outputRate !== protocol.outputUsdPerMillion
)
  throw new Error("Model settings/pricing differ from the frozen protocol.");
if (!process.env.MODEL_API_KEY) throw new Error("Missing server credentials.");
const output = `output/ocw-cross-subject/${batch}`;
await mkdir("output/ocw-cross-subject", { recursive: true });
await mkdir(output, { recursive: false });
const limit = spendingLimit(limitId, 20);
process.env.VERA_EVALUATION_LIMIT_ID = limitId;
const provider = new MetaProvider(),
  before = spent();
type Run = {
  course: string;
  phase: string;
  repeat: number;
  candidate: string;
  latencyMs: number;
  cost: number;
  error?: string;
  artifact?: CheckedExam;
  analysis?: unknown;
  repairHistory?: PipelineArtifact[];
  metrics?: unknown;
};
const runs: Run[] = [];
const runningCodeHashes = await hashes();
const report = () => ({
  protocol: protocol.id,
  phase,
  batch,
  createdAt: new Date().toISOString(),
  inference: cfg,
  codeHashes: runningCodeHashes,
  sourceFreezeSha256: sha256(JSON.stringify(publicFreeze)),
  runs,
  cost: spent() - before,
  additionalUsageSinceCap: spent() - limit.baseline,
  limitations: protocol.limitations,
});
// Two courses at a time; each course's pairs and candidate order remain sequential.
async function courseRuns(course: (typeof benchmarkCourses)[number]) {
  const packet = frozen.packets.find(
    (p) => p.course === course.id && p.phase === phase,
  )!.packet;
  const target = benchmarkBlueprint(course, phase, packet),
    attachments: Attachment[] = packet.documents.flatMap((d) =>
      d.pages
        .filter(
          (p) =>
            p.needsVision &&
            p.imagePath &&
            !p.duplicateOf &&
            !excludedFromModel(p),
        )
        .map((p) => ({
          name: `${d.id}:page-${p.number}`,
          mime: "image/png" as const,
          path: p.imagePath!,
        })),
    );
  for (let repeat = 0; repeat < (phase === "development" ? 2 : 3); repeat++)
    for (const candidate of repeat % 2
      ? ["vera", "direct-meta"]
      : ["direct-meta", "vera"]) {
      const started = Date.now(),
        run: Run = {
          course: course.id,
          phase,
          repeat: repeat + 1,
          candidate,
          latencyMs: 0,
          cost: 0,
        };
      const callJobs = new Set<string>();
      const bounded: AssessmentProvider = {
        async structured(request) {
          callJobs.add(request.jobId);
          const value = await provider.structured(request);
          return value;
        },
      };
      try {
        if (candidate === "direct-meta") {
          const exam = await bounded.structured({
            name: "Direct generation",
            schema: V2Exam,
            jobId: `${batch}:${course.id}:${repeat}:direct`,
            signal: AbortSignal.timeout(8 * 60_000),
            prompt: `${generalGenerationPrompt(target)}\nUNTRUSTED_COURSE_EVIDENCE: ${packetText(packet)}`,
            attachments,
          });
          const issues = checkExam(
            exam,
            target,
            undefined,
            packetText(packet),
            packet,
          );
          run.artifact = {
            id: id(),
            packetId: packet.id,
            revisionId: "direct",
            exam,
            issues,
            verification: verifyExam(exam, { packet }),
            review: { questions: [] },
            repairAttempts: 0,
            ready: !issues.some((i) => i.severity === "error"),
            fixture: false,
            schemaVersion: 2,
            createdAt: new Date().toISOString(),
          };
        } else {
          put("packet", packet);
          const now = new Date().toISOString();
          const analysis = put<Job>("job", {
            id: id(),
            packetId: packet.id,
            kind: "analyze",
            status: "running",
            stage: "analysis",
            createdAt: now,
            updatedAt: now,
          });
          await runJob(analysis, bounded, AbortSignal.timeout(8 * 60_000));
          run.analysis = get<Revision>(
            "revision",
            get<Job>("job", analysis.id)!.resultId!,
          )?.blueprint;
          // Both workflows share the same explicit target. Analysis is recorded, not substituted into the comparison target.
          const revision = put<Revision>("revision", {
            id: id(),
            packetId: packet.id,
            blueprint: target,
            approved: true,
            createdAt: now,
          });
          const job = put<Job>("job", {
            id: id(),
            packetId: packet.id,
            revisionId: revision.id,
            kind: "generate",
            status: "running",
            stage: "generate",
            createdAt: now,
            updatedAt: now,
          });
          await runJob(job, bounded, AbortSignal.timeout(8 * 60_000));
          run.artifact = get<CheckedExam>(
            "exam",
            get<Job>("job", job.id)!.resultId!,
          );
          run.repairHistory = list<PipelineArtifact>("artifact").filter(
            (a) => a.jobId === job.id || a.jobId === analysis.id,
          );
        }
        if (!run.artifact)
          throw new Error("No assessment artifact was published.");
        const v = run.artifact.verification ?? [],
          q = run.artifact.exam.questions;
        run.metrics = {
          questions: q.length,
          numericalClaims: v.filter((v) =>
            ["arithmetic", "polynomial", "matrix-2x2"].includes(v.method),
          ).length,
          numericalClaimsPassed: v.filter(
            (v) =>
              ["arithmetic", "polynomial", "matrix-2x2"].includes(v.method) &&
              v.result === "passed",
          ).length,
          unsupportedChecks: v.filter((v) => v.result === "unsupported").length,
          sourceLocationsPassed: v.filter(
            (v) => v.method === "source-location" && v.result === "passed",
          ).length,
          questionsWithCheckableNumerics: new Set(
            v
              .filter(
                (v) =>
                  ["arithmetic", "polynomial", "matrix-2x2"].includes(
                    v.method,
                  ) && v.result === "passed",
              )
              .map((v) => v.question),
          ).size,
          originalityWarnings: run.artifact.issues.filter(
            (i) => i.code === "SOURCE_OVERLAP",
          ).length,
          blockingChecks: run.artifact.issues.filter(
            (i) => i.severity === "error",
          ).length,
        };
      } catch (error) {
        run.error =
          error instanceof Error ? error.message : "Generation failed";
      }
      run.repairHistory = list<PipelineArtifact>("artifact").filter((a) =>
        callJobs.has(a.jobId),
      );
      for (const jobId of callJobs) {
        const job = get<Job>("job", jobId);
        if (job && job.status === "running" && run.error)
          put("job", {
            ...job,
            status: "failed",
            error: run.error,
            updatedAt: new Date().toISOString(),
          });
      }
      run.cost = [...callJobs].reduce(
        (n, jobId) =>
          n +
          Number(
            (
              usageDb()
                .prepare(
                  "SELECT COALESCE(SUM(COALESCE(cost,reserved)),0) total FROM usage WHERE job_id=?",
                )
                .get(jobId) as { total: number }
            ).total,
          ),
        0,
      );
      run.latencyMs = Date.now() - started;
      runs.push(run);
      await json(`${output}/${course.id}-${repeat + 1}-${candidate}.json`, run);
      console.log(
        `${phase} ${course.id} pair ${repeat + 1} ${candidate}: ${run.error ? "FAILED: " + run.error.slice(0, 160) : run.artifact?.ready ? "checks passed" : "unresolved checks"} · ${(run.latencyMs / 1000).toFixed(1)}s`,
      );
    }
}
for (let i = 0; i < benchmarkCourses.length; i += 2)
  await Promise.all(benchmarkCourses.slice(i, i + 2).map(courseRuns));
await json(`${output}/report.json`, report());
// Target content is opened only after every generation artifact is immutable.
const alignmentSchema = z.object({
  topicCoverage: z.string(),
  formatComparison: z.string(),
  reasoningComparison: z.string(),
  uncertainty: z.string(),
});
const alignments: unknown[] = [];
for (const course of benchmarkCourses) {
  const target = frozen.sources.find(
    (s) =>
      s.course === course.id &&
      s.phase === phase &&
      s.partition === "heldout-question",
  )!;
  let targetText: string;
  if (target.html) {
    const html = await readFile(target.file, "utf8");
    const stripped = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const start = stripped.lastIndexOf(target.section ?? "Paper 1");
    targetText = stripped.slice(start, start + 6000);
  } else {
    const { PDFParse } = await import("pdf-parse"),
      parser = new PDFParse({
        data: new Uint8Array(await readFile(target.file)),
      });
    try {
      targetText = (await parser.getText({ first: 6 })).text;
    } finally {
      await parser.destroy();
    }
  }
  const courseRuns = runs.filter((r) => r.course === course.id);
  try {
    const judgment = await provider.structured({
      name: "Provisional assessment alignment",
      schema: alignmentSchema,
      jobId: `${batch}:${course.id}:alignment`,
      prompt: `Compare the generated practice to this real ${course.keyed ? "assessment" : "writing assignment"}. Report topic coverage, format, and reasoning demands with specific limitations. Do not claim equal difficulty or numerical accuracy. These are model judgments, not expert ground truth. The practice settings deliberately constrain count/points/time.\nUNTRUSTED_REFERENCE: ${targetText}\nGENERATED_PRACTICE: ${JSON.stringify(courseRuns.map((r) => ({ candidate: r.candidate, error: r.error, questions: r.artifact?.exam.questions.map((q) => ({ topic: q.topic, type: q.type, question: q.question })) })))}`,
    });
    alignments.push({
      course: course.id,
      basis: "provisional-model-judgment",
      judgment,
      referenceLexicalOverlap: courseRuns.map((r) => ({
        candidate: r.candidate,
        repeat: r.repeat,
        maxEightWordOverlap: Math.max(
          0,
          ...(r.artifact?.exam.questions ?? []).map((q) =>
            sourceOverlapRate(q.question, targetText),
          ),
        ),
      })),
      referenceHasKey: course.keyed,
    });
  } catch (error) {
    alignments.push({
      course: course.id,
      error: error instanceof Error ? error.message : "Alignment failed",
    });
  }
}
await json(`${output}/alignment.json`, alignments);
await json(`${output}/usage-final.json`, {
  before,
  after: spent(),
  cost: spent() - before,
  additionalUsageSinceCap: spent() - limit.baseline,
  cap: limit.cap,
  budget: usageSummary(),
});
console.log(
  `Finished ${runs.length} immutable attempts. Accounted batch usage including alignment: USD ${(spent() - before).toFixed(4)}.`,
);

import "./environment.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { benchmarkCourses } from "../lib/ocw-benchmark";
import { feedbackCases, controlledExam } from "../lib/controlled-feedback";
import { persistFeedback } from "../lib/feedback";
import { automaticGrade } from "../lib/verification";
import { spendingLimit, put, get, id, list, usageSummary } from "../lib/store";
import { runJob } from "../lib/pipeline";
import type {
  Packet,
  Job,
  Attempt,
  FeedbackRecord,
  PipelineArtifact,
} from "../lib/contracts";

process.env.VERA_BUDGET_DIR ||= path.resolve(
  process.env.VERA_DATA_DIR || ".vera",
);
process.env.VERA_DATA_DIR = ".vera/evaluations/ocw-cross-subject";
process.env.VERA_BUDGET_BUCKET = "development";
const limit = spendingLimit("ocw-cross-subject-v2-additional-20usd", 20);
process.env.VERA_EVALUATION_LIMIT_ID = "ocw-cross-subject-v2-additional-20usd";
const batch = process.argv[2];
if (!batch || !/^[a-z0-9-]+$/.test(batch))
  throw new Error("Supply a unique feedback batch id.");
const frozen = JSON.parse(
  await readFile(`${process.env.VERA_DATA_DIR}/frozen.json`, "utf8"),
) as { packets: { course: string; phase: string; packet: Packet }[] };
await mkdir("output/ocw-feedback", { recursive: true });
const output = `output/ocw-feedback/${batch}`;
await mkdir(output);
const spent = () =>
    usageSummary().buckets.reduce((n, b) => n + Number(b.spent), 0),
  before = spent(),
  reports = [];
for (const course of benchmarkCourses) {
  const packet = frozen.packets.find(
      (p) => p.course === course.id && p.phase === "development",
    )!.packet,
    cases = feedbackCases(course.id, packet),
    exam = controlledExam(packet, cases);
  put("packet", packet);
  put("exam", exam);
  const attempt = put<Attempt>("attempt", {
    id: id(),
    examId: exam.id,
    startedAt: Date.now(),
    endsAt: Number.MAX_SAFE_INTEGER,
    mode: "untimed",
    submittedAt: Date.now(),
    responses: Object.fromEntries(
      cases.map((c) => [c.question.number, c.response]),
    ),
    selfScores: {},
  });
  const deterministic = persistFeedback(exam, attempt, packet),
    now = new Date().toISOString(),
    job = put<Job>("job", {
      id: id(),
      kind: "feedback",
      attemptId: attempt.id,
      packetId: packet.id,
      status: "running",
      stage: "start",
      createdAt: now,
      updatedAt: now,
    });
  let error: string | undefined;
  try {
    await runJob(job, undefined, AbortSignal.timeout(8 * 60_000));
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Feedback failed";
    put("job", { ...job, status: "failed", error });
  }
  const suggestions = list<FeedbackRecord>("feedback").filter(
    (f) => f.attemptId === attempt.id && f.basis === "ai-suggestion",
  );
  const rows = cases.map((c, i) => {
    const grade = automaticGrade(c.question, c.response),
      feedback = deterministic[i];
    return {
      number: c.question.number,
      category: c.category,
      expectedAutomatic: c.expectedAutomatic,
      actualAutomatic: grade ?? null,
      automaticCheckPassed: (grade ?? null) === c.expectedAutomatic,
      deterministicBasis: feedback.basis,
      suggestionPublished: suggestions.some(
        (s) => s.question === c.question.number,
      ),
      scoreUnchanged:
        JSON.stringify(get<Attempt>("attempt", attempt.id)!.selfScores) ===
        "{}",
      interpretationVerified: false,
    };
  });
  const report = {
    course: course.id,
    attribution: course.attribution,
    cases: cases.map((c) => ({
      ...c,
      limitation:
        "VERA-authored controls tied to OCW development evidence; category labels on written samples are test intent, not expert grades.",
    })),
    rows,
    error,
    suggestions,
    artifacts: list<PipelineArtifact>("artifact").filter(
      (a) => a.jobId === job.id,
    ),
    limitations: [
      "Excerpt/criterion/citation validation does not establish factual entailment or helpfulness.",
      "No automatic grade is assigned to an essay or written explanation.",
      "Published AI suggestions remain provisional, including those about deliberately incorrect samples.",
    ],
  };
  reports.push(report);
  await writeFile(
    `${output}/${course.id}.json`,
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(
    `${course.id}: ${rows.filter((r) => r.automaticCheckPassed).length}/12 scoring-boundary controls; ${suggestions.length}/12 model suggestions published${error ? "; " + error : ""}`,
  );
}
await writeFile(
  `${output}/report.json`,
  JSON.stringify(
    {
      reports,
      cost: spent() - before,
      additionalUsageSinceCap: spent() - limit.baseline,
      limitations:
        "Feedback behavior and grounding controls, not expert validation of all criticism or learning gains.",
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);

import "./environment.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sha256 } from "../lib/evaluation";
import { MetaProvider, modelConfig } from "../lib/provider";
import { spendingLimit, usageSummary } from "../lib/store";

process.env.VERA_BUDGET_DIR ||= path.resolve(
  process.env.VERA_DATA_DIR || ".vera",
);
process.env.VERA_DATA_DIR = ".vera/evaluations/ocw-cross-subject";
process.env.VERA_BUDGET_BUCKET = "development";
spendingLimit("ocw-cross-subject-v2-additional-20usd", 20);
process.env.VERA_EVALUATION_LIMIT_ID = "ocw-cross-subject-v2-additional-20usd";
const batch = process.argv[2];
if (!batch || !/^[a-z0-9-]+$/.test(batch))
  throw new Error("Supply the completed final batch id.");
const completed = JSON.parse(
  await readFile(`output/ocw-cross-subject/${batch}/report.json`, "utf8"),
);
if (completed.phase !== "evaluation" || completed.runs.length !== 24)
  throw new Error(
    "Complete all 24 final generation attempts before the supplemental reference audit.",
  );
const frozen = JSON.parse(
  await readFile(`${process.env.VERA_DATA_DIR}/frozen.json`, "utf8"),
);
const question = frozen.sources.find(
    (s: { id: string }) => s.id === "psych-target2",
  ),
  key = frozen.sources.find((s: { id: string }) => s.id === "psych-key2");
const output = `output/ocw-reference/${batch}`;
await mkdir(output);
const { PDFParse } = await import("pdf-parse");
const parser = new PDFParse({
  data: new Uint8Array(await readFile(question.file)),
});
let text: string;
try {
  text = (await parser.getText({ partial: [1] })).text;
  const rendered = await parser.getScreenshot({
    partial: [1],
    desiredWidth: 1300,
    imageDataUrl: false,
    imageBuffer: true,
  });
  await writeFile(`${output}/question-page.png`, rendered.pages[0].data);
} finally {
  await parser.destroy();
}
// Transcribed from a rendered official key BEFORE the model call. Question 2 is
// quarantined prospectively because its colored answer conflicts with primary
// research summaries; no corrected letter is silently substituted.
const manifest = {
  kind: "post-hoc supplemental reference agreement, separate from generation benchmark",
  createdAt: new Date().toISOString(),
  model: modelConfig(),
  questionSha256: sha256(await readFile(question.file)),
  keySha256: sha256(await readFile(key.file)),
  questionPage: 1,
  officialLetters: { 1: "C", 2: "D", 3: "B", 4: "D" },
  quarantined: [
    {
      number: 2,
      reason:
        "The official key highlights inferior random-position recall for experts; primary research reports a much smaller retained advantage. Subject-expert review is needed; this item is not counted as established accuracy.",
      research: "https://pubmed.ncbi.nlm.nih.gov/24213863/",
    },
  ],
  limitation:
    "Single small post-hoc model solve, not VERA generation quality, a full MIT grade, or a clean prospective factual benchmark.",
};
await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2), {
  flag: "wx",
});
const spent = () =>
    usageSummary().buckets.reduce((n, b) => n + Number(b.spent), 0),
  before = spent(),
  start = Date.now();
let result: unknown;
try {
  const answer = await new MetaProvider().structured({
    name: "Supplemental reference MC solve",
    schema: z.object({
      answers: z
        .array(
          z.object({
            number: z.number().int().min(1).max(4),
            letter: z.enum(["A", "B", "C", "D"]),
            reasoning: z.string(),
            uncertainty: z.string(),
          }),
        )
        .length(4),
    }),
    jobId: `reference:${batch}`,
    prompt: `Solve only multiple-choice questions 1 through 4 on this question page. Return a letter, brief reasoning and any uncertainty for each. The official key is withheld. Do not assume that every possible reference key would be infallible. UNTRUSTED_QUESTION_TEXT: ${text}`,
    attachments: [
      {
        name: "question-page-1",
        mime: "image/png",
        path: `${output}/question-page.png`,
      },
    ],
  });
  if (new Set(answer.answers.map((a) => a.number)).size !== 4)
    throw new Error("Supplemental solver omitted or duplicated an item.");
  const comparison = answer.answers.map((a) => ({
    ...a,
    officialLetter: manifest.officialLetters[a.number as 1 | 2 | 3 | 4],
    agreesWithReference:
      a.letter === manifest.officialLetters[a.number as 1 | 2 | 3 | 4],
    quarantined: a.number === 2,
  }));
  result = {
    comparison,
    referenceAgreement: {
      matched: comparison.filter((c) => c.agreesWithReference).length,
      denominator: 4,
    },
    nonQuarantinedAgreement: {
      matched: comparison.filter((c) => !c.quarantined && c.agreesWithReference)
        .length,
      denominator: 3,
    },
    latencyMs: Date.now() - start,
    accountedCost: spent() - before,
    manifest,
  };
} catch (error) {
  result = {
    error: error instanceof Error ? error.message : "Reference solve failed",
    latencyMs: Date.now() - start,
    accountedCost: spent() - before,
    manifest,
  };
}
await writeFile(
  `${output}/result.json`,
  JSON.stringify(result, null, 2) + "\n",
  { flag: "wx" },
);
console.log(JSON.stringify(result, null, 2));

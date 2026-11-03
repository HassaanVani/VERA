import "./environment.mjs";
import { z } from "zod";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { MetaProvider, modelConfig } from "../lib/provider";
import { put, usageSummary, id } from "../lib/store";

const config = modelConfig();
const report = { checkedAt: new Date().toISOString(), model: config.model, inference: { maxOutputTokens: config.maxOutputTokens, reasoningEffort: config.reasoningEffort || "auto" }, status: "pending", cases: [] as { name: string; passed: boolean; error?: string }[] };
if (!process.env.MODEL_API_KEY) {
  console.log("PENDING: MODEL_API_KEY is not configured. No live calls or model quality claims made.");
} else {
  const provider = new MetaProvider();
  const schema = z.object({ eigenvalue: z.number(), vector: z.tuple([z.number(), z.number()]), explanation: z.string() });
  const cases = [
    { name: "text_and_schema", prompt: "For A=[[3,1],[1,3]], give the eigenvalue corresponding to v=[1,1]. Explain your multiplication.", attachments: [] },
    { name: "mathematical_image", prompt: "Read the calibration matrix in the attached image. Give the eigenvalue corresponding to v=[1,1] and explain.", attachments: [{ name: "calibration.png", mime: "image/png" as const, path: path.resolve("fixtures/probe-matrix.png") }] },
  ];
  for (const c of cases) {
    try { const r = await provider.structured({ ...c, name: c.name, schema, jobId: `probe-${id()}` }); report.cases.push({ name: c.name, passed: r.eigenvalue === 4 && r.vector[0] === 1 && r.vector[1] === 1 && r.explanation.length > 10 }); }
    catch (e) { report.cases.push({ name: c.name, passed: false, error: e instanceof Error ? e.message : "Probe failed" }); }
  }
  report.status = report.cases.every(c => c.passed) ? "passed" : "failed";
  if (report.status === "passed") put("probe", { id: report.model, ...report });
}
await mkdir("output", { recursive: true }); await writeFile("output/meta-probe.json", JSON.stringify({ ...report, usage: usageSummary() }, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.status === "failed") process.exitCode = 1;

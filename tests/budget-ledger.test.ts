import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { spendingLimit, usageSummary } from "../lib/store";

let directory: string;
beforeAll(() => {
  directory = mkdtempSync(path.join(tmpdir(), "vera-consolidated-budget-"));
  process.env.VERA_DATA_DIR = directory;
  process.env.VERA_BUDGET_DIR = directory;
  for (const [suffix, id, cost, reservation] of [
    ["", "old-app", 0.35, 0.4],
    ["evaluations/mit-ocw", "old-evaluation", null, 0.2],
  ] as const) {
    const folder = path.join(directory, suffix);
    mkdirSync(folder, { recursive: true });
    const database = new DatabaseSync(path.join(folder, "vera.sqlite"));
    database.exec(
      "CREATE TABLE usage(id TEXT PRIMARY KEY,job_id TEXT,stage TEXT,model TEXT,bucket TEXT,reserved REAL,cost REAL,status TEXT,input_tokens INTEGER,output_tokens INTEGER,latency_ms INTEGER,error TEXT,created TEXT)",
    );
    database
      .prepare("INSERT INTO usage VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        id,
        "old call",
        "model",
        "development",
        reservation,
        cost,
        cost === null ? "uncertain" : "settled",
        null,
        null,
        1,
        null,
        "2026-11-03",
      );
    database.close();
  }
});

describe("shared persistent spending reservations", () => {
  it("counts historical app and isolated evaluation charges once, including uncertain reservations", () => {
    const first = usageSummary();
    expect(first.buckets[0].calls).toBe(2);
    expect(first.buckets[0].spent).toBeCloseTo(0.55);
    expect(usageSummary().buckets[0].calls).toBe(2);
  });
  it("prevents two processes from simultaneously exceeding the additional cap", async () => {
    spendingLimit("race-cap", 0.05);
    const moduleUrl = pathToFileURL(path.resolve("lib/store.ts")).href;
    const code = `import { reserveUsage } from ${JSON.stringify(moduleUrl)}; try { reserveUsage('race','test','model',0.04); process.stdout.write('reserved'); } catch { process.stdout.write('blocked'); }`;
    const attempt = () =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "--input-type=module", "-e", code],
          {
            env: {
              ...process.env,
              VERA_DATA_DIR: directory,
              VERA_BUDGET_DIR: directory,
              VERA_EVALUATION_LIMIT_ID: "race-cap",
              VERA_BUDGET_BUCKET: "development",
            },
            windowsHide: true,
          },
        );
        let output = "";
        child.stdout.on("data", (chunk) => {
          output += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (status) =>
          status === 0
            ? resolve(output)
            : reject(new Error(`Child exited ${status}`)),
        );
      });
    const result = await Promise.all([attempt(), attempt()]);
    expect(result.sort()).toEqual(["blocked", "reserved"]);
  }, 20000);
});

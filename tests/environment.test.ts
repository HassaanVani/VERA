import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("worker and evaluation environment loading", () => {
  function run(external?: string) {
    const dir = mkdtempSync(path.join(tmpdir(), "vera-env-"));
    writeFileSync(
      path.join(dir, ".env"),
      "VERA_ENV_TEST_VALUE=base\nVERA_ENV_ONLY_BASE=loaded\n",
    );
    writeFileSync(path.join(dir, ".env.local"), "VERA_ENV_TEST_VALUE=local\n");
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
    delete env.__NEXT_PROCESSED_ENV;
    delete env.VERA_ENV_TEST_VALUE;
    if (external) env.VERA_ENV_TEST_VALUE = external;
    const script = `import ${JSON.stringify(pathToFileURL(path.resolve("scripts/environment.mjs")).href)}; console.log(JSON.stringify({value:process.env.VERA_ENV_TEST_VALUE,base:process.env.VERA_ENV_ONLY_BASE}));`;
    return JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        cwd: dir,
        env,
        encoding: "utf8",
      }),
    );
  }
  it("loads .env and lets .env.local override it", () =>
    expect(run()).toEqual({ value: "local", base: "loaded" }));
  it("preserves explicitly supplied environment variables", () =>
    expect(run("external")).toEqual({ value: "external", base: "loaded" }));
});

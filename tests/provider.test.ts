import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { MetaProvider, modelConfig } from "../lib/provider";
import { usageSummary } from "../lib/store";
beforeAll(() => { process.env.VERA_DATA_DIR = mkdtempSync(path.join(tmpdir(), "vera-provider-")); });
afterEach(() => { delete process.env.MODEL_API_KEY; delete process.env.META_MODEL; });
describe("Meta provider boundary", () => {
  it("fails clearly before networking when credentials are missing", async () => {
    delete process.env.MODEL_API_KEY;
    await expect(new MetaProvider().structured({ schema: z.object({ ok: z.boolean() }), name: "probe", prompt: "test", jobId: "test" })).rejects.toThrow(/MODEL_API_KEY/);
  });
  it("disables contributor mode", () => { process.env.META_MODEL = "muse-spark-1.3-contributor"; expect(() => modelConfig()).toThrow(/Standard/); });
  it("uses the documented structured response format and records usage", async () => {
    process.env.MODEL_API_KEY = "test-only";
    let sent: Record<string, unknown> = {};
    const transport: typeof fetch = async (_url, init) => { sent = JSON.parse(String(init?.body)); return Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }); };
    const result = await new MetaProvider(transport).structured({ schema: z.object({ ok: z.boolean() }), name: "test_schema", prompt: "test", jobId: "test" });
    expect(result.ok).toBe(true); expect(sent.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "test_schema" } }); expect(usageSummary().recent[0]).toMatchObject({ status: "settled", input_tokens: 10, output_tokens: 5 });
  });
  it("retains a conservative reservation on network interruption", async () => {
    process.env.MODEL_API_KEY = "test-only";
    const transport: typeof fetch = async () => { throw new Error("network interruption"); };
    await expect(new MetaProvider(transport).structured({ schema: z.object({ ok: z.boolean() }), name: "interruption", prompt: "test", jobId: "test" })).rejects.toThrow(/interruption/);
    expect(usageSummary().recent[0]).toMatchObject({ status: "uncertain", cost: null });
  });
  it("rejects truncated output and never marks it ready", async () => {
    process.env.MODEL_API_KEY = "test-only";
    const transport: typeof fetch = async () => Response.json({ choices: [{ finish_reason: "length", message: { content: '{"ok":' } }], usage: { prompt_tokens: 10, completion_tokens: 1 } });
    await expect(new MetaProvider(transport).structured({ schema: z.object({ ok: z.boolean() }), name: "truncation", prompt: "test", jobId: "test" })).rejects.toThrow(/incomplete/);
  });
});

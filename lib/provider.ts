import { z } from "zod";
import { readFile } from "node:fs/promises";
import { SYSTEM } from "./prompts";
import { reserveUsage, settleUsage } from "./store";

export type Attachment = {
  name: string;
  mime: "image/png" | "image/jpeg";
  path: string;
};
export type ModelRequest<T> = {
  schema: z.ZodType<T>;
  name: string;
  prompt: string;
  jobId: string;
  attachments?: Attachment[];
  signal?: AbortSignal;
};
export interface AssessmentProvider {
  structured<T>(request: ModelRequest<T>): Promise<T>;
}
export function modelConfig() {
  const model = process.env.META_MODEL || "muse-spark-1.3";
  if (model.includes("contributor"))
    throw new Error(
      "VERA requires Standard mode. Contributor models are disabled.",
    );
  const inputRate = Number(process.env.VERA_INPUT_USD_PER_MILLION || 1.25),
    outputRate = Number(process.env.VERA_OUTPUT_USD_PER_MILLION || 4.25);
  if (![inputRate, outputRate].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("Invalid model pricing configuration.");
  const maxOutputTokens = Number(process.env.VERA_MAX_OUTPUT_TOKENS || 16000);
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < 2048 ||
    maxOutputTokens > 24000
  )
    throw new Error(
      "VERA_MAX_OUTPUT_TOKENS must be a whole number between 2048 and 24000.",
    );
  const effort = process.env.META_REASONING_EFFORT || "low";
  if (
    !["auto", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
      effort,
    )
  )
    throw new Error(
      "Invalid META_REASONING_EFFORT. Use auto, minimal, low, medium, high, xhigh, or max.",
    );
  return {
    model,
    base: process.env.META_BASE_URL || "https://api.meta.ai/v1",
    inputRate,
    outputRate,
    maxOutputTokens,
    reasoningEffort: effort === "auto" ? undefined : effort,
  };
}
export class MetaProvider implements AssessmentProvider {
  constructor(private transport: typeof fetch = fetch) {}
  async structured<T>(r: ModelRequest<T>): Promise<T> {
    const key = process.env.MODEL_API_KEY;
    if (!key)
      throw new Error(
        "Add MODEL_API_KEY to .env.local and restart VERA to use live Meta generation. The saved demonstration works without credentials.",
      );
    const cfg = modelConfig();
    const attachments = await Promise.all(
      (r.attachments ?? []).map(async (a) => ({
        type: "image_url",
        image_url: {
          url: `data:${a.mime};base64,${(await readFile(a.path)).toString("base64")}`,
        },
      })),
    );
    if (attachments.length > 40)
      throw new Error(
        "Too many visual pages; split the packet into smaller sections.",
      );
    // UTF-8 byte length is a conservative text-token ceiling. Images reserve 8192 tokens each.
    const schema = z.toJSONSchema(r.schema, { target: "draft-7" });
    const maxOutput = cfg.maxOutputTokens,
      inputCeiling =
        Buffer.byteLength(SYSTEM + r.prompt + JSON.stringify(schema)) +
        attachments.length * 8192;
    const reservation =
      (inputCeiling * cfg.inputRate + maxOutput * cfg.outputRate) / 1e6;
    const callCap = Number(process.env.VERA_CALL_RESERVATION_USD || 0.5);
    if (!Number.isFinite(callCap) || callCap <= 0 || reservation > callCap)
      throw new Error(
        `Estimated call ceiling USD ${reservation.toFixed(3)} exceeds the configured per-call cap. Use a smaller packet.`,
      );
    for (let attempt = 0; attempt < 3; attempt++) {
      r.signal?.throwIfAborted();
      const callId = reserveUsage(
          r.jobId,
          r.name,
          cfg.model,
          Math.max(0.02, reservation),
        ),
        start = Date.now();
      let accounted = false;
      try {
        const response = await this.transport(`${cfg.base}/chat/completions`, {
          method: "POST",
          signal: AbortSignal.any([
            AbortSignal.timeout(90_000),
            ...(r.signal ? [r.signal] : []),
          ]),
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cfg.model,
            reasoning_effort: cfg.reasoningEffort,
            messages: [
              { role: "system", content: SYSTEM },
              {
                role: "user",
                content: [{ type: "text", text: r.prompt }, ...attachments],
              },
            ],
            max_completion_tokens: maxOutput,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: r.name.replace(/[^a-zA-Z0-9_]/g, "_"),
                schema,
              },
            },
          }),
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          settleUsage(callId, {
            cost: retryable ? undefined : 0,
            latency: Date.now() - start,
            error: `HTTP ${response.status}`,
          });
          accounted = true;
          if (retryable && attempt < 2) {
            const wait = Math.max(
              500 * 2 ** attempt + Math.random() * 250,
              Number(response.headers.get("Retry-After") || 0) * 1000,
            );
            if (wait > 15_000)
              throw new Error(
                "Meta is rate-limited. Retry later; no long retry loop was started.",
              );
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, wait);
              r.signal?.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  reject(new Error("Generation cancelled."));
                },
                { once: true },
              );
            });
            continue;
          }
          throw new Error(
            response.status === 401
              ? "Meta rejected the API key. Check MODEL_API_KEY and account access."
              : `Meta request failed (HTTP ${response.status}). Retry this stage later.`,
          );
        }
        const body = await response.json();
        const input = body.usage?.prompt_tokens,
          output = body.usage?.completion_tokens;
        const validUsage =
          Number.isFinite(input) &&
          input >= 0 &&
          Number.isFinite(output) &&
          output >= 0;
        settleUsage(callId, {
          cost: validUsage
            ? (input * cfg.inputRate + output * cfg.outputRate) / 1e6
            : undefined,
          input,
          output,
          latency: Date.now() - start,
        });
        accounted = true;
        if (body.choices?.[0]?.finish_reason !== "stop")
          throw new Error(
            `Meta output was incomplete or refused (finish_reason=${body.choices?.[0]?.finish_reason || "missing"}). Review the output-token limit and reasoning effort; no partial result was marked ready.`,
          );
        return r.schema.parse(JSON.parse(body.choices[0].message.content));
      } catch (error) {
        if (!accounted)
          settleUsage(callId, {
            latency: Date.now() - start,
            error:
              "Interrupted or invalid provider response; reserved cost retained.",
          });
        throw error;
      }
    }
    throw new Error("Meta retry limit reached.");
  }
}

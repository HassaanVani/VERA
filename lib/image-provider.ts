import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, id, put, reserveUsage, settleUsage } from "./store";
import type { ImageArtifact } from "./contracts";

export type ImageRequest = {
  jobId: string;
  exhibitId: string;
  prompt: string;
  fingerprint: string;
  signal?: AbortSignal;
};
export interface ImageProvider {
  generate(request: ImageRequest): Promise<ImageArtifact>;
}
export function pngDimensions(bytes: Buffer) {
  if (
    bytes.length < 24 ||
    bytes.length > 12 * 1024 * 1024 ||
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new Error("Image provider did not return a supported PNG.");
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (width < 64 || height < 64 || width > 4096 || height > 4096)
    throw new Error("Generated image dimensions are outside supported bounds.");
  return { width, height };
}
async function boundedJSON(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty image response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 20 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Image response exceeds the supported size.");
    }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export class MetaImageProvider implements ImageProvider {
  constructor(private transport: typeof fetch = fetch) {}
  async generate(request: ImageRequest) {
    if (!process.env.MODEL_API_KEY)
      throw new Error(
        "Configure Meta credentials before requesting Muse Image.",
      );
    const model = process.env.META_IMAGE_MODEL || "muse-image-1.0";
    if (model !== "muse-image-1.0")
      throw new Error(
        "Recheck image model pricing and capability before changing META_IMAGE_MODEL.",
      );
    const cost = Number(process.env.VERA_IMAGE_USD_PER_IMAGE || 0.01);
    if (cost !== 0.01)
      throw new Error(
        "Muse Image pricing must match the checked USD 0.01 rate.",
      );
    for (let attempt = 0; attempt < 2; attempt++) {
      request.signal?.throwIfAborted();
      const callId = reserveUsage(
          request.jobId,
          "Generate Muse Image exhibit",
          model,
          cost,
        ),
        start = Date.now();
      let settled = false;
      try {
        const response = await this.transport(
          `${process.env.META_BASE_URL || "https://api.meta.ai/v1"}/responses`,
          {
            method: "POST",
            signal: AbortSignal.any([
              AbortSignal.timeout(180000),
              ...(request.signal ? [request.signal] : []),
            ]),
            headers: {
              Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              store: false,
              input: request.prompt,
              tools: [
                {
                  type: "image_generation",
                  enable_web_search: false,
                  enable_image_search: false,
                  enable_shell: true,
                  reasoning_strength: "high",
                  size: "auto",
                  output_format: "png",
                },
              ],
            }),
          },
        );
        if (!response.ok) {
          const retryable = response.status === 429 || response.status === 503;
          settleUsage(callId, {
            cost: retryable ? undefined : 0,
            latency: Date.now() - start,
            error: `Image HTTP ${response.status}`,
          });
          settled = true;
          if (retryable && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 750));
            continue;
          }
          throw new Error(
            `Muse Image request failed (HTTP ${response.status}).`,
          );
        }
        const payload = await boundedJSON(response);
        const items = Array.isArray(payload.output)
          ? payload.output.filter(
              (item: { type?: string }) =>
                item.type === "image_generation_call",
            )
          : [];
        if (
          payload.status !== "completed" ||
          items.length !== 1 ||
          items[0].status !== "completed" ||
          typeof items[0].result !== "string"
        )
          throw new Error(
            "Muse Image did not return one completed image; the reservation is retained.",
          );
        const encoded = items[0].result;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
          throw new Error("Malformed image payload.");
        // A completed returned image is billed even if local format checks fail.
        settleUsage(callId, { cost, latency: Date.now() - start });
        settled = true;
        const bytes = Buffer.from(encoded, "base64"),
          dimensions = pngDimensions(bytes);
        request.signal?.throwIfAborted();
        const assetId = id(),
          directory = path.join(dataDir(), "generated-images");
        await mkdir(directory, { recursive: true });
        const filePath = path.join(directory, `${assetId}.png`);
        await writeFile(filePath, bytes);
        return put<ImageArtifact>("image", {
          id: assetId,
          jobId: request.jobId,
          exhibitId: request.exhibitId,
          path: filePath,
          mime: "image/png",
          sha256: createHash("sha256").update(bytes).digest("hex"),
          fingerprint: request.fingerprint,
          model,
          ...dimensions,
          responseId: payload.id,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        if (!settled)
          settleUsage(callId, {
            latency: Date.now() - start,
            error: "Image response interrupted or invalid; charge uncertain.",
          });
        throw error;
      }
    }
    throw new Error("Muse Image retry limit reached.");
  }
}

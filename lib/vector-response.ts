import { z } from "zod";
import type { Exam } from "./contracts";
export type DiagramConfig = NonNullable<
  Exam["questions"][number]["responseDiagram"]
>;
const point = z.tuple([z.number().finite(), z.number().finite()]);
export const VectorResponse = z.object({
  version: z.literal(1),
  kind: z.literal("vector-drawing"),
  vectors: z.array(z.object({ from: point, to: point })).max(6),
  reasoning: z.string().max(12000),
});
export type VectorResponse = z.infer<typeof VectorResponse>;
const prefix = "VERA_VECTOR_V1:";
export function readVectorResponse(value: string): VectorResponse | undefined {
  if (!value.startsWith(prefix)) return undefined;
  try {
    return VectorResponse.parse(JSON.parse(value.slice(prefix.length)));
  } catch {
    return undefined;
  }
}
export const emptyVectorResponse = (): VectorResponse => ({
  version: 1,
  kind: "vector-drawing",
  vectors: [],
  reasoning: "",
});
export function encodeVectorResponse(value: VectorResponse) {
  return value.vectors.length || value.reasoning.trim()
    ? prefix + JSON.stringify(value)
    : "";
}
export function validVectorResponse(value: string, config: DiagramConfig) {
  if (!value) return true;
  const response = readVectorResponse(value);
  return (
    !!response &&
    response.vectors.length <= config.maxVectors &&
    response.vectors.every((v) =>
      [v.from, v.to].every(
        ([x, y]) =>
          x >= config.minX &&
          x <= config.maxX &&
          y >= config.minY &&
          y <= config.maxY,
      ),
    )
  );
}
export function responseText(value: string) {
  const parsed = readVectorResponse(value);
  return parsed
    ? [
        ...parsed.vectors.map(
          (v, i) =>
            `Vector ${i + 1}: (${v.from.join(", ")}) → (${v.to.join(", ")})`,
        ),
        parsed.reasoning,
      ]
        .filter(Boolean)
        .join("\n")
    : value;
}

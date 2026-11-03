import { createHash } from "node:crypto";

export type EvaluationSource = {
  id: string;
  partition: "generation" | "heldout-question" | "heldout-solution";
  role: string;
  name: string;
  url: string;
};
export const sha256 = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export function generationSources<T extends EvaluationSource>(
  sources: T[],
): T[] {
  if (new Set(sources.map((source) => source.id)).size !== sources.length)
    throw new Error("Evaluation source IDs must be unique.");
  const selected = sources.filter(
    (source) => source.partition === "generation",
  );
  if (
    !selected.length ||
    selected.some(
      (source) =>
        source.role === "solutions" || source.role === "generated-reference",
    )
  )
    throw new Error(
      "Generation sources must exclude official solutions and generated references.",
    );
  return selected;
}
export function assertFrozen(
  expected: string,
  bytes: string | Uint8Array,
  name: string,
) {
  if (sha256(bytes) !== expected)
    throw new Error(
      `${name} changed after freeze. Create a new evaluation version.`,
    );
}
export function countFailures(
  runs: {
    error?: string;
    artifact?: { ready?: boolean; issues?: { severity: string }[] };
  }[],
) {
  return runs.filter(
    (run) =>
      run.error ||
      !run.artifact ||
      run.artifact.ready === false ||
      run.artifact.issues?.some((issue) => issue.severity === "error"),
  ).length;
}

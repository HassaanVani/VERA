import { describe, expect, it } from "vitest";
import {
  assertFrozen,
  countFailures,
  generationSources,
  sha256,
  type EvaluationSource,
} from "../lib/evaluation";

describe("evaluation integrity", () => {
  const source = (
    id: string,
    partition: EvaluationSource["partition"],
    role = "lecture-notes",
  ): EvaluationSource => ({
    id,
    partition,
    role,
    name: id,
    url: "https://ocw.mit.edu/source.pdf",
  });
  it("withholds exam questions and solutions from generation", () => {
    const sources = [
      source("notes", "generation"),
      source("test", "heldout-question"),
      source("key", "heldout-solution", "solutions"),
    ];
    expect(generationSources(sources).map((item) => item.id)).toEqual([
      "notes",
    ]);
    expect(() =>
      generationSources([source("key", "generation", "solutions")]),
    ).toThrow(/exclude/);
    expect(() =>
      generationSources([
        source("same", "generation"),
        source("same", "heldout-question"),
      ]),
    ).toThrow(/unique/);
  });
  it("rejects changes to frozen inputs", () => {
    expect(() =>
      assertFrozen(sha256("original"), "original", "packet"),
    ).not.toThrow();
    expect(() => assertFrozen(sha256("original"), "edited", "packet")).toThrow(
      /freeze/,
    );
  });
  it("keeps provider failures, missing outputs, and unresolved exams in the denominator", () => {
    const runs = [
      { error: "provider down" },
      {},
      { artifact: { ready: false, issues: [] } },
      { artifact: { ready: true, issues: [{ severity: "error" }] } },
      { artifact: { ready: true, issues: [{ severity: "warning" }] } },
    ];
    expect(countFailures(runs)).toBe(4);
    expect(runs.length).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizeExhibitFields,
  materialProblems,
} from "../lib/supporting-material";
import {
  illustratedPacket,
  illustratedBlueprint,
  illustratedExam,
} from "../lib/illustrated-demo";
import type { Exam } from "../lib/contracts";

const setup = () => {
  const packet = illustratedPacket();
  return {
    packet,
    exam: illustratedExam(packet, illustratedBlueprint(packet), "revision")
      .exam,
  };
};
describe("non-semantic exhibit placeholders", () => {
  it("removes placeholder image specs and misplaced source pointers from synthetic diagrams", () => {
    const { packet, exam } = setup();
    const diagram = exam.exhibits!.find((e) => e.kind === "diagram")!;
    diagram.illustration = {
      prompt:
        "Placeholder for structured diagram; rendered as precise diagram, not Muse image.",
      description: "Accessible description of given Cartesian data.",
    };
    diagram.source = { documentId: packet.documents[0].id, page: 1 };
    const result = normalizeExhibitFields(exam);
    const clean = result.exam.exhibits!.find((e) => e.id === diagram.id)!;
    expect(clean.illustration).toBeUndefined();
    expect(clean.source).toBeUndefined();
    expect(clean.drawing).toEqual(diagram.drawing);
    expect(clean.points).toEqual(diagram.points);
    expect(result.exam.questions).toEqual(exam.questions);
    expect(result.changes[0].removed).toEqual(["illustration", "source"]);
  });
  it("removes only empty non-diagram drawing objects, retaining image prompts", () => {
    const { exam } = setup();
    const image: NonNullable<Exam["exhibits"]>[number] = {
      ...exam.exhibits![0],
      id: "image",
      kind: "image" as const,
      points: [],
      illustration: {
        prompt: "Create a clear textbook figure with original given data.",
        description: "A figure showing the original arrangement.",
      },
      drawing: {
        axes: "none" as const,
        description: "Unused",
        segments: [],
        paths: [],
        circles: [],
      },
    };
    const input: Exam = { ...exam, exhibits: [image] };
    const clean = normalizeExhibitFields(input).exam.exhibits![0];
    expect(clean.drawing).toBeUndefined();
    expect(clean.illustration).toEqual(image.illustration);
    expect(materialProblems(clean)).toEqual([]);
    image.drawing!.segments = [
      { from: "A", to: "B", arrow: true, label: "Given" },
    ];
    const conflicting = normalizeExhibitFields(input).exam.exhibits![0];
    expect(materialProblems(conflicting)).toContain(
      "Drawing data belongs only to a diagram.",
    );
  });
  it("preserves source passages and substantive conflicting specifications", () => {
    const { packet, exam } = setup();
    const passage = exam.exhibits!.find((e) => e.kind === "passage")!;
    const source = structuredClone(passage.source);
    const diagram = exam.exhibits!.find((e) => e.kind === "diagram")!;
    diagram.illustration = {
      prompt:
        "Create a physical arrangement with a battery and an open switch.",
      description:
        "An actual image request that conflicts with the selected renderer.",
    };
    const result = normalizeExhibitFields(exam);
    expect(
      result.exam.exhibits!.find((e) => e.id === passage.id)?.source,
    ).toEqual(source);
    expect(
      materialProblems(
        result.exam.exhibits!.find((e) => e.id === diagram.id)!,
        packet,
      ),
    ).toContain("Muse Image specifications belong only to image exhibits.");
    expect(normalizeExhibitFields(result.exam).changes).toEqual([]);
  });
});

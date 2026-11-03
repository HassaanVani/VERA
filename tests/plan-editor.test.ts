import { describe, expect, it } from "vitest";
import { demoBlueprint, demoPacket } from "../lib/demo";
import { EditableDraft, planProblems } from "../lib/plan-editor";

describe("reviewable exam plan drafts", () => {
  it("recovers incomplete edits without permitting approval", () => {
    const packet = demoPacket(),
      draft = demoBlueprint(packet);
    draft.title = "";
    draft.slots[0].points = 0;
    draft.totalPoints = draft.slots.reduce((sum, slot) => sum + slot.points, 0);
    expect(
      EditableDraft.safeParse(JSON.parse(JSON.stringify(draft))).success,
    ).toBe(true);
    expect(planProblems(draft, packet)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "plan-title" }),
        expect.objectContaining({ id: "plan-0-points" }),
      ]),
    );
  });
  it("rejects fractional timing and excessive totals with recoverable targets", () => {
    const packet = demoPacket(),
      draft = demoBlueprint(packet);
    draft.slots[1].minutes = 1.5;
    draft.totalPoints = 201;
    const problems = planProblems(draft, packet);
    expect(
      problems.find((problem) => problem.id === "plan-1-minutes")?.message,
    ).toContain("whole minutes");
    expect(
      problems.find((problem) => problem.id === "plan-totals")?.message,
    ).toContain("200 points");
  });
  it("preserves source validation and accepts a valid original plan", () => {
    const packet = demoPacket(),
      draft = demoBlueprint(packet);
    expect(planProblems(draft, packet)).toEqual([]);
    draft.slots[0].evidence[0].page = 999;
    expect(
      planProblems(draft, packet).some((problem) =>
        problem.message.includes("missing document or page"),
      ),
    ).toBe(true);
  });
});

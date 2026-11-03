import { z } from "zod";
import { Blueprint, Slot, type Packet } from "./contracts";
import { blueprintIssues } from "./domain";

// A draft can contain unfinished fields. It is never approved without full validation.
export const EditableDraft = Blueprint.extend({
  title: z.string(),
  totalPoints: z.number().finite(),
  minutes: z.number().finite(),
  slots: z
    .array(
      Slot.extend({
        topic: z.string(),
        points: z.number().finite(),
        minutes: z.number().finite(),
      }),
    )
    .min(1)
    .max(12),
});
export type PlanProblem = { id: string; message: string };
export function planProblems(value: Blueprint, packet: Packet): PlanProblem[] {
  const result = Blueprint.safeParse(value);
  if (!result.success)
    return result.error.issues.map((issue) => {
      const field = issue.path.at(-1);
      const index =
        issue.path[0] === "slots" ? Number(issue.path[1]) : undefined;
      const prefix = index === undefined ? "" : `Question ${index + 1}: `;
      const message =
        field === "topic"
          ? "enter a topic."
          : field === "title"
            ? "Enter an exam title of 1–160 characters."
            : field === "points"
              ? "enter whole points between 1 and 100."
              : field === "totalPoints"
                ? "The exam must total between 1 and 200 points."
                : field === "minutes"
                  ? index === undefined
                    ? "The exam must last between 1 and 180 minutes."
                    : "enter whole minutes between 1 and 120."
                  : issue.message;
      return {
        id:
          index === undefined
            ? field === "title"
              ? "plan-title"
              : "plan-totals"
            : `plan-${index}-${String(field)}`,
        message: prefix + message,
      };
    });
  return blueprintIssues(result.data, packet).map((issue) => ({
    id: "plan-totals",
    message: issue.message,
  }));
}

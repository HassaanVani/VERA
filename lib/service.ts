import { validVectorResponse } from "./vector-response";
import { z } from "zod";
import {
  Attempt,
  Blueprint,
  Job,
  Packet,
  Revision,
  CheckedExam,
} from "./contracts";
import { get, id, list, put, transaction } from "./store";
import { orderedRevisions } from "./revisions";
import { automaticGrade } from "./verification";
import { blueprintIssues, results } from "./domain";

export function queue(
  kind: Job["kind"],
  packetId: string,
  revisionId?: string,
  parentExamId?: string,
  focus?: string[],
) {
  return transaction(() => {
    if (!get<Packet>("packet", packetId)) throw new Error("Packet not found.");
    if (
      list<Job>("job").some(
        (j) =>
          j.packetId === packetId && ["running", "queued"].includes(j.status),
      )
    )
      throw new Error("This packet already has an active job.");
    if (kind !== "analyze") {
      const r = get<Revision>("revision", revisionId || "");
      if (
        !r ||
        r.packetId !== packetId ||
        !r.approved ||
        orderedRevisions(list<Revision>("revision")).find(
          (r) => r.packetId === packetId,
        )?.id !== r.id
      )
        throw new Error(
          "Approve the latest blueprint revision before generating.",
        );
      if (
        kind === "follow-up" &&
        (!r.parentExamId ||
          r.parentExamId !== parentExamId ||
          get<CheckedExam>("exam", parentExamId)?.packetId !== packetId)
      )
        throw new Error(
          "Follow-up must reference its approved parent assessment.",
        );
    }
    const now = new Date().toISOString();
    return put<Job>("job", {
      id: id(),
      kind,
      packetId,
      revisionId,
      parentExamId,
      focus,
      status: "queued",
      stage: "Waiting for local worker",
      createdAt: now,
      updatedAt: now,
    });
  });
}
export function saveRevision(
  revisionId: string,
  value: unknown,
  approve: boolean,
): Revision {
  const blueprint = Blueprint.parse(value);
  return transaction(() => {
    const old = get<Revision>("revision", revisionId);
    if (!old) throw new Error("Blueprint not found.");
    if (
      orderedRevisions(list<Revision>("revision")).find(
        (r) => r.packetId === old.packetId,
      )?.id !== old.id
    )
      throw new Error(
        "This blueprint was edited elsewhere. Reload the latest revision.",
      );
    if (
      list<Job>("job").some(
        (j) =>
          j.packetId === old.packetId &&
          ["running", "queued"].includes(j.status),
      )
    )
      throw new Error("Cancel the active job before editing this blueprint.");
    const problems = blueprintIssues(
      blueprint,
      get<Packet>("packet", old.packetId),
    );
    if (problems.length)
      throw new Error(problems.map((p) => p.message).join(" "));
    for (const r of list<Revision>("revision").filter(
      (r) => r.packetId === old.packetId && r.approved,
    ))
      put("revision", { ...r, approved: false });
    const changes = [
      old.blueprint.title !== blueprint.title ? "Exam title changed" : "",
      old.blueprint.domain !== blueprint.domain ? "Subject changed" : "",
      JSON.stringify(old.blueprint.slots) !== JSON.stringify(blueprint.slots)
        ? "Question topics, objectives, formats or settings changed"
        : "",
      old.blueprint.instructions !== blueprint.instructions
        ? "Instructions changed"
        : "",
      old.blueprint.totalPoints !== blueprint.totalPoints
        ? "Total points changed"
        : "",
      old.blueprint.minutes !== blueprint.minutes ? "Duration changed" : "",
    ].filter(Boolean);
    return put("revision", {
      id: id(),
      packetId: old.packetId,
      blueprint,
      approved: approve,
      parentRevisionId: old.id,
      parentExamId: old.parentExamId,
      changes,
      createdAt: new Date().toISOString(),
    });
  });
}
export function beginAttempt(
  examId: string,
  mode: "timed" | "untimed" = "timed",
): Attempt {
  const exam = get<CheckedExam>("exam", examId);
  if (!exam?.ready)
    throw new Error("Exam has unresolved checks and cannot enter practice.");
  const existing = list<Attempt>("attempt").find(
    (a) => a.examId === examId && !a.submittedAt,
  );
  if (existing) return existing;
  const now = Date.now();
  return put("attempt", {
    id: id(),
    examId,
    startedAt: now,
    endsAt:
      mode === "untimed"
        ? Number.MAX_SAFE_INTEGER
        : now + exam.exam.minutes * 60_000,
    mode,
    responses: {},
    selfScores: {},
  });
}
const AttemptUpdate = z.object({
  responses: z.record(z.string(), z.string().max(20_000)).optional(),
  selfScores: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
  submit: z.boolean().optional(),
});
export function updateAttempt(attemptId: string, body: unknown): Attempt {
  const patch = AttemptUpdate.parse(body);
  return transaction(() => {
    const a = get<Attempt>("attempt", attemptId);
    if (!a) throw new Error("Practice attempt not found.");
    const e = get<CheckedExam>("exam", a.examId)!;
    if (patch.selfScores && !a.submittedAt)
      throw new Error("Submit the timed attempt before self-grading.");
    for (const [key, score] of Object.entries(patch.selfScores ?? {})) {
      const q = e.exam.questions.find((q) => String(q.number) === key);
      if (!q || automaticGrade(q, "") !== undefined || score > q.points)
        throw new Error("Invalid rubric score.");
    }
    for (const [key, response] of Object.entries(patch.responses ?? {})) {
      const q = e.exam.questions.find((q) => String(q.number) === key);
      if (!q || (q.type === "multiple-choice" && !/^[A-D]$/.test(response)))
        throw new Error("Invalid question response.");
      if (
        q.responseDiagram &&
        !validVectorResponse(response, q.responseDiagram)
      )
        throw new Error(
          "Diagram response is malformed or outside its stated coordinate bounds.",
        );
    }
    if (a.submittedAt && patch.responses)
      throw new Error("Responses are locked after submission.");
    const expired = a.mode !== "untimed" && Date.now() > a.endsAt;
    const next = {
      ...a,
      responses:
        !expired && !a.submittedAt
          ? { ...a.responses, ...patch.responses }
          : a.responses,
      selfScores: { ...a.selfScores, ...patch.selfScores },
      submittedAt:
        a.submittedAt || (patch.submit || expired ? Date.now() : undefined),
    };
    return put("attempt", next);
  });
}
export function followUp(examId: string) {
  return transaction(() => {
    const exam = get<CheckedExam>("exam", examId);
    if (!exam) throw new Error("Exam not found.");
    if (
      list<Job>("job").some(
        (j) =>
          j.packetId === exam.packetId &&
          ["running", "queued"].includes(j.status),
      )
    )
      throw new Error(
        "Wait for or cancel the active job before requesting follow-up.",
      );
    const attempt = list<Attempt>("attempt").find(
      (a) => a.examId === examId && a.submittedAt,
    );
    if (!attempt) throw new Error("Complete a practice attempt first.");
    if (
      exam.exam.questions.some(
        (q) =>
          automaticGrade(q, "") === undefined &&
          attempt.selfScores[q.number] === undefined,
      )
    )
      throw new Error(
        "Record rubric scores for each written response before planning follow-up.",
      );
    const rows = results(exam, attempt).sort(
      (a, b) => a.earned / a.possible - b.earned / b.possible,
    );
    const missed = rows.filter((r) => r.earned < r.possible);
    const weak = (missed.length ? missed : rows).slice(0, 3);
    const parent = get<Revision>("revision", exam.revisionId)!;
    const slots = weak.map((r, i) => ({
      ...parent.blueprint.slots.find((s) => s.number === r.number)!,
      number: i + 1,
      pattern: missed.length
        ? `Address the missed objective with new material: ${parent.blueprint.slots.find((s) => s.number === r.number)!.pattern}`
        : "Extend this objective to a new context; no missed objective was observed in this attempt.",
    }));
    for (const r of list<Revision>("revision").filter(
      (r) => r.packetId === exam.packetId && r.approved,
    ))
      put("revision", { ...r, approved: false });
    const revision = put<Revision>("revision", {
      id: id(),
      packetId: exam.packetId,
      approved: false,
      parentRevisionId: parent.id,
      parentExamId: exam.id,
      changes: [
        "Targeted plan proposed from this attempt; review objectives and settings before approval.",
      ],
      createdAt: new Date().toISOString(),
      blueprint: {
        ...parent.blueprint,
        title: "Targeted follow-up · " + parent.blueprint.title,
        slots,
        totalPoints: slots.reduce((n, s) => n + s.points, 0),
        minutes: slots.reduce((n, s) => n + s.minutes, 0),
        uncertainties: [
          ...parent.blueprint.uncertainties,
          "Weak-area estimates include self-reported free-response performance.",
        ],
      },
    });
    return revision;
  });
}

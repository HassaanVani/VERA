import { materialProblems } from "./supporting-material";
import type {
  Blueprint,
  CheckedExam,
  Exam,
  Issue,
  Packet,
  Scenario,
  Attempt,
} from "./contracts";
import {
  automaticGrade,
  calculationClose,
  numericGrade,
  referenceExists,
  verifyExam,
} from "./verification";
import { excludedFromModel } from "./source-policy";

export const multiply = (
  a: Scenario["matrix"],
  v: [number, number],
): [number, number] => [
  a[0][0] * v[0] + a[0][1] * v[1],
  a[1][0] * v[0] + a[1][1] * v[1],
];
export const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
// Conservative known-case check: an explicit cross-question reference that
// repeats the referenced numeric answer with its unit. Not semantic leakage proof.
function statedQuantities(text: string) {
  const plain = text
    .replace(/\\(?:mathrm|text)\{([^{}]*)\}/g, "$1")
    .replace(/\\times\s*10\^\{([+-]?\d+)\}/g, "e$1")
    .replace(/\\[,!; ]|\$|\s/g, "");
  return [
    ...plain.matchAll(
      /([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([a-z/]+)/gi,
    ),
  ].map((match) => ({ value: Number(match[1]), unit: match[2].toLowerCase() }));
}
export function scenarioIssues(s: Scenario): Issue[] {
  return s.eigenpairs.flatMap((e, i) => {
    const v = multiply(s.matrix, e.vector);
    return !e.vector.some((x) => x !== 0) ||
      !v.every((x, j) => close(x, e.value * e.vector[j]))
      ? [
          {
            code: "EIGENPAIR",
            path: `eigenpairs.${i}`,
            message:
              "Scenario eigenpair fails Av = λv or uses the zero vector.",
            severity: "error" as const,
          },
        ]
      : [];
  });
}
// Adapted from JEFF's blueprintInvariantIssues; all settings remain explicit.
export function blueprintIssues(b: Blueprint, packet?: Packet): Issue[] {
  const issues: Issue[] = [];
  const add = (code: string, message: string) =>
    issues.push({ code, message, path: "blueprint", severity: "error" });
  if (b.slots.reduce((n, s) => n + s.points, 0) !== b.totalPoints)
    add("POINT_SUM", "Slot points must equal total points.");
  if (b.slots.reduce((n, s) => n + s.minutes, 0) !== b.minutes)
    add("TIME_SUM", "Slot minutes must equal exam duration.");
  if (b.slots.some((s, i) => s.number !== i + 1))
    add("NUMBERING", "Question slots must be numbered sequentially.");
  if (
    packet &&
    b.slots.some(
      (s) =>
        !s.evidence.some((ref) =>
          packet.documents.some(
            (d) =>
              d.id === ref.documentId &&
              !["solutions", "generated-reference"].includes(d.role),
          ),
        ),
    )
  )
    add(
      "TOPIC_EVIDENCE",
      "Each question topic needs at least one course-content source beyond solutions or generated references.",
    );
  if (
    b.slots.some(
      (slot) =>
        slot.responseMode === "vector-drawing" &&
        slot.type !== "worked-response",
    )
  )
    add(
      "RESPONSE_MODE",
      "Vector drawing requires a worked-response question and self-scoring.",
    );
  for (const o of b.observations) {
    if (o.kind === "observed" && !o.evidence.length)
      add("NO_EVIDENCE", "Observed facts need a source reference.");
    if (
      packet &&
      o.kind === "observed" &&
      o.evidence.some((e) =>
        ["solutions", "generated-reference"].includes(
          packet.documents.find((d) => d.id === e.documentId)?.role ?? "",
        ),
      )
    )
      add(
        "EVIDENCE_ROLE",
        "Solutions and generated references cannot establish assessed coverage or format.",
      );
  }
  if (
    packet &&
    b.settingsBasis === "observed" &&
    !packet.documents.some((d) => ["past-exam", "assignment"].includes(d.role))
  )
    add(
      "SETTINGS_EVIDENCE",
      "Observed assessment settings need instructor assessment evidence.",
    );
  if (packet)
    for (const ref of [
      ...b.observations.flatMap((o) => o.evidence),
      ...b.slots.flatMap((s) => s.evidence),
    ]) {
      const doc = packet.documents.find((d) => d.id === ref.documentId);
      if (
        !doc ||
        !doc.pages.some((p) => p.number === ref.page && !excludedFromModel(p))
      )
        add(
          "INVALID_REFERENCE",
          "A source reference names a missing document or page, or a page excluded from model processing.",
        );
    }
  return issues;
}
// JEFF's eight-word overlap heuristic, independent of its provider types.
export function sourceOverlapRate(
  stem: string,
  source: string,
  size = 8,
): number {
  const grams = (text: string) => {
    const w = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    return Array.from({ length: Math.max(0, w.length - size + 1) }, (_, i) =>
      w.slice(i, i + size).join(" "),
    );
  };
  const sourceGrams = new Set(grams(source)),
    candidate = grams(stem);
  return candidate.length
    ? candidate.filter((g) => sourceGrams.has(g)).length / candidate.length
    : 0;
}
export function checkExam(
  e: Exam,
  b: Blueprint,
  s: Scenario | undefined,
  source: string,
  packet?: Packet,
): Issue[] {
  const issues = s ? scenarioIssues(s) : [];
  const add = (
    code: string,
    path: string,
    message: string,
    severity: Issue["severity"] = "error",
  ) => issues.push({ code, path, message, severity });
  if (e.questions.length !== b.slots.length)
    add(
      "QUESTION_COUNT",
      "questions",
      "Question count differs from the approved blueprint.",
    );
  if (
    e.totalPoints !== b.totalPoints ||
    e.questions.reduce((n, q) => n + q.points, 0) !== b.totalPoints
  )
    add("POINT_SUM", "totalPoints", "Exam points do not match the blueprint.");
  if (
    e.minutes !== b.minutes ||
    e.questions.reduce((n, q) => n + q.minutes, 0) !== b.minutes
  )
    add("TIME_SUM", "minutes", "Exam duration does not match the blueprint.");
  const stems = new Set<string>();
  for (const [i, q] of e.questions.entries()) {
    const p = `questions.${i}`,
      slot = b.slots[i],
      stem = q.question.toLowerCase().replace(/\s+/g, " ");
    if (q.number !== i + 1)
      add("NUMBERING", p, "Question numbering is not sequential.");
    if (slot?.responseMode === "vector-drawing" && !q.responseDiagram)
      add(
        "RESPONSE_DIAGRAM",
        p,
        "The approved question needs a vector response diagram.",
      );
    if (q.responseDiagram) {
      const c = q.responseDiagram,
        exhibit = e.exhibits?.find((e) => e.id === c.exhibitId);
      if (
        slot?.responseMode !== "vector-drawing" ||
        q.type !== "worked-response" ||
        !q.exhibitIds.includes(c.exhibitId) ||
        exhibit?.kind !== "diagram" ||
        exhibit?.drawing?.axes === "none" ||
        c.minX >= c.maxX ||
        c.minY >= c.maxY ||
        (exhibit?.drawing?.circles ?? []).some((circle) => {
          const center = exhibit?.points.find(
            (point) => point.label === circle.center,
          );
          return (
            !center ||
            center.x - circle.radius < c.minX ||
            center.x + circle.radius > c.maxX ||
            center.y - circle.radius < c.minY ||
            center.y + circle.radius > c.maxY
          );
        }) ||
        exhibit.points.some(
          (point) =>
            point.x < c.minX ||
            point.x > c.maxX ||
            point.y < c.minY ||
            point.y > c.maxY,
        )
      )
        add(
          "RESPONSE_DIAGRAM",
          p,
          "Vector responses need an approved worked question, a referenced precise diagram and valid bounds containing all givens.",
        );
    }
    if (
      !slot ||
      q.type !== slot.type ||
      q.points !== slot.points ||
      q.minutes !== slot.minutes ||
      q.topic !== slot.topic
    )
      add(
        "SLOT_ALIGNMENT",
        p,
        "Question type, topic, points, or time differs from its slot.",
      );
    if (stems.has(stem)) add("DUPLICATE", p, "Question stem is duplicated.");
    stems.add(stem);
    if (q.rubric.reduce((n, r) => n + r.points, 0) !== q.points)
      add("RUBRIC_SUM", p, "Rubric points do not match question points.");
    if (
      q.type === "multiple-choice" &&
      (q.options.length !== 4 ||
        new Set(q.options).size !== 4 ||
        !/^[A-D]$/.test(q.answer))
    )
      add(
        "MC_OPTIONS",
        p,
        "Multiple choice needs four unique options and an A–D answer key.",
      );
    if (s && q.type === "multiple-choice" && q.options.length === 4) {
      // Check simple scalar choices against the dataset, not merely detached claims.
      const numeric = q.options.map((o) =>
        Number(o.trim().replace(/^\$|\$$/g, "")),
      );
      const trace = s.matrix[0][0] + s.matrix[1][1],
        det = s.matrix[0][0] * s.matrix[1][1] - s.matrix[0][1] * s.matrix[1][0];
      const roots = trace * trace - 4 * det;
      const expected = /(?:which value is|what is) the determinant/i.test(
        q.question,
      )
        ? [det]
        : /(?:which value is|what is) the trace/i.test(q.question)
          ? [trace]
          : /which value is an eigenvalue/i.test(q.question) && roots >= 0
            ? [(trace + Math.sqrt(roots)) / 2, (trace - Math.sqrt(roots)) / 2]
            : [];
      if (expected.length && numeric.every(Number.isFinite)) {
        const correctIndices = numeric.flatMap((value, index) =>
          expected.some((x) => close(value, x)) ? [index] : [],
        );
        if (
          correctIndices.length !== 1 ||
          correctIndices[0] !== q.answer.charCodeAt(0) - 65
        )
          add(
            "MC_NUMERICAL_KEY",
            p,
            "The scalar MC answer key is incorrect or more than one option is correct.",
          );
      }
    }
    if (q.type !== "multiple-choice" && q.options.length)
      add("FR_OPTIONS", p, "Free response must not have answer options.");
    if (sourceOverlapRate(q.question, source) >= 0.35)
      add(
        "SOURCE_OVERLAP",
        p,
        "Close phrase overlap with a source; inspect for copying or a close transformation.",
        "warning",
      );
    if (
      q.type === "numeric" &&
      (!q.numeric ||
        numericGrade(q, q.answer) !== true ||
        (q.numeric.value !== 0 &&
          q.numeric.absoluteTolerance >= Math.abs(q.numeric.value) * 0.1))
    )
      add(
        "NUMERIC_KEY",
        p,
        "Numeric questions need a coherent key, tolerance and explicit unit.",
      );
    if (
      q.type === "numeric" &&
      q.numeric &&
      !q.claims.some(
        (c) =>
          c.kind === "calculation" &&
          calculationClose(c.answer, q.numeric!.value) &&
          c.unit === q.numeric!.unit,
      )
    )
      add(
        "NUMERIC_BASIS",
        p,
        "A numeric key needs a matching checkable calculation claim.",
      );
    if (
      q.subparts?.length &&
      q.subparts.reduce((n, part) => n + part.points, 0) !== q.points
    )
      add("SUBPART_SUM", p, "Subpart points must equal question points.");
    if (packet && e.schemaVersion === 2 && !q.evidence?.length)
      add(
        "NO_EVIDENCE",
        p,
        "Every generated question needs course-page evidence.",
      );
    if (packet)
      for (const ref of q.evidence ?? []) {
        if (!referenceExists(packet, ref))
          add(
            "INVALID_REFERENCE",
            p,
            "Question evidence references a missing page.",
          );
        else if (
          ["solutions", "generated-reference"].includes(
            packet.documents.find((d) => d.id === ref.documentId)!.role,
          )
        )
          add(
            "EVIDENCE_ROLE",
            p,
            "Question coverage cannot be established only by solutions or generated content.",
          );
      }
    const available = new Set([
      ...(s ? ["calibration", "vectors", "diagram"] : []),
      ...(e.exhibits ?? []).map((x) => x.id),
    ]);
    if (q.exhibitIds.some((id) => !available.has(id)))
      add("EXHIBIT_REFERENCE", p, "A question references a missing exhibit.");
  }
  const verification = verifyExam(e, { scenario: s, packet });
  for (const question of e.questions) {
    const visibleText = [
      question.question,
      ...question.options,
      ...(question.subparts ?? []).map((p) => p.prompt),
    ].join(" ");
    const quantities = statedQuantities(visibleText);
    for (const source of e.questions.filter(
      (q) =>
        q.number !== question.number && q.type === "numeric" && q.numeric?.unit,
    )) {
      if (
        new RegExp(`\\b(?:question|item)\\s+${source.number}\\b`, "i").test(
          visibleText,
        ) &&
        quantities.some(
          (value) =>
            value.unit === source.numeric!.unit.toLowerCase() &&
            calculationClose(value.value, source.numeric!.value),
        )
      )
        add(
          "CROSS_ITEM_LEAK",
          `questions.${question.number - 1}`,
          "An explicitly referenced numeric question has its answer stated in another question. Remove the derived result while retaining original givens.",
        );
    }
  }
  for (const v of verification)
    if (v.result === "failed")
      add(
        "NUMERICAL_CLAIM",
        `questions.${v.question - 1}`,
        `${v.method}: ${v.artifact}`,
      );
  for (const q of e.questions.filter((q) => q.type === "numeric"))
    if (
      !verification.some(
        (v) =>
          v.question === q.number &&
          v.method === "arithmetic" &&
          v.result === "passed",
      )
    )
      add(
        "NUMERIC_UNVERIFIED",
        `questions.${q.number - 1}`,
        "The numeric key has no successfully checked arithmetic basis.",
      );
  if (
    s &&
    s.vectors.some((v) => /eigen|invariant|answer|solution/i.test(v.label))
  )
    add(
      "ANSWER_LEAK",
      "scenario",
      "An exhibit label reveals an intended answer.",
    );
  if (s) {
    const compact = source.replace(/\s+/g, "");
    if (compact.includes(JSON.stringify(s.matrix)))
      add(
        "SOURCE_DATA_REUSE",
        "scenario",
        "The shared matrix repeats a known source matrix; choose new data.",
      );
  }
  const exhibitIds = new Set<string>();
  if (
    (e.exhibits ?? []).filter((exhibit) => exhibit.kind === "image").length > 2
  )
    add(
      "IMAGE_LIMIT",
      "exhibits",
      "At most two generated images are supported per assessment.",
    );
  if (
    b.visuals === "muse-image" &&
    !(e.exhibits ?? []).some((exhibit) => exhibit.kind === "image")
  )
    add(
      "IMAGE_REQUIRED",
      "exhibits",
      "This plan requested Muse Image figures; none were supplied.",
    );
  for (const [index, exhibit] of (e.exhibits ?? []).entries()) {
    const exhibitPath = `exhibits.${index}`;
    if (b.visuals === "precise" && exhibit.kind === "image")
      add(
        "VISUAL_MODE",
        exhibitPath,
        "This plan permits precise diagrams only; replace the raster image specification.",
      );
    if (exhibitIds.has(exhibit.id))
      add(
        "EXHIBIT_DUPLICATE",
        exhibitPath,
        "Exhibit identifiers must be unique.",
      );
    exhibitIds.add(exhibit.id);
    if (
      /eigen.?direction|invariant.?probe|correct.?answer|answer.?key|solution/i.test(
        [
          exhibit.title,
          ...exhibit.points.map((p) => p.label),
          ...exhibit.columns,
          exhibit.kind === "image"
            ? exhibit.illustration?.description || ""
            : "",
        ].join(" "),
      )
    )
      add(
        "ANSWER_LEAK",
        exhibitPath,
        "A supporting-material label reveals an intended answer.",
      );
    if (
      exhibit.kind === "table" &&
      (!exhibit.columns.length ||
        exhibit.rows.some((r) => r.length !== exhibit.columns.length))
    )
      add(
        "EXHIBIT_TABLE",
        exhibitPath,
        "Shared table rows must match their columns.",
      );
    if (
      exhibit.kind === "diagram" &&
      (!exhibit.points.length ||
        exhibit.points.some(
          (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y),
        ))
    )
      add(
        "EXHIBIT_COORDINATES",
        exhibitPath,
        "Diagram coordinates must be finite and nonempty.",
      );
    for (const message of materialProblems(exhibit, packet))
      add(
        exhibit.source || (exhibit.kind === "passage" && !exhibit.synthetic)
          ? "SOURCE_EXHIBIT"
          : "DIAGRAM_STRUCTURE",
        exhibitPath,
        message,
      );
    if (exhibit.points.length > 40 || exhibit.rows.length > 50)
      add(
        "EXHIBIT_LIMIT",
        exhibitPath,
        "Exhibit exceeds the renderer's bounds.",
      );
  }
  return issues;
}
export function results(exam: CheckedExam, attempt: Attempt) {
  return exam.exam.questions.map((q) => {
    const grade = automaticGrade(q, attempt.responses[q.number] ?? "");
    const selfReported = grade === undefined;
    return {
      number: q.number,
      topic: q.topic,
      possible: q.points,
      earned: selfReported
        ? Math.max(0, Math.min(q.points, attempt.selfScores[q.number] ?? 0))
        : grade
          ? q.points
          : 0,
      selfReported,
    };
  });
}

import type {
  Blueprint,
  CheckedExam,
  Exam,
  Packet,
  Question,
} from "./contracts";
import { id } from "./store";
import { checkExam } from "./domain";
import { verifyExam } from "./verification";

export const fictionalPetition =
  "We ask the council to restore the public path to the river. Since the gate was closed, families in our street have carried water from the upper well. We have sent two requests and received no written reply. We ask that the council hear our account before renewing the lease.";
export const illustratedPacket = (): Packet => ({
  id: id(),
  name: "Diagrams & documents · demonstration",
  fixture: true,
  createdAt: new Date().toISOString(),
  documents: [
    {
      id: id(),
      name: "VERA-authored geometry notes and fictional petition",
      mime: "text/plain",
      filePath: "",
      role: "lecture-notes",
      warnings: [
        "Authored demonstration. The petition is fictional, not an authentic historical primary source.",
      ],
      pages: [
        {
          number: 1,
          needsVision: false,
          text: "Original geometry notes. Coordinates give exact locations; do not measure pixels to obtain lengths. The area of a triangle is one half of base times perpendicular height. The area of a circle is pi times radius squared. A figure provides data, while the student must choose a suitable method and show its limitations.",
        },
        {
          number: 2,
          needsVision: false,
          text: `VERA-authored fictional historical-style petition. This is not an authentic primary source.\n\n${fictionalPetition}\n\nSource criticism distinguishes what an author claims from what an independent record establishes. A petition can reveal a request and a viewpoint without establishing that every claim is true or representative.`,
        },
      ],
    },
  ],
});
export const isIllustratedDemo = (p: Packet) =>
  p.documents.some(
    (d) => d.name === "VERA-authored geometry notes and fictional petition",
  );
export function illustratedBlueprint(packet: Packet): Blueprint {
  const topics = [
    "Area from coordinates",
    "Circular buffer",
    "Reading a petition",
  ];
  return {
    schemaVersion: 2,
    domain: "Geometry and source reading",
    settingsBasis: "student-selected",
    title: "A field survey & a written account",
    instructions:
      "Use exact given data, not pixel measurements. Give areas in m². Use pi = 3.14 for the circle. The petition is a fictional authored exercise; distinguish its claims from corroborated facts.",
    totalPoints: 15,
    minutes: 20,
    observations: [
      {
        text: "The supplied notes describe triangle/circle area and source criticism.",
        kind: "observed",
        evidence: [
          {
            documentId: packet.documents[0].id,
            page: 1,
            description: "Authored geometry notes",
          },
        ],
      },
    ],
    uncertainties: [
      "Saved original example; no live AI generation or model review.",
      "The petition is fictional. Its interpretation is self-scored, not automatically verified.",
    ],
    slots: topics.map((topic, i) => ({
      number: i + 1,
      topic,
      type: i === 2 ? "short-answer" : "numeric",
      points: 5,
      minutes: i === 2 ? 8 : 6,
      objective:
        i === 2
          ? "Distinguish a source's claims from independent corroboration"
          : "Choose and apply an area formula to given data",
      section: i === 2 ? "Source reading" : "Applied geometry",
      difficulty: "transfer",
      pattern: "Original demonstration",
      basis: "student-selected",
      evidence: [
        {
          documentId: packet.documents[0].id,
          page: i === 2 ? 2 : 1,
          description: topic,
        },
      ],
    })),
  };
}
export function illustratedExam(
  packet: Packet,
  blueprint: Blueprint,
  revisionId: string,
  variant = 0,
): CheckedExam {
  const width = variant ? 8 : 6,
    height = variant ? 5 : 4,
    radius = variant ? 2 : 1.5;
  const triangle = (width * height) / 2,
    circle = 3.14 * radius ** 2;
  const original = illustratedBlueprint(packet);
  const questions: Question[] = blueprint.slots.map((slot) => {
    const type = original.slots.findIndex((s) => s.topic === slot.topic);
    const index = type < 0 ? slot.number - 1 : type;
    if (index === 2 && slot.type === "numeric")
      throw new Error(
        "This authored source-reading example has no numeric key. Choose a written format or use your own materials for live generation.",
      );
    const numeric = index === 0 ? triangle : circle;
    const text =
      index === 0
        ? `A survey marks a triangular habitat with corners O, A and B. Use the given coordinates in the field diagram to calculate its area. Give your final answer in m².`
        : index === 1
          ? `A circular buffer is centered at A with radius ${radius} m. Calculate the buffer's total area, using pi = 3.14. Give your final answer in m². The circle is not clipped to the habitat boundary.`
          : "Read the fictional petition. Identify one claim or request the author makes, then explain one thing this passage alone cannot establish.";
    const explanation =
      index === 0
        ? `The horizontal base is ${width} m and perpendicular height ${height} m. Area = ${width} × ${height} / 2 = ${triangle} m².`
        : index === 1
          ? `Circle area = 3.14 × ${radius}² = ${circle} m².`
          : "The author requests restoration of access to the river and claims a disruption to water collection. The passage alone cannot establish that every claim is accurate or represents all residents; corroborating records or other viewpoints would be needed.";
    const mc = slot.type === "multiple-choice";
    return {
      number: slot.number,
      topic: slot.topic,
      type: slot.type,
      points: slot.points,
      minutes: slot.minutes,
      objective: slot.objective,
      section: slot.section,
      evidence: slot.evidence,
      question: text + (mc ? " Select the best answer." : ""),
      options: mc
        ? index === 2
          ? [
              "It records a request and viewpoint, while factual claims need corroboration.",
              "It proves that all residents agreed.",
              "It proves that the council never replied to anyone.",
              "It establishes the full legal terms of the lease.",
            ]
          : [
              `${numeric} m²`,
              `${numeric * 2} m²`,
              `${numeric / 2} m²`,
              `${numeric + 3} m²`,
            ]
        : [],
      exhibitIds: [index === 2 ? "petition" : "field-map"],
      answer: mc ? "A" : index === 2 ? explanation : `${numeric} m²`,
      solution: explanation,
      rubric: [
        {
          criterion:
            index === 2
              ? "Identify a supported claim and explain the need for independent corroboration, using the passage."
              : "Choose the appropriate area formula and obtain the stated final area with units.",
          points: slot.points,
        },
      ],
      numeric:
        slot.type === "numeric"
          ? {
              value: numeric,
              absoluteTolerance: 0.005,
              relativeTolerance: 0,
              unit: "m²",
            }
          : undefined,
      claims:
        index === 2
          ? [
              {
                kind: "source",
                evidence: slot.evidence[0],
                quote: fictionalPetition,
              },
            ]
          : [
              {
                kind: "calculation",
                expression:
                  index === 0 ? `${width}*${height}/2` : `3.14*${radius}^2`,
                answer: numeric,
                unit: "m²",
              },
            ],
    };
  });
  const exam: Exam = {
    schemaVersion: 2,
    subject: blueprint.domain,
    title: blueprint.title,
    instructions: blueprint.instructions,
    totalPoints: blueprint.totalPoints,
    minutes: blueprint.minutes,
    questions,
    exhibits: [
      {
        id: "field-map",
        kind: "diagram",
        title: "Field survey · distances in metres",
        content: "Exact coordinate data; the circle shows the given buffer.",
        columns: [],
        rows: [],
        synthetic: true,
        points: [
          { label: "O", x: 0, y: 0 },
          { label: "A", x: width, y: 0 },
          { label: "B", x: 2, y: height },
        ],
        drawing: {
          axes: "cartesian",
          description: `O is (0, 0), A is (${width}, 0) and B is (2, ${height}), in metres. O–A–B is a triangular boundary. An arrow runs from O to B. A circle centered at A has radius ${radius} m.`,
          paths: [
            {
              points: ["O", "A", "B"],
              closed: true,
              label: "Habitat boundary",
            },
          ],
          segments: [{ from: "O", to: "B", arrow: true, label: "" }],
          circles: [{ center: "A", radius, label: "Buffer" }],
        },
      },
      {
        id: "petition",
        kind: "passage",
        title: "Fictional petition · authored source exercise",
        content: fictionalPetition,
        columns: [],
        rows: [],
        points: [],
        synthetic: false,
        source: { documentId: packet.documents[0].id, page: 2 },
      },
    ],
  };
  const issues = checkExam(
    exam,
    blueprint,
    undefined,
    packet.documents[0].pages.map((p) => p.text).join("\n"),
    packet,
  );
  return {
    id: id(),
    packetId: packet.id,
    revisionId,
    schemaVersion: 2,
    fixture: true,
    createdAt: new Date().toISOString(),
    exam,
    issues,
    review: { questions: [] },
    verification: verifyExam(exam, { packet }),
    repairAttempts: 0,
    ready: !issues.some((i) => i.severity === "error"),
  };
}

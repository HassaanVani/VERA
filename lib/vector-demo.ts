import type { Packet, Blueprint, CheckedExam, Exam } from "./contracts";
import { id } from "./store";
import { checkExam } from "./domain";
import { verifyExam } from "./verification";
const sourceName = "VERA original coordinate-vector notes";
export const isVectorDemo = (packet: Packet) =>
  packet.documents.some((d) => d.name === sourceName);
export function vectorPacket(): Packet {
  return {
    id: id(),
    name: "Vectors · drawing example",
    fixture: true,
    createdAt: new Date().toISOString(),
    documents: [
      {
        id: id(),
        name: sourceName,
        role: "lecture-notes",
        mime: "text/plain",
        filePath: "",
        warnings: [
          "Authored interactive example. No live model generation or independent model review.",
        ],
        pages: [
          {
            number: 1,
            needsVision: false,
            text: "VERA original vector notes. A vector in Cartesian coordinates has a tail and a head; the displacement is head minus tail. A position vector starts at the origin. The transformation T(x,y)=(2x+y,y) sends each given input to a new coordinate pair. Linear combinations operate on components. For this example the given input is v=(1,2). The coordinate diagram gives the origin O=(0,0) and the input endpoint V=(1,2); it does not show the answers. Explain your algebra as well as drawing each requested vector.",
          },
        ],
      },
    ],
  };
}
export function vectorBlueprint(packet: Packet): Blueprint {
  const evidence = [
    {
      documentId: packet.documents[0].id,
      page: 1,
      description: "Original coordinate-vector notes and the given input",
    },
  ];
  return {
    schemaVersion: 2,
    settingsBasis: "student-selected",
    visuals: "precise",
    domain: "Applied linear algebra",
    title: "Draw and explain a vector",
    instructions:
      "Authored interactive demonstration, not a model-generated exam. Draw each answer using the coordinate diagram or enter exact endpoints. Your drawing and explanation are saved together. Written reasoning and vector construction are self-scored after submission.",
    totalPoints: 12,
    minutes: 12,
    observations: [
      {
        text: "The original notes define a component transformation and vector combinations.",
        kind: "observed",
        evidence,
      },
    ],
    uncertainties: [
      "This saved example makes no claims about model quality or instructor format.",
      "Coordinate bounds are validated; correctness of the student's drawing is not automatically graded.",
    ],
    slots: [
      {
        number: 1,
        topic: "A transformed vector",
        type: "worked-response",
        points: 6,
        minutes: 6,
        difficulty: "routine",
        objective:
          "Apply a linear transformation and represent the result geometrically",
        pattern:
          "Draw the transformed position vector and explain the component computation.",
        evidence,
        responseMode: "vector-drawing",
        basis: "student-selected",
        section: "Construct and explain",
      },
      {
        number: 2,
        topic: "A vector combination",
        type: "worked-response",
        points: 6,
        minutes: 6,
        difficulty: "transfer",
        objective: "Construct a component-wise vector combination",
        pattern:
          "Draw the specified vector combination and explain its components.",
        evidence,
        responseMode: "vector-drawing",
        basis: "student-selected",
        section: "Construct and explain",
      },
    ],
  };
}
export function vectorExam(
  packet: Packet,
  blueprint: Blueprint,
  revisionId: string,
): CheckedExam {
  if (
    blueprint.slots.length !== 2 ||
    blueprint.slots.some(
      (s) =>
        s.type !== "worked-response" || s.responseMode !== "vector-drawing",
    )
  )
    throw Error(
      "This authored example requires its two worked-response vector questions. Use your materials for another format.",
    );
  const exam: Exam = {
    schemaVersion: 2,
    subject: blueprint.domain,
    title: blueprint.title,
    instructions: blueprint.instructions,
    totalPoints: blueprint.totalPoints,
    minutes: blueprint.minutes,
    exhibits: [
      {
        id: "coordinate-givens",
        kind: "diagram",
        title: "Given vector and coordinate frame",
        content:
          "Original given data: O=(0,0), V=(1,2). Dark gray marks the input; blue marks your answer in practice.",
        synthetic: true,
        columns: [],
        rows: [],
        points: [
          { label: "O", x: 0, y: 0 },
          { label: "V", x: 1, y: 2 },
        ],
        drawing: {
          axes: "cartesian",
          description:
            "Cartesian axes in equal units. The given input v has tail O=(0,0) and head V=(1,2). The student's response uses the same coordinate frame.",
          segments: [{ from: "O", to: "V", arrow: true, label: "Given v" }],
          paths: [],
          circles: [],
        },
      },
    ],
    questions: blueprint.slots.map((slot, index) => ({
      ...slot,
      question:
        index === 0
          ? "A linear transformation is $T(x,y)=(2x+y,y)$. For the given vector $v=(1,2)$, draw the position vector $T(v)$ with its tail at the origin. Explain how you found its endpoint."
          : "Using the same given input $v=(1,2)$, draw the position vector $2v-(1,0)$ with its tail at the origin. Explain the component-wise addition and subtraction, and how the endpoint on your diagram represents that result. You may draw intermediate arrows as well as your final vector; make the intended final vector clear in your explanation.",
      options: [],
      answer:
        index === 0
          ? "An arrow from (0,0) to (4,2)."
          : "An arrow from (0,0) to (1,4).",
      solution:
        index === 0
          ? "T(1,2)=(2*1+2,2)=(4,2). Draw the arrow with tail at the origin and head at (4,2)."
          : "2(1,2)-(1,0)=(2,4)-(1,0)=(1,4). Draw an origin-based arrow to (1,4), and identify the intended final vector if intermediate arrows are included.",
      rubric: [
        {
          criterion:
            index === 0
              ? "Correct transformed endpoint, origin-based arrow and explanation of both components."
              : "Correct component combination, origin-based final arrow and explanation distinguishing any intermediate arrows.",
          points: slot.points,
        },
      ],
      exhibitIds: ["coordinate-givens"],
      responseDiagram: {
        exhibitId: "coordinate-givens",
        minX: -1,
        maxX: 6,
        minY: -1,
        maxY: 5,
        maxVectors: 3,
      },
      claims:
        index === 0
          ? [
              {
                kind: "calculation" as const,
                expression: "2*1+2",
                answer: 4,
                unit: "",
              },
            ]
          : [
              {
                kind: "calculation" as const,
                expression: "2*1-1",
                answer: 1,
                unit: "",
              },
            ],
    })),
  };
  const issues = checkExam(exam, blueprint, undefined, "", packet);
  return {
    id: id(),
    packetId: packet.id,
    revisionId,
    exam,
    issues,
    review: { questions: [] },
    verification: verifyExam(exam, { packet }),
    repairAttempts: 0,
    ready: !issues.some((i) => i.severity === "error"),
    fixture: true,
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
  };
}

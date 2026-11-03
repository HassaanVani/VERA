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

export const originalStudyNotes =
  "VERA original demonstration: Evidence and learning. Retrieval practice means attempting to recall information before checking it. A correlation alone does not establish causation: a third factor may influence both variables. Random assignment helps balance confounders across experimental groups, but does not guarantee every participant is identical. In a fictional recall study, Group A recalled 18 of 24 words and Group B recalled 12 of 24 words. The difference in mean recalled words is 6 words; this aggregate comparison alone does not establish a causal effect or statistical significance. A defensible study explanation distinguishes an observed difference, an alternative explanation, and a proposed test. Essays can support multiple defensible designs if their reasoning addresses the evidence and limitations.";
export function generalDemoPacket(): Packet {
  return {
    id: id(),
    name: "Evidence & decisions · demonstration",
    fixture: true,
    createdAt: new Date().toISOString(),
    documents: [
      {
        id: id(),
        name: "VERA original evidence and learning notes",
        role: "lecture-notes",
        mime: "text/plain",
        filePath: "",
        warnings: [
          "Original saved example. No live generation or independent model review.",
        ],
        pages: [{ number: 1, text: originalStudyNotes, needsVision: false }],
      },
    ],
  };
}
export const isGeneralDemo = (p: Packet) =>
  p.documents.some(
    (d) => d.name === "VERA original evidence and learning notes",
  );
export function generalDemoBlueprint(p: Packet): Blueprint {
  const evidence = [
    {
      documentId: p.documents[0].id,
      page: 1,
      description:
        "Original notes on retrieval, causal inference and a fictional recall study.",
    },
  ];
  return {
    schemaVersion: 2,
    settingsBasis: "student-selected",
    title: "Evidence, recall & causal claims",
    domain: "Research methods and learning",
    instructions:
      "Use the information in each question. Explain limitations where asked. Numeric answers must include the requested unit.",
    totalPoints: 20,
    minutes: 20,
    observations: [
      {
        kind: "observed",
        text: "The notes distinguish retrieval, observed differences and causal inference.",
        evidence,
      },
      {
        kind: "student-selected",
        text: "Four formats, 20 points and 20 minutes are saved demonstration settings.",
        evidence: [],
      },
    ],
    uncertainties: [
      "No instructor assessment was supplied. This is original practice, not a prediction.",
      "Open-ended reasoning and essay quality are not automatically verified.",
    ],
    slots: [
      {
        topic: "Causal inference",
        type: "multiple-choice",
        objective: "Distinguish correlation from causation",
      },
      {
        topic: "Comparing observations",
        type: "numeric",
        objective: "Calculate a difference and state its unit",
      },
      {
        topic: "Retrieval practice",
        type: "short-answer",
        objective: "Explain retrieval with a concrete example",
      },
      {
        topic: "Study design",
        type: "essay",
        objective: "Propose a defensible experiment with limitations",
      },
    ].map((s, i) => ({
      ...s,
      type: s.type as Question["type"],
      number: i + 1,
      basis: "student-selected",
      section: i < 2 ? "Interpret evidence" : "Explain and apply",
      points: 5,
      minutes: 5,
      difficulty: i < 2 ? "routine" : "transfer",
      pattern: "Explain your choice or reasoning using the supplied evidence.",
      evidence,
    })),
  };
}
export function generalDemoExam(
  p: Packet,
  b: Blueprint,
  revisionId: string,
): CheckedExam {
  const stems = [
    "A survey finds that students who use recall quizzes also earn higher grades. Which conclusion is justified by this correlation alone?",
    "In a fictional study, Group A recalls 18 words on average and Group B recalls 12 words. How many more words does Group A recall on average? Give your answer in words.",
    "Explain retrieval practice to a classmate and give one specific example that involves recalling information before checking it.",
    "Design a short study to test whether recall quizzes improve retention. Explain allocation to groups, the outcome you would measure, and one limitation. More than one defensible design is possible.",
  ];
  const answers = [
    "B",
    "6 words",
    "Attempt recall before checking, such as writing a definition from memory and then comparing it with the notes.",
    "Randomly assign students to recall quizzes or equal-time rereading. Measure delayed recall using the same test. Consider prior knowledge, adherence and the limits of a small sample.",
  ];
  const exam: Exam = {
    schemaVersion: 2,
    subject: b.domain,
    title: b.title,
    instructions: b.instructions,
    totalPoints: b.totalPoints,
    minutes: b.minutes,
    exhibits: [],
    questions: b.slots.map((s) => {
      const topics = [
        "Causal inference",
        "Comparing observations",
        "Retrieval practice",
        "Study design",
      ];
      const types = ["multiple-choice", "numeric", "short-answer", "essay"];
      const found = topics.indexOf(s.topic);
      const i =
        found >= 0 && types[found] === s.type
          ? found
          : Math.max(
              0,
              types.indexOf(
                s.type === "free-response" || s.type === "worked-response"
                  ? "essay"
                  : s.type,
              ),
            );
      return {
        ...s,
        question: stems[i],
        options:
          i === 0
            ? [
                "Recall quizzes certainly caused the higher grades",
                "The variables are associated; confounding is still possible",
                "The survey proves there are no confounders",
                "Every student will benefit equally",
              ]
            : [],
        answer: answers[i],
        solution:
          i === 0
            ? "Association alone does not establish causation. Prior motivation or study time may affect both quiz use and grades. B is the supported conclusion."
            : i === 1
              ? "Subtract the two means: 18 − 12 = 6 words. This difference alone does not establish statistical significance or causation."
              : answers[i],
        rubric: [
          {
            criterion:
              i === 0
                ? "Select the conclusion supported by correlation alone."
                : i === 1
                  ? "Calculate the difference and include words as the unit."
                  : i === 2
                    ? "Explain recall before checking and give a matching example."
                    : "Propose a coherent comparison, allocation, retention measure and limitation; accept other defensible designs.",
            points: s.points,
          },
        ],
        exhibitIds: [],
        claims:
          i === 1
            ? [
                {
                  kind: "calculation",
                  expression: "18-12",
                  answer: 6,
                  unit: "words",
                },
              ]
            : [],
        ...(i === 1
          ? {
              numeric: {
                value: 6,
                absoluteTolerance: 0,
                relativeTolerance: 0,
                unit: "words",
              },
            }
          : {}),
      };
    }),
  };
  const issues = checkExam(exam, b, undefined, originalStudyNotes, p);
  return {
    id: id(),
    packetId: p.id,
    revisionId,
    schemaVersion: 2,
    exam,
    issues,
    verification: verifyExam(exam, { packet: p }),
    review: { questions: [] },
    repairAttempts: 0,
    ready: !issues.some((i) => i.severity === "error"),
    fixture: true,
    createdAt: new Date().toISOString(),
  };
}

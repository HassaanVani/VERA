import type { CheckedExam, Packet, Question } from "./contracts";

export type ControlledCase = {
  category:
    | "correct"
    | "incorrect"
    | "partial"
    | "blank"
    | "alternative"
    | "ambiguous";
  response: string;
  expectedAutomatic: boolean | null;
  question: Question;
};
export function feedbackCases(
  course: string,
  packet: Packet,
): ControlledCase[] {
  const source = packet.documents[0],
    page = course === "linear-algebra" ? 2 : course === "psychology" ? 6 : 1;
  const evidence = [
    {
      documentId: source.id,
      page,
      description:
        "Permitted OCW development excerpt; these questions and student responses are VERA-authored controls, not official examination items.",
    },
  ];
  const objective: Question = {
    number: 1,
    topic: "Controlled objective response",
    type: course === "psychology" ? "multiple-choice" : "numeric",
    points: 5,
    minutes: 1,
    question:
      course === "linear-algebra"
        ? "For the fictional matrix with rows (4,2) and (1,3), compute its determinant. Give a dimensionless numeric answer."
        : course === "microeconomics"
          ? "In a fictional market, demand is Qd=80−2P and supply is Qs=20+P. Find the equilibrium price, in USD."
          : "Which word appears in the scientific-method list on page 6 of the supplied research-methods lecture?",
    options:
      course === "psychology"
        ? ["Infallible", "Falsifiable", "Unchangeable", "Unquestionable"]
        : [],
    answer:
      course === "linear-algebra"
        ? "10"
        : course === "microeconomics"
          ? "20 USD"
          : "B",
    solution:
      course === "linear-algebra"
        ? "The determinant is 4×3−2×1 = 10."
        : course === "microeconomics"
          ? "Set 80−2P=20+P, so 60=3P and P=20 USD."
          : "The slide explicitly includes Falsifiable. B is the source-location answer, not a comprehensive definition of science.",
    rubric: [
      {
        criterion:
          "State the requested result using the supplied data and required unit.",
        points: 5,
      },
    ],
    exhibitIds: [],
    evidence,
    claims:
      course === "linear-algebra"
        ? [{ kind: "calculation", expression: "4*3-2*1", answer: 10, unit: "" }]
        : course === "microeconomics"
          ? [
              {
                kind: "calculation",
                expression: "(80-20)/(2+1)",
                answer: 20,
                unit: "USD",
              },
            ]
          : [],
    ...(course === "linear-algebra"
      ? {
          numeric: {
            value: 10,
            absoluteTolerance: 0,
            relativeTolerance: 0,
            unit: "",
          },
        }
      : course === "microeconomics"
        ? {
            numeric: {
              value: 20,
              absoluteTolerance: 0.001,
              relativeTolerance: 0,
              unit: "USD",
            },
          }
        : {}),
  };
  const written: Question = {
    number: 1,
    topic: "Controlled written reasoning",
    type: course === "history" ? "essay" : "short-answer",
    points: 5,
    minutes: 1,
    question:
      course === "linear-algebra"
        ? "Explain why checking one numerical example is insufficient to establish a general claim about all eigenvectors."
        : course === "microeconomics"
          ? "Explain how an observed market outcome can differ from a model's prediction and identify one assumption you would inspect."
          : course === "psychology"
            ? "Explain how a falsifiable research claim differs from an appeal to authority. Give one example and a limitation."
            : "Explain how a Native American perspective can complicate an account of colonial independence. Use the supplied lecture evidence and acknowledge one limitation.",
    options: [],
    answer:
      "An evidence-based response that addresses the criterion; multiple defensible answers may be valid.",
    solution:
      "Identify the relevant claim, connect it to the supplied evidence, and explain why the conclusion is limited. This open-ended control has no automatically verified expert grade.",
    rubric: [
      {
        criterion:
          "Connect the claim to relevant evidence, address the requested reasoning and state a limitation. Accept defensible alternatives.",
        points: 5,
      },
    ],
    exhibitIds: [],
    evidence,
    claims: [],
  };
  const variants: ControlledCase["category"][] = [
    "correct",
    "incorrect",
    "partial",
    "blank",
    "alternative",
    "ambiguous",
  ];
  const numeric =
    course === "linear-algebra"
      ? ["10", "11", "4*3", "", "12-2", "about ten or eleven"]
      : course === "microeconomics"
        ? ["20 USD", "30 USD", "60 USD", "", "60/3 dollars", "20 or 30 USD"]
        : ["B", "A", "", "", "B", ""];
  const prose = [
    "The evidence supports a limited claim under the stated assumptions. I would explain the mechanism and consider competing explanations before generalizing.",
    "A single example proves that every possible case must be the same, so no assumptions or alternative explanations are needed.",
    "There may be an assumption to check, but I have not explained it yet.",
    "",
    "Another defensible approach is to compare competing accounts, state the conditions for each and look for counterexamples rather than assume one account is complete.",
    "It depends on what is meant by the claim and which evidence is available; the question may permit several interpretations.",
  ];
  return [course === "history" ? written : objective, written].flatMap(
    (q, group) =>
      variants.map((category, i) => ({
        category,
        response:
          q.type === "numeric" || q.type === "multiple-choice"
            ? numeric[i]
            : prose[i],
        expectedAutomatic:
          q.type === "numeric" || q.type === "multiple-choice"
            ? [0, 4].includes(i)
            : null,
        question: { ...q, number: group * 6 + i + 1 },
      })),
  );
}
export function controlledExam(
  packet: Packet,
  cases: ControlledCase[],
): CheckedExam {
  return {
    id: `${packet.id}-feedback-controls`,
    packetId: packet.id,
    revisionId: "feedback-controls",
    exam: {
      schemaVersion: 2,
      subject: packet.name,
      title: "VERA-authored feedback controls",
      instructions:
        "Synthetic responses for reliability evaluation; not an MIT grade.",
      totalPoints: 60,
      minutes: 12,
      exhibits: [],
      questions: cases.map((c) => c.question),
    },
    issues: [],
    review: { questions: [] },
    ready: true,
    repairAttempts: 0,
    fixture: true,
    createdAt: new Date().toISOString(),
  };
}

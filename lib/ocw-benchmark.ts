import type { Blueprint, Packet, Question } from "./contracts";

const ocw = "https://ocw.mit.edu/courses/";
const resources = (course: string, resource: string) =>
  `${ocw}${course}/resources/${resource}/`;
const algebra = "18-06-linear-algebra-spring-2010",
  algebraSC = "18-06sc-linear-algebra-fall-2011",
  economics = "14-01sc-principles-of-microeconomics-fall-2011",
  psychology = "9-00sc-introduction-to-psychology-fall-2011",
  history = "21h-001-how-to-stage-a-revolution-fall-2013";
export type BenchmarkSource = {
  id: string;
  url: string;
  role: "lecture-notes" | "past-exam" | "assignment" | "solutions";
  partition: "generation" | "heldout-question" | "heldout-solution";
  pages?: number[];
  html?: boolean;
  section?: string;
};
export type BenchmarkCourse = {
  id: string;
  subject: string;
  attribution: string;
  keyed: boolean;
  development: BenchmarkSource[];
  evaluation: BenchmarkSource[];
  topics: { development: string[]; evaluation: string[] };
  types: Question["type"][];
};
const src = (
  id: string,
  url: string,
  role: BenchmarkSource["role"],
  partition: BenchmarkSource["partition"] = "generation",
  pages?: number[],
): BenchmarkSource => ({
  id,
  url,
  role,
  partition,
  ...(pages ? { pages } : {}),
});
export const benchmarkCourses: BenchmarkCourse[] = [
  {
    id: "linear-algebra",
    subject: "Linear algebra",
    attribution:
      "Gilbert Strang and MIT OpenCourseWare, 18.06 Spring 2010 and 18.06SC Fall 2011",
    keyed: true,
    development: [
      src(
        "la-eigen",
        resources(algebraSC, "mit18_06scf11_ses2-8sum"),
        "lecture-notes",
        "generation",
        [1, 2, 3, 4],
      ),
      src(
        "la-prior1",
        resources(algebra, "mit18_06s10_exam1_s10"),
        "past-exam",
        "generation",
        [1, 2],
      ),
      src(
        "la-target2",
        resources(algebra, "mit18_06s10_exam2_s10"),
        "past-exam",
        "heldout-question",
      ),
      src(
        "la-key2",
        resources(algebra, "mit18_06s10_exam2_s10_soln"),
        "solutions",
        "heldout-solution",
      ),
    ],
    evaluation: [
      src(
        "la-det",
        resources(algebraSC, "mit18_06scf11_ses2-5sum"),
        "lecture-notes",
        "generation",
        [1, 2, 3, 4],
      ),
      src(
        "la-prior1-later",
        resources(algebra, "mit18_06s10_exam1_s10"),
        "past-exam",
        "generation",
        [3, 4, 5],
      ),
      src(
        "la-target3",
        resources(algebra, "mit18_06s10_exam3_s10"),
        "past-exam",
        "heldout-question",
      ),
      src(
        "la-key3",
        resources(algebra, "mit18_06s10_exam3_s10_soln"),
        "solutions",
        "heldout-solution",
      ),
    ],
    topics: {
      development: [
        "Eigenvalues and trace",
        "Eigenvectors and matrix action",
        "Reasoning about eigenpairs",
      ],
      evaluation: [
        "Computing a determinant",
        "Determinant properties",
        "Interpreting singularity",
      ],
    },
    types: ["numeric", "worked-response", "short-answer"],
  },
  {
    id: "microeconomics",
    subject: "Microeconomics",
    attribution:
      "Jonathan Gruber, William Wheaton and MIT OpenCourseWare, 14.01SC Fall 2011 / practice exams Fall 2007",
    keyed: true,
    development: [
      src(
        "econ-notes1",
        resources(economics, "mit14_01scf11_rev_midtm01"),
        "lecture-notes",
        "generation",
        [1, 2, 3],
      ),
      src(
        "econ-prior1",
        resources(economics, "mit14_01scf11_exam01_f07"),
        "past-exam",
        "generation",
        [1, 2],
      ),
      src(
        "econ-target1",
        resources(economics, "mit14_01scf11_exam01"),
        "past-exam",
        "heldout-question",
      ),
      src(
        "econ-key1",
        resources(economics, "mit14_01scf11_exam01_sol"),
        "solutions",
        "heldout-solution",
      ),
    ],
    evaluation: [
      src(
        "econ-notes2",
        resources(economics, "mit14_01scf11_rev_midtm02"),
        "lecture-notes",
        "generation",
        [1, 2, 3],
      ),
      src(
        "econ-prior2",
        resources(economics, "mit14_01scf11_exam02_f07"),
        "past-exam",
        "generation",
        [1, 2],
      ),
      src(
        "econ-target2",
        resources(economics, "mit14_01scf11_exam02"),
        "past-exam",
        "heldout-question",
      ),
      src(
        "econ-key2",
        resources(economics, "mit14_01scf11_exam02_soln"),
        "solutions",
        "heldout-solution",
      ),
    ],
    topics: {
      development: [
        "Market equilibrium",
        "Demand and consumer choices",
        "Interpreting a market intervention",
      ],
      evaluation: [
        "Costs and production",
        "Competition and market power",
        "Producer decisions and welfare",
      ],
    },
    types: ["numeric", "multiple-choice", "worked-response"],
  },
  {
    id: "psychology",
    subject: "Psychology",
    attribution:
      "John D. E. Gabrieli and MIT OpenCourseWare, 9.00SC Fall 2011 / practice exams 2009",
    keyed: true,
    development: [
      src(
        "psych-research",
        resources(psychology, "mit9_00scf11_lec02_scires"),
        "lecture-notes",
        "generation",
        [1, 2, 3, 4, 5, 6],
      ),
      src(
        "psych-prior1",
        resources(psychology, "mit9_00scf11_exam1_2009"),
        "past-exam",
        "generation",
        [1, 2],
      ),
      src(
        "psych-target1",
        resources(psychology, "mit9_00scf11_exam1"),
        "past-exam",
        "heldout-question",
      ),
      src(
        "psych-key1",
        resources(psychology, "mit9_00scf11_exam1_sol"),
        "solutions",
        "heldout-solution",
      ),
    ],
    evaluation: [
      src(
        "psych-memory",
        resources(psychology, "mit9_00scf11_lec10_mem1"),
        "lecture-notes",
        "generation",
        [1, 2, 3, 4, 5, 6],
      ),
      src(
        "psych-prior2",
        resources(psychology, "mit9_00scf11_exam2_2009"),
        "past-exam",
        "generation",
        [1, 2],
      ),
      src(
        "psych-target2",
        resources(psychology, "mit9_00scf11_exam2"),
        "past-exam",
        "heldout-question",
      ),
      src(
        "psych-key2",
        resources(psychology, "mit9_00scf11_exam2_sol"),
        "solutions",
        "heldout-solution",
      ),
    ],
    topics: {
      development: [
        "Scientific research methods",
        "Experimental and correlational reasoning",
        "Evaluating psychological evidence",
      ],
      evaluation: [
        "Memory processes",
        "Interpreting memory research",
        "Explaining memory evidence",
      ],
    },
    types: ["multiple-choice", "multiple-choice", "short-answer"],
  },
  {
    id: "history",
    subject: "History",
    attribution:
      "Craig Steven Wilder, Malick Ghachem, Jeffrey S. Ravel and MIT OpenCourseWare, 21H.001 Fall 2013",
    keyed: false,
    development: [
      src(
        "history-britain",
        resources(history, "mit21h_001f13_lec_03"),
        "lecture-notes",
        "generation",
        [1, 2, 3],
      ),
      {
        ...src(
          "history-paper1",
          `${ocw}${history}/pages/assignments/`,
          "assignment",
          "heldout-question",
        ),
        html: true,
        section: "Paper 1",
      },
    ],
    evaluation: [
      src(
        "history-race",
        resources(history, "mit21h_001f13_lec_04"),
        "lecture-notes",
        "generation",
        [1, 2, 3],
      ),
      {
        ...src(
          "history-paper2",
          `${ocw}${history}/pages/assignments/`,
          "assignment",
          "heldout-question",
        ),
        html: true,
        section: "Paper 2",
      },
    ],
    topics: {
      development: [
        "Imperial conflict and colonial independence",
        "Evidence and competing perspectives",
        "Explaining revolutionary change",
      ],
      evaluation: [
        "Slavery and colonial independence",
        "Race and competing perspectives",
        "Historical argument and limitations",
      ],
    },
    types: ["short-answer", "essay", "essay"],
  },
];

export function benchmarkBlueprint(
  course: BenchmarkCourse,
  phase: "development" | "evaluation",
  packet: Packet,
): Blueprint {
  const evidence = packet.documents.map((d) => ({
    documentId: d.id,
    page: d.pages[0].number,
    description: `${d.name}: permitted course evidence; focused excerpt.`,
  }));
  return {
    schemaVersion: 2,
    settingsBasis: "student-selected",
    title: `${course.subject} · ${phase} practice`,
    domain: course.subject,
    instructions:
      "Answer all three questions. Show reasoning where requested. Use the stated unit for numeric answers. These selected practice settings do not reproduce the full instructor assessment.",
    totalPoints: 30,
    minutes: 30,
    observations: [
      {
        kind: "student-selected",
        text: "Three questions, 30 points and 30 minutes are benchmark settings. They do not measure inferred instructor-format accuracy.",
        evidence: [],
      },
    ],
    uncertainties: [
      "Focused excerpts cannot establish full course or exam coverage.",
      "Automated checks do not establish conceptual correctness, essay quality or equal difficulty.",
      "Public OCW materials may have appeared in model training; this is not a contamination-free prediction benchmark.",
    ],
    slots: course.topics[phase].map((topic, i) => ({
      number: i + 1,
      basis: "student-selected",
      topic,
      objective: `Demonstrate ${topic.toLowerCase()} using the supplied evidence`,
      section: "Selected practice",
      type: course.types[i],
      points: 10,
      minutes: 10,
      difficulty: i === 0 ? "routine" : i === 1 ? "transfer" : "synthesis",
      pattern:
        "Use a new example; explain assumptions and reasoning. Keep within what the permitted sources can support.",
      evidence,
    })),
  };
}

import { z } from "zod";

export const Role = z.enum([
  "past-exam",
  "lecture-notes",
  "assignment",
  "syllabus",
  "review-sheet",
  "solutions",
  "textbook",
  "generated-reference",
]);
export const Evidence = z.object({
  documentId: z.string(),
  page: z.number().int().positive(),
  description: z.string().min(1),
});
export const DecisionBasis = z.enum([
  "observed",
  "inferred",
  "student-selected",
]);
export const QuestionType = z.enum([
  "multiple-choice",
  "numeric",
  "short-answer",
  "worked-response",
  "essay",
  "free-response",
]);
export const Slot = z.object({
  number: z.number().int().positive(),
  topic: z.string().min(1),
  type: QuestionType,
  points: z.number().int().min(1).max(100),
  minutes: z.number().int().min(1).max(120),
  difficulty: z.enum(["routine", "transfer", "synthesis"]),
  pattern: z.string(),
  evidence: z.array(Evidence),
  objective: z.string().optional(),
  section: z.string().optional(),
  basis: DecisionBasis.optional(),
});
export const Blueprint = z.object({
  schemaVersion: z.literal(2).optional(),
  settingsBasis: DecisionBasis.optional(),
  title: z.string().min(1).max(160),
  domain: z.string().min(1).max(120),
  instructions: z.string(),
  totalPoints: z.number().int().min(1).max(200),
  minutes: z.number().int().min(1).max(180),
  observations: z.array(
    z.object({
      text: z.string(),
      kind: z.enum(["observed", "inferred", "student-selected"]),
      evidence: z.array(Evidence),
    }),
  ),
  uncertainties: z.array(z.string()),
  slots: z.array(Slot).min(1).max(12),
});
const Vec = z.tuple([z.number().finite(), z.number().finite()]);
const Matrix = z.tuple([Vec, Vec]);
export const Scenario = z.object({
  title: z.string(),
  company: z.string(),
  context: z.string(),
  matrix: Matrix,
  vectors: z
    .array(z.object({ label: z.string(), input: Vec }))
    .min(2)
    .max(6),
  eigenpairs: z
    .array(z.object({ value: z.number().finite(), vector: Vec }))
    .min(1)
    .max(2),
});
export const Claim = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), input: Vec, answer: Vec }),
  z.object({ kind: z.literal("eigenpair"), value: z.number(), vector: Vec }),
  z.object({ kind: z.literal("determinant"), answer: z.number() }),
  z.object({ kind: z.literal("trace"), answer: z.number() }),
  z.object({
    kind: z.literal("calculation"),
    expression: z.string().max(300),
    answer: z.number().finite(),
    unit: z.string().max(40),
  }),
  z.object({
    kind: z.literal("expression"),
    left: z.string().max(300),
    right: z.string().max(300),
    variable: z.literal("x"),
  }),
  z.object({
    kind: z.literal("source"),
    evidence: Evidence,
    quote: z.string().min(8).max(1000),
  }),
  z.object({
    kind: z.literal("exhibit-cell"),
    exhibitId: z.string(),
    row: z.number().int().nonnegative(),
    column: z.number().int().nonnegative(),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("coordinate"),
    exhibitId: z.string(),
    label: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
  }),
]);
export const Exhibit = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["passage", "table", "diagram"]),
  title: z.string().min(1),
  content: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  points: z.array(
    z.object({
      label: z.string(),
      x: z.number().finite(),
      y: z.number().finite(),
    }),
  ),
  synthetic: z.boolean(),
});
export const Question = z.object({
  number: z.number().int().positive(),
  topic: z.string(),
  type: QuestionType,
  points: z.number().int().positive(),
  minutes: z.number().int().positive(),
  question: z.string().min(12),
  options: z.array(z.string()),
  answer: z.string().min(1),
  solution: z.string().min(12),
  rubric: z
    .array(
      z.object({
        criterion: z.string().min(1),
        points: z.number().int().positive(),
      }),
    )
    .min(1),
  exhibitIds: z.array(z.string()),
  claims: z.array(Claim),
  evidence: z.array(Evidence).optional(),
  objective: z.string().optional(),
  section: z.string().optional(),
  subparts: z
    .array(
      z.object({
        label: z.string(),
        prompt: z.string(),
        points: z.number().int().positive(),
      }),
    )
    .optional(),
  numeric: z
    .object({
      value: z.number().finite(),
      absoluteTolerance: z.number().min(0).max(1),
      relativeTolerance: z.number().min(0).max(0.1),
      unit: z.string().max(40),
    })
    .optional(),
});
export const Exam = z.object({
  schemaVersion: z.literal(2).optional(),
  subject: z.string().optional(),
  title: z.string(),
  instructions: z.string(),
  totalPoints: z.number().int(),
  minutes: z.number().int(),
  exhibits: z.array(Exhibit).optional(),
  questions: z.array(Question).min(1).max(12),
});
export const Review = z.object({
  questions: z.array(
    z.object({
      number: z.number().int(),
      independentAnswer: z.string(),
      status: z.enum(["consistent", "disputed", "unverifiable"]),
      issues: z.array(z.string()),
    }),
  ),
});
export const Independent = z.object({
  questions: z.array(
    z.object({
      number: z.number().int(),
      answer: z.string(),
      reasoning: z.string(),
    }),
  ),
});
export const Patch = z.object({ questions: z.array(Question) });
// Legacy schemas remain permissive for existing saved records. New live output
// must include its provenance and version rather than relying on prompt text.
export const V2Slot = Slot.extend({
  type: QuestionType.exclude(["free-response"]),
  objective: z.string().min(1),
  section: z.string().min(1),
  basis: DecisionBasis,
});
export const V2Blueprint = Blueprint.extend({
  schemaVersion: z.literal(2),
  settingsBasis: DecisionBasis,
  slots: z.array(V2Slot).min(1).max(12),
});
export const V2Question = Question.extend({
  type: QuestionType.exclude(["free-response"]),
  evidence: z.array(Evidence).min(1),
  objective: z.string().min(1),
  section: z.string().min(1),
});
export const V2Exam = Exam.extend({
  schemaVersion: z.literal(2),
  subject: z.string().min(1),
  exhibits: z.array(Exhibit),
  questions: z.array(V2Question).min(1).max(12),
});
export const V2Patch = Patch.extend({ questions: z.array(V2Question) });
export type Blueprint = z.infer<typeof Blueprint>;
export type Scenario = z.infer<typeof Scenario>;
export type Exam = z.infer<typeof Exam>;
export type Question = z.infer<typeof Question>;
export type Review = z.infer<typeof Review>;
export type Role = z.infer<typeof Role>;
export type Issue = {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
};
export type SourcePage = {
  number: number;
  text: string;
  imagePath?: string;
  duplicateOf?: string;
  needsVision: boolean;
};
export type SourceDocument = {
  id: string;
  name: string;
  role: Role;
  mime: string;
  filePath: string;
  pages: SourcePage[];
  warnings: string[];
};
export type Packet = {
  id: string;
  name: string;
  createdAt: string;
  documents: SourceDocument[];
  fixture: boolean;
};
export type Revision = {
  id: string;
  packetId: string;
  blueprint: Blueprint;
  approved: boolean;
  createdAt: string;
  parentRevisionId?: string;
  changes?: string[];
  parentExamId?: string;
};
export type Verification = {
  question: number;
  claim: number | null;
  method: string;
  result: "passed" | "failed" | "unsupported";
  artifact: string;
  checkerVersion: string;
  limitation: string;
};
export type CheckedExam = {
  id: string;
  packetId: string;
  revisionId: string;
  scenario?: Scenario;
  exam: Exam;
  issues: Issue[];
  review: Review;
  verification?: Verification[];
  repairAttempts: number;
  ready: boolean;
  fixture: boolean;
  createdAt: string;
  schemaVersion?: 2;
};
export type Job = {
  id: string;
  kind: "analyze" | "generate" | "follow-up" | "feedback";
  packetId: string;
  revisionId?: string;
  parentExamId?: string;
  attemptId?: string;
  focus?: string[];
  status:
    | "queued"
    | "running"
    | "complete"
    | "failed"
    | "cancelled"
    | "interrupted";
  stage: string;
  error?: string;
  resultId?: string;
  createdAt: string;
  updatedAt: string;
};
export type Attempt = {
  id: string;
  examId: string;
  startedAt: number;
  endsAt: number;
  mode?: "timed" | "untimed";
  responses: Record<string, string>;
  selfScores: Record<string, number>;
  submittedAt?: number;
};
export type FeedbackRecord = {
  id: string;
  attemptId: string;
  examId: string;
  jobId?: string;
  question: number;
  answerExcerpt: string;
  criterion: string;
  text: string;
  basis:
    | "automatically-checked"
    | "self-scored"
    | "needs-review"
    | "ai-suggestion";
  evidence: z.infer<typeof Evidence>[];
  nextAction: string;
  checkerVersion: string;
  createdAt: string;
  responseHash: string;
  disputes: { id: string; reason: string; createdAt: string }[];
};
export type PipelineArtifact = {
  id: string;
  jobId: string;
  stage: string;
  cycle: number;
  payload: unknown;
  createdAt: string;
};

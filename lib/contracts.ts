import { z } from "zod";

export const Role = z.enum(["past-exam", "lecture-notes", "assignment", "syllabus", "review-sheet", "solutions", "textbook", "generated-reference"]);
export const Evidence = z.object({ documentId: z.string(), page: z.number().int().positive(), description: z.string().min(1) });
export const Slot = z.object({ number: z.number().int().positive(), topic: z.string().min(1), type: z.enum(["multiple-choice", "free-response"]), points: z.number().int().min(1).max(100), minutes: z.number().int().min(1).max(120), difficulty: z.enum(["routine", "transfer", "synthesis"]), pattern: z.string(), evidence: z.array(Evidence) });
export const Blueprint = z.object({ title: z.string().min(1).max(160), domain: z.literal("linear-algebra"), instructions: z.string(), totalPoints: z.number().int().min(1).max(200), minutes: z.number().int().min(1).max(180), observations: z.array(z.object({ text: z.string(), kind: z.enum(["observed", "inferred", "student-selected"]), evidence: z.array(Evidence) })), uncertainties: z.array(z.string()), slots: z.array(Slot).min(1).max(12) });
const Vec = z.tuple([z.number().finite(), z.number().finite()]);
const Matrix = z.tuple([Vec, Vec]);
export const Scenario = z.object({ title: z.string(), company: z.string(), context: z.string(), matrix: Matrix, vectors: z.array(z.object({ label: z.string(), input: Vec })).min(2).max(6), eigenpairs: z.array(z.object({ value: z.number().finite(), vector: Vec })).min(1).max(2) });
export const Claim = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), input: Vec, answer: Vec }),
  z.object({ kind: z.literal("eigenpair"), value: z.number(), vector: Vec }),
  z.object({ kind: z.literal("determinant"), answer: z.number() }),
  z.object({ kind: z.literal("trace"), answer: z.number() }),
]);
export const Question = z.object({ number: z.number().int().positive(), topic: z.string(), type: z.enum(["multiple-choice", "free-response"]), points: z.number().int().positive(), minutes: z.number().int().positive(), question: z.string().min(12), options: z.array(z.string()), answer: z.string().min(1), solution: z.string().min(12), rubric: z.array(z.object({ criterion: z.string().min(1), points: z.number().int().positive() })).min(1), exhibitIds: z.array(z.enum(["calibration", "vectors", "diagram"])).min(1), claims: z.array(Claim).min(1) });
export const Exam = z.object({ title: z.string(), instructions: z.string(), totalPoints: z.number().int(), minutes: z.number().int(), questions: z.array(Question).min(1).max(12) });
export const Review = z.object({ questions: z.array(z.object({ number: z.number().int(), independentAnswer: z.string(), status: z.enum(["consistent", "disputed", "unverifiable"]), issues: z.array(z.string()) })) });
export const Independent = z.object({ questions: z.array(z.object({ number: z.number().int(), answer: z.string(), reasoning: z.string() })) });
export const Patch = z.object({ questions: z.array(Question) });
export type Blueprint = z.infer<typeof Blueprint>;
export type Scenario = z.infer<typeof Scenario>;
export type Exam = z.infer<typeof Exam>;
export type Question = z.infer<typeof Question>;
export type Review = z.infer<typeof Review>;
export type Role = z.infer<typeof Role>;
export type Issue = { code: string; path: string; message: string; severity: "error" | "warning" };
export type SourcePage = { number: number; text: string; imagePath?: string; duplicateOf?: string; needsVision: boolean };
export type SourceDocument = { id: string; name: string; role: Role; mime: string; filePath: string; pages: SourcePage[]; warnings: string[] };
export type Packet = { id: string; name: string; createdAt: string; documents: SourceDocument[]; fixture: boolean };
export type Revision = { id: string; packetId: string; blueprint: Blueprint; approved: boolean; createdAt: string };
export type CheckedExam = { id: string; packetId: string; revisionId: string; scenario: Scenario; exam: Exam; issues: Issue[]; review: Review; repairAttempts: number; ready: boolean; fixture: boolean; createdAt: string };
export type Job = { id: string; kind: "analyze" | "generate" | "follow-up"; packetId: string; revisionId?: string; parentExamId?: string; focus?: string[]; status: "queued" | "running" | "complete" | "failed" | "cancelled" | "interrupted"; stage: string; error?: string; resultId?: string; createdAt: string; updatedAt: string };
export type Attempt = { id: string; examId: string; startedAt: number; endsAt: number; responses: Record<string, string>; selfScores: Record<string, number>; submittedAt?: number };

import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/[...path]/route";
import {
  generalDemoPacket,
  generalDemoBlueprint,
  generalDemoExam,
} from "../lib/general-demo";
import {
  arithmetic,
  polynomial,
  verifyExam,
  numericGrade,
  automaticGrade,
} from "../lib/verification";
import { checkExam } from "../lib/domain";
import { publicExam } from "../lib/assessment-access";
import {
  put,
  id,
  list,
  get,
  spendingLimit,
  reserveUsage,
  settleUsage,
} from "../lib/store";
import {
  beginAttempt,
  followUp,
  saveRevision,
  updateAttempt,
} from "../lib/service";
import { persistFeedback } from "../lib/feedback";
import { runJob } from "../lib/pipeline";
import type {
  Job,
  Revision,
  CheckedExam,
  PipelineArtifact,
} from "../lib/contracts";
import type { AssessmentProvider } from "../lib/provider";
import { packetText } from "../lib/prompts";
import { feedbackCases } from "../lib/controlled-feedback";
import { orderedRevisions } from "../lib/revisions";

beforeAll(() => {
  process.env.VERA_DATA_DIR = mkdtempSync(path.join(tmpdir(), "vera-v2-"));
  delete process.env.VERA_BUDGET_DIR;
});
function setup() {
  const p = put("packet", generalDemoPacket()),
    b = generalDemoBlueprint(p),
    r = put<Revision>("revision", {
      id: id(),
      packetId: p.id,
      blueprint: b,
      approved: true,
      createdAt: new Date().toISOString(),
    }),
    e = put("exam", generalDemoExam(p, b, r.id));
  return { p, b, r, e };
}
function req(route: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000/api/${route}`, {
    method: body ? "POST" : "GET",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "x-vera-local": "1",
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });

describe("subject-independent checks and bounded grading", () => {
  it("runs original non-math material without matrix scenarios or mandatory exhibits", () => {
    const { e, p, b } = setup();
    expect(e.ready).toBe(true);
    expect(e.scenario).toBeUndefined();
    expect(checkExam(e.exam, b, undefined, "", p)).toEqual([]);
    expect(
      e.verification?.filter((v) => v.result === "unsupported"),
    ).toHaveLength(4);
  });
  it("parses bounded expressions without executing code and respects precedence", () => {
    expect(arithmetic("-2^2+3*(7-2)")).toBe(11);
    expect(polynomial("(x+1)^2")).toEqual([1, 2, 1]);
    for (const x of ["process.exit()", "1/0", "x^99", "x/(x+1)", "1e999"])
      expect(() => polynomial(x)).toThrow();
  });
  it("grades numbers, arithmetic alternatives, precision and units without grading prose", () => {
    const { e } = setup(),
      q = e.exam.questions[1];
    expect(numericGrade(q, "6 words")).toBe(true);
    expect(numericGrade(q, "18-12 words")).toBe(true);
    expect(numericGrade(q, "$6$ words")).toBe(true);
    expect(numericGrade(q, "6 seconds")).toBe(false);
    expect(numericGrade(q, "6")).toBe(false);
    expect(numericGrade(q, "6.01 words")).toBe(false);
    expect(numericGrade(e.exam.questions[3], "anything")).toBeUndefined();
  });
  it("catches wrong numeric keys, arithmetic mutations and references", () => {
    const { e, b, p } = setup(),
      bad = structuredClone(e.exam);
    bad.questions[1].numeric!.value = 9;
    bad.questions[1].claims = [
      { kind: "calculation", expression: "18-12", answer: 9, unit: "words" },
    ];
    bad.questions[0].evidence![0].page = 90;
    const codes = checkExam(bad, b, undefined, "", p).map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "NUMERIC_KEY",
        "NUMERICAL_CLAIM",
        "INVALID_REFERENCE",
      ]),
    );
  });
  it("does not mistake tiny SI values or permissive tolerances for a checked key", () => {
    const { e, b, p } = setup(),
      q = e.exam.questions[1];
    q.numeric = {
      value: 1.77e-10,
      absoluteTolerance: 1e-14,
      relativeTolerance: 0.001,
      unit: "F",
    };
    q.answer = "1.77e-10 F";
    q.claims = [
      {
        kind: "calculation",
        expression: "8.85e-12*0.02/0.001",
        answer: 1.77e-10,
        unit: "F",
      },
    ];
    expect(
      checkExam(e.exam, b, undefined, "", p).filter(
        (i) => i.severity === "error",
      ),
    ).toEqual([]);
    q.claims[0] = {
      kind: "calculation",
      expression: "8.85e-12*0.02/0.001",
      answer: 0,
      unit: "F",
    };
    expect(checkExam(e.exam, b, undefined, "", p).map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "NUMERICAL_CLAIM",
        "NUMERIC_BASIS",
        "NUMERIC_UNVERIFIED",
      ]),
    );
    q.claims[0] = {
      kind: "calculation",
      expression: "8.85e-12*0.02/0.001",
      answer: 1.77e-10,
      unit: "F",
    };
    q.numeric.absoluteTolerance = 1e-8;
    expect(
      checkExam(e.exam, b, undefined, "", p).some(
        (i) => i.code === "NUMERIC_KEY",
      ),
    ).toBe(true);
  });
  it("rejects answer-bearing labels, absent exhibits, duplicate stems and bad table dimensions", () => {
    const { e, b, p } = setup(),
      bad = structuredClone(e.exam);
    bad.questions[0].exhibitIds = ["missing"];
    bad.questions[1].question = bad.questions[0].question;
    bad.exhibits = [
      {
        id: "table",
        kind: "table",
        title: "Correct answer key",
        content: "",
        columns: ["a", "b"],
        rows: [["one"]],
        points: [],
        synthetic: true,
      },
    ];
    expect(checkExam(bad, b, undefined, "", p).map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "ANSWER_LEAK",
        "EXHIBIT_REFERENCE",
        "DUPLICATE",
        "EXHIBIT_TABLE",
      ]),
    );
  });
  it("blocks an explicitly referenced numeric answer repeated in a later question", () => {
    const { e, b, p } = setup();
    e.exam.questions[1].numeric = {
      value: 1.18e-10,
      absoluteTolerance: 1e-14,
      relativeTolerance: 0.001,
      unit: "F",
    };
    e.exam.questions[3].question =
      "Use Question 2: the capacitance is $C=1.18\\times 10^{-10}\\,\\mathrm{F}$. Explain the stored energy.";
    expect(
      checkExam(e.exam, b, undefined, "", p).some(
        (i) => i.code === "CROSS_ITEM_LEAK",
      ),
    ).toBe(true);
    e.exam.questions[3].question =
      "Use your capacitance from Question 2 and explain how stored energy changes when voltage doubles.";
    expect(
      checkExam(e.exam, b, undefined, "", p).some(
        (i) => i.code === "CROSS_ITEM_LEAK",
      ),
    ).toBe(false);
  });
  it("verifies quote locations without upgrading interpretation to ground truth", () => {
    const { e, p } = setup();
    e.exam.questions[0].claims = [
      {
        kind: "source",
        evidence: e.exam.questions[0].evidence![0],
        quote: "A correlation alone does not establish causation",
      },
    ];
    const v = verifyExam(e.exam, { packet: p })[0];
    expect(v.result).toBe("passed");
    expect(v.limitation).toContain("does not verify");
    e.exam.questions[0].claims = [
      {
        kind: "source",
        evidence: e.exam.questions[0].evidence![0],
        quote: "Invented quotation not in the packet",
      },
    ];
    expect(verifyExam(e.exam, { packet: p })[0].result).toBe("failed");
  });
  it("excludes restricted pages from model input and evidence validation", () => {
    const { p, e, b } = setup();
    p.documents[0].pages[0].text =
      "DO_NOT_TRANSMIT: This content is excluded from our Creative Commons license.";
    expect(packetText(p)).not.toContain("DO_NOT_TRANSMIT");
    expect(
      checkExam(e.exam, b, undefined, "", p).some(
        (i) => i.code === "INVALID_REFERENCE",
      ),
    ).toBe(true);
  });
  it("detects table-cell and coordinate contradictions", () => {
    const { e } = setup();
    e.exam.exhibits = [
      {
        id: "plot",
        kind: "diagram",
        title: "Measured points",
        content: "",
        columns: [],
        rows: [],
        points: [{ label: "P", x: 2, y: 3 }],
        synthetic: true,
      },
    ];
    e.exam.questions[0].claims = [
      { kind: "coordinate", exhibitId: "plot", label: "P", x: 2, y: 4 },
    ];
    expect(verifyExam(e.exam, {})[0].result).toBe("failed");
  });
  it("keeps all 48 controlled responses within their scoring boundaries", () => {
    const { p } = setup();
    const all = [
      "linear-algebra",
      "microeconomics",
      "psychology",
      "history",
    ].flatMap((course) => feedbackCases(course, p));
    expect(all).toHaveLength(48);
    for (const c of all) {
      expect(automaticGrade(c.question, c.response) ?? null).toBe(
        c.expectedAutomatic,
      );
      if (c.expectedAutomatic === null)
        expect(
          c.question.type === "essay" || c.question.type === "short-answer",
        ).toBe(true);
    }
  });
});

describe("private answers, review and recovery boundaries", () => {
  it("keeps upstream diagnostic text out of public usage responses", async () => {
    const call = reserveUsage("diagnostic-test", "test", "model", 0.02);
    settleUsage(call, {
      cost: 0,
      latency: 1,
      error: "PRIVATE_UPSTREAM_RESPONSE_CANARY",
    });
    const workspace = await GET(req("workspace"), ctx("workspace"));
    expect(await workspace.text()).not.toContain(
      "PRIVATE_UPSTREAM_RESPONSE_CANARY",
    );
  });
  it("orders replacement plans ahead of invalidated parents when timestamps tie", () => {
    const { r } = setup(),
      child = { ...r, id: "replacement", parentRevisionId: r.id },
      grandchild = { ...r, id: "replacement-2", parentRevisionId: child.id };
    expect(orderedRevisions([r, child, grandchild]).map((r) => r.id)).toEqual([
      grandchild.id,
      child.id,
      r.id,
    ]);
  });
  it("does not serialize keys, claims, rubrics, review answers or numeric specifications", async () => {
    const { e } = setup();
    e.exam.questions[0].answer = "SECRET_KEY_CANARY";
    put("exam", e);
    const safe = JSON.stringify(publicExam(e));
    for (const name of [
      '"answer":',
      '"solution":',
      '"claims":',
      '"numeric":',
      '"rubric":',
      '"independentAnswer":',
      "SECRET_KEY_CANARY",
    ])
      expect(safe).not.toContain(name);
    const workspace = await GET(req("workspace"), ctx("workspace"));
    expect(await workspace.text()).not.toContain("SECRET_KEY_CANARY");
  });
  it("keeps solutions private until that specific attempt is submitted", async () => {
    const { e } = setup(),
      a = beginAttempt(e.id, "untimed");
    const denied = await GET(
      req(`attempts/${a.id}/solutions`),
      ctx("attempts", a.id, "solutions"),
    );
    expect(denied.status).toBe(403);
    updateAttempt(a.id, { responses: { 1: "B", 2: "6 words" }, submit: true });
    const allowed = await GET(
      req(`attempts/${a.id}/solutions`),
      ctx("attempts", a.id, "solutions"),
    );
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).exam.exam.questions[0].answer).toBe("B");
  });
  it("untimed attempts survive elapsed clock time, resume and retain responses", () => {
    const { e } = setup(),
      a = beginAttempt(e.id, "untimed");
    put("attempt", { ...a, endsAt: Date.now() - 1 });
    expect(
      updateAttempt(a.id, { responses: { 2: "6 words" } }).submittedAt,
    ).toBeUndefined();
    expect(beginAttempt(e.id).id).toBe(a.id);
  });
  it("preserves disputed feedback versions and never alters automatic scores", async () => {
    const { e, p } = setup(),
      a = beginAttempt(e.id);
    const submitted = updateAttempt(a.id, {
      responses: { 1: "A" },
      submit: true,
    });
    const records = persistFeedback(e, submitted, p),
      feedback = records[0];
    const reported = await POST(
      req(`feedback/${feedback.id}`, {
        reason: "The explanation needs review",
      }),
      ctx("feedback", feedback.id),
    );
    expect(reported.status).toBe(200);
    expect(persistFeedback(e, submitted, p)[0].disputes).toHaveLength(1);
    expect(get<CheckedExam>("exam", e.id)?.exam.questions[0].answer).toBe("B");
  });
  it("requires written self-scores and leaves targeted plans unapproved", () => {
    const { e } = setup(),
      a = beginAttempt(e.id);
    updateAttempt(a.id, { submit: true });
    expect(() => followUp(e.id)).toThrow(/rubric/);
    updateAttempt(a.id, { selfScores: { 3: 2, 4: 3 } });
    const plan = followUp(e.id);
    expect(plan.approved).toBe(false);
    expect(plan.parentExamId).toBe(e.id);
    const approved = saveRevision(plan.id, plan.blueprint, true);
    expect(approved.parentExamId).toBe(e.id);
  });
  it("invalidates plan approval when a document role changes", async () => {
    const { p, r } = setup();
    expect(
      (
        await POST(
          req(`packets/${p.id}/roles`, {
            documentId: p.documents[0].id,
            role: "textbook",
          }),
          ctx("packets", p.id, "roles"),
        )
      ).status,
    ).toBe(200);
    expect(get<Revision>("revision", r.id)?.approved).toBe(false);
  });
  it("stores independent outputs and repair history while leaving unverified reasoning visible", async () => {
    const { p, b, e, r } = setup();
    put("packet", { ...p, fixture: false });
    const now = new Date().toISOString(),
      job = put<Job>("job", {
        id: id(),
        packetId: p.id,
        revisionId: r.id,
        kind: "generate",
        status: "running",
        stage: "start",
        createdAt: now,
        updatedAt: now,
      });
    const provider: AssessmentProvider = {
      async structured(request) {
        const payload = request.name.startsWith("Generate")
          ? e.exam
          : request.name.startsWith("Solve")
            ? {
                questions: e.exam.questions.map((q) => ({
                  number: q.number,
                  answer: q.answer,
                  reasoning:
                    "Independent reasoning, not a verified expert grade.",
                })),
              }
            : {
                questions: e.exam.questions.map((q) => ({
                  number: q.number,
                  independentAnswer: q.answer,
                  status: "unverifiable",
                  issues: ["Human review needed for interpretation"],
                })),
              };
        return request.schema.parse(payload);
      },
    };
    await runJob(job, provider);
    const saved = get<CheckedExam>("exam", get<Job>("job", job.id)!.resultId!)!;
    expect(saved.ready).toBe(true);
    expect(saved.exam.totalPoints).toBe(b.totalPoints);
    expect(saved.issues.some((i) => i.code === "REVIEW_LIMIT")).toBe(true);
    expect(
      list<PipelineArtifact>("artifact").filter((a) => a.jobId === job.id)
        .length,
    ).toBeGreaterThan(5);
  });
  it("rejects feedback that fabricates a student excerpt without changing scores", async () => {
    const { p, e } = setup(),
      a = beginAttempt(e.id);
    updateAttempt(a.id, { responses: { 1: "B" }, submit: true });
    const now = new Date().toISOString(),
      job = put<Job>("job", {
        id: id(),
        kind: "feedback",
        packetId: p.id,
        attemptId: a.id,
        status: "running",
        stage: "start",
        createdAt: now,
        updatedAt: now,
      });
    const provider: AssessmentProvider = {
      async structured(request) {
        return request.schema.parse({
          questions: [
            {
              number: 1,
              criterionIndex: 0,
              answerExcerpt: "Words the student never wrote",
              text: "Invented criticism must not be published",
              nextAction: "Review the criterion",
              evidence: [],
            },
          ],
        });
      },
    };
    await expect(runJob(job, provider)).rejects.toThrow(/excerpt/);
    expect(
      list("feedback").filter(
        (f) => (f as { attemptId: string }).attemptId === a.id,
      ),
    ).toHaveLength(0);
  });
  it("does not publish an exam cancelled at the final checking boundary", async () => {
    const { p, e, r } = setup();
    put("packet", { ...p, fixture: false });
    const now = new Date().toISOString(),
      job = put<Job>("job", {
        id: id(),
        packetId: p.id,
        revisionId: r.id,
        kind: "generate",
        status: "running",
        stage: "start",
        createdAt: now,
        updatedAt: now,
      });
    const provider: AssessmentProvider = {
      async structured(request) {
        if (request.name.startsWith("Generate"))
          return request.schema.parse(e.exam);
        if (request.name.startsWith("Solve"))
          return request.schema.parse({
            questions: e.exam.questions.map((q) => ({
              number: q.number,
              answer: q.answer,
              reasoning: "Checked independently",
            })),
          });
        put("job", { ...job, status: "cancelled" });
        return request.schema.parse({
          questions: e.exam.questions.map((q) => ({
            number: q.number,
            independentAnswer: q.answer,
            status: "consistent",
            issues: [],
          })),
        });
      },
    };
    await expect(runJob(job, provider)).rejects.toThrow(/cancelled/);
    expect(get<Job>("job", job.id)?.resultId).toBeUndefined();
  });
  it("enforces an additional persistent evaluation cap before making calls", () => {
    spendingLimit("test-additional", 0.03);
    process.env.VERA_EVALUATION_LIMIT_ID = "test-additional";
    const call = reserveUsage("evaluation", "test", "model", 0.02);
    expect(() => reserveUsage("evaluation", "test", "model", 0.02)).toThrow(
      /evaluation spending/,
    );
    settleUsage(call, { cost: 0.01, latency: 1 });
    expect(() =>
      reserveUsage("evaluation", "test", "model", 0.01),
    ).not.toThrow();
    delete process.env.VERA_EVALUATION_LIMIT_ID;
  });
});

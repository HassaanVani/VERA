import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { vectorPacket, vectorBlueprint, vectorExam } from "../lib/vector-demo";
import { put, get, id, list } from "../lib/store";
import { beginAttempt, updateAttempt, saveRevision } from "../lib/service";
import {
  encodeVectorResponse,
  emptyVectorResponse,
  readVectorResponse,
  responseText,
  validVectorResponse,
} from "../lib/vector-response";
import { checkExam, blueprintIssues } from "../lib/domain";
import { publicExam } from "../lib/assessment-access";
import { independentPrompt } from "../lib/prompts";
import { persistFeedback } from "../lib/feedback";
import {
  bindSourcePassages,
  exactSourceSlice,
  materialProblems,
} from "../lib/supporting-material";
import { diagramGeometry } from "../lib/diagram-geometry";
import { runJob } from "../lib/pipeline";
import {
  illustratedPacket,
  illustratedBlueprint,
  illustratedExam,
} from "../lib/illustrated-demo";
import type { Job, CheckedExam, PipelineArtifact } from "../lib/contracts";
import VectorAnswer from "../components/VectorAnswer";
beforeAll(() => {
  const root = mkdtempSync(path.join(tmpdir(), "vera-vectors-"));
  process.env.VERA_DATA_DIR = root;
  process.env.VERA_BUDGET_DIR = root;
});
function setup() {
  const packet = put("packet", vectorPacket()),
    blueprint = vectorBlueprint(packet),
    revision = put("revision", {
      id: id(),
      packetId: packet.id,
      blueprint,
      approved: true,
      createdAt: new Date().toISOString(),
    }),
    exam = put("exam", vectorExam(packet, blueprint, revision.id));
  return {
    packet,
    blueprint,
    revision,
    exam,
    config: exam.exam.questions[0].responseDiagram!,
  };
}
describe("vector response persistence and honest grading", () => {
  it("loads a labeled authored drawing example without model calls", async () => {
    const { packet, revision } = setup(),
      now = new Date().toISOString(),
      job = put<Job>("job", {
        id: id(),
        kind: "generate",
        packetId: packet.id,
        revisionId: revision.id,
        status: "running",
        stage: "start",
        createdAt: now,
        updatedAt: now,
      });
    await runJob(job, {
      structured: async () => {
        throw Error("No provider call permitted");
      },
    });
    const result = get<CheckedExam>(
      "exam",
      get<Job>("job", job.id)!.resultId!,
    )!;
    expect(result.ready).toBe(true);
    expect(
      result
        .verification!.filter((v) => v.method === "vector-response-grading")
        .map((v) => v.result),
    ).toEqual(["unsupported", "unsupported"]);
  });
  it("validates, saves, reads and locks coordinate answers after submission", () => {
    const { exam, config } = setup(),
      attempt = beginAttempt(exam.id, "untimed"),
      response = encodeVectorResponse({
        ...emptyVectorResponse(),
        vectors: [{ from: [0, 0], to: [4, 2] }],
        reasoning: "I transformed the two components.",
      });
    expect(validVectorResponse(response, config)).toBe(true);
    expect(
      updateAttempt(attempt.id, { responses: { 1: response } }).responses[1],
    ).toBe(response);
    expect(
      readVectorResponse(
        get<typeof attempt>("attempt", attempt.id)!.responses[1],
      )!.vectors[0].to,
    ).toEqual([4, 2]);
    updateAttempt(attempt.id, { submit: true });
    expect(() => updateAttempt(attempt.id, { responses: { 1: "" } })).toThrow(
      /locked/,
    );
  });
  it("rejects malformed, excessive, out-of-bounds and non-finite responses", () => {
    const { exam, config } = setup(),
      attempt = beginAttempt(exam.id, "untimed");
    for (const value of [
      "{broken}",
      "VERA_VECTOR_V1:{}",
      encodeVectorResponse({
        ...emptyVectorResponse(),
        vectors: [{ from: [0, 0], to: [99, 2] }],
      }),
      "VERA_VECTOR_V1:" +
        JSON.stringify({
          ...emptyVectorResponse(),
          vectors: Array.from({ length: 4 }, () => ({
            from: [0, 0],
            to: [1, 1],
          })),
        }),
    ]) {
      expect(validVectorResponse(value, config)).toBe(false);
      expect(() =>
        updateAttempt(attempt.id, { responses: { 1: value } }),
      ).toThrow(/Diagram response/);
    }
    expect(
      readVectorResponse(
        'VERA_VECTOR_V1:{"version":1,"kind":"vector-drawing","vectors":[{"from":[0,0],"to":[1e999,1]}],"reasoning":""}',
      ),
    ).toBeUndefined();
  });
  it("keeps an empty drawing unanswered and formats saved vectors without JSON noise", () => {
    expect(encodeVectorResponse(emptyVectorResponse())).toBe("");
    const value = encodeVectorResponse({
      ...emptyVectorResponse(),
      vectors: [{ from: [0, 0], to: [4, 2] }],
      reasoning: "My explanation",
    });
    expect(responseText(value)).toBe(
      "Vector 1: (0, 0) → (4, 2)\nMy explanation",
    );
  });
  it("preserves self-scoring and readable feedback provenance", () => {
    const { packet, exam } = setup(),
      attempt = beginAttempt(exam.id, "untimed");
    const response = encodeVectorResponse({
      ...emptyVectorResponse(),
      vectors: [{ from: [0, 0], to: [4, 2] }],
    });
    updateAttempt(attempt.id, { responses: { 1: response }, submit: true });
    const submitted = get<typeof attempt>("attempt", attempt.id)!;
    const feedback = persistFeedback(exam, submitted, packet);
    expect(feedback[0].basis).toBe("needs-review");
    expect(feedback[0].answerExcerpt).toContain("Vector 1:");
    expect(feedback[0].answerExcerpt).not.toContain("VERA_VECTOR_V1");
    expect(
      updateAttempt(attempt.id, { selfScores: { 1: 4 } }).selfScores[1],
    ).toBe(4);
  });
  it("allows only approved worked diagrams and validates bounds at generation", () => {
    const { packet, blueprint, exam } = setup();
    blueprint.slots[0].type = "essay";
    expect(blueprintIssues(blueprint, packet).map((i) => i.code)).toContain(
      "RESPONSE_MODE",
    );
    blueprint.slots[0].type = "worked-response";
    exam.exam.questions[0].responseDiagram!.maxX = -1;
    expect(
      checkExam(exam.exam, blueprint, undefined, "", packet).map((i) => i.code),
    ).toContain("RESPONSE_DIAGRAM");
  });
  it("withholds keys while keeping a safe coordinate response configuration", () => {
    const { exam } = setup(),
      payload = JSON.stringify(publicExam(exam));
    expect(payload).toContain('"responseDiagram":');
    for (const field of ['"answer":', '"solution":', '"rubric":', '"claims":'])
      expect(payload).not.toContain(field);
    expect(independentPrompt(exam.exam, undefined)).toContain(
      '"responseDiagram":',
    );
    expect(independentPrompt(exam.exam, undefined)).not.toContain('"answer":');
  });
  it("renders saved geometry and escaped reasoning in a read-only review", () => {
    const { exam, config } = setup(),
      value = encodeVectorResponse({
        ...emptyVectorResponse(),
        vectors: [{ from: [0, 0], to: [4, 2] }],
        reasoning: "<script>bad()</script>",
      });
    const markup = renderToStaticMarkup(
      <VectorAnswer
        config={config}
        exhibit={exam.exam.exhibits![0]}
        value={value}
        readOnly
      />,
    );
    expect(markup).toContain('class="answer-vector"');
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<textarea");
  });
  it("invalidates approval when the answer method changes", () => {
    const { revision } = setup();
    const changed = saveRevision(
      revision.id,
      {
        ...revision.blueprint,
        slots: revision.blueprint.slots.map((s) => ({
          ...s,
          responseMode: "written",
        })),
      },
      false,
    );
    expect(changed.approved).toBe(false);
  });
});
describe("source binding and content-sized diagram bounds", () => {
  it("returns actual source punctuation without accepting changed words", () => {
    const page =
      "Before. The author calls it “a great test” of endurance. After.";
    expect(
      exactSourceSlice(
        page,
        'The author calls it "a great test" of endurance.',
      ),
    ).toBe("The author calls it “a great test” of endurance.");
    expect(
      exactSourceSlice(
        page,
        'The author calls it "a small test" of endurance.',
      ),
    ).toBeUndefined();
  });
  it("binds a permitted passage to its original substring and retains the model proposal", () => {
    const packet = illustratedPacket(),
      b = illustratedBlueprint(packet),
      exam = illustratedExam(packet, b, "rev").exam;
    packet.documents[0].pages[1].text =
      "A primary source says “look at this evidence” and questions certainty.";
    const passage = exam.exhibits!.find((e) => e.kind === "passage")!;
    passage.content =
      'A primary source says "look at this evidence" and questions certainty.';
    const result = bindSourcePassages(exam, packet);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].before).toContain('"look');
    expect(
      result.exam.exhibits!.find((e) => e.id === passage.id)!.content,
    ).toContain("“look");
    expect(
      materialProblems(
        result.exam.exhibits!.find((e) => e.id === passage.id)!,
        packet,
      ),
    ).toEqual([]);
    expect(exam.exhibits!.find((e) => e.id === passage.id)!.content).toContain(
      '"look',
    );
  });
  it("does not bind excluded pages, invented quotations or incorrect page references", () => {
    const packet = illustratedPacket(),
      b = illustratedBlueprint(packet),
      exam = illustratedExam(packet, b, "rev").exam;
    const passage = exam.exhibits!.find((e) => e.kind === "passage")!;
    passage.content = "This is an invented source that was never uploaded.";
    expect(bindSourcePassages(exam, packet).changes).toEqual([]);
    packet.documents[0].pages[1].text =
      "A real primary source says “the river is shared” with neighbors.";
    passage.content =
      'A real primary source says "the river is shared" with neighbors.';
    packet.documents[0].role = "solutions";
    expect(bindSourcePassages(exam, packet).changes).toEqual([]);
    packet.documents[0].role = "lecture-notes";
    passage.source!.page = 999;
    expect(bindSourcePassages(exam, packet).changes).toEqual([]);
  });
  it("fits wide diagrams without forcing the origin into an axis-free view", () => {
    const { exam } = setup(),
      exhibit = structuredClone(exam.exam.exhibits![0]);
    exhibit.points = [
      { label: "A", x: 100, y: 100 },
      { label: "B", x: 110, y: 101 },
    ];
    exhibit.drawing = {
      axes: "none",
      description: "Two given positions",
      segments: [],
      paths: [],
      circles: [],
    };
    const geometry = diagramGeometry(exhibit);
    expect(geometry.width).toBeGreaterThan(geometry.height * 2);
    expect(geometry.x(100)).toBeGreaterThan(20);
    expect(geometry.x(110)).toBeLessThan(geometry.width - 20);
    expect(geometry.x(101) - geometry.x(100)).toBeCloseTo(
      geometry.y(100) - geometry.y(101),
    );
  });
  it("persists automatic source binding before independent review without spending a repair cycle", async () => {
    const packet = illustratedPacket(),
      blueprint = illustratedBlueprint(packet),
      generated = illustratedExam(packet, blueprint, "rev").exam;
    packet.fixture = false;
    for (const question of generated.questions)
      question.claims = question.claims.filter(
        (claim) => claim.kind !== "source",
      );
    packet.documents[0].pages[1].text =
      "A real page states “a shared concern” about river access.";
    const passage = generated.exhibits!.find((e) => e.kind === "passage")!;
    passage.content =
      'A real page states "a shared concern" about river access.';
    put("packet", packet);
    const now = new Date().toISOString(),
      revision = put("revision", {
        id: id(),
        packetId: packet.id,
        blueprint,
        approved: true,
        createdAt: now,
      }),
      job = put<Job>("job", {
        id: id(),
        kind: "generate",
        packetId: packet.id,
        revisionId: revision.id,
        status: "running",
        stage: "start",
        createdAt: now,
        updatedAt: now,
      });
    await runJob(job, {
      async structured(request) {
        return request.schema.parse(
          request.name.startsWith("Generate")
            ? generated
            : request.name.startsWith("Solve")
              ? {
                  questions: generated.questions.map((q) => ({
                    number: q.number,
                    answer: q.answer,
                    reasoning: "Independent test reasoning",
                  })),
                }
              : {
                  questions: generated.questions.map((q) => ({
                    number: q.number,
                    independentAnswer: q.answer,
                    status: "consistent",
                    issues: [],
                  })),
                },
        );
      },
    });
    const saved = get<CheckedExam>("exam", get<Job>("job", job.id)!.resultId!)!;
    expect(saved.ready).toBe(true);
    expect(saved.repairAttempts).toBe(0);
    expect(
      list<PipelineArtifact>("artifact").some(
        (a) => a.jobId === job.id && a.stage === "Bind literal source passages",
      ),
    ).toBe(true);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Exhibit } from "../lib/contracts";
import type { CheckedExam, Job, PipelineArtifact } from "../lib/contracts";
import {
  illustratedPacket,
  illustratedBlueprint,
  illustratedExam,
  fictionalPetition,
} from "../lib/illustrated-demo";
import { materialProblems, retrievePassages } from "../lib/supporting-material";
import { publicExam } from "../lib/assessment-access";
import { independentPrompt } from "../lib/prompts";
import { get, id, list, put } from "../lib/store";
import { runJob } from "../lib/pipeline";
import type { AssessmentProvider } from "../lib/provider";
import GeometryDiagram from "../components/GeometryDiagram";

beforeAll(() => {
  const root = mkdtempSync(path.join(tmpdir(), "vera-illustrations-"));
  process.env.VERA_DATA_DIR = root;
  process.env.VERA_BUDGET_DIR = root;
});
const setup = () => {
  const packet = illustratedPacket(),
    blueprint = illustratedBlueprint(packet),
    exam = illustratedExam(packet, blueprint, "revision");
  return {
    packet,
    blueprint,
    exam,
    diagram: exam.exam.exhibits![0],
    passage: exam.exam.exhibits![1],
  };
};
describe("precise diagrams and retrieved source passages", () => {
  it("loads the illustrated example with checked arithmetic and honest interpretation limits", () => {
    const { exam } = setup();
    expect(exam.ready).toBe(true);
    expect(
      exam.verification?.some(
        (v) => v.method === "diagram-structure" && v.result === "passed",
      ),
    ).toBe(true);
    expect(
      exam.verification?.some(
        (v) => v.method === "source-excerpt" && v.result === "passed",
      ),
    ).toBe(true);
    expect(
      exam.verification?.filter((v) => v.method === "written-reasoning"),
    ).toHaveLength(3);
  });
  it("rejects dangling vertices, duplicate labels, invalid circle centers and answer-bearing labels", () => {
    const { diagram } = setup();
    const bad = structuredClone(diagram);
    bad.points.push({ ...bad.points[0] });
    bad.drawing!.segments[0].to = "absent";
    bad.drawing!.circles[0].center = "missing";
    bad.drawing!.paths[0].label = "correct answer";
    expect(materialProblems(bad).length).toBeGreaterThanOrEqual(4);
  });
  it("rejects nonfinite geometry, oversized coordinates and impossible radii", () => {
    const { diagram } = setup();
    const bad = structuredClone(diagram);
    bad.points[0].x = Infinity;
    expect(Exhibit.safeParse(bad).success).toBe(false);
    bad.points[0].x = 2e6;
    expect(materialProblems(bad).join(" ")).toContain("magnitude");
    bad.drawing!.circles[0].radius = -2;
    expect(Exhibit.safeParse(bad).success).toBe(false);
  });
  it("renders structured geometry with a text alternative and no executable model markup", () => {
    const { diagram } = setup();
    const markup = renderToStaticMarkup(
      <GeometryDiagram
        exhibit={{
          ...diagram,
          drawing: {
            ...diagram.drawing!,
            description: "<script>unsafe()</script>",
          },
        }}
      />,
    );
    expect(markup).toContain("<polygon");
    expect(markup).toContain("marker-end=");
    expect(markup).toContain("Diagram data &amp; description");
    expect(markup).toContain("Circle centered at A, radius 1.5");
    expect(markup).not.toContain("<script>");
  });
  it("keeps full circles within the shared coordinate bounds", () => {
    const { diagram } = setup();
    const markup = renderToStaticMarkup(<GeometryDiagram exhibit={diagram} />);
    const circles = [
      ...markup.matchAll(
        /<circle[^>]*cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g,
      ),
    ];
    expect(circles.length).toBeGreaterThan(3);
    for (const [, cx, cy, radius] of circles) {
      const viewport = markup.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!;
      for (const [axis, center] of [Number(cx), Number(cy)].entries()) {
        expect(center - Number(radius)).toBeGreaterThan(10);
        expect(center + Number(radius)).toBeLessThan(
          Number(viewport[axis + 1]) - 10,
        );
      }
    }
  });
  it("retrieves cited page text without treating it as an instruction", () => {
    const { packet, blueprint } = setup();
    const retrieved = retrievePassages(packet, blueprint);
    expect(
      retrieved.some(
        (p) => p.page === 2 && p.content.includes(fictionalPetition),
      ),
    ).toBe(true);
    packet.documents.push({
      ...packet.documents[0],
      id: "generated",
      role: "generated-reference",
    });
    expect(
      retrievePassages(packet, blueprint).some(
        (p) => p.documentId === "generated",
      ),
    ).toBe(false);
  });
  it("blocks invented quotations, missing references and synthetic material mislabeled as a source", () => {
    const { passage, packet } = setup();
    expect(materialProblems(passage, packet)).toEqual([]);
    expect(
      materialProblems(
        {
          ...passage,
          content: "This invented sentence never appeared in the document.",
        },
        packet,
      ),
    ).not.toEqual([]);
    expect(
      materialProblems(
        { ...passage, source: { documentId: "missing", page: 2 } },
        packet,
      ),
    ).not.toEqual([]);
    expect(
      materialProblems({ ...passage, synthetic: true }, packet),
    ).not.toEqual([]);
  });
  it("does not release keys with diagram/source metadata or the independent solve", () => {
    const { exam } = setup();
    const publicJSON = JSON.stringify(publicExam(exam));
    for (const field of [
      '"answer":',
      '"solution":',
      '"rubric":',
      '"numeric":',
      '"claims":',
    ])
      expect(publicJSON).not.toContain(field);
    expect(publicJSON).toContain('"drawing":');
    expect(independentPrompt(exam.exam, undefined)).not.toContain(
      '"solution":',
    );
  });
  it("runs generation, retrieval, independent solving and publication with the richer schema", async () => {
    const { packet, blueprint, exam } = setup();
    put("packet", { ...packet, fixture: false });
    const revision = put("revision", {
      id: "revision",
      packetId: packet.id,
      blueprint,
      approved: true,
      createdAt: new Date().toISOString(),
    });
    const now = new Date().toISOString();
    const job = put<Job>("job", {
      id: id(),
      kind: "generate",
      packetId: packet.id,
      revisionId: revision.id,
      status: "running",
      stage: "start",
      createdAt: now,
      updatedAt: now,
    });
    const provider: AssessmentProvider = {
      async structured(request) {
        const payload = request.name.startsWith("Generate")
          ? exam.exam
          : request.name.startsWith("Solve")
            ? {
                questions: exam.exam.questions.map((q) => ({
                  number: q.number,
                  answer: q.answer,
                  reasoning: "Independent test response",
                })),
              }
            : {
                questions: exam.exam.questions.map((q) => ({
                  number: q.number,
                  independentAnswer: q.answer,
                  status: "unverifiable",
                  issues: ["Interpretation still needs review"],
                })),
              };
        if (request.name.startsWith("Generate"))
          expect(request.prompt).toContain("UNTRUSTED_RETRIEVED_PASSAGES");
        return request.schema.parse(payload);
      },
    };
    await runJob(job, provider);
    const saved = get<CheckedExam>("exam", get<Job>("job", job.id)!.resultId!)!;
    expect(saved.ready).toBe(true);
    expect(saved.exam.exhibits![0].drawing!.circles).toHaveLength(1);
    expect(
      list<PipelineArtifact>("artifact").some(
        (a) => a.stage === "Retrieved source passages",
      ),
    ).toBe(true);
  });
  it.each([false, true])(
    "bounds supporting-material repair (unrelated edit: %s)",
    async (unrelated) => {
      const { packet, blueprint, exam } = setup();
      put("packet", { ...packet, fixture: false });
      const now = new Date().toISOString();
      const revision = put("revision", {
        id: id(),
        packetId: packet.id,
        blueprint,
        approved: true,
        createdAt: now,
      });
      const job = put<Job>("job", {
        id: id(),
        packetId: packet.id,
        revisionId: revision.id,
        kind: "generate",
        status: "running",
        stage: "start",
        createdAt: now,
        updatedAt: now,
      });
      const damaged = structuredClone(exam.exam);
      damaged.exhibits![0].drawing!.segments[0].to = "missing";
      let repairs = 0;
      const provider: AssessmentProvider = {
        async structured(request) {
          let payload: unknown;
          if (request.name.startsWith("Generate")) payload = damaged;
          else if (request.name.startsWith("Targeted repair")) {
            repairs++;
            payload = {
              questions: [],
              exhibits: [exam.exam.exhibits![unrelated ? 1 : 0]],
            };
          } else if (request.name.startsWith("Solve"))
            payload = {
              questions: exam.exam.questions.map((q) => ({
                number: q.number,
                answer: q.answer,
                reasoning: "Independent test reasoning",
              })),
            };
          else
            payload = {
              questions: exam.exam.questions.map((q) => ({
                number: q.number,
                independentAnswer: q.answer,
                status: "unverifiable",
                issues: [],
              })),
            };
          return request.schema.parse(payload);
        },
      };
      if (unrelated) {
        await expect(runJob(job, provider)).rejects.toThrow(
          "unaffected supporting material",
        );
        expect(get<Job>("job", job.id)!.resultId).toBeUndefined();
      } else {
        await runJob(job, provider);
        const result = get<CheckedExam>(
          "exam",
          get<Job>("job", job.id)!.resultId!,
        )!;
        expect(result.ready).toBe(true);
        expect(
          result
            .verification!.filter((v) => v.method === "diagram-structure")
            .every((v) => v.result === "passed"),
        ).toBe(true);
        expect(
          list<PipelineArtifact>("artifact").find(
            (a) => a.jobId === job.id && a.stage === "Repair diff",
          ),
        ).toBeDefined();
      }
      expect(repairs).toBe(1);
    },
  );
});

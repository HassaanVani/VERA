import { mkdtempSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/[...path]/route";
import {
  MetaImageProvider,
  pngDimensions,
  type ImageProvider,
} from "../lib/image-provider";
import {
  imagePrompt,
  prepareExamImages,
  imageVerification,
} from "../lib/exam-images";
import {
  generalDemoPacket,
  generalDemoBlueprint,
  generalDemoExam,
} from "../lib/general-demo";
import { get, put, id, list, usageSummary, dataDir } from "../lib/store";
import type {
  CheckedExam,
  ImageArtifact,
  Job,
  PipelineArtifact,
} from "../lib/contracts";
import type { AssessmentProvider } from "../lib/provider";
import { publicExam } from "../lib/assessment-access";
import { independentPrompt } from "../lib/prompts";
import { runJob } from "../lib/pipeline";
import { checkExam } from "../lib/domain";

beforeAll(() => {
  const directory = mkdtempSync(path.join(tmpdir(), "vera-image-"));
  process.env.VERA_DATA_DIR = directory;
  process.env.VERA_BUDGET_DIR = directory;
});
afterEach(() => {
  delete process.env.MODEL_API_KEY;
  delete process.env.META_IMAGE_MODEL;
  delete process.env.VERA_IMAGE_USD_PER_IMAGE;
});
// Metadata-only fixture for transport validation; live browser checks use decoded PNGs.
function png() {
  const bytes = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(200, 16);
  bytes.writeUInt32BE(100, 20);
  return bytes;
}
function setup() {
  const packet = generalDemoPacket();
  packet.fixture = false;
  packet.documents[0].name = "Original test-only notes";
  const blueprint = generalDemoBlueprint(packet);
  blueprint.visuals = "muse-image";
  const exam = generalDemoExam(packet, blueprint, "revision");
  exam.exam.exhibits = [
    {
      id: "figure",
      kind: "image",
      title: "Study arrangement",
      content: "Two original groups in a recall study.",
      columns: [],
      rows: [],
      points: [],
      synthetic: true,
      illustration: {
        prompt:
          "Draw two participant groups labeled A and B; no results or answers.",
        description:
          "Two groups, A and B, each completing the same recall task.",
      },
    },
  ];
  exam.exam.questions[0].exhibitIds = ["figure"];
  return { packet, blueprint, exam };
}
const fakeImages: ImageProvider = {
  async generate(request) {
    const assetId = id(),
      file = path.join(dataDir(), `${assetId}.png`);
    await writeFile(file, png());
    return put<ImageArtifact>("image", {
      id: assetId,
      jobId: request.jobId,
      exhibitId: request.exhibitId,
      path: file,
      mime: "image/png",
      sha256: "test-hash",
      fingerprint: request.fingerprint,
      model: "test-only",
      width: 200,
      height: 100,
      createdAt: new Date().toISOString(),
    });
  },
};
const consistent = {
  status: "consistent",
  issues: [],
  observedDescription: "The image matches the stated givens.",
};

describe("Muse Image provider and exam boundaries", () => {
  it("requires credentials and checked pricing before networking", async () => {
    const request = {
      jobId: id(),
      exhibitId: "figure",
      prompt: "test",
      fingerprint: "test",
    };
    await expect(new MetaImageProvider().generate(request)).rejects.toThrow(
      /credentials/,
    );
    process.env.MODEL_API_KEY = "test-only";
    process.env.VERA_IMAGE_USD_PER_IMAGE = ".02";
    await expect(new MetaImageProvider().generate(request)).rejects.toThrow(
      /pricing/,
    );
  });
  it("uses agentic layout tools, persists private assets and settles the shared ledger", async () => {
    process.env.MODEL_API_KEY = "test-only";
    let sent: Record<string, unknown> = {};
    const transport: typeof fetch = async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({
        id: "response-test",
        status: "completed",
        output: [
          {
            type: "image_generation_call",
            status: "completed",
            result: png().toString("base64"),
          },
        ],
      });
    };
    const asset = await new MetaImageProvider(transport).generate({
      jobId: id(),
      exhibitId: "figure",
      prompt: "test",
      fingerprint: "test",
    });
    expect(sent).toMatchObject({
      model: "muse-image-1.0",
      store: false,
      tools: [
        {
          type: "image_generation",
          enable_shell: true,
          enable_web_search: false,
          enable_image_search: false,
        },
      ],
    });
    expect(await readFile(asset.path)).toEqual(png());
    expect(asset.path).not.toContain(`${path.sep}public${path.sep}`);
    expect(usageSummary().recent[0]).toMatchObject({
      cost: 0.01,
      status: "settled",
    });
  });
  it("retains uncertain charges and bounds retry and cancellation", async () => {
    process.env.MODEL_API_KEY = "test-only";
    const request = {
      jobId: id(),
      exhibitId: "figure",
      prompt: "test",
      fingerprint: "test",
    };
    await expect(
      new MetaImageProvider(async () => {
        throw Error("connection lost");
      }).generate(request),
    ).rejects.toThrow("connection lost");
    expect(usageSummary().recent[0]).toMatchObject({
      cost: null,
      status: "uncertain",
    });
    let calls = 0;
    await expect(
      new MetaImageProvider(async () => {
        calls++;
        return new Response("", { status: 503 });
      }).generate(request),
    ).rejects.toThrow(/503/);
    expect(calls).toBe(2);
    const signal = AbortSignal.abort();
    await expect(
      new MetaImageProvider(async () => {
        throw Error("must not call");
      }).generate({ ...request, signal }),
    ).rejects.toThrow();
  });
  it("rejects invalid image formats and unreasonable dimensions", () => {
    expect(() => pngDimensions(Buffer.from("<svg>"))).toThrow(/PNG/);
    const bytes = png();
    bytes.writeUInt32BE(8000, 16);
    expect(() => pngDimensions(bytes)).toThrow(/dimensions/);
  });
  it("withholds keys and private image instructions from public and independent payloads", () => {
    const { exam } = setup();
    expect(imagePrompt(exam.exam, "figure")).not.toContain('"solution":');
    expect(imagePrompt(exam.exam, "figure")).not.toContain('"answer":');
    expect(independentPrompt(exam.exam, undefined)).not.toContain(
      '"illustration":',
    );
    exam.imageExhibits = [
      {
        exhibitId: "figure",
        assetId: "image",
        description: "Given participant arrangement",
        width: 200,
        height: 100,
        reviewStatus: "consistent",
        ...{ privatePrompt: "SECRET" },
      },
    ];
    const published = JSON.stringify(publicExam(exam));
    for (const field of [
      '"answer":',
      '"solution":',
      '"illustration":',
      "SECRET",
      "Draw two participant",
    ])
      expect(published).not.toContain(field);
    expect(published).toContain("/images/image");
  });
  it("blocks seeded answer-bearing alt text and missing requested figures", () => {
    const { packet, blueprint, exam } = setup();
    exam.exam.exhibits![0].illustration!.description =
      "The correct answer is B; the experiment proves causation.";
    expect(
      checkExam(exam.exam, blueprint, undefined, "", packet).some(
        (i) => i.code === "ANSWER_LEAK",
      ),
    ).toBe(true);
    exam.exam.exhibits = [];
    expect(
      checkExam(exam.exam, blueprint, undefined, "", packet).some(
        (i) => i.code === "IMAGE_REQUIRED",
      ),
    ).toBe(true);
    const precise = setup();
    precise.blueprint.visuals = "precise";
    expect(
      checkExam(
        precise.exam.exam,
        precise.blueprint,
        undefined,
        "",
        precise.packet,
      ).some((i) => i.code === "VISUAL_MODE"),
    ).toBe(true);
  });
  it("caches unchanged figures, regenerates changed givens and never passes pixel geometry", async () => {
    const { exam } = setup(),
      jobId = id();
    let generations = 0,
      inspections = 0;
    const provider: ImageProvider = {
      async generate(request) {
        generations++;
        return fakeImages.generate(request);
      },
    };
    const inspect: Parameters<typeof prepareExamImages>[3] = async (
      _name,
      schema,
      _prompt,
      attachments,
    ) => {
      inspections++;
      expect(attachments).toHaveLength(1);
      return schema.parse(consistent);
    };
    const first = await prepareExamImages(
      exam.exam,
      jobId,
      provider,
      inspect,
      () => {},
    );
    await prepareExamImages(exam.exam, jobId, provider, inspect, () => {});
    expect(generations).toBe(1);
    expect(inspections).toBe(1);
    expect(
      imageVerification(exam.exam, first.images).map((v) => v.result),
    ).toEqual(["unsupported"]);
    exam.exam.questions[0].question += " Now use a third group.";
    await prepareExamImages(exam.exam, jobId, provider, inspect, () => {});
    expect(generations).toBe(2);
  });
  it.each(["disputed", "unverifiable", "consistent"] as const)(
    "blocks image review %s when issues are present",
    async (status) => {
      const { exam } = setup();
      const result = await prepareExamImages(
        exam.exam,
        id(),
        fakeImages,
        async (_name, schema) =>
          schema.parse({
            ...consistent,
            status,
            issues: ["A given label is wrong."],
          }),
        () => {},
      );
      expect(result.issues).toMatchObject([
        { code: "IMAGE_REVIEW", severity: "error", path: "exhibits.0" },
      ]);
    },
  );
  it("serves only image assets linked to the requested assessment", async () => {
    const { exam } = setup(),
      artifact = await fakeImages.generate({
        jobId: id(),
        exhibitId: "figure",
        prompt: "test",
        fingerprint: id(),
      });
    exam.imageExhibits = [
      {
        exhibitId: "figure",
        assetId: artifact.id,
        description: "Given arrangement",
        width: 200,
        height: 100,
        reviewStatus: "consistent",
      },
    ];
    put("exam", exam);
    const image = async (examId: string) =>
      GET(
        new NextRequest(
          `http://localhost/api/exams/${examId}/images/${artifact.id}`,
          { headers: { host: "localhost" } },
        ),
        {
          params: Promise.resolve({
            path: ["exams", examId, "images", artifact.id],
          }),
        },
      );
    expect((await image(exam.id)).headers.get("content-type")).toBe(
      "image/png",
    );
    expect((await image("another-exam")).status).toBe(404);
  });
  it.each([false, true])(
    "retains image repair artifacts and stops after two cycles (exhausted: %s)",
    async (exhausted) => {
      const { packet, blueprint, exam } = setup();
      put("packet", packet);
      const now = new Date().toISOString(),
        revision = put("revision", {
          id: id(),
          packetId: packet.id,
          blueprint,
          approved: true,
          createdAt: now,
        });
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
      let inspections = 0,
        repairs = 0;
      const provider: AssessmentProvider = {
        async structured(request) {
          let payload: unknown;
          if (request.name.startsWith("Generate questions"))
            payload = exam.exam;
          else if (request.name.startsWith("Inspect generated")) {
            inspections++;
            payload =
              inspections === 1 || exhausted
                ? {
                    ...consistent,
                    status: "disputed",
                    issues: ["Incorrect given label"],
                  }
                : consistent;
          } else if (request.name.startsWith("Targeted repair")) {
            repairs++;
            payload = {
              questions: [],
              exhibits: [
                {
                  ...exam.exam.exhibits![0],
                  illustration: {
                    ...exam.exam.exhibits![0].illustration,
                    prompt: `Correct the given label in the original figure, revision ${repairs}.`,
                  },
                },
              ],
            };
          } else if (request.name.startsWith("Solve independently")) {
            expect(request.attachments).toHaveLength(1);
            payload = {
              questions: exam.exam.questions.map((q) => ({
                number: q.number,
                answer: q.answer,
                reasoning: "Independent test reasoning",
              })),
            };
          } else
            payload = {
              questions: exam.exam.questions.map((q) => ({
                number: q.number,
                independentAnswer: q.answer,
                status: "consistent",
                issues: [],
              })),
            };
          return request.schema.parse(payload);
        },
      };
      await runJob(job, provider, undefined, fakeImages);
      const saved = get<CheckedExam>(
        "exam",
        get<Job>("job", job.id)!.resultId!,
      )!;
      expect(saved.ready).toBe(!exhausted);
      expect(repairs).toBe(exhausted ? 2 : 1);
      expect(
        saved.verification!.some(
          (v) =>
            v.method === "raster-image-geometry" && v.result === "unsupported",
        ),
      ).toBe(true);
      expect(
        list<PipelineArtifact>("artifact").filter(
          (a) => a.jobId === job.id && a.stage === "Repair diff",
        ),
      ).toHaveLength(repairs);
    },
  );
});

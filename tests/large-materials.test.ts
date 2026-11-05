import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "../app/api/[...path]/route";
import { ingest, LIMITS } from "../lib/ingestion";
import {
  analysisSections,
  visualAttachments,
  evidenceContext,
  ANALYSIS_SECTION,
} from "../lib/material-context";
import {
  generalDemoPacket,
  generalDemoBlueprint,
  generalDemoExam,
} from "../lib/general-demo";
import { get, id, list, put } from "../lib/store";
import { runJob } from "../lib/pipeline";
import { packetText } from "../lib/prompts";
import type { Job, Packet, PipelineArtifact, Revision } from "../lib/contracts";
import type { AssessmentProvider, ModelRequest } from "../lib/provider";

const pdf = vi.hoisted(() => ({ pages: 51, groups: [] as number[][] }));
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    async getInfo() {
      return { total: pdf.pages };
    }
    async getText() {
      return {
        text: "Readable course content. ".repeat(pdf.pages),
        pages: Array.from({ length: pdf.pages }, (_, i) => ({
          num: i + 1,
          text: `Page ${i + 1}: unique course material. `.repeat(5),
        })),
      };
    }
    async getScreenshot(options: { partial: number[] }) {
      pdf.groups.push(options.partial);
      return {
        pages: options.partial.map((pageNumber) => ({
          pageNumber,
          data: Buffer.from("rendered page"),
        })),
      };
    }
    async destroy() {}
  },
}));

beforeAll(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "vera-large-"));
  process.env.VERA_DATA_DIR = dir;
  process.env.VERA_BUDGET_DIR = dir;
});

function materials(count = 95): Packet {
  const packet = generalDemoPacket();
  packet.fixture = false;
  const original = packet.documents[0].pages[0];
  packet.documents[0].pages = Array.from({ length: count }, (_, i) => ({
    ...original,
    number: i + 1,
    text: i === 0 ? original.text : `Unique source page ${i + 1}. `,
    needsVision: i % 3 === 0,
    imagePath: `/source/page-${i + 1}.png`,
  }));
  return packet;
}
function analysisJob(packet: Packet) {
  put("packet", packet);
  const now = new Date().toISOString();
  return put<Job>("job", {
    id: id(),
    packetId: packet.id,
    kind: "analyze",
    status: "running",
    stage: "Preparing",
    createdAt: now,
    updatedAt: now,
  });
}

describe("large material packets", () => {
  it("accepts a 51-page PDF and renders no more than five pages at a time", async () => {
    pdf.pages = 51;
    pdf.groups = [];
    const document = await ingest(
      new File(["%PDF-1.7"], "lecture-notes.pdf"),
      "lecture-notes",
      id(),
    );
    expect(document.pages).toHaveLength(51);
    expect(document.pages.at(-1)?.number).toBe(51);
    expect(pdf.groups.flat()).toEqual(
      Array.from({ length: 51 }, (_, i) => i + 1),
    );
    expect(pdf.groups.every((group) => group.length <= 5)).toBe(true);
  });
  it("enforces the new page bound before rendering, with an accurate error", async () => {
    pdf.pages = LIMITS.pages + 1;
    pdf.groups = [];
    await expect(
      ingest(new File(["%PDF-1.7"], "large.pdf"), "textbook", id()),
    ).rejects.toThrow(/201 pages exceeds the 200-page/);
    expect(pdf.groups).toHaveLength(0);
  });
  it("accepts more than 40 pages through the actual upload route", async () => {
    pdf.pages = 51;
    const form = new FormData();
    form.set("name", "Long lecture notes");
    form.set("roles", JSON.stringify(["lecture-notes"]));
    form.append("files", new File(["%PDF-1.7"], "lecture-notes.pdf"));
    const response = await POST(
      new NextRequest("http://localhost:3000/api/packets", {
        method: "POST",
        headers: { host: "localhost:3000", "x-vera-local": "1" },
        body: form,
      }),
      { params: Promise.resolve({ path: ["packets"] }) },
    );
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(get<Packet>("packet", value.id)?.documents[0].pages).toHaveLength(
      51,
    );
  });
  it("bounds each section without losing original page IDs or source text", () => {
    const packet = materials(),
      sections = analysisSections(packet);
    const pages = sections.flatMap((section) =>
      section.documents.flatMap((d) => d.pages),
    );
    expect(pages).toEqual(packet.documents[0].pages);
    for (const section of sections) {
      const pages = section.documents.flatMap((d) => d.pages);
      expect(pages.length).toBeLessThanOrEqual(ANALYSIS_SECTION.pages);
      expect(visualAttachments(section).length).toBeLessThanOrEqual(
        ANALYSIS_SECTION.images,
      );
      expect(
        pages.reduce((n, p) => n + Buffer.byteLength(p.text), 0),
      ).toBeLessThanOrEqual(ANALYSIS_SECTION.textBytes);
    }
    const readable = {
      ...packet,
      documents: packet.documents.map((d) => ({
        ...d,
        pages: d.pages.map((p) => ({ ...p, needsVision: false })),
      })),
    };
    expect(visualAttachments(readable)).toHaveLength(0);
    expect(packetText(readable)).toContain('"visualAttached":false');
  });
  it("splits by UTF-8 bytes and omits duplicate, excluded and generated evidence", () => {
    const packet = materials(3);
    packet.documents[0].pages[0].text = "λ".repeat(30_000);
    packet.documents[0].pages[1].text = "λ".repeat(30_000);
    packet.documents[0].pages[2].text = "All rights reserved";
    packet.documents.push({
      ...packet.documents[0],
      id: "generated",
      role: "generated-reference",
    });
    const sections = analysisSections(packet);
    expect(sections).toHaveLength(2);
    expect(
      sections.flatMap((s) =>
        s.documents.flatMap((d) => d.pages.map((p) => p.number)),
      ),
    ).toEqual([1, 2]);
    packet.documents[0].pages[1].duplicateOf = `${packet.documents[0].id}:1`;
    expect(
      analysisSections(packet).flatMap((s) =>
        s.documents.flatMap((d) => d.pages),
      ),
    ).toHaveLength(1);
  });
  it("reads every eligible section before creating one unapproved plan", async () => {
    const packet = materials(),
      job = analysisJob(packet),
      calls: string[] = [];
    const provider: AssessmentProvider = {
      async structured<T>(request: ModelRequest<T>) {
        calls.push(request.name);
        if (request.name.startsWith("Read course evidence")) {
          const section = JSON.parse(
            request.prompt
              .split("UNTRUSTED_PACKET_JSON: ")[1]
              .split("\nAttached image order:")[0],
          );
          return request.schema.parse({
            subject: "Study methods",
            topics: [
              {
                topic: "Recall",
                summary: "Evidence summary",
                evidence: [
                  {
                    documentId: section[0].id,
                    page: section[0].pages[0].page,
                    description: "Course content",
                  },
                ],
              },
            ],
            assessmentFacts: [],
            uncertainties: [],
          });
        }
        return request.schema.parse(generalDemoBlueprint(packet));
      },
    };
    await runJob(job, provider);
    expect(
      calls.filter((name) => name.startsWith("Read course evidence")),
    ).toHaveLength(analysisSections(packet).length);
    expect(calls.at(-1)).toBe("Build exam plan from all material sections");
    const result = get<Revision>(
      "revision",
      get<Job>("job", job.id)!.resultId!,
    )!;
    expect(result.approved).toBe(false);
    const coverage = list<PipelineArtifact>("artifact").find(
      (a) => a.jobId === job.id && a.stage === "Course analysis coverage",
    );
    expect(coverage?.payload).toMatchObject({
      uploadedPages: 95,
      analyzedPages: 95,
    });
  });
  it("rejects section citations to unread pages without publishing a plan", async () => {
    const packet = materials(),
      job = analysisJob(packet);
    const provider: AssessmentProvider = {
      async structured<T>(request: ModelRequest<T>) {
        return request.schema.parse({
          subject: "Study",
          topics: [
            {
              topic: "Recall",
              summary: "Bad reference",
              evidence: [
                {
                  documentId: packet.documents[0].id,
                  page: 999,
                  description: "Unavailable",
                },
              ],
            },
          ],
          assessmentFacts: [],
          uncertainties: [],
        });
      },
    };
    await expect(runJob(job, provider)).rejects.toThrow(
      /invalid source reference/,
    );
    expect(get<Job>("job", job.id)?.resultId).toBeUndefined();
  });
  it("can cancel between section calls without publishing a partial plan", async () => {
    const packet = materials(),
      job = analysisJob(packet),
      controller = new AbortController();
    let calls = 0;
    const provider: AssessmentProvider = {
      async structured<T>(request: ModelRequest<T>) {
        calls++;
        controller.abort();
        return request.schema.parse({
          subject: "Study",
          topics: [],
          assessmentFacts: [],
          uncertainties: [],
        });
      },
    };
    await expect(runJob(job, provider, controller.signal)).rejects.toThrow();
    expect(calls).toBe(1);
    expect(get<Job>("job", job.id)?.resultId).toBeUndefined();
  });
  it("limits generation to approved pages while retaining full uploaded evidence", async () => {
    const packet = materials(95),
      blueprint = generalDemoBlueprint(packet);
    packet.documents[0].pages[94].text = "UNAPPROVED_PAGE_CANARY";
    expect(
      evidenceContext(
        packet,
        blueprint.slots.flatMap((s) => s.evidence),
      ).documents[0].pages.map((p) => p.number),
    ).toEqual([1]);
    put("packet", packet);
    const now = new Date().toISOString();
    const revision = put<Revision>("revision", {
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
      stage: "Preparing",
      createdAt: now,
      updatedAt: now,
    });
    const exam = generalDemoExam(packet, blueprint, revision.id).exam;
    let prompt = "";
    const provider: AssessmentProvider = {
      async structured<T>(request: ModelRequest<T>) {
        if (request.name === "Generate questions and exhibits") {
          prompt = request.prompt;
          return request.schema.parse(exam);
        }
        if (request.name.startsWith("Solve independently"))
          return request.schema.parse({
            questions: exam.questions.map((q) => ({
              number: q.number,
              answer: q.answer,
              reasoning: "Separate solution",
            })),
          });
        return request.schema.parse({
          questions: exam.questions.map((q) => ({
            number: q.number,
            independentAnswer: q.answer,
            status: "consistent",
            issues: [],
          })),
        });
      },
    };
    await runJob(job, provider);
    expect(prompt).not.toContain("UNAPPROVED_PAGE_CANARY");
    expect(get<Packet>("packet", packet.id)?.documents[0].pages).toHaveLength(
      95,
    );
  });
});

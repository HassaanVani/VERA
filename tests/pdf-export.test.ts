import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/[...path]/route";
import { assessmentPaper, paperText } from "../lib/paper";
import { exportPdf, pdfFilename } from "../lib/pdf-export";
import {
  generalDemoPacket,
  generalDemoBlueprint,
  generalDemoExam,
} from "../lib/general-demo";
import { vectorPacket, vectorBlueprint, vectorExam } from "../lib/vector-demo";
import { beginAttempt, updateAttempt } from "../lib/service";
import { put, id } from "../lib/store";
import { encodeVectorResponse } from "../lib/vector-response";
import { demoPacket, demoBlueprint, savedDemo } from "../lib/demo";

beforeAll(() => {
  const root = mkdtempSync(path.join(tmpdir(), "vera-pdf-"));
  process.env.VERA_DATA_DIR = root;
  process.env.VERA_BUDGET_DIR = root;
});
function setup() {
  const packet = generalDemoPacket(),
    blueprint = generalDemoBlueprint(packet);
  const exam = generalDemoExam(packet, blueprint, id());
  return { packet, exam };
}
describe("readable PDF export and solution boundary", () => {
  it("preserves legacy calibration, measurement and diagram givens without releasing eigenpair keys", () => {
    const packet = demoPacket(),
      exam = savedDemo(packet, id(), demoBlueprint(packet));
    exam.scenario!.eigenpairs = [{ value: 338899, vector: [119933, 779911] }];
    const html = assessmentPaper(exam, packet, {}, "");
    for (const text of [
      "Calibration sheet",
      "Vector measurements",
      "Given transformation diagram",
      "Transformed output",
      "Basis probe u",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("338899");
    expect(html).not.toContain("119933");
  });
  it("recovers the renderer lock after a missing-browser failure", async () => {
    const { packet, exam } = setup(),
      previous = process.env.VERA_PDF_BROWSER;
    process.env.VERA_PDF_BROWSER = path.join(
      tmpdir(),
      "vera-missing-browser",
      "chrome.exe",
    );
    try {
      await expect(exportPdf(exam, packet)).rejects.toThrow(
        "configured PDF browser",
      );
      await expect(exportPdf(exam, packet)).rejects.toThrow(
        "configured PDF browser",
      );
    } finally {
      if (previous === undefined) delete process.env.VERA_PDF_BROWSER;
      else process.env.VERA_PDF_BROWSER = previous;
    }
  });
  it("never serializes private keys, solutions, rubrics, claims or review artifacts in a paper", () => {
    const { packet, exam } = setup();
    for (const q of exam.exam.questions) {
      q.answer = "PRIVATE_KEY_CANARY";
      q.evidence![0].description = "PRIVATE_EVIDENCE_CANARY";
      q.solution = "PRIVATE_SOLUTION_CANARY";
      q.rubric = [{ criterion: "PRIVATE_RUBRIC_CANARY", points: q.points }];
    }
    exam.review.questions = [
      {
        number: 1,
        independentAnswer: "PRIVATE_REVIEW_CANARY",
        status: "consistent",
        issues: [],
      },
    ];
    exam.verification![0].artifact = "PRIVATE_ARTIFACT_CANARY";
    const html = assessmentPaper(exam, packet, {}, "");
    expect(html).not.toContain("CANARY");
    expect(html).toContain("NO SOLUTIONS");
    expect(html).toContain("Authored saved example");
    expect(html).toContain(packet.documents[0].name);
    expect(html).toContain("not whole-exam verification");
  });
  it("refuses unsubmitted and mismatched attempt reviews at the document boundary", () => {
    const { packet, exam } = setup();
    const attempt = {
      id: id(),
      examId: exam.id,
      startedAt: 1,
      endsAt: 999,
      responses: {},
      selfScores: {},
    };
    expect(() => assessmentPaper(exam, packet, {}, "", attempt)).toThrow(
      "Submit",
    );
    expect(() =>
      assessmentPaper(exam, packet, {}, "", {
        ...attempt,
        submittedAt: 9,
        examId: "other",
      }),
    ).toThrow("Submit");
  });
  it("keeps the review endpoint closed before server-confirmed submission", async () => {
    const { packet, exam } = setup();
    put("packet", packet);
    put("exam", exam);
    const attempt = beginAttempt(exam.id, "untimed");
    const route = ["attempts", attempt.id, "pdf"];
    const blocked = await GET(
      new NextRequest(`http://127.0.0.1:3001/api/${route.join("/")}`, {
        headers: { host: "127.0.0.1:3001" },
      }),
      { params: Promise.resolve({ path: route }) },
    );
    expect(blocked.status).toBe(403);
    expect(await blocked.text()).not.toContain(exam.exam.questions[0].solution);
    const submitted = updateAttempt(attempt.id, {
      responses: { "1": "A", "3": "My saved answer" },
      submit: true,
    });
    const html = assessmentPaper(exam, packet, {}, "", submitted);
    expect(html).toContain("CONTAINS SOLUTIONS");
    expect(html).toContain("My saved answer");
    expect(html).toContain("Needs review");
    expect(html).toContain(exam.exam.questions[0].solution);
  });
  it("escapes hostile document text while rendering math without trusted commands", () => {
    const { packet, exam } = setup();
    exam.exam.questions[0].question =
      '<img src="https://attacker.test/x"> $x^2 + 1$';
    packet.name = "<script>alert(1)</script>";
    const html = assessmentPaper(exam, packet, {}, "");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<img src="https:');
    expect(html).toContain('class="katex"');
    expect(html).toContain("default-src 'none'");
    expect(paperText("$\\href{javascript:alert(1)}{x}$")).not.toContain(
      'href="javascript:',
    );
  });
  it("preserves readable submitted vector coordinates and the actual response grid", () => {
    const packet = vectorPacket(),
      exam = vectorExam(packet, vectorBlueprint(packet), id());
    const response = encodeVectorResponse({
      version: 1,
      kind: "vector-drawing",
      vectors: [{ from: [0, 0], to: [1.25, 2] }],
      reasoning: "My construction",
    });
    const html = assessmentPaper(exam, packet, {}, "", {
      id: id(),
      examId: exam.id,
      startedAt: 1,
      endsAt: 9,
      submittedAt: 10,
      responses: { "1": response },
      selfScores: {},
    });
    expect(html).toContain("My construction");
    expect(html).toContain("1.25, 2");
    expect(html).toContain("Your saved vectors are blue");
    expect(html).not.toContain("VERA_VECTOR_V1:");
  });
  it("prints circle and path givens with exact data in vector and reference sheets", () => {
    const packet = vectorPacket(),
      exam = vectorExam(packet, vectorBlueprint(packet), id());
    const ex = exam.exam.exhibits![0];
    ex.drawing!.circles = [
      { center: ex.points[0].label, radius: 0.5, label: "Calibration circle" },
    ];
    ex.drawing!.paths = [
      {
        points: ex.points.slice(0, 2).map((p) => p.label),
        closed: false,
        label: "Survey path",
      },
      {
        points: ex.points.slice(0, 2).map((p) => p.label),
        closed: true,
        label: "Given polygon",
      },
    ];
    let html = assessmentPaper(exam, packet, {}, "");
    for (const token of [
      "<polyline",
      "<polygon",
      "radius 0.5",
      "Calibration circle",
      "Survey path",
      "Given polygon",
    ])
      expect(html).toContain(token);
    exam.exam.questions[0].responseDiagram = undefined;
    html = assessmentPaper(exam, packet, {}, "");
    expect(html).toContain("Calibration circle");
    expect(html).toContain("Survey path");
  });
  it("cannot silently omit a missing image, and produces a safe download name", () => {
    const { packet, exam } = setup();
    exam.exam.exhibits!.push({
      id: "missing-image",
      kind: "image",
      title: "Required image",
      content: "",
      columns: [],
      rows: [],
      points: [],
      synthetic: true,
    });
    exam.exam.questions[0].exhibitIds.push("missing-image");
    expect(() => assessmentPaper(exam, packet, {}, "")).toThrow("unavailable");
    expect(pdfFilename('../Bad\r\n"title"')).toBe("VERA-Badtitle.pdf");
  });
});

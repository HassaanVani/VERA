import { mkdtempSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { beforeAll, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/[...path]/route";
import { id, put, get, usageDb } from "../lib/store";
import {
  generalDemoPacket,
  generalDemoBlueprint,
  generalDemoExam,
} from "../lib/general-demo";
import { runEvidence, examProvenance } from "../lib/run-evidence";
import type { CheckedExam, Job, PipelineArtifact } from "../lib/contracts";
beforeAll(() => {
  const root = mkdtempSync(path.join(tmpdir(), "vera-run-evidence-"));
  process.env.VERA_DATA_DIR = root;
  process.env.VERA_BUDGET_DIR = root;
});
it("separates curation, predecessor failures, costs and provisional review without leaking artifacts", async () => {
  const packet = put("packet", generalDemoPacket()),
    blueprint = generalDemoBlueprint(packet);
  const parent = generalDemoExam(packet, blueprint, id());
  parent.fixture = false;
  parent.ready = false;
  parent.repairAttempts = 2;
  put("exam", parent);
  const exam = structuredClone(parent);
  exam.id = id();
  exam.ready = true;
  exam.exam.questions[0].answer = "PRIVATE_KEY_CANARY";
  exam.review.questions = [
    {
      number: 1,
      status: "consistent",
      independentAnswer: "PRIVATE_SOLVE_CANARY",
      issues: [],
    },
  ];
  put("exam", exam);
  const earlier = put<Job>("job", {
    id: id(),
    packetId: packet.id,
    kind: "generate",
    resultId: parent.id,
    status: "complete",
    stage: "blocked",
    createdAt: "2026-11-01T01:00:00Z",
    updatedAt: "2026-11-01T01:01:00Z",
  });
  const current = put<Job>("job", {
    ...earlier,
    id: id(),
    resultId: exam.id,
    createdAt: "2026-11-01T02:00:00Z",
  });
  put<PipelineArtifact>("artifact", {
    id: id(),
    jobId: current.id,
    stage: "Assistant curation diff",
    cycle: 0,
    payload: {
      parentExamId: parent.id,
      before: "PRIVATE_DIFF_CANARY",
      after: "PRIVATE_ANSWER_CANARY",
    },
    createdAt: "now",
  });
  for (const cycle of [0, 1])
    put<PipelineArtifact>("artifact", {
      id: id(),
      jobId: earlier.id,
      stage: "Repair diff",
      cycle,
      payload: "PRIVATE_REPAIR_CANARY",
      createdAt: "now",
    });
  usageDb()
    .prepare(
      "INSERT INTO usage(id,job_id,model,stage,reserved,cost,status,created) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      id(),
      earlier.id,
      "muse-image-test",
      "test",
      0.5,
      null,
      "uncertain",
      "now",
    );
  usageDb()
    .prepare(
      "INSERT INTO usage(id,job_id,model,stage,reserved,cost,status,created) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      id(),
      current.id,
      "muse-spark-test",
      "test",
      0.5,
      0.02,
      "settled",
      "now",
    );
  const evidence = runEvidence(exam);
  expect(evidence.provenance).toEqual({
    kind: "reviewed-copy",
    parentExamId: parent.id,
  });
  expect(evidence.executions[0]).toMatchObject({
    ready: false,
    heldUsd: 0.5,
    uncertainAttempts: 1,
    repairCycles: 2,
  });
  expect(evidence.executions[1]).toMatchObject({
    current: true,
    settledUsd: 0.02,
    heldUsd: 0,
    repairCycles: 0,
  });
  expect(evidence.questions[0].modelReview).toBe("consistent");
  expect(JSON.stringify(evidence)).not.toContain("CANARY");
  const r = await GET(
    new NextRequest(`http://127.0.0.1:3001/api/exams/${exam.id}/evidence`, {
      headers: { host: "127.0.0.1:3001" },
    }),
    { params: Promise.resolve({ path: ["exams", exam.id, "evidence"] }) },
  );
  expect(r.status).toBe(200);
  expect(await r.text()).not.toContain("CANARY");
  expect(get<CheckedExam>("exam", exam.id)!.repairAttempts).toBe(2);
  expect(get<CheckedExam>("exam", exam.id)!.provenance).toBeUndefined();
});
it("does not infer zero cost, model execution or curation when evidence is missing", () => {
  const packet = put("packet", generalDemoPacket()),
    exam = generalDemoExam(packet, generalDemoBlueprint(packet), id());
  exam.fixture = false;
  put<Job>("job", {
    id: id(),
    packetId: packet.id,
    kind: "generate",
    resultId: exam.id,
    status: "complete",
    stage: "old",
    createdAt: "now",
    updatedAt: "now",
  });
  expect(examProvenance(exam)).toBeUndefined();
  const run = runEvidence(exam).executions[0];
  expect(run.source).toBe("usage-unavailable");
  expect(run.settledUsd).toBeNull();
  expect(run.repairCycles).toBeNull();
});

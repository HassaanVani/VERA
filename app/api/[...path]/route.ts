import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { z } from "zod";
import { Role } from "@/lib/contracts";
import type {
  Packet,
  Revision,
  Job,
  CheckedExam,
  Attempt,
  FeedbackRecord,
} from "@/lib/contracts";
import {
  get,
  put,
  id,
  list,
  usageSummary,
  workerOnline,
  transaction,
} from "@/lib/store";
import { deduplicate, ingest, LIMITS } from "@/lib/ingestion";
import { demoPacket } from "@/lib/demo";
import {
  beginAttempt,
  followUp,
  queue,
  saveRevision,
  updateAttempt,
} from "@/lib/service";
import { modelConfig } from "@/lib/provider";
import { generalDemoPacket } from "@/lib/general-demo";
import { publicExam } from "@/lib/assessment-access";
import { orderedRevisions } from "@/lib/revisions";
import { persistFeedback } from "@/lib/feedback";
import { visibleCourses } from "@/lib/course-archive";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard(req: NextRequest, write = false) {
  const host = req.headers.get("host")?.split(":")[0];
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error("VERA is a local application. Use localhost or 127.0.0.1.");
  if (
    write &&
    (req.headers.get("x-vera-local") !== "1" ||
      (req.headers.get("origin") &&
        new URL(req.headers.get("origin")!).host !== req.headers.get("host")))
  )
    throw new Error("Local request validation failed. Reload VERA.");
}
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    guard(req);
    const { path } = await ctx.params;
    if (path[0] === "workspace") {
      const packets = visibleCourses();
      const packetIds = new Set(packets.map((p) => p.id));
      const exams = list<CheckedExam>("exam").filter((e) =>
        packetIds.has(e.packetId),
      );
      const examIds = new Set(exams.map((e) => e.id));
      return json({
        packets: packets.map((p) => ({
          ...p,
          documents: p.documents.map((d) => ({
            ...d,
            filePath: "",
            pages: d.pages.map((p) => ({
              ...p,
              imagePath: p.imagePath ? "available" : undefined,
            })),
          })),
        })),
        revisions: orderedRevisions(
          list<Revision>("revision").filter((r) => packetIds.has(r.packetId)),
        ),
        jobs: list<Job>("job")
          .filter((j) => packetIds.has(j.packetId))
          .map((j) => ({
            ...j,
            error: j.error
              ? "This operation failed. Retry after checking configuration and the source packet; the private diagnostic is retained locally."
              : undefined,
          })),
        exams: exams.map(publicExam),
        attempts: list<Attempt>("attempt").filter((a) => examIds.has(a.examId)),
        usage: (() => {
          const summary = usageSummary();
          return {
            ...summary,
            recent: summary.recent.map((r) => ({
              id: r.id,
              job_id: r.job_id,
              stage: r.stage,
              model: r.model,
              bucket: r.bucket,
              reserved: r.reserved,
              cost: r.cost,
              status: r.status,
              input_tokens: r.input_tokens,
              output_tokens: r.output_tokens,
              latency_ms: r.latency_ms,
              created: r.created,
            })),
          };
        })(),
        meta: {
          testWorkspace:
            process.env.VERA_TEST_WORKSPACE === "1" &&
            !process.env.MODEL_API_KEY &&
            nodePath.resolve(
              /* turbopackIgnore: true */ process.env.VERA_DATA_DIR || ".vera",
            ) !== nodePath.resolve(".vera"),
          configured: !!process.env.MODEL_API_KEY,
          model: modelConfig().model,
          workerOnline: workerOnline(),
          capabilityTested: !!get("probe", modelConfig().model),
        },
      });
    }
    if (path[0] === "attempts" && path[2] === "solutions") {
      const attempt = get<Attempt>("attempt", path[1]);
      if (!attempt?.submittedAt)
        return json(
          { error: "Submit this attempt before opening solutions." },
          403,
        );
      const exam = get<CheckedExam>("exam", attempt.examId);
      if (!exam) return json({ error: "Assessment not found." }, 404);
      const packet = get<Packet>("packet", exam.packetId)!;
      return json({
        exam,
        feedback: persistFeedback(exam, attempt, packet),
        suggestions: list<FeedbackRecord>("feedback").filter(
          (f) => f.attemptId === attempt.id && f.basis === "ai-suggestion",
        ),
      });
    }
    if (path[0] === "source") {
      const packet = get<Packet>(
        "packet",
        req.nextUrl.searchParams.get("packet") || "",
      );
      const doc = packet?.documents.find((d) => d.id === path[1]);
      const page = doc?.pages.find(
        (p) => p.number === Number(req.nextUrl.searchParams.get("page") || 1),
      );
      if (!doc || !page) return json({ error: "Source page not found." }, 404);
      if (page.imagePath)
        return new Response(await readFile(page.imagePath), {
          headers: {
            "Content-Type":
              doc.mime === "image/jpeg" ? "image/jpeg" : "image/png",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      return new Response(page.text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Request failed." },
      400,
    );
  }
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    guard(req, true);
    const { path } = await ctx.params;
    if (path[0] === "packets" && !path[1]) {
      const length = Number(req.headers.get("content-length") || 0);
      if (length > LIMITS.packetBytes + 1_000_000)
        throw new Error("Packet exceeds 30 MB.");
      const form = await req.formData(),
        files = form
          .getAll("files")
          .filter((f): f is File => f instanceof File);
      if (
        !files.length ||
        files.length > LIMITS.files ||
        files.reduce((n, f) => n + f.size, 0) > LIMITS.packetBytes
      )
        throw new Error("Upload 1–8 files, at most 30 MB per packet.");
      const roles = z
        .array(Role)
        .parse(JSON.parse(String(form.get("roles") || "[]")));
      if (roles.length !== files.length)
        throw new Error("Assign a role to every file.");
      const packetId = id(),
        documents = [];
      for (const [i, f] of files.entries())
        documents.push(await ingest(f, roles[i], packetId));
      if (documents.reduce((n, d) => n + d.pages.length, 0) > LIMITS.pages)
        throw new Error("Packet exceeds 40 pages; select focused excerpts.");
      if (
        documents.reduce(
          (n, d) => n + d.pages.reduce((m, p) => m + p.text.length, 0),
          0,
        ) > LIMITS.textChars
      )
        throw new Error(
          "Packet text exceeds the extraction limit. Use focused excerpts.",
        );
      const packet = put<Packet>("packet", {
        id: packetId,
        name: String(form.get("name") || "Untitled course packet").slice(
          0,
          160,
        ),
        createdAt: new Date().toISOString(),
        fixture: false,
        documents: deduplicate(documents),
      });
      return json({ id: packet.id });
    }
    if (path[0] === "demo") {
      const input = await req.json();
      const packet = put(
        "packet",
        input.kind === "general" ? generalDemoPacket() : demoPacket(),
      );
      return json({ packetId: packet.id, job: queue("analyze", packet.id) });
    }
    if (Number(req.headers.get("content-length") || 0) > 250_000)
      throw new Error("Request too large.");
    const body = await req.json();
    if (path[0] === "packets" && path[2] === "roles")
      return json(
        transaction(() => {
          const packet = get<Packet>("packet", path[1]);
          if (!packet) throw new Error("Course packet not found.");
          if (
            list<Job>("job").some(
              (j) =>
                j.packetId === packet.id &&
                ["queued", "running"].includes(j.status),
            )
          )
            throw new Error(
              "Cancel the active operation before changing document roles.",
            );
          const input = z
            .object({ documentId: z.string(), role: Role })
            .parse(body);
          if (!packet.documents.some((d) => d.id === input.documentId))
            throw new Error("Document not found.");
          put("packet", {
            ...packet,
            documents: packet.documents.map((d) =>
              d.id === input.documentId ? { ...d, role: input.role } : d,
            ),
          });
          for (const revision of list<Revision>("revision").filter(
            (r) => r.packetId === packet.id && r.approved,
          ))
            put("revision", { ...revision, approved: false });
          return { packetId: packet.id, approvalInvalidated: true };
        }),
      );
    if (path[0] === "jobs") {
      if (path[1])
        return json(
          transaction(() => {
            const job = get<Job>("job", path[1]);
            if (!job || !["queued", "running"].includes(job.status))
              throw new Error("This job is no longer active.");
            return put("job", {
              ...job,
              status: "cancelled",
              stage: "Cancelled",
              updatedAt: new Date().toISOString(),
            });
          }),
        );
      const input = z
        .object({
          kind: z.enum(["analyze", "generate", "follow-up"]),
          packetId: z.string(),
          revisionId: z.string().optional(),
          parentExamId: z.string().optional(),
          focus: z.array(z.string()).optional(),
        })
        .parse(body);
      if (
        !process.env.MODEL_API_KEY &&
        !get<Packet>("packet", input.packetId)?.fixture
      )
        throw new Error(
          "Add MODEL_API_KEY to .env.local and restart VERA for live generation.",
        );
      return json(
        queue(
          input.kind,
          input.packetId,
          input.revisionId,
          input.parentExamId,
          input.focus,
        ),
      );
    }
    if (path[0] === "revisions")
      return json(saveRevision(path[1], body.blueprint, body.approve === true));
    if (path[0] === "feedback" && path[1]) {
      return json(
        transaction(() => {
          const record = get<FeedbackRecord>("feedback", path[1]);
          if (
            !record ||
            !get<Attempt>("attempt", record.attemptId)?.submittedAt
          )
            throw new Error("Feedback not available.");
          const reason = z.string().trim().min(3).max(2000).parse(body.reason);
          return put("feedback", {
            ...record,
            disputes: [
              ...record.disputes,
              { id: id(), reason, createdAt: new Date().toISOString() },
            ],
          });
        }),
      );
    }
    if (path[0] === "attempts" && path[2] === "feedback") {
      const attempt = get<Attempt>("attempt", path[1]);
      if (!attempt?.submittedAt) throw new Error("Submit your attempt first.");
      const exam = get<CheckedExam>("exam", attempt.examId)!;
      if (
        list<Job>("job").some(
          (j) =>
            j.attemptId === attempt.id &&
            ["running", "queued"].includes(j.status),
        )
      )
        throw new Error("Feedback is already being prepared.");
      const now = new Date().toISOString();
      return json(
        put<Job>("job", {
          id: id(),
          packetId: exam.packetId,
          attemptId: attempt.id,
          kind: "feedback",
          status: "queued",
          stage: "Waiting for local worker",
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    if (path[0] === "attempts")
      return json(
        path[1]
          ? updateAttempt(path[1], body)
          : beginAttempt(
              z.string().parse(body.examId),
              z.enum(["timed", "untimed"]).default("timed").parse(body.mode),
            ),
      );
    if (path[0] === "follow-up")
      return json(followUp(z.string().parse(body.examId)));
    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json(
      {
        error:
          e instanceof z.ZodError
            ? e.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : e instanceof Error
              ? e.message
              : "Request failed.",
      },
      400,
    );
  }
}

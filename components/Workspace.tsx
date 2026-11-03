"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  FileText,
  Layers3,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Target,
  UploadCloud,
  X,
  Zap,
  CircleAlert,
} from "lucide-react";

import type { Packet, Revision, Job, Attempt, Role } from "@/lib/contracts";

import type { PublicCheckedExam } from "@/lib/assessment-access";
import Review from "./Review";
import usePlanDraft from "./usePlanDraft";
import Dialog from "./Dialog";
import CourseJourney from "./CourseJourney";
import GenerationProgress from "./GenerationProgress";
import ExamPlanEditor from "./ExamPlanEditor";

import CourseLibrary from "./CourseLibrary";
import Brand from "./Brand";
import CourseMaterials from "./CourseMaterials";

import Exhibits from "./Exhibits";

import MathText from "./MathText";

import Practice from "./Practice";

type View =
  | "overview"
  | "packet"
  | "blueprint"
  | "exam"
  | "practice"
  | "results"
  | "activity";

type WorkspaceData = {
  packets: Packet[];

  revisions: Revision[];

  jobs: Job[];

  exams: PublicCheckedExam[];

  attempts: Attempt[];

  meta: {
    configured: boolean;

    model: string;

    workerOnline: boolean;

    capabilityTested: boolean;
  };

  usage: {
    buckets: {
      bucket: string;

      calls: number;

      spent: number;

      uncertain: number;
    }[];

    recent: {
      id: string;

      stage: string;

      model: string;

      cost: number | null;

      reserved: number;

      status: string;

      latency_ms: number;
    }[];

    reserve: number;

    limit: number;
  };
};

const roles: Role[] = [
  "lecture-notes",

  "past-exam",

  "assignment",

  "syllabus",

  "review-sheet",

  "solutions",

  "textbook",

  "generated-reference",
];

const roleName = (r: string) =>
  ({
    "past-exam": "Past exam",

    "lecture-notes": "Lecture notes",

    assignment: "Assignment",

    syllabus: "Syllabus",

    "review-sheet": "Review sheet",

    solutions: "Solutions",

    textbook: "Textbook",

    "generated-reference": "AI-generated reference",
  })[r] || r;

async function request(route: string, body?: unknown) {
  const response = await fetch(
    `/api/${route}`,

    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",

          headers: {
            "x-vera-local": "1",

            ...(body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" }),
          },

          body: body instanceof FormData ? body : JSON.stringify(body),
        },
  );

  const result = await response.json();

  if (!response.ok) throw new Error(result.error || "Request failed.");

  return result;
}

function Empty({
  title,

  children,
}: {
  title: string;

  children: React.ReactNode;
}) {
  return (
    <div className="panel empty">
      <Layers3 size={32} />

      <h3>{title}</h3>

      <div className="empty-body">{children}</div>
    </div>
  );
}

export default function Workspace() {
  const [data, setData] = useState<WorkspaceData>(),
    [view, setView] = useState<View>("overview"),
    [packetId, setPacketId] = useState(""),
    [examId, setExamId] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(true),
    [clock, setClock] = useState(() => Date.now()),
    [error, setError] = useState(""),
    [uploadOpen, setUploadOpen] = useState(false),
    [source, setSource] = useState<{
      url: string;
      name: string;
      documentId: string;
      page: number;
    }>(),
    [startOpen, setStartOpen] = useState(false),
    [uploadReview, setUploadReview] = useState(false),
    [practiceMode, setPracticeMode] = useState<"timed" | "untimed">("timed");

  const [generationRequest, setGenerationRequest] = useState<{
    id: string;
    packetId: string;
  }>();

  const [files, setFiles] = useState<{ file: File; role: Role | "" }[]>([]),
    [packetName, setPacketName] = useState("");

  const watching = useRef<string>(""),
    input = useRef<HTMLInputElement>(null);

  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    const restore = () => {
      const q = new URLSearchParams(window.location.search);

      const v = q.get("view");

      setView(
        v &&
          [
            "overview",

            "packet",

            "blueprint",

            "exam",

            "practice",

            "results",

            "activity",
          ].includes(v)
          ? (v as View)
          : "overview",
      );

      setPacketId(q.get("course") || "");

      setExamId(q.get("exam") || "");

      setNavigationReady(true);
    };

    restore();

    window.addEventListener("popstate", restore);

    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!navigationReady) return;

    const q = new URLSearchParams();

    if (view !== "overview") q.set("view", view);

    if (packetId) q.set("course", packetId);

    if (examId) q.set("exam", examId);

    window.history.replaceState(
      null,

      "",

      q.size ? `?${q}` : window.location.pathname,
    );
  }, [view, packetId, examId, navigationReady]);

  const refresh = useCallback(async () => {
    const d = (await request("workspace")) as WorkspaceData;

    setData(d);
    setConnected(true);
    setClock(Date.now());
    return d;
  }, []);

  useEffect(() => {
    let alive = true;

    const load = () => {
      void refresh().catch(() => {
        if (alive) setConnected(false);
      });
    };

    load();

    const t = setInterval(load, 1800);

    return () => {
      alive = false;

      clearInterval(t);
    };
  }, [refresh]);

  const packet = packetId
    ? data?.packets.find((p) => p.id === packetId)
    : data?.packets[0];

  const revision = data?.revisions.find((r) => r.packetId === packet?.id);

  const exam =
    data?.exams.find((e) => e.id === examId && e.packetId === packet?.id) ||
    data?.exams.find((e) => e.packetId === packet?.id);

  const attempt = data?.attempts.find((a) => a.examId === exam?.id);

  const active = data?.jobs.find(
    (j) =>
      j.packetId === packet?.id && ["running", "queued"].includes(j.status),
  );

  const requestedGeneration = data?.jobs.find(
    (j) => j.id === generationRequest?.id,
  );
  const pendingGeneration =
    generationRequest?.packetId === packet?.id &&
    !!generationRequest &&
    (!requestedGeneration ||
      ["queued", "running"].includes(requestedGeneration.status));

  const recentJob = data?.jobs.find((j) => j.packetId === packet?.id);

  const {
    draft,
    notice: planNotice,
    edit,
    reset: resetPlan,
  } = usePlanDraft(revision);

  useEffect(() => {
    const j = data?.jobs.find((j) => j.id === watching.current);

    if (j?.status === "complete") {
      watching.current = "";

      if (j.kind === "feedback") return;
      if (j.kind === "analyze")
        setView((current) => (current === "blueprint" ? "blueprint" : current));
      else {
        setExamId(j.resultId || "");

        setView((current) => (current === "exam" ? "exam" : current));
      }
    }

    if (j && ["failed", "interrupted"].includes(j.status)) {
      watching.current = "";

      setError(j.error || "Job failed. Retry when ready.");
    }
  }, [data]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);

    setError("");

    try {
      await fn();

      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const goto = (v: View) => {
    const q = new URLSearchParams(window.location.search);

    q.set("view", v);

    window.history.pushState(null, "", `?${q}`);

    setView(v);
  };

  const demo = (kind = "general") =>
    act(async () => {
      const r = await request("demo", { kind });

      setPacketId(r.packetId);

      watching.current = r.job.id;

      setView("blueprint");
    });

  const analyze = () =>
    act(async () => {
      if (!packet) return;

      const j = await request("jobs", { kind: "analyze", packetId: packet.id });

      watching.current = j.id;

      setView("blueprint");
    });

  const generate = () =>
    act(async () => {
      if (!packet || !revision) return;

      const j = await request("jobs", {
        kind: revision.parentExamId ? "follow-up" : "generate",
        parentExamId: revision.parentExamId,
        focus: revision.parentExamId
          ? revision.blueprint.slots.map((s) => s.objective || s.topic)
          : undefined,

        packetId: packet.id,

        revisionId: revision.id,
      });

      watching.current = j.id;
      setGenerationRequest({ id: j.id, packetId: packet.id });
      setExamId("");

      setView("exam");
    });

  const practice = () =>
    act(async () => {
      if (!exam) return;

      if (attempt?.submittedAt) {
        setView("results");

        return;
      }

      if (!attempt && !startOpen) {
        setStartOpen(true);
        return;
      }
      await request("attempts", { examId: exam.id, mode: practiceMode });
      setStartOpen(false);

      setView("practice");
    });

  const openSource = (documentId: string, page: number) => {
    if (!packet) return;

    const doc = packet.documents.find((d) => d.id === documentId);

    setSource({
      name: `${doc?.name || "Source"} · page ${page}`,
      documentId,
      page,

      url: `/api/source/${documentId}?packet=${packet.id}&page=${page}`,
    });
  };

  const savePlan = (approve: boolean) =>
    void act(async () => {
      if (!revision || !draft) return;
      await request(`revisions/${revision.id}`, { blueprint: draft, approve });
      try {
        localStorage.removeItem(`vera:plan:${revision.id}`);
      } catch {}
    });

  const dirty =
    draft &&
    revision &&
    JSON.stringify(draft) !== JSON.stringify(revision.blueprint);

  const spent = data?.usage.buckets.reduce((n, b) => n + b.spent, 0) || 0;

  useEffect(() => {
    if (navigationReady) {
      const title = {
        overview: "Library",
        packet: "Materials",
        blueprint: "Exam plan",
        exam: "Practice exam",
        results: "Review",
        activity: "Settings & activity",
        practice: "Practice session",
      }[view];
      document.title = `${title} · VERA`;
      window.scrollTo(0, 0);

      document.getElementById("main")?.focus({ preventScroll: true });
    }
  }, [view, navigationReady]);

  function openUpload() {
    setError("");

    setUploadReview(false);
    setUploadOpen(true);
  }

  function chooseFiles(selection: FileList | null) {
    if (!selection) return;

    const incoming = Array.from(selection).filter(
      (file) =>
        !files.some(
          (f) =>
            f.file.name === file.name &&
            f.file.size === file.size &&
            f.file.lastModified === file.lastModified,
        ),
    );

    if (files.length + incoming.length > 8) {
      setError("Choose up to 8 files. Remove a file before adding more.");

      return;
    }

    const invalid = incoming.find(
      (file) =>
        !file.size ||
        file.size > 10 * 1024 * 1024 ||
        !/\.(pdf|png|jpe?g)$/i.test(file.name),
    );

    if (invalid) {
      setError(
        `${invalid.name} couldn’t be added. Choose a PDF, PNG, or JPEG under 10 MB.`,
      );

      return;
    }

    if (
      [...files.map((f) => f.file), ...incoming].reduce(
        (n, file) => n + file.size,

        0,
      ) >
      30 * 1024 * 1024
    ) {
      setError(
        "These files exceed 30 MB. Choose fewer files or smaller excerpts.",
      );

      return;
    }

    setError("");

    setUploadReview(false);
    setFiles([
      ...files,

      ...incoming.map((file) => ({ file, role: "" as const })),
    ]);

    if (input.current) input.current.value = "";
  }

  return (
    <div className={`app-shell view-${view}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <div className="main-shell">
        <header className="topbar">
          <button
            className="brand-home"
            aria-label="Library"
            onClick={() => goto("overview")}
          >
            <Brand />
          </button>
          <button
            className="workspace-settings"
            aria-label="Generation settings and activity"
            onClick={() => goto("activity")}
          >
            Settings
          </button>
        </header>

        <main id="main" tabIndex={-1}>
          {data &&
            packetId &&
            !packet &&
            view !== "overview" &&
            view !== "activity" && (
              <div className="connection-recovery" role="status">
                <p>
                  This course is unavailable or archived. Return to your courses
                  to choose another.
                </p>
                <button
                  className="text-button"
                  onClick={() => goto("overview")}
                >
                  Your courses
                </button>
              </div>
            )}
          <div className="page-title">
            <div>
              <div className="eyebrow">
                {view === "overview" ? (
                  ""
                ) : view === "activity" ? (
                  ""
                ) : (
                  <>
                    <button
                      className="course-return"
                      onClick={() => goto("overview")}
                    >
                      ← Your courses
                    </button>
                    {view !== "packet" && packet && (
                      <span className="course-context">{packet.name}</span>
                    )}
                  </>
                )}
              </div>

              <h1>
                {view === "overview"
                  ? "Your courses"
                  : view === "packet"
                    ? packet?.name || "Course materials"
                    : view === "blueprint"
                      ? "Review your exam plan"
                      : view === "exam"
                        ? "Your practice exam"
                        : view === "activity"
                          ? "Settings & activity"
                          : view === "results"
                            ? "Review your practice"
                            : "Time to work it out."}
              </h1>

              <p>
                {view === "overview"
                  ? "Pick up where you left off, or bring something new to practice."
                  : view === "packet"
                    ? "Start with your files. Then decide what to practice."
                    : view === "blueprint"
                      ? "Check the evidence and shape the exam before generating questions."
                      : view === "exam"
                        ? "Preview the questions, then choose how you want to practice."
                        : view === "activity"
                          ? "Manage live generation and see where your credits go."
                          : view === "results"
                            ? "Check your reasoning, score your work, and choose what to practice next."
                            : "Your answers save as you go. Keep the exhibits close."}
              </p>
            </div>

            {view === "overview" && data?.packets.some((p) => !p.fixture) && (
              <button className="primary" onClick={openUpload}>
                <Plus size={17} />
                Add course materials
              </button>
            )}
          </div>

          {!connected && (
            <div className="connection-recovery" role="status">
              <CircleAlert size={18} />
              <div>
                <strong>VERA isn’t responding.</strong>
                <p>
                  Keep this tab open. Reconnect or restart the local app to
                  continue. We’ll retry automatically.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => void refresh().catch(() => {})}
              >
                Try reconnecting
              </button>
            </div>
          )}
          {error && !uploadOpen && !startOpen && (
            <div className="error-banner" role="alert">
              <CircleAlert size={18} />

              <span>
                <strong>We couldn’t complete that action.</strong>

                {error}
              </span>

              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {!data && (
            <div className="loading">
              <LoaderCircle className="spin" /> Loading your courses…
            </div>
          )}

          {data && (
            <>
              {view !== "overview" &&
                view !== "activity" &&
                view !== "practice" && (
                  <CourseJourney
                    view={view}
                    hasPacket={!!packet}
                    hasPlan={!!revision}
                    approved={!!revision?.approved && !dirty}
                    hasExam={!!exam}
                    submitted={!!attempt?.submittedAt}
                    onNavigate={goto}
                  />
                )}
              {active && (
                <GenerationProgress
                  job={active}
                  fixture={!!packet?.fixture}
                  legacyScenario={revision?.blueprint.schemaVersion !== 2}
                  onCancel={() =>
                    void act(async () => {
                      await request(`jobs/${active.id}`, {});
                    })
                  }
                />
              )}

              {recentJob &&
                !active &&
                ["failed", "interrupted", "cancelled"].includes(
                  recentJob.status,
                ) && (
                  <div className="job-banner failure">
                    <CircleAlert size={18} />

                    <div>
                      <strong>
                        {recentJob.status === "cancelled"
                          ? "Job cancelled"
                          : "This job needs attention"}
                      </strong>

                      <span>
                        {recentJob.error ||
                          "Your source packet and blueprint are still available."}
                      </span>
                    </div>

                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void (recentJob.kind === "analyze"
                          ? analyze()
                          : generate())
                      }
                    >
                      <RotateCcw size={14} /> Retry
                    </button>
                  </div>
                )}

              {view === "overview" && (
                <CourseLibrary
                  packets={data.packets}
                  revisions={data.revisions}
                  exams={data.exams}
                  attempts={data.attempts}
                  now={clock}
                  busy={busy || !!active}
                  onUpload={openUpload}
                  onGeneralSample={() => void demo("general")}
                  onOpen={(p, next, selectedExam) => {
                    setPacketId(p.id);

                    setExamId(selectedExam || "");

                    goto(next);
                  }}
                />
              )}

              {view === "packet" &&
                (!packet ? (
                  <Empty title="Add materials to start a course">
                    <p>
                      Start with a focused set of notes, an instructor
                      assessment, or a textbook excerpt.
                    </p>
                    <button className="primary" onClick={openUpload}>
                      Add course materials <Plus size={16} />
                    </button>
                  </Empty>
                ) : (
                  <CourseMaterials
                    packet={packet}
                    busy={busy || !!active}
                    configured={data.meta.configured}
                    workerOnline={data.meta.workerOnline}
                    hasPlan={!!revision}
                    onAnalyze={() => void analyze()}
                    onReview={() => goto("blueprint")}
                    onSettings={() => goto("activity")}
                    onSource={openSource}
                    onRole={(documentId, role) =>
                      void act(async () => {
                        await request(`packets/${packet.id}/roles`, {
                          documentId,
                          role,
                        });
                      })
                    }
                  />
                ))}

              {view === "blueprint" &&
                (!revision || !draft ? (
                  <Empty
                    title={
                      active
                        ? "Understanding your materials"
                        : "Your exam plan starts with your materials"
                    }
                  >
                    {active ? (
                      "Your editable exam plan will appear here when analysis is complete."
                    ) : (
                      <>
                        <p>
                          {packet
                            ? "Start with the materials view to check your sources and analysis settings."
                            : "Add a course first. You’ll review its sources before building a plan."}
                        </p>
                        <button
                          className="primary"
                          onClick={() =>
                            packet ? goto("packet") : openUpload()
                          }
                        >
                          {packet
                            ? "Review course materials"
                            : "Add course materials"}{" "}
                          <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </Empty>
                ) : (
                  <>
                    {!!revision.changes?.length && (
                      <section className="panel revision-changes">
                        <h3>Changes since the previous plan</h3>
                        <ul>
                          {revision.changes.map((change, i) => (
                            <li key={i}>{change}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <div className="blueprint-layout">
                      {packet && (
                        <ExamPlanEditor
                          key={revision.id}
                          draft={draft}
                          packet={packet}
                          approved={revision.approved}
                          dirty={!!dirty}
                          busy={busy || !!active}
                          notice={planNotice}
                          onEdit={edit}
                          onSave={savePlan}
                          onGenerate={() => void generate()}
                          onReset={resetPlan}
                          onSource={openSource}
                        />
                      )}

                      <details className="plan-evidence">
                        <summary>Why these topics?</summary>
                        <section className="evidence-panel">
                          {draft.observations.map((o, i) => (
                            <div className="observation" key={i}>
                              <span
                                className={`badge ${o.kind === "observed" ? "blue" : ""}`}
                              >
                                {o.kind.replaceAll("-", " ")}
                              </span>

                              <p>{o.text}</p>

                              {o.evidence.map((r, n) => (
                                <button
                                  key={n}
                                  className="source-link"
                                  onClick={() =>
                                    openSource(r.documentId, r.page)
                                  }
                                >
                                  {
                                    packet?.documents.find(
                                      (d) => d.id === r.documentId,
                                    )?.name
                                  }{" "}
                                  · p. {r.page} <ArrowUpRight size={12} />
                                </button>
                              ))}
                            </div>
                          ))}
                        </section>
                      </details>
                    </div>
                  </>
                ))}

              {view === "exam" &&
                (!exam ||
                active?.kind === "generate" ||
                active?.kind === "follow-up" ||
                pendingGeneration ? (
                  <Empty
                    title={
                      active || pendingGeneration
                        ? "Assembling your assessment"
                        : "Your practice exam will appear here"
                    }
                  >
                    {active || pendingGeneration ? (
                      active?.stage || "Waiting for the saved job status…"
                    ) : (
                      <>
                        <p>
                          Review and approve an exam plan to generate questions
                          and their exhibits.
                        </p>
                        <button
                          className="primary"
                          onClick={() =>
                            goto(revision ? "blueprint" : "packet")
                          }
                        >
                          {revision
                            ? "Review exam plan"
                            : "Review course materials"}{" "}
                          <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </Empty>
                ) : (
                  <>
                    <div className="exam-header">
                      <div>
                        <h2>{exam.exam.title}</h2>

                        <p>
                          <span>
                            <FileText size={14} /> {exam.exam.questions.length}{" "}
                            questions
                          </span>

                          <span>
                            <Target size={14} /> {exam.exam.totalPoints} points
                          </span>

                          <span>
                            <Clock3 size={14} /> {exam.exam.minutes} minutes
                          </span>
                        </p>
                      </div>

                      <div className="exam-controls">
                        {data.exams.filter((e) => e.packetId === packet?.id)
                          .length > 1 && (
                          <select
                            aria-label="Assessment version"
                            value={exam.id}
                            onChange={(e) => {
                              setExamId(e.target.value);
                            }}
                          >
                            {data.exams

                              .filter((e) => e.packetId === packet?.id)

                              .map((e, i) => (
                                <option key={e.id} value={e.id}>
                                  {i === 0 ? "Latest: " : "Earlier: "}

                                  {e.exam.title}
                                </option>
                              ))}
                          </select>
                        )}

                        <button
                          className="secondary"
                          onClick={() => {
                            const a = document.createElement("a");

                            a.href = URL.createObjectURL(
                              new Blob([JSON.stringify(exam, null, 2)], {
                                type: "application/json",
                              }),
                            );

                            a.download = "vera-assessment.json";

                            a.click();

                            URL.revokeObjectURL(a.href);
                          }}
                        >
                          <ArrowDownToLine size={16} /> Export
                        </button>

                        {!exam.ready && (
                          <button
                            className="primary"
                            onClick={() => goto("blueprint")}
                          >
                            Review plan & generate again
                          </button>
                        )}
                        <button
                          className="primary"
                          disabled={!exam.ready || busy}
                          onClick={() => void practice()}
                        >
                          {attempt?.submittedAt
                            ? "View results"
                            : attempt
                              ? attempt.endsAt <= clock
                                ? "Review ended attempt"
                                : "Resume practice"
                              : "Start practice"}

                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>

                    <div
                      className={`check-report ${exam.ready ? "pass" : "fail"}`}
                    >
                      <ShieldCheck size={21} />

                      <div>
                        <strong>
                          {exam.ready
                            ? "Structural checks passed · review checking coverage"
                            : "Unresolved checks · practice blocked"}
                        </strong>

                        <p>
                          {exam.fixture
                            ? "Saved demonstration. Model review was not run. Numerical claims and structure are checked locally."
                            : `Recorded claim checks: ${exam.verification?.filter((v) => v.result === "passed").length ?? "legacy"}. ${exam.repairAttempts} repair cycles. Written reasoning is not automatically verified. Model review is provisional.`}
                        </p>

                        {exam.issues.map((i, n) => (
                          <p
                            className={
                              i.severity === "error"
                                ? "inline-error"
                                : "source-warning"
                            }
                            key={n}
                          >
                            {i.code}: {i.message}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`exam-layout ${exam.scenario || exam.exam.exhibits?.length ? "" : "without-material"}`}
                    >
                      <div>
                        <div className="instructions panel">
                          <span className="eyebrow">BEFORE YOU BEGIN</span>

                          <p>{exam.exam.instructions}</p>

                          <p className="muted small">
                            Solutions unlock after you finish an attempt.
                          </p>
                        </div>

                        {exam.exam.questions.map((q) => (
                          <article
                            className="panel question-card"
                            key={q.number}
                          >
                            <div className="question-meta">
                              <span>
                                QUESTION {q.number.toString().padStart(2, "0")}
                              </span>

                              <span>
                                {q.points} points · {q.minutes} min
                              </span>
                            </div>

                            <span className="badge">{q.topic}</span>

                            <h3>
                              <MathText text={q.question} />
                            </h3>

                            <p className="muted small">
                              {q.exhibitIds.length
                                ? `Supporting material: ${q.exhibitIds.join(", ")}`
                                : "No additional supporting material needed."}
                            </p>

                            {q.options.length > 0 && (
                              <div className="readonly-options">
                                {q.options.map((o, i) => (
                                  <div key={i}>
                                    <span className="option-letter">
                                      {String.fromCharCode(65 + i)}
                                    </span>

                                    <MathText text={o} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>

                      <Exhibits
                        scenario={exam.scenario}
                        exhibits={exam.exam.exhibits}
                      />
                    </div>
                  </>
                ))}

              {view === "practice" &&
                (exam && attempt && !attempt.submittedAt ? (
                  <Practice
                    key={attempt.id}
                    attempt={attempt}
                    exam={exam}
                    update={request}
                    onExit={() => goto("exam")}
                    onSubmit={() => {
                      void refresh().then(() => setView("results"));
                    }}
                  />
                ) : (
                  <Empty title="Practice session complete">
                    <button className="primary" onClick={() => goto("results")}>
                      View results <ArrowRight size={16} />
                    </button>
                  </Empty>
                ))}

              {view === "results" &&
                (exam && attempt?.submittedAt && packet ? (
                  <Review
                    key={attempt.id}
                    attempt={attempt}
                    packet={packet}
                    api={request}
                    refresh={refresh}
                    onPlan={() => goto("blueprint")}
                    onSource={openSource}
                    feedbackRevision={
                      data.jobs.find((j) => j.attemptId === attempt.id)
                        ?.updatedAt
                    }
                    canSuggest={
                      data.meta.configured && data.meta.workerOnline && !active
                    }
                  />
                ) : (
                  <Empty title="Finish practice to review your answers">
                    <p>Solutions and feedback open after submission.</p>
                    <button
                      className="primary"
                      onClick={() => (exam ? void practice() : goto("packet"))}
                    >
                      {exam ? "Open practice" : "Review course materials"}
                    </button>
                  </Empty>
                ))}

              {view === "activity" && (
                <>
                  <div className="activity-grid">
                    <section className="panel config-card">
                      <div className="section-heading">
                        <h2>
                          <Zap size={18} /> Meta Model API
                        </h2>

                        <span
                          className={`badge ${data.meta.configured ? "blue" : "amber"}`}
                        >
                          {data.meta.configured
                            ? "Key configured"
                            : "Setup needed"}
                        </span>
                      </div>

                      <dl>
                        <div>
                          <dt>Candidate model</dt>

                          <dd>{data.meta.model}</dd>
                        </div>

                        <div>
                          <dt>Data-use mode</dt>

                          <dd>Standard · Contributor disabled</dd>
                        </div>

                        <div>
                          <dt>Capability probe</dt>

                          <dd>
                            {data.meta.capabilityTested
                              ? "Passed for configured model"
                              : "Not yet run"}
                          </dd>
                        </div>

                        <div>
                          <dt>Background worker</dt>

                          <dd>
                            {data.meta.workerOnline
                              ? "Connected"
                              : "Offline · run npm run dev"}
                          </dd>
                        </div>
                      </dl>

                      <p className="muted small">
                        Set MODEL_API_KEY in .env.local, restart VERA, and run
                        npm run probe. Credentials stay on the server. Saved
                        demos make no model calls.
                      </p>
                    </section>

                    <section className="panel budget-card">
                      <span className="eyebrow">USD 150 TOTAL CREDITS</span>

                      <h2>
                        ${spent.toFixed(2)} <small>accounted usage</small>
                      </h2>

                      <div className="budget-track">
                        <span
                          style={{
                            width: `${Math.min(100, (spent / 150) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="budget-labels">
                        <span>$90 Development</span>

                        <span>$30 Demo</span>

                        <span>$30 Reserve</span>
                      </div>

                      <p>
                        Reserve is locked. Interrupted calls retain their
                        estimated reservation until reconciled.
                      </p>

                      {data.usage.buckets.map((b) => (
                        <p key={b.bucket}>
                          <strong>
                            {b.bucket}: ${b.spent.toFixed(3)}
                          </strong>{" "}
                          · {b.calls} calls · {b.uncertain || 0} uncertain
                        </p>
                      ))}
                    </section>
                  </div>

                  <div className="section-heading">
                    <h2>Generation history</h2>

                    <span className="badge">All outcomes retained</span>
                  </div>

                  <div className="panel job-list">
                    {data.jobs.length ? (
                      data.jobs.map((j) => (
                        <div key={j.id}>
                          <span className={`job-status ${j.status}`}>
                            <span />

                            {j.status}
                          </span>

                          <div>
                            <strong>
                              {j.kind === "analyze"
                                ? "Course analysis"
                                : j.kind === "follow-up"
                                  ? "Targeted follow-up"
                                  : "Assessment generation"}
                            </strong>

                            <small>
                              {j.stage}

                              {j.error ? ` · ${j.error}` : ""}
                            </small>
                          </div>

                          <span>
                            {new Date(j.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",

                              minute: "2-digit",
                            })}
                          </span>

                          {j.resultId && (
                            <button
                              className="icon-button"
                              aria-label="Open job result"
                              onClick={() => {
                                setPacketId(j.packetId);

                                if (j.kind !== "analyze")
                                  setExamId(j.resultId!);

                                goto(
                                  j.kind === "analyze" ? "blueprint" : "exam",
                                );
                              }}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        Your first generation job will appear here.
                      </p>
                    )}
                  </div>

                  <div className="section-heading">
                    <h2>Recent provider calls</h2>
                  </div>

                  <div className="panel usage-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Stage / model</th>

                          <th>Latency</th>

                          <th>Cost / reserved</th>

                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {data.usage.recent.map((c) => (
                          <tr key={c.id}>
                            <td>
                              {c.stage}

                              <small>{c.model}</small>
                            </td>

                            <td>{((c.latency_ms || 0) / 1000).toFixed(1)}s</td>

                            <td>${(c.cost ?? c.reserved).toFixed(4)}</td>

                            <td>{c.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!data.usage.recent.length && (
                      <p className="muted">
                        No live generation yet. Saved examples use zero credits.
                      </p>
                    )}
                  </div>
                </>
              )}

              <footer className="main-footer">
                <span>VERA</span>

                <span>Practice grounded in your course.</span>

                <span className="footer-storage">Stored on this device</span>
              </footer>
            </>
          )}
        </main>
      </div>

      {uploadOpen && (
        <Dialog
          titleId="upload-title"
          onDismiss={() => setUploadOpen(false)}
          locked={busy}
          className="upload-dialog"
        >
          <div className="section-heading">
            <h2 id="upload-title">Add course materials</h2>

            <button
              className="icon-button"
              aria-label="Close upload"
              disabled={busy}
              onClick={() => setUploadOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}

          <p className="muted">
            Add focused excerpts. PDFs and images stay in your local workspace
            and are sent to Meta when you request analysis or generation.
          </p>

          <div className="upload-step-label" role="status">
            Step{" "}
            {uploadReview
              ? "2 of 2 · Check your materials"
              : "1 of 2 · Choose sources"}
          </div>
          <div hidden={uploadReview} className="upload-selection">
            <label>
              Course name
              <input
                disabled={busy}
                placeholder="Name this course or topic"
                value={packetName}
                onChange={(e) => setPacketName(e.target.value)}
              />
            </label>

            <input
              ref={input}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              multiple
              className="sr-only"
              onChange={(e) => chooseFiles(e.target.files)}
            />

            <button
              className="dropzone"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();

                chooseFiles(e.dataTransfer.files);
              }}
            >
              <UploadCloud size={30} />

              <strong>Drop course materials here</strong>

              <span>or browse files · PDF, PNG, JPEG</span>

              <small>
                8 files · 10 MB each · 30 MB and 40 pages per packet
              </small>
            </button>

            {files.length > 0 && (
              <p className="upload-role-help">
                Choose each document’s role. Past exams inform format;
                AI-generated references do not.
              </p>
            )}
            <div className="upload-files">
              {files.map((f, i) => (
                <div key={i}>
                  <FileText size={18} />

                  <span>
                    {f.file.name}

                    <small>{(f.file.size / 1024).toFixed(0)} KB</small>
                  </span>

                  <select
                    aria-label={`Role for ${f.file.name}`}
                    required
                    value={f.role}
                    onChange={(e) =>
                      setFiles(
                        files.map((v, n) =>
                          n === i ? { ...v, role: e.target.value as Role } : v,
                        ),
                      )
                    }
                  >
                    <option value="" disabled>
                      Choose a role…
                    </option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {roleName(r)}
                      </option>
                    ))}
                  </select>

                  <button
                    className="icon-button"
                    aria-label={`Remove ${f.file.name}`}
                    onClick={() => setFiles(files.filter((_, n) => n !== i))}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {uploadReview && (
            <section className="upload-review">
              <h3>{packetName.trim() || files[0]?.file.name}</h3>
              <p>
                {files.length} {files.length === 1 ? "document" : "documents"} ·{" "}
                {(
                  files.reduce((sum, item) => sum + item.file.size, 0) /
                  1024 /
                  1024
                ).toFixed(1)}{" "}
                MB
              </p>
              <dl>
                {files.map((item, i) => (
                  <div key={i}>
                    <dt>{item.file.name}</dt>
                    <dd>{roleName(item.role)}</dd>
                  </div>
                ))}
              </dl>
              <p className="upload-next">
                Next: VERA extracts the pages so you can inspect them. Saving
                uses no model credits. You decide when to send sources for
                analysis.
              </p>
            </section>
          )}
          <p className="muted small">
            Only add materials you have permission to use.
          </p>

          <div className="modal-actions">
            {uploadReview && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setUploadReview(false)}
              >
                Back to files
              </button>
            )}
            <button
              className="primary"
              disabled={!files.length || files.some((f) => !f.role) || busy}
              onClick={() => {
                if (!uploadReview) {
                  setError("");
                  setUploadReview(true);
                  return;
                }
                void act(async () => {
                  const form = new FormData();

                  form.set("name", packetName || files[0].file.name);

                  form.set("roles", JSON.stringify(files.map((f) => f.role)));

                  files.forEach((f) => form.append("files", f.file));

                  const p = await request("packets", form);

                  setPacketId(p.id);

                  setExamId("");

                  setFiles([]);

                  setPacketName("");

                  setUploadOpen(false);

                  setView("packet");
                });
              }}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Plus size={16} />
              )}{" "}
              {busy
                ? "Extracting pages…"
                : uploadReview
                  ? "Save materials"
                  : "Review materials"}
            </button>
          </div>
        </Dialog>
      )}

      {startOpen && exam && (
        <Dialog
          titleId="start-practice-title"
          onDismiss={() => setStartOpen(false)}
          locked={busy}
          className="start-practice-dialog"
        >
          <span className="eyebrow">CHOOSE YOUR PRACTICE MODE</span>
          <h2 id="start-practice-title">Ready to start practice?</h2>
          <p>{exam.exam.title}</p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <fieldset className="practice-mode">
            <legend>Practice mode</legend>
            <label>
              <input
                type="radio"
                name="practice-mode"
                checked={practiceMode === "timed"}
                onChange={() => setPracticeMode("timed")}
              />
              Timed exam
              <span>Use the plan’s time limit. Leaving does not pause it.</span>
            </label>
            <label>
              <input
                type="radio"
                name="practice-mode"
                checked={practiceMode === "untimed"}
                onChange={() => setPracticeMode("untimed")}
              />
              Untimed practice
              <span>
                Work at your pace. Solutions stay hidden until you finish.
              </span>
            </label>
          </fieldset>
          <dl className="start-practice-facts">
            <div>
              <dt>Time limit</dt>
              <dd>
                {practiceMode === "untimed"
                  ? "No time limit"
                  : `${exam.exam.minutes} minutes`}
              </dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>{exam.exam.questions.length}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{exam.exam.totalPoints} points</dd>
            </div>
          </dl>
          <ul className="start-practice-notes">
            <li>Exhibits stay available while you work.</li>
            <li>
              Answers save automatically.{" "}
              {practiceMode === "untimed"
                ? "You can leave and resume without a deadline."
                : "The timer continues if you leave or refresh."}
            </li>
            <li>
              Choice and supported numeric answers use the key. You’ll score
              written work using the marking guide after finishing.
            </li>
          </ul>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setStartOpen(false)}
            >
              Keep previewing
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void practice()}
            >
              {busy
                ? "Starting…"
                : practiceMode === "untimed"
                  ? "Start untimed practice"
                  : "Start timed practice"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}

      {source && (
        <Dialog
          label="Source page"
          onDismiss={() => setSource(undefined)}
          className="source-modal"
        >
          <div className="section-heading">
            <h2>{source.name}</h2>

            <button
              className="icon-button"
              aria-label="Close source"
              onClick={() => setSource(undefined)}
            >
              <X size={20} />
            </button>
          </div>

          <iframe src={source.url} title={source.name} />
          <div className="source-pagination">
            <button
              className="text-button"
              disabled={
                packet?.documents.find((d) => d.id === source.documentId)
                  ?.pages[0]?.number === source.page
              }
              onClick={() => {
                const pages =
                  packet?.documents.find((d) => d.id === source.documentId)
                    ?.pages || [];
                const i = pages.findIndex((p) => p.number === source.page);
                if (i > 0) openSource(source.documentId, pages[i - 1].number);
              }}
            >
              Previous page
            </button>
            <label>
              Page
              <select
                aria-label="Source page number"
                value={source.page}
                onChange={(e) =>
                  openSource(source.documentId, Number(e.target.value))
                }
              >
                {packet?.documents
                  .find((d) => d.id === source.documentId)
                  ?.pages.map((p) => (
                    <option key={p.number} value={p.number}>
                      {p.number}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="text-button"
              disabled={
                packet?.documents
                  .find((d) => d.id === source.documentId)
                  ?.pages.at(-1)?.number === source.page
              }
              onClick={() => {
                const pages =
                  packet?.documents.find((d) => d.id === source.documentId)
                    ?.pages || [];
                const i = pages.findIndex((p) => p.number === source.page);
                if (i >= 0 && i < pages.length - 1)
                  openSource(source.documentId, pages[i + 1].number);
              }}
            >
              Next page
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

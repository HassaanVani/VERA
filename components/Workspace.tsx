"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  FolderOpen,
  Gauge,
  Layers3,
  LoaderCircle,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Target,
  UploadCloud,
  X,
  Zap,
  CircleAlert,
  PanelLeftClose,
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

const nav = [
  { view: "overview", icon: Blocks, label: "Library" },

  { view: "packet", icon: FolderOpen, label: "Materials" },

  { view: "blueprint", icon: Layers3, label: "Exam plan" },

  { view: "exam", icon: FileText, label: "Practice exam" },

  { view: "results", icon: Target, label: "Results" },

  { view: "activity", icon: Gauge, label: "Settings & activity" },
] as const;

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

function Logo() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 5H11L17 21H10L4 5Z" fill="#7ab1ff" />

          <path d="M17 5H24L17 21H10L17 5Z" fill="#347aff" />
        </svg>
      </span>

      <span>
        VERA<span className="brand-dot">.</span>
      </span>
    </div>
  );
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
    [source, setSource] = useState<{ url: string; name: string }>(),
    [menu, setMenu] = useState(false),
    [startOpen, setStartOpen] = useState(false),
    [uploadReview, setUploadReview] = useState(false),
    [practiceMode, setPracticeMode] = useState<"timed" | "untimed">("timed");

  const [generationRequest, setGenerationRequest] = useState<{
    id: string;
    packetId: string;
  }>();

  const [files, setFiles] = useState<{ file: File; role: Role }[]>([]),
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

    setMenu(false);
  };

  const demo = (kind = "legacy") =>
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
      document.title = `${nav.find((item) => item.view === view)?.label || "Practice session"} · VERA`;
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

      ...incoming.map((file) => ({ file, role: "lecture-notes" as Role })),
    ]);

    if (input.current) input.current.value = "";
  }

  return (
    <div className={`app-shell view-${view}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {menu && (
        <button
          className="mobile-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}

      <aside
        id="workspace-navigation"
        className={`sidebar ${menu ? "open" : ""}`}
      >
        <Logo />

        <div className="workspace-label">
          <BookOpen size={18} />

          <div>
            Study workspace<small>VERIFIED EXAM & REVISION ARCHITECT</small>
          </div>
        </div>

        <p className="nav-caption">YOUR WORKSPACE</p>

        <nav>
          {nav.map((n) => (
            <button
              key={n.view}
              onClick={() => goto(n.view)}
              aria-current={view === n.view ? "page" : undefined}
              className={
                view === n.view || (view === "practice" && n.view === "exam")
                  ? "active"
                  : ""
              }
            >
              <n.icon size={18} />

              <span>{n.label}</span>

              {n.view === "packet" && !!packet?.documents.length && (
                <span className="nav-count">{packet?.documents.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-course-label">
          <span className="eyebrow">CURRENT COURSE</span>

          <p>{packet?.name || "No course selected"}</p>
        </div>

        <div className="sidebar-bottom">
          <button onClick={() => goto("activity")}>
            <Settings2 size={17} /> Generation settings{" "}
            <ArrowUpRight size={14} />
          </button>

          <p>
            <ShieldCheck size={14} /> Files stored on this device.
          </p>

          <span className="version">VERA / LOCAL WORKSPACE</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              aria-expanded={menu}
              aria-controls="workspace-navigation"
              onClick={() => setMenu(!menu)}
            >
              <PanelLeftClose size={18} />
            </button>

            <span>Workspace</span>

            <ChevronRight size={13} />

            <strong>
              {nav.find((n) => n.view === view)?.label || "Practice session"}
            </strong>
          </div>

          <div className="topbar-right">
            <span className="connection">
              <span className={`status-dot ${connected ? "" : "offline"}`} />{" "}
              {connected ? "Local workspace" : "Workspace unavailable"}
            </span>

            <button
              className="icon-button"
              title="Generation settings and activity"
              aria-label="Generation settings and activity"
              onClick={() => goto("activity")}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <main id="main" tabIndex={-1}>
          <div className="page-title">
            <div>
              <div className="eyebrow">
                {view === "overview"
                  ? "A PLACE TO GET PREPARED"
                  : packet?.name || "YOUR STUDY WORKSPACE"}
              </div>

              <h1>
                {view === "overview"
                  ? "Your course library."
                  : view === "packet"
                    ? "Course materials"
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
                  ? "Turn course materials into a practice exam—with the documents to solve it."
                  : view === "packet"
                    ? "Inspect the extracted pages, then build an exam plan from your evidence."
                    : view === "blueprint"
                      ? "Check the evidence and shape the exam before generating questions."
                      : view === "exam"
                        ? "Read the questions alongside their exhibits, or start a timed attempt."
                        : view === "activity"
                          ? "Manage live generation and see where your credits go."
                          : view === "results"
                            ? "Check your reasoning, score your work, and choose what to practice next."
                            : "Your answers save as you go. Keep the exhibits close."}
              </p>
            </div>

            {view !== "practice" && (
              <button
                className={view === "overview" ? "primary" : "secondary"}
                onClick={openUpload}
              >
                <Plus size={17} />

                {view === "overview" ? "Add course materials" : "New course"}
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

              {packet && view !== "overview" && view !== "activity" && (
                <div className="packet-selector">
                  <FolderOpen size={16} />

                  <label className="sr-only" htmlFor="selected-packet">
                    Selected course
                  </label>

                  <select
                    id="selected-packet"
                    value={packet.id}
                    onChange={(e) => {
                      setPacketId(e.target.value);

                      setExamId("");
                    }}
                  >
                    {data.packets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  {packet.fixture && (
                    <span className="badge amber">
                      Saved example · no live generation
                    </span>
                  )}
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
                  onSample={() => void demo()}
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
                  <>
                    {!packet.fixture &&
                      (!data.meta.configured || !data.meta.workerOnline) && (
                        <section
                          className="setup-guidance"
                          aria-labelledby="setup-heading"
                        >
                          <CircleHelp size={21} />
                          <div>
                            <h2 id="setup-heading">
                              {!data.meta.configured
                                ? "Your materials are saved. Connect Meta to build a plan."
                                : "Your materials are saved. The background worker is offline."}
                            </h2>
                            <p>
                              {!data.meta.configured
                                ? "Live analysis sends the selected course sources to Meta. You can configure it now, or explore the complete workflow with the sample course."
                                : "Restart VERA with npm run dev to continue. Your documents and exam plan are still available."}
                            </p>
                            <div>
                              <button
                                className="secondary"
                                onClick={() => goto("activity")}
                              >
                                Open generation settings
                              </button>
                              <button
                                className="text-button"
                                onClick={() => void demo()}
                              >
                                Explore sample course <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        </section>
                      )}
                    <div className="section-heading">
                      <div>
                        <h2>Course evidence</h2>
                        <p className="muted small">
                          {packet.documents.length} sources ·{" "}
                          {packet.documents.reduce(
                            (sum, d) => sum + d.pages.length,
                            0,
                          )}{" "}
                          pages. Inspect a page to check what VERA will read.
                        </p>
                      </div>

                      <button
                        className="primary"
                        disabled={
                          busy ||
                          !!active ||
                          (!packet.fixture &&
                            (!data.meta.configured || !data.meta.workerOnline))
                        }
                        onClick={() => void analyze()}
                      >
                        Build exam plan <ArrowRight size={16} />
                      </button>
                    </div>

                    <div className="material-readiness panel">
                      <h3>Material readiness</h3>
                      <p>
                        {packet.documents.reduce(
                          (n, d) =>
                            n +
                            d.pages.filter(
                              (p) =>
                                p.text.trim().length > 80 && !p.needsVision,
                            ).length,
                          0,
                        )}{" "}
                        pages with readable extracted text ·{" "}
                        {packet.documents.reduce(
                          (n, d) =>
                            n + d.pages.filter((p) => p.needsVision).length,
                          0,
                        )}{" "}
                        pages need visual inspection
                      </p>
                      <p>
                        Check the page previews and document roles below. Role
                        changes invalidate plan approval.
                      </p>
                    </div>
                    <div className="source-grid">
                      {packet.documents.map((d) => (
                        <article className="panel source-card" key={d.id}>
                          <div className="source-card-top">
                            <span className="quick-icon">
                              <FileText size={21} />
                            </span>

                            <label className="source-role">
                              Document role
                              <select
                                aria-label={`Role for ${d.name}`}
                                value={d.role}
                                disabled={busy || !!active}
                                onChange={(event) =>
                                  void act(async () => {
                                    await request(
                                      `packets/${packet.id}/roles`,
                                      {
                                        documentId: d.id,
                                        role: event.target.value,
                                      },
                                    );
                                  })
                                }
                              >
                                {roles.map((role) => (
                                  <option key={role} value={role}>
                                    {roleName(role)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <h3>{d.name}</h3>

                          <p>
                            {d.pages.length} page
                            {d.pages.length !== 1 ? "s" : ""} ·{" "}
                            {d.pages.filter((p) => p.duplicateOf).length}{" "}
                            duplicate pages
                          </p>

                          {d.warnings.map((w) => (
                            <p className="source-warning" key={w}>
                              <CircleAlert size={13} /> {w}
                            </p>
                          ))}

                          <div className="page-links">
                            {d.pages.map((p) => (
                              <button
                                key={p.number}
                                onClick={() => openSource(d.id, p.number)}
                                title={
                                  p.duplicateOf
                                    ? "Duplicate evidence retained for provenance"
                                    : "Inspect original page"
                                }
                              >
                                p. {p.number}
                                {p.duplicateOf ? " ↔" : ""}
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>

                    {!packet.documents.some(
                      (document) =>
                        document.role === "past-exam" ||
                        document.role === "assignment",
                    ) && (
                      <p className="evidence-expectation">
                        <CircleHelp size={16} /> No instructor assessment is
                        included. The plan can use these materials for topics;
                        exam format and difficulty will remain inferred.
                      </p>
                    )}
                    <details className="source-policy">
                      <summary>How VERA uses your materials</summary>
                      <p>
                        Document roles were set when you uploaded them. Course
                        notes and textbook excerpts inform topics. Past
                        instructor assessments can inform format. AI-generated
                        references do not establish course scope or exam format.
                        Uploaded text is treated as evidence, never as
                        instructions.
                      </p>
                    </details>
                  </>
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
                    <div className="plan-introduction">
                      <span className="badge">
                        {revision.approved && !dirty
                          ? "Approved"
                          : "Your review needed"}
                      </span>
                      <p>
                        {revision.approved && !dirty
                          ? "Your plan is approved. Generate an exam when you’re ready."
                          : "Check that these topics match what you want to practice. Review the assumptions and open each question’s source evidence where needed."}
                      </p>
                    </div>
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

                      <aside>
                        <section className="panel evidence-panel">
                          <h3>
                            <BookOpen size={17} /> What the evidence says
                          </h3>

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
                      </aside>
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

                <button
                  className="text-button"
                  onClick={() => goto("activity")}
                >
                  Generation settings <ArrowUpRight size={13} />
                </button>
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
                placeholder="e.g. Linear algebra · eigenvalues"
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

            <p className="upload-role-help">
              Choose what each file is. A past instructor exam can inform
              format; an AI-generated exam must be marked as an AI-generated
              reference.
            </p>
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
                    value={f.role}
                    onChange={(e) =>
                      setFiles(
                        files.map((v, n) =>
                          n === i ? { ...v, role: e.target.value as Role } : v,
                        ),
                      )
                    }
                  >
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
            Only add materials you have permission to use. Label AI-generated
            exams as generated reference. VERA supports subject-independent
            practice, with bounded numerical and source checks. Legacy examples
            cover linear algebra development scenarios; Physics II support comes
            later.
          </p>

          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                uploadReview ? setUploadReview(false) : setUploadOpen(false)
              }
            >
              {uploadReview ? "Back to files" : "Cancel"}
            </button>

            <button
              className="primary"
              disabled={!files.length || busy}
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
        </Dialog>
      )}
    </div>
  );
}

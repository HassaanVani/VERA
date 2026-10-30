"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  BookOpen,
  Check,
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
  Sparkles,
  Target,
  UploadCloud,
  X,
  Zap,
  CircleAlert,
  PanelLeftClose,
} from "lucide-react";

import type {
  Packet,
  Revision,
  Job,
  CheckedExam,
  Attempt,
  Blueprint,
  Role,
} from "@/lib/contracts";

import { results } from "@/lib/domain";

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

  exams: CheckedExam[];

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
    [error, setError] = useState(""),
    [uploadOpen, setUploadOpen] = useState(false),
    [source, setSource] = useState<{ url: string; name: string }>(),
    [menu, setMenu] = useState(false),
    [showSolutions, setShowSolutions] = useState(false);

  const [files, setFiles] = useState<{ file: File; role: Role }[]>([]),
    [packetName, setPacketName] = useState(""),
    [draft, setDraft] = useState<Blueprint>();

  const watching = useRef<string>(""),
    draftId = useRef(""),
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

    return d;
  }, []);

  useEffect(() => {
    let alive = true;

    const load = () => {
      void refresh().catch((e) => {
        if (alive) setError(e.message);
      });
    };

    load();

    const t = setInterval(load, 1800);

    return () => {
      alive = false;

      clearInterval(t);
    };
  }, [refresh]);

  useEffect(() => {
    if (!uploadOpen && !source) return;

    const previous = document.activeElement as HTMLElement | null;

    const modal = document.querySelector<HTMLElement>('[role="dialog"]');

    const focusable = () => [
      ...(modal?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, textarea, iframe, [tabindex="0"]',
      ) || []),
    ];

    focusable()[0]?.focus();

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUploadOpen(false);

        setSource(undefined);
      }

      if (event.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes.at(-1);

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();

          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();

          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);

      previous?.focus();
    };
  }, [uploadOpen, source]);

  const packet =
    data?.packets.find((p) => p.id === packetId) || data?.packets[0];

  const revision = data?.revisions.find((r) => r.packetId === packet?.id);

  const exam =
    data?.exams.find((e) => e.id === examId && e.packetId === packet?.id) ||
    data?.exams.find((e) => e.packetId === packet?.id);

  const attempt = data?.attempts.find((a) => a.examId === exam?.id);

  const ungraded =
    exam?.exam.questions.filter(
      (q) =>
        q.type === "free-response" &&
        attempt?.selfScores[q.number] === undefined,
    ).length || 0;

  const active = data?.jobs.find(
    (j) =>
      j.packetId === packet?.id && ["running", "queued"].includes(j.status),
  );

  const recentJob = data?.jobs.find((j) => j.packetId === packet?.id);

  useEffect(() => {
    if (revision && draftId.current !== revision.id) {
      draftId.current = revision.id;

      setDraft(structuredClone(revision.blueprint));
    }
  }, [revision]);

  useEffect(() => {
    const j = data?.jobs.find((j) => j.id === watching.current);

    if (j?.status === "complete") {
      watching.current = "";

      if (j.kind === "analyze") setView("blueprint");
      else {
        setExamId(j.resultId || "");

        setShowSolutions(false);

        setView("exam");
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

  const demo = () =>
    act(async () => {
      const r = await request("demo", {});

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
        kind: "generate",

        packetId: packet.id,

        revisionId: revision.id,
      });

      watching.current = j.id;

      setView("exam");
    });

  const practice = () =>
    act(async () => {
      if (!exam) return;

      if (attempt?.submittedAt) {
        setView("results");

        return;
      }

      await request("attempts", { examId: exam.id });

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

  const edit = (value: Blueprint) => setDraft(value);

  const dirty =
    draft &&
    revision &&
    JSON.stringify(draft) !== JSON.stringify(revision.blueprint);

  const spent = data?.usage.buckets.reduce((n, b) => n + b.spent, 0) || 0;

  const steps = [
    "Materials",

    "Analysis",

    "Exam plan",

    "Questions",

    "Checks",

    "Practice",

    "Follow-up",
  ];

  const currentStep = !packet
    ? 0
    : !revision
      ? 1
      : !revision.approved || dirty
        ? 2
        : !exam
          ? 3
          : !exam.ready
            ? 4
            : !attempt?.submittedAt
              ? 5
              : 6;

  useEffect(() => {
    if (navigationReady) {
      window.scrollTo(0, 0);

      document.getElementById("main")?.focus({ preventScroll: true });
    }
  }, [view, navigationReady]);

  function openUpload() {
    setError("");

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
        `${invalid.name} couldn�t be added. Choose a PDF, PNG, or JPEG under 10 MB.`,
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
              <span className="status-dot" /> Saved on this device
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
                    ? "Add context to each source before VERA builds your exam plan."
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

          {error && (
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
              {view !== "overview" && view !== "activity" && (
                <div className="workflow" aria-label="Assessment workflow">
                  {steps.map((s, i) => (
                    <div
                      key={s}
                      className={
                        i < currentStep
                          ? "done"
                          : i === currentStep
                            ? "current"
                            : ""
                      }
                    >
                      <span>
                        {i < currentStep ? (
                          <Check size={11} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>

                      {s}

                      {i < steps.length - 1 && <ChevronRight size={12} />}
                    </div>
                  ))}
                </div>
              )}

              {active && (
                <div className="job-banner" role="status">
                  <LoaderCircle className="spin" size={18} />

                  <div>
                    <strong>{active.stage}</strong>

                    <span>
                      {packet?.fixture
                        ? "Opening the saved example. No credits are used."
                        : "Progress is saved locally. You can move between views."}
                    </span>
                  </div>

                  <button
                    className="text-button"
                    onClick={() =>
                      void act(async () => {
                        await request(`jobs/${active.id}`, {});
                      })
                    }
                  >
                    Cancel job <X size={14} />
                  </button>
                </div>
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

                      draftId.current = "";
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
                  busy={busy || !!active}
                  onUpload={openUpload}
                  onSample={() => void demo()}
                  onOpen={(p, next) => {
                    setPacketId(p.id);

                    setExamId("");

                    goto(next);
                  }}
                />
              )}

              {view === "packet" &&
                (!packet ? (
                  <Empty title="Add materials to start a course">
                    Upload focused course excerpts or load the saved
                    demonstration.
                  </Empty>
                ) : (
                  <>
                    <div className="section-heading">
                      <h2>Course evidence</h2>

                      <button
                        className="primary"
                        disabled={busy || !!active}
                        onClick={() => void analyze()}
                      >
                        Build exam plan <ArrowRight size={16} />
                      </button>
                    </div>

                    <div className="source-grid">
                      {packet.documents.map((d) => (
                        <article className="panel source-card" key={d.id}>
                          <div className="source-card-top">
                            <span className="quick-icon">
                              <FileText size={21} />
                            </span>

                            <span className="badge">{roleName(d.role)}</span>
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

                    <div className="info-strip">
                      <ShieldCheck size={18} />

                      <span>
                        Documents provide evidence. Text inside them cannot
                        change VERA’s rules. Generated reference material is
                        excluded from course analysis.
                      </span>
                    </div>
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
                      <button
                        className="primary"
                        disabled={!packet || busy}
                        onClick={() => void analyze()}
                      >
                        Build exam plan <ArrowRight size={16} />
                      </button>
                    )}
                  </Empty>
                ) : (
                  <>
                    <div className="blueprint-summary">
                      <div className="panel">
                        <Layers3 size={20} />

                        <span>
                          Questions<strong>{draft.slots.length}</strong>
                        </span>
                      </div>

                      <div className="panel">
                        <Target size={20} />

                        <span>
                          Total points<strong>{draft.totalPoints}</strong>
                        </span>
                      </div>

                      <div className="panel">
                        <Clock3 size={20} />

                        <span>
                          Time limit
                          <strong>
                            {draft.minutes} <small>min</small>
                          </strong>
                        </span>
                      </div>

                      <div className="panel">
                        <ShieldCheck size={20} />

                        <span>
                          Approval
                          <strong className="approval-text">
                            {revision.approved && !dirty
                              ? "Approved"
                              : "Review needed"}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="blueprint-layout">
                      <section className="panel blueprint-editor">
                        <div className="section-heading">
                          <h2>Question plan</h2>

                          <span className="badge">Editable plan</span>
                        </div>

                        <label>
                          Exam title
                          <input
                            value={draft.title}
                            onChange={(e) =>
                              edit({ ...draft, title: e.target.value })
                            }
                          />
                        </label>

                        <label>
                          Instructions
                          <textarea
                            rows={3}
                            value={draft.instructions}
                            onChange={(e) =>
                              edit({ ...draft, instructions: e.target.value })
                            }
                          />
                        </label>

                        <div className="slot-table-wrap">
                          <table className="slot-table">
                            <thead>
                              <tr>
                                <th># / Topic</th>

                                <th>Format</th>

                                <th>Pts</th>

                                <th>Min</th>
                              </tr>
                            </thead>

                            <tbody>
                              {draft.slots.map((slot, i) => (
                                <tr key={slot.number}>
                                  <td>
                                    <span className="slot-number">
                                      {slot.number.toString().padStart(2, "0")}
                                    </span>

                                    <label
                                      className="sr-only"
                                      htmlFor={`topic-${i}`}
                                    >
                                      Topic for question {slot.number}
                                    </label>

                                    <input
                                      id={`topic-${i}`}
                                      value={slot.topic}
                                      onChange={(e) =>
                                        edit({
                                          ...draft,

                                          slots: draft.slots.map((s, n) =>
                                            n === i
                                              ? { ...s, topic: e.target.value }
                                              : s,
                                          ),
                                        })
                                      }
                                    />

                                    <small>{slot.pattern}</small>

                                    <select
                                      aria-label={`Question ${slot.number} difficulty`}
                                      value={slot.difficulty}
                                      onChange={(e) =>
                                        edit({
                                          ...draft,

                                          slots: draft.slots.map((s, n) =>
                                            n === i
                                              ? {
                                                  ...s,

                                                  difficulty: e.target
                                                    .value as typeof s.difficulty,
                                                }
                                              : s,
                                          ),
                                        })
                                      }
                                    >
                                      <option value="routine">Routine</option>

                                      <option value="transfer">Transfer</option>

                                      <option value="synthesis">
                                        Synthesis
                                      </option>
                                    </select>
                                  </td>

                                  <td>
                                    <select
                                      aria-label={`Question ${slot.number} format`}
                                      value={slot.type}
                                      onChange={(e) =>
                                        edit({
                                          ...draft,

                                          slots: draft.slots.map((s, n) =>
                                            n === i
                                              ? {
                                                  ...s,

                                                  type: e.target
                                                    .value as typeof s.type,
                                                }
                                              : s,
                                          ),
                                        })
                                      }
                                    >
                                      <option value="multiple-choice">
                                        Multiple choice
                                      </option>

                                      <option value="free-response">
                                        Free response
                                      </option>
                                    </select>
                                  </td>

                                  <td>
                                    <input
                                      aria-label={`Question ${slot.number} points`}
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={slot.points}
                                      onChange={(e) => {
                                        const slots = draft.slots.map((s, n) =>
                                          n === i
                                            ? {
                                                ...s,

                                                points: Number(e.target.value),
                                              }
                                            : s,
                                        );

                                        edit({
                                          ...draft,

                                          slots,

                                          totalPoints: slots.reduce(
                                            (n, s) => n + s.points,

                                            0,
                                          ),
                                        });
                                      }}
                                    />
                                  </td>

                                  <td>
                                    <input
                                      aria-label={`Question ${slot.number} minutes`}
                                      type="number"
                                      min={1}
                                      max={120}
                                      value={slot.minutes}
                                      onChange={(e) => {
                                        const slots = draft.slots.map((s, n) =>
                                          n === i
                                            ? {
                                                ...s,

                                                minutes: Number(e.target.value),
                                              }
                                            : s,
                                        );

                                        edit({
                                          ...draft,

                                          slots,

                                          minutes: slots.reduce(
                                            (n, s) => n + s.minutes,

                                            0,
                                          ),
                                        });
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="blueprint-actions">
                          <button
                            className="secondary"
                            disabled={busy || !!active}
                            onClick={() =>
                              void act(async () => {
                                await request(`revisions/${revision.id}`, {
                                  blueprint: draft,

                                  approve: false,
                                });
                              })
                            }
                          >
                            Save changes
                          </button>

                          {!revision.approved || dirty ? (
                            <button
                              className="primary"
                              disabled={busy || !!active}
                              onClick={() =>
                                void act(async () => {
                                  await request(`revisions/${revision.id}`, {
                                    blueprint: draft,

                                    approve: true,
                                  });
                                })
                              }
                            >
                              <Check size={16} /> Approve exam plan
                            </button>
                          ) : (
                            <button
                              className="primary"
                              disabled={busy || !!active}
                              onClick={() => void generate()}
                            >
                              Generate practice exam <Sparkles size={16} />
                            </button>
                          )}
                        </div>

                        <p className="muted small">
                          Any edit requires a new approval. This plan describes
                          practice alignment, not a prediction of your next
                          exam.
                        </p>
                      </section>

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

                        <section className="panel uncertainty-panel">
                          <h3>
                            <CircleHelp size={17} /> What remains uncertain
                          </h3>

                          {draft.uncertainties.map((u, i) => (
                            <p key={i}>{u}</p>
                          ))}
                        </section>
                      </aside>
                    </div>
                  </>
                ))}

              {view === "exam" &&
                (!exam ? (
                  <Empty
                    title={
                      active
                        ? "Assembling your assessment"
                        : "Your practice exam will appear here"
                    }
                  >
                    {active
                      ? active.stage
                      : "Review and approve an exam plan to generate questions and their exhibits."}
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

                              setShowSolutions(false);
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

                        <button
                          className="primary"
                          disabled={!exam.ready || busy}
                          onClick={() => void practice()}
                        >
                          {attempt?.submittedAt
                            ? "View results"
                            : attempt
                              ? "Resume practice"
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
                            ? "Numerical & structural checks passed"
                            : "Unresolved checks · practice blocked"}
                        </strong>

                        <p>
                          {exam.fixture
                            ? "Saved demonstration. Model review was not run. Numerical claims and structure are checked locally."
                            : `Separate model review: ${exam.review.questions.filter((q) => q.status === "consistent").length}/${exam.exam.questions.length} consistent. ${exam.repairAttempts} repair cycles. A consistency check is not proof of correctness.`}
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

                    <div className="exam-layout">
                      <div>
                        <div className="instructions panel">
                          <span className="eyebrow">BEFORE YOU BEGIN</span>

                          <p>{exam.exam.instructions}</p>

                          <button
                            className="text-button"
                            onClick={() => setShowSolutions(!showSolutions)}
                          >
                            {showSolutions
                              ? "Hide solutions & marking guide"
                              : "Show solutions & marking guide"}

                            <ChevronRight size={14} />
                          </button>
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
                              Exhibits: {q.exhibitIds.join(", ")}
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

                            {showSolutions && (
                              <div className="solution">
                                <span className="eyebrow">WORKED SOLUTION</span>

                                <p>
                                  <MathText text={q.solution} />
                                </p>

                                <strong>
                                  Answer: <MathText text={q.answer} />
                                </strong>

                                <h4>Marking guide</h4>

                                {q.rubric.map((r, i) => (
                                  <p key={i}>
                                    {r.criterion}

                                    <span>{r.points} pts</span>
                                  </p>
                                ))}

                                {exam.review.questions.find(
                                  (r) => r.number === q.number,
                                ) && (
                                  <details>
                                    <summary>Independent model answer</summary>

                                    <p>
                                      <MathText
                                        text={
                                          exam.review.questions.find(
                                            (r) => r.number === q.number,
                                          )!.independentAnswer
                                        }
                                      />
                                    </p>
                                  </details>
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>

                      <Exhibits scenario={exam.scenario} />
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
                (!exam || !attempt?.submittedAt ? (
                  <Empty title="Make room for a first attempt">
                    {exam?.ready ? (
                      <button
                        className="primary"
                        onClick={() => void practice()}
                      >
                        {attempt ? "Resume practice" : "Start practice"}{" "}
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      "Generate a checked assessment to start practice."
                    )}
                  </Empty>
                ) : (
                  <>
                    <div className="results-top">
                      <div className="panel score-card">
                        <span className="eyebrow">PRACTICE SCORE</span>

                        {ungraded > 0 && (
                          <span className="badge amber score-pending">
                            {ungraded} written{" "}
                            {ungraded === 1 ? "answer needs" : "answers need"} a
                            score
                          </span>
                        )}

                        <strong>
                          {results(exam, attempt).reduce(
                            (n, r) => n + r.earned,

                            0,
                          )}

                          <small> / {exam.exam.totalPoints}</small>
                        </strong>

                        <p>
                          Multiple choice is scored automatically. You score
                          written answers.
                        </p>
                      </div>

                      <div className="panel next-session">
                        <span className="quick-icon">
                          <Target size={23} />
                        </span>

                        <div>
                          <h2>Choose what to practice next.</h2>

                          <p>
                            Use the marking guide to score each written answer.
                            Then create a short exam focused on the topics that
                            need more work.
                          </p>

                          <button
                            className="primary"
                            disabled={busy || !!active || ungraded > 0}
                            onClick={() =>
                              void act(async () => {
                                const j = await request("follow-up", {
                                  examId: exam.id,
                                });

                                watching.current = j.id;

                                setView("exam");
                              })
                            }
                          >
                            Create focused practice <ArrowRight size={16} />
                          </button>

                          {ungraded > 0 && (
                            <p className="follow-up-hint">
                              Score all written answers to unlock focused
                              practice.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="info-strip">
                      <CircleHelp size={18} />

                      <span>
                        Free-response scores are self-reported. Topic estimates
                        describe this attempt; they do not establish mastery or
                        learning gains.
                      </span>
                    </div>

                    {results(exam, attempt).map((r) => {
                      const q = exam.exam.questions.find(
                        (q) => q.number === r.number,
                      )!;

                      return (
                        <article
                          className="panel result-question"
                          key={r.number}
                        >
                          <div className="result-line">
                            <span className="slot-number">
                              {r.number.toString().padStart(2, "0")}
                            </span>

                            <div>
                              <h3>{r.topic}</h3>

                              <span className="muted small">
                                {r.selfReported
                                  ? "Score your work using the marking guide"
                                  : "Multiple choice · scored automatically"}
                              </span>
                            </div>

                            <strong>
                              {r.selfReported &&
                              attempt.selfScores[r.number] === undefined
                                ? "�"
                                : r.earned}{" "}
                              / {r.possible}
                            </strong>
                          </div>

                          <p>
                            <MathText text={q.question} />
                          </p>

                          <div className="your-response">
                            <span className="eyebrow">YOUR RESPONSE</span>

                            <p>
                              {attempt.responses[q.number] ||
                                "No response recorded"}
                            </p>
                          </div>

                          <details>
                            <summary>Solution & marking guide</summary>

                            <div className="solution">
                              <MathText text={q.solution} />

                              {q.rubric.map((c, i) => (
                                <p key={i}>
                                  {c.criterion}

                                  <span>{c.points} pts</span>
                                </p>
                              ))}
                            </div>
                          </details>

                          {r.selfReported && (
                            <label className="self-score">
                              Points earned
                              <select
                                value={attempt.selfScores[q.number] ?? ""}
                                onChange={(e) =>
                                  void act(async () => {
                                    await request(`attempts/${attempt.id}`, {
                                      selfScores: {
                                        [q.number]: Number(e.target.value),
                                      },
                                    });
                                  })
                                }
                              >
                                <option value="" disabled>
                                  Select rubric score
                                </option>

                                {Array.from(
                                  { length: q.points + 1 },

                                  (_, i) => (
                                    <option key={i} value={i}>
                                      {i} / {q.points}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          )}
                        </article>
                      );
                    })}
                  </>
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
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
          >
            <div className="section-heading">
              <h2 id="upload-title">Add course materials</h2>

              <button
                className="icon-button"
                aria-label="Close upload"
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
              and are sent to Meta only when you request analysis.
            </p>

            <label>
              Course name
              <input
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

            <p className="muted small">
              Only add materials you have permission to use. Label AI-generated
              exams as generated reference. VERA currently checks linear algebra
              development scenarios; Physics II support comes later.
            </p>

            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </button>

              <button
                className="primary"
                disabled={!files.length || busy}
                onClick={() =>
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
                  })
                }
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Plus size={16} />
                )}{" "}
                Save materials
              </button>
            </div>
          </section>
        </div>
      )}

      {source && (
        <div className="modal-backdrop">
          <section
            className="modal source-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Source page"
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
          </section>
        </div>
      )}
    </div>
  );
}

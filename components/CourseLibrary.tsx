"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { Packet, Revision, CheckedExam, Attempt } from "@/lib/contracts";
import { demoScenario } from "@/lib/demo-client";
import { TransformationDiagram } from "./Exhibits";

type Props = {
  packets: Packet[];
  revisions: Revision[];
  exams: CheckedExam[];
  attempts: Attempt[];
  now: number;
  busy: boolean;
  onUpload: () => void;
  onSample: () => void;
  onOpen: (
    packet: Packet,
    next: "packet" | "blueprint" | "exam" | "practice" | "results",
    examId?: string,
  ) => void;
};

export default function CourseLibrary({
  packets,
  revisions,
  exams,
  attempts,
  now,
  busy,
  onUpload,
  onSample,
  onOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "yours" | "samples">("all");
  const visible = useMemo(
    () =>
      packets.filter(
        (p) =>
          (filter === "all" ||
            (filter === "samples" ? p.fixture : !p.fixture)) &&
          `${p.name} ${p.documents.map((d) => d.name).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [packets, query, filter],
  );
  const openAttempts = attempts.filter(
    (attempt) =>
      !attempt.submittedAt &&
      exams.some(
        (exam) =>
          exam.id === attempt.examId &&
          packets.some((packet) => packet.id === exam.packetId),
      ),
  );
  const resume =
    openAttempts.find((attempt) => attempt.endsAt > now) || openAttempts[0];
  const expired = !!resume && resume.endsAt <= now;
  const resumeExam = exams.find((exam) => exam.id === resume?.examId);
  const resumePacket = packets.find(
    (packet) => packet.id === resumeExam?.packetId,
  );
  return (
    <div className="library-layout">
      <section className="library-main" aria-label="Course library">
        {resume && resumeExam && resumePacket && (
          <div className="resume-course">
            <div>
              <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
              <h2>{resumePacket.name}</h2>
              <p>
                {expired
                  ? "Your time limit has ended. Open the attempt to review the answers you saved."
                  : "Your practice attempt is open. The timer continues while you’re away."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => onOpen(resumePacket, "practice", resumeExam.id)}
            >
              {expired ? "Review ended attempt" : "Resume practice"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        <div className="library-toolbar">
          <div className="filter-tabs" aria-label="Filter courses" role="group">
            {(
              [
                ["all", "All courses"],
                ["yours", "Your materials"],
                ["samples", "Samples"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
                <span>
                  {
                    packets.filter(
                      (p) =>
                        value === "all" ||
                        (value === "samples" ? p.fixture : !p.fixture),
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <label className="course-search">
            <Search size={16} />
            <span className="sr-only">Search courses</span>
            <input
              placeholder="Find a course…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                aria-label="Clear course search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
        </div>
        <p className="sr-only" role="status">
          {visible.length} matching courses
        </p>
        <div className="library-list">
          {!packets.length ? (
            <div className="library-empty">
              <div className="empty-book">
                <BookOpen size={32} strokeWidth={1.3} />
                <span>01</span>
              </div>
              <h2>Start with one topic you want to practice.</h2>
              <p>
                Add your notes, a past exam, or a review sheet.
                <br />
                VERA will turn them into an exam plan you can review.
              </p>
              <button className="primary" onClick={onUpload}>
                <Plus size={16} /> Add course materials
              </button>
              <span className="empty-footnote">
                PDF, PNG, or JPEG · up to 40 pages
              </span>
            </div>
          ) : !visible.length ? (
            <div className="search-empty">
              <Search size={25} />
              <h2>No matching courses</h2>
              <p>Try another name or show all courses.</p>
              <button
                className="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="list-heading">
                <span>COURSE / MATERIALS</span>
                <span>NEXT STEP</span>
              </div>
              {visible.map((p, i) => {
                const pages = p.documents.reduce(
                  (n, d) => n + d.pages.length,
                  0,
                );
                const courseAttempts = attempts.filter(
                  (a) =>
                    !a.submittedAt &&
                    exams.some((e) => e.id === a.examId && e.packetId === p.id),
                );
                const openAttempt =
                  courseAttempts.find((a) => a.endsAt > now) ||
                  courseAttempts[0];
                const exam =
                    exams.find((e) => e.id === openAttempt?.examId) ||
                    exams.find((e) => e.packetId === p.id),
                  revision = revisions.find((r) => r.packetId === p.id);
                const completed = attempts.find(
                  (a) => a.examId === exam?.id && a.submittedAt,
                );
                const next = openAttempt
                  ? "practice"
                  : completed
                    ? "results"
                    : exam
                      ? "exam"
                      : revision
                        ? "blueprint"
                        : "packet";
                const status = openAttempt
                  ? openAttempt.endsAt <= now
                    ? "Time is up · review attempt"
                    : "Resume practice"
                  : completed
                    ? "Review results"
                    : exam
                      ? exam.ready
                        ? "Practice exam ready"
                        : "Review checking report"
                      : revision
                        ? revision.approved
                          ? "Ready to generate"
                          : "Review exam plan"
                        : "Ready to analyze";
                return (
                  <button
                    key={p.id}
                    className="course-row"
                    onClick={() => onOpen(p, next, exam?.id)}
                  >
                    <span
                      className={`course-cover cover-${i % 3}`}
                      aria-hidden="true"
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <BookOpen size={24} strokeWidth={1.3} />
                    </span>
                    <span className="course-detail">
                      <span className="course-title">{p.name}</span>
                      <span className="course-metadata">
                        {p.documents.length}{" "}
                        {p.documents.length === 1 ? "document" : "documents"}
                        <span>·</span>
                        {pages} {pages === 1 ? "page" : "pages"}
                        {p.fixture && (
                          <span className="sample-label">Saved example</span>
                        )}
                      </span>
                    </span>
                    <span className="course-next">
                      <span className={exam?.ready ? "course-ready" : ""}>
                        {exam?.ready && <Check size={13} />} {status}
                      </span>
                      <span className="course-date">
                        Added{" "}
                        {new Date(p.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                    <ArrowUpRight size={18} className="course-arrow" />
                  </button>
                );
              })}
              <button className="add-course-row" onClick={onUpload}>
                <Plus size={16} /> Add another course
              </button>
            </>
          )}
        </div>
        <div className="library-method">
          <div>
            <span>01</span>
            <h3>Bring your sources</h3>
            <p>
              Notes and past assessments define what belongs in your practice.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Shape your exam</h3>
            <p>Review the evidence. Adjust the topics, format, and time.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Work the whole problem</h3>
            <p>Use exhibits, check your reasoning, then practice the gaps.</p>
          </div>
        </div>
        <p className="library-note">
          <FileText size={15} /> Your materials remain separate from every
          generated practice document.
        </p>
      </section>
      <aside className="sample-desk" aria-label="Explore a sample assessment">
        <div className="sample-desk-heading">
          <span className="eyebrow">THE VERA DIFFERENCE</span>
          <span className="sample-marker">EXHIBIT 03</span>
        </div>
        <h2>
          The question is only
          <br />
          part of the picture.
        </h2>
        <p>
          Practice with the data and documents you need to work out the answer.
        </p>
        <div className="sample-sheet">
          <div className="sample-sheet-header">
            <span>
              NORTHSTAR
              <br />
              <strong>IMAGING LAB</strong>
            </span>
            <span>
              CALIBRATION
              <br />
              REPORT / 001
            </span>
          </div>
          <h3>
            A transformation,
            <br />
            made visible.
          </h3>
          <TransformationDiagram scenario={demoScenario} />
          <div className="sample-sheet-footer">
            <span>2D LINEAR TRANSFORMATION</span>
            <span>↗</span>
          </div>
        </div>
        <div className="sample-contents">
          <span>
            <Check size={13} /> 5 questions
          </span>
          <span>
            <Check size={13} /> 3 exhibits
          </span>
          <span>
            <Check size={13} /> Worked solutions
          </span>
        </div>
        <button className="sample-open" disabled={busy} onClick={onSample}>
          Open sample course <ArrowRight size={17} />
        </button>
        <p className="sample-disclosure">
          An authored example with synthetic data.
          <br />
          No live AI generation or credits used.
        </p>
      </aside>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Plus, Search, X } from "lucide-react";
import type { Packet, Revision, Attempt } from "@/lib/contracts";
import type { PublicCheckedExam } from "@/lib/assessment-access";

type Props = {
  packets: Packet[];
  revisions: Revision[];
  exams: PublicCheckedExam[];
  attempts: Attempt[];
  now: number;
  busy: boolean;
  onUpload: () => void;
  onGeneralSample: () => void;
  onIllustratedSample: () => void;
  onVectorSample?: () => void;
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
  onGeneralSample,
  onIllustratedSample,
  onVectorSample,
  onOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"yours" | "samples">("yours");
  const visible = useMemo(
    () =>
      packets.filter(
        (p) =>
          (filter === "samples" ? p.fixture : !p.fixture) &&
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
    openAttempts.find(
      (attempt) => attempt.mode === "untimed" || attempt.endsAt > now,
    ) || openAttempts[0];
  const expired = !!resume && resume.mode !== "untimed" && resume.endsAt <= now;
  const resumeExam = exams.find((exam) => exam.id === resume?.examId);
  const resumePacket = packets.find(
    (packet) => packet.id === resumeExam?.packetId,
  );
  return (
    <div className="course-collection">
      <section className="library-main" aria-label="Course library">
        {resume && resumeExam && resumePacket && (
          <div className="resume-course">
            <div>
              <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
              <h2>{resumePacket.name}</h2>
              <p>
                {expired
                  ? "Your time limit has ended. Open the attempt to review the answers you saved."
                  : resume.mode === "untimed"
                    ? "Your untimed practice is open. Continue at your pace."
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
        {packets.length > 0 && (
          <div className="library-toolbar">
            <div
              className="filter-tabs"
              aria-label="Filter courses"
              role="group"
            >
              {(
                [
                  ["yours", "Your courses"],
                  ["samples", "Saved examples"],
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
                      packets.filter((p) =>
                        value === "samples" ? p.fixture : !p.fixture,
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
        )}
        <p className="sr-only" role="status">
          {visible.length} matching courses
        </p>
        <div className="library-list">
          {!packets.some((p) => !p.fixture) && filter === "yours" && !query ? (
            <div className="library-empty">
              <h2>What are you studying?</h2>
              <p>
                Add notes, a past exam, or a reading.
                <br />
                We’ll help you shape them into practice.
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
              <p>Try another name or switch collections.</p>
              <button
                className="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("yours");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {visible.map((p) => {
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
                  courseAttempts.find(
                    (a) => a.mode === "untimed" || a.endsAt > now,
                  ) || courseAttempts[0];
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
                  ? openAttempt.mode !== "untimed" && openAttempt.endsAt <= now
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
                        : "Open materials";
                return (
                  <button
                    key={p.id}
                    className="course-row"
                    onClick={() => onOpen(p, next, exam?.id)}
                  >
                    <span className="course-spine" aria-hidden="true" />
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
                      <span>{status}</span>
                      <span className="course-date">
                        {p.documents
                          .slice(0, 2)
                          .map((d) => d.name)
                          .join(" · ")}
                        {p.documents.length > 2
                          ? ` +${p.documents.length - 2} more`
                          : ""}
                      </span>
                    </span>
                    <ArrowUpRight size={18} className="course-arrow" />
                  </button>
                );
              })}
            </>
          )}
        </div>
        <details className="example-disclosure">
          <summary>
            Explore a saved example <ArrowRight size={15} />
          </summary>
          <div>
            <p>
              Try original saved examples with written, numerical or drawing
              responses. Loading them uses no model credits.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={onGeneralSample}
            >
              Try evidence & decisions <ArrowRight size={15} />
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={onIllustratedSample}
            >
              Explore diagrams & documents <ArrowRight size={15} />
            </button>
            {onVectorSample && (
              <button
                className="text-button"
                disabled={busy}
                onClick={onVectorSample}
              >
                Try vector drawing <ArrowRight size={15} />
              </button>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, RotateCcw } from "lucide-react";
import type { Blueprint, Packet } from "@/lib/contracts";
import { planProblems } from "@/lib/plan-editor";

const formatLabels = {
  "multiple-choice": "Multiple choice",
  numeric: "Numeric answer",
  "short-answer": "Short answer",
  "worked-response": "Worked response",
  essay: "Essay",
  "free-response": "Written response",
};
const difficultyLabels = {
  routine: "Apply a method",
  transfer: "Use in a new context",
  synthesis: "Combine ideas",
};

export default function ExamPlanEditor({
  draft,
  packet,
  approved,
  dirty,
  busy,
  notice,
  onEdit,
  onSave,
  onGenerate,
  onReset,
  onSource,
}: {
  draft: Blueprint;
  packet: Packet;
  approved: boolean;
  dirty: boolean;
  busy: boolean;
  notice: string;
  onEdit: (value: Blueprint) => void;
  onSave: (approve: boolean) => void;
  onGenerate: () => void;
  onReset: () => void;
  onSource: (documentId: string, page: number) => void;
}) {
  const [validate, setValidate] = useState(false);
  const errors = validate ? planProblems(draft, packet) : [];
  const summary = useRef<HTMLDivElement>(null);
  function commit(approve: boolean) {
    setValidate(true);
    const problems = planProblems(draft, packet);
    if (problems.length) {
      requestAnimationFrame(() => {
        for (const problem of problems) {
          let parent = document.getElementById(problem.id)?.parentElement;
          while (parent) {
            if (parent instanceof HTMLDetailsElement) parent.open = true;
            parent = parent.parentElement;
          }
        }
        summary.current?.focus();
        summary.current?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      });
    } else onSave(approve);
  }
  function updateSlot(
    index: number,
    patch: Partial<Blueprint["slots"][number]>,
  ) {
    const slots = draft.slots.map((slot, i) =>
      i === index
        ? { ...slot, ...patch, basis: "student-selected" as const }
        : slot,
    );
    onEdit({
      ...draft,
      settingsBasis: "student-selected",
      slots,
      totalPoints: slots.reduce((sum, s) => sum + s.points, 0),
      minutes: slots.reduce((sum, s) => sum + s.minutes, 0),
    });
  }
  const errorFor = (id: string) => errors.find((e) => e.id === id);
  return (
    <section className="panel plan-editor" aria-labelledby="plan-heading">
      <div className="plan-primary">
        <div className="section-heading">
          <div>
            <h2 id="plan-heading">Question plan</h2>
            <p className="muted">
              {packet.fixture
                ? "A saved example, ready for you to adjust."
                : "Suggested from your files. Open a topic to make changes."}
            </p>
          </div>
        </div>
        {draft.schemaVersion !== 2 && (
          <p className="muted small">
            Saved legacy transformation plan. New course analyses and the
            evidence & decisions sample use subject-independent question
            formats.
          </p>
        )}
        {errors.length > 0 && (
          <div className="plan-errors" tabIndex={-1} ref={summary} role="alert">
            <h3>Check these details before continuing</h3>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>
                  <a
                    href={`#${e.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      const field = document.getElementById(e.id);
                      let parent = field?.parentElement;
                      while (parent) {
                        if (parent instanceof HTMLDetailsElement)
                          parent.open = true;
                        parent = parent.parentElement;
                      }
                      field?.focus();
                    }}
                  >
                    {e.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <fieldset disabled={busy} className="plan-fields">
          <div className="plan-proposal">
            <h3>{draft.title}</h3>
            <p>
              {draft.slots.length} questions · {draft.totalPoints} points ·{" "}
              {draft.minutes} minutes
            </p>
          </div>
          <details className="plan-identity">
            <summary>
              Title and subject <ChevronDown size={14} />
            </summary>
            <label htmlFor="plan-subject">Subject</label>
            <input
              id="plan-subject"
              value={draft.domain}
              maxLength={120}
              onChange={(event) =>
                onEdit({
                  ...draft,
                  settingsBasis: "student-selected",
                  domain: event.target.value,
                })
              }
            />
            <label htmlFor="plan-title">Exam title</label>
            <input
              id="plan-title"
              value={draft.title}
              maxLength={160}
              aria-invalid={!!errorFor("plan-title")}
              aria-describedby={
                errorFor("plan-title") ? "plan-title-error" : undefined
              }
              onChange={(e) =>
                onEdit({
                  ...draft,
                  settingsBasis: "student-selected",
                  title: e.target.value,
                })
              }
            />
            {errorFor("plan-title") && (
              <p className="inline-error" id="plan-title-error">
                {errorFor("plan-title")!.message}
              </p>
            )}
            <details className="plan-instructions">
              <summary>
                Exam instructions <ChevronDown size={14} />
              </summary>
              <label>
                Instructions
                <textarea
                  rows={3}
                  value={draft.instructions}
                  onChange={(e) =>
                    onEdit({ ...draft, instructions: e.target.value })
                  }
                />
              </label>
            </details>
          </details>
          <ol className="plan-slots">
            {draft.slots.map((slot, index) => (
              <li key={slot.number}>
                <details className="plan-question">
                  <summary>
                    <span className="proposal-number">
                      {String(slot.number).padStart(2, "0")}
                    </span>
                    <span className="proposal-topic">
                      <strong>{slot.topic || "Add a topic"}</strong>
                      <span>
                        {
                          {
                            "multiple-choice": "Multiple choice",
                            numeric: "Numeric answer",
                            "short-answer": "Short answer",
                            "worked-response": "Worked response",
                            essay: "Essay",
                            "free-response": "Written response",
                          }[slot.type]
                        }{" "}
                        · {slot.points} points · {slot.minutes} min
                      </span>
                    </span>
                    <ChevronDown size={15} />
                  </summary>
                  <div className="plan-question-fields">
                    <div className="plan-slot-heading">
                      <span className="slot-number">
                        {String(slot.number).padStart(2, "0")}
                      </span>
                      <span className="badge">
                        {(slot.basis || "legacy basis unrecorded").replaceAll(
                          "-",
                          " ",
                        )}
                      </span>
                      <label htmlFor={`plan-${index}-topic`}>
                        Topic for question {slot.number}
                      </label>
                    </div>
                    <input
                      id={`plan-${index}-topic`}
                      value={slot.topic}
                      aria-invalid={!!errorFor(`plan-${index}-topic`)}
                      onChange={(e) =>
                        updateSlot(index, { topic: e.target.value })
                      }
                    />
                    <div className="plan-slot-settings">
                      <label>
                        Format
                        <select
                          aria-label={`Question ${slot.number} format`}
                          value={slot.type}
                          onChange={(e) =>
                            updateSlot(index, {
                              type: e.target.value as typeof slot.type,
                            })
                          }
                        >
                          <option value="multiple-choice">
                            Multiple choice
                          </option>
                          {draft.schemaVersion === 2 && (
                            <>
                              <option value="numeric">Numeric answer</option>
                              <option value="short-answer">Short answer</option>
                              <option value="worked-response">
                                Worked response
                              </option>
                              <option value="essay">Essay</option>
                            </>
                          )}
                          {draft.schemaVersion !== 2 && (
                            <option value="free-response">
                              Written response (legacy)
                            </option>
                          )}
                        </select>
                      </label>
                      <label>
                        Points
                        <input
                          id={`plan-${index}-points`}
                          aria-label={`Question ${slot.number} points`}
                          type="number"
                          min={1}
                          max={100}
                          value={slot.points || ""}
                          aria-invalid={!!errorFor(`plan-${index}-points`)}
                          onChange={(e) =>
                            updateSlot(index, {
                              points: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Minutes
                        <input
                          id={`plan-${index}-minutes`}
                          aria-label={`Question ${slot.number} minutes`}
                          type="number"
                          min={1}
                          max={120}
                          value={slot.minutes || ""}
                          aria-invalid={!!errorFor(`plan-${index}-minutes`)}
                          onChange={(e) =>
                            updateSlot(index, {
                              minutes: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                    {(slot.type === "numeric" ||
                      slot.type === "multiple-choice") && (
                      <p className="muted small">
                        Key-based, all-or-nothing scoring. Choose a worked
                        response if you want to self-score method and partial
                        credit.
                      </p>
                    )}
                    {errors
                      .filter((e) => e.id.startsWith(`plan-${index}-`))
                      .map((e) => (
                        <p className="inline-error" key={e.id}>
                          {e.message}
                        </p>
                      ))}
                    <details className="plan-slot-context">
                      <summary>
                        Source evidence & difficulty <ChevronDown size={14} />
                      </summary>
                      <label>
                        Learning objective
                        <input
                          value={slot.objective || ""}
                          onChange={(event) =>
                            updateSlot(index, { objective: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Section
                        <input
                          value={slot.section || ""}
                          onChange={(event) =>
                            updateSlot(index, { section: event.target.value })
                          }
                        />
                      </label>
                      <p>{slot.pattern}</p>
                      <label>
                        Difficulty
                        <select
                          aria-label={`Question ${slot.number} difficulty`}
                          value={slot.difficulty}
                          onChange={(e) =>
                            updateSlot(index, {
                              difficulty: e.target
                                .value as typeof slot.difficulty,
                            })
                          }
                        >
                          <option value="routine">
                            Routine · apply a method
                          </option>
                          <option value="transfer">
                            Transfer · use it in a new context
                          </option>
                          <option value="synthesis">
                            Synthesis · combine ideas
                          </option>
                        </select>
                      </label>
                      <div className="plan-source-links">
                        {slot.evidence.map((ref, i) => (
                          <button
                            key={i}
                            className="source-link"
                            onClick={() => onSource(ref.documentId, ref.page)}
                          >
                            {packet.documents.find(
                              (d) => d.id === ref.documentId,
                            )?.name || "Source"}{" "}
                            · p. {ref.page}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </fieldset>
      </div>
      <aside className="plan-context" aria-label="Plan balance and evidence">
        <section
          className="assessment-outline"
          aria-labelledby="balance-heading"
        >
          <h3 id="balance-heading">Assessment outline</h3>
          <p className="plan-subject">
            <span>Subject</span>
            {draft.domain}
          </p>
          <h4>Question formats</h4>
          <ul className="balance-list">
            {Object.entries(formatLabels).map(([type, label]) => {
              const count = draft.slots.filter(
                (slot) => slot.type === type,
              ).length;
              return count ? (
                <li key={type}>
                  <span>{label}</span>
                  <span>{count}</span>
                </li>
              ) : null;
            })}
          </ul>
          <h4>Reasoning demands</h4>
          <ul className="balance-list">
            {Object.entries(difficultyLabels).map(([level, label]) => {
              const count = draft.slots.filter(
                (slot) => slot.difficulty === level,
              ).length;
              return count ? (
                <li key={level}>
                  <span>{label}</span>
                  <span>{count}</span>
                </li>
              ) : null;
            })}
          </ul>
          <p className="plan-basis">
            Settings:{" "}
            {(draft.settingsBasis || "legacy basis unrecorded").replaceAll(
              "-",
              " ",
            )}
          </p>
          <label className="visual-mode">
            Diagram rendering
            <select
              aria-label="Diagram rendering"
              disabled={busy || packet.fixture}
              value={draft.visuals || "auto"}
              onChange={(event) =>
                onEdit({
                  ...draft,
                  visuals: event.target.value as Blueprint["visuals"],
                  settingsBasis: "student-selected",
                })
              }
            >
              <option value="auto">Choose for this subject</option>
              <option value="muse-image">Muse Image · AI illustrations</option>
              <option value="precise">Precise SVG diagrams</option>
            </select>
          </label>
          <p className="visual-mode-note">
            {packet.fixture
              ? "Saved examples keep their authored visuals."
              : "Image figures receive AI visual review. Exact given data stays available as text."}
          </p>
        </section>
        {draft.uncertainties.length > 0 && (
          <details className="plan-assumptions" open>
            <summary>
              Assumptions to review <ChevronDown size={15} />
            </summary>
            <ul>
              {draft.uncertainties.map((uncertainty, index) => (
                <li key={index}>{uncertainty}</li>
              ))}
            </ul>
          </details>
        )}
        <details className="plan-evidence">
          <summary>Why these topics?</summary>
          <section className="evidence-panel">
            {draft.observations.length === 0 && (
              <p className="muted">
                No topic rationale was recorded for this saved plan. Inspect
                each question’s source evidence before approval.
              </p>
            )}
            {draft.observations.map((observation, index) => (
              <div className="observation" key={index}>
                <span className="evidence-basis">
                  {observation.kind.replaceAll("-", " ")}
                </span>
                <p>{observation.text}</p>
                {observation.evidence.map((ref, i) => (
                  <button
                    key={i}
                    className="source-link"
                    onClick={() => onSource(ref.documentId, ref.page)}
                  >
                    {packet.documents.find(
                      (document) => document.id === ref.documentId,
                    )?.name || "Source"}{" "}
                    · p. {ref.page}
                  </button>
                ))}
              </div>
            ))}
          </section>
        </details>
      </aside>
      <footer className="plan-footer">
        <div className="plan-commit" id="plan-totals" tabIndex={-1}>
          <div>
            <p role="status">
              {notice ||
                (dirty
                  ? "Changes kept in this browser · save or approve to update your plan"
                  : approved
                    ? "Approved plan · ready to generate"
                    : "Review this plan, then approve it to continue.")}
            </p>
          </div>
          <div className="plan-commit-actions">
            {dirty && (
              <button
                className="icon-button"
                title="Discard edits"
                aria-label="Discard edits"
                disabled={busy}
                onClick={() => {
                  onReset();
                  setValidate(false);
                }}
              >
                <RotateCcw size={16} />
              </button>
            )}
            {dirty && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => commit(false)}
              >
                Save draft
              </button>
            )}
            {approved && !dirty ? (
              <button className="primary" disabled={busy} onClick={onGenerate}>
                Generate practice exam <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy}
                onClick={() => commit(true)}
              >
                <Check size={16} /> Approve exam plan
              </button>
            )}
          </div>
        </div>
        <p className="muted small plan-disclaimer">
          Approval confirms your practice settings. This plan does not predict
          your next exam. Editing an approved plan requires approval again.
        </p>
      </footer>
    </section>
  );
}

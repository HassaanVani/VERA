"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, RotateCcw } from "lucide-react";
import type { Blueprint, Packet } from "@/lib/contracts";
import { planProblems } from "@/lib/plan-editor";

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
    if (planProblems(draft, packet).length) {
      requestAnimationFrame(() => {
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
      i === index ? { ...slot, ...patch } : slot,
    );
    onEdit({
      ...draft,
      slots,
      totalPoints: slots.reduce((sum, s) => sum + s.points, 0),
      minutes: slots.reduce((sum, s) => sum + s.minutes, 0),
    });
  }
  const errorFor = (id: string) => errors.find((e) => e.id === id);
  return (
    <section className="panel plan-editor" aria-labelledby="plan-heading">
      <div className="section-heading">
        <div>
          <h2 id="plan-heading">Question plan</h2>
          <p className="muted">
            Review the topics first. Adjust the format, marks, and timing where
            needed.
          </p>
        </div>
      </div>
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
                    document.getElementById(e.id)?.focus();
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
        <label htmlFor="plan-title">Exam title</label>
        <input
          id="plan-title"
          value={draft.title}
          maxLength={160}
          aria-invalid={!!errorFor("plan-title")}
          aria-describedby={
            errorFor("plan-title") ? "plan-title-error" : undefined
          }
          onChange={(e) => onEdit({ ...draft, title: e.target.value })}
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
        <ol className="plan-slots">
          {draft.slots.map((slot, index) => (
            <li key={slot.number}>
              <div className="plan-slot-heading">
                <span className="slot-number">
                  {String(slot.number).padStart(2, "0")}
                </span>
                <label htmlFor={`plan-${index}-topic`}>
                  Topic for question {slot.number}
                </label>
              </div>
              <input
                id={`plan-${index}-topic`}
                value={slot.topic}
                aria-invalid={!!errorFor(`plan-${index}-topic`)}
                onChange={(e) => updateSlot(index, { topic: e.target.value })}
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
                    <option value="multiple-choice">Multiple choice</option>
                    <option value="free-response">Written response</option>
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
                      updateSlot(index, { points: Number(e.target.value) })
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
                      updateSlot(index, { minutes: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
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
                <p>{slot.pattern}</p>
                <label>
                  Difficulty
                  <select
                    aria-label={`Question ${slot.number} difficulty`}
                    value={slot.difficulty}
                    onChange={(e) =>
                      updateSlot(index, {
                        difficulty: e.target.value as typeof slot.difficulty,
                      })
                    }
                  >
                    <option value="routine">Routine · apply a method</option>
                    <option value="transfer">
                      Transfer · use it in a new context
                    </option>
                    <option value="synthesis">Synthesis · combine ideas</option>
                  </select>
                </label>
                <div className="plan-source-links">
                  {slot.evidence.map((ref, i) => (
                    <button
                      key={i}
                      className="source-link"
                      onClick={() => onSource(ref.documentId, ref.page)}
                    >
                      {packet.documents.find((d) => d.id === ref.documentId)
                        ?.name || "Source"}{" "}
                      · p. {ref.page}
                    </button>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </fieldset>
      <div className="plan-commit" id="plan-totals" tabIndex={-1}>
        <div>
          <strong>
            {draft.slots.length} questions <span>·</span> {draft.totalPoints}{" "}
            points <span>·</span> {draft.minutes} minutes
          </strong>
          <p role="status">
            {notice ||
              (dirty
                ? "Draft changes · approval required before generation"
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
    </section>
  );
}

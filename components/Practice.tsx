"use client";
import { useState, useEffect, useRef } from "react";
import {
  Clock3,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flag,
  RotateCcw,
} from "lucide-react";
import type { Attempt } from "@/lib/contracts";
import type { PublicCheckedExam } from "@/lib/assessment-access";
import MathText from "./MathText";
import Exhibits from "./Exhibits";
import Dialog from "./Dialog";
import useAttemptResponses from "./useAttemptResponses";

export default function Practice({
  attempt,
  exam,
  onSubmit,
  onExit,
  update,
  onSource,
}: {
  attempt: Attempt;
  exam: PublicCheckedExam;
  onSubmit: () => void;
  onExit: () => void;
  update: (path: string, body: unknown) => Promise<unknown>;
  onSource?: (documentId: string, page: number) => void;
}) {
  const navigationKey = `vera:practice-nav:${attempt.id}`;
  const [{ index, flags }, setNavigation] = useState<{
    index: number;
    flags: number[];
  }>(() => {
    try {
      const cached = JSON.parse(
        sessionStorage.getItem(navigationKey) || "null",
      );
      return {
        index:
          cached &&
          Number.isInteger(cached.index) &&
          cached.index >= 0 &&
          cached.index < exam.exam.questions.length
            ? cached.index
            : 0,
        flags: Array.isArray(cached?.flags)
          ? cached.flags.filter(
              (n: unknown) =>
                Number.isInteger(n) &&
                exam.exam.questions.some((q) => q.number === n),
            )
          : [],
      };
    } catch {
      return { index: 0, flags: [] };
    }
  });
  const [now, setNow] = useState(() => Date.now()),
    [error, setError] = useState("");
  const [timerHidden, setTimerHidden] = useState(false);
  const [submitting, setSubmitting] = useState(false),
    [mobilePane, setMobilePane] = useState("questions");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const {
    responses,
    status,
    error: saveError,
    answer,
    flush,
    waitForSave,
  } = useAttemptResponses(attempt, update);
  const finishing = useRef(false),
    submitRef = useRef<() => void>(() => {}),
    heading = useRef<HTMLHeadingElement>(null);
  const q = exam.exam.questions[index],
    seconds = Math.max(0, Math.ceil((attempt.endsAt - now) / 1000));
  const untimed = attempt.mode === "untimed";
  const hasMaterial =
    !!exam.scenario ||
    (exam.exam.exhibits ?? []).some((e) => q.exhibitIds.includes(e.id));
  const answered = exam.exam.questions.filter((question) =>
    responses[question.number]?.trim(),
  ).length;
  function chooseQuestion(next: number) {
    const trigger = document.activeElement;
    const leavingReview = confirmFinish;
    setNavigation({ index: next, flags });
    setMobilePane("questions");
    setConfirmFinish(false);
    try {
      sessionStorage.setItem(
        navigationKey,
        JSON.stringify({ index: next, flags }),
      );
    } catch {}
    requestAnimationFrame(() => {
      const focused = document.activeElement;
      // A student may already have moved into the answer before this frame.
      if (focused?.matches("input, textarea, select")) return;
      if (focused !== trigger && focused !== document.body && !leavingReview)
        return;
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }
  function toggleFlag() {
    const next = flags.includes(q.number)
      ? flags.filter((n) => n !== q.number)
      : [...flags, q.number];
    setNavigation({ index, flags: next });
    try {
      sessionStorage.setItem(
        navigationKey,
        JSON.stringify({ index, flags: next }),
      );
    } catch {}
  }
  async function submit() {
    if (finishing.current) return;
    finishing.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (Date.now() < attempt.endsAt) await flush();
      else await waitForSave();
      await update(`attempts/${attempt.id}`, { submit: true });
      onSubmit();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your attempt could not be submitted. Try again.",
      );
      finishing.current = false;
      setSubmitting(false);
      setConfirmFinish(false);
    }
  }
  useEffect(() => {
    submitRef.current = () => {
      void submit();
    };
  });
  useEffect(() => {
    if (untimed) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [untimed]);
  useEffect(() => {
    if (!untimed && !seconds) submitRef.current();
  }, [seconds, untimed]);
  const saveLabel =
    status === "error"
      ? "Answers not saved"
      : status === "saving" || status === "unsaved"
        ? "Saving answers…"
        : "Answers saved on this device’s VERA server";
  return (
    <>
      <div className="practice-bar">
        <div>
          <span className="eyebrow">PRACTICE SESSION</span>
          <h2>{exam.exam.title}</h2>
          {exam.fixture && (
            <span className="practice-disclosure">
              Saved example · no live generation
            </span>
          )}
        </div>
        <div className="practice-tools">
          <button
            className="secondary"
            onClick={() => setConfirmFinish(true)}
            disabled={submitting}
          >
            Finish attempt
          </button>
          {!untimed && (
            <button
              className="text-button timer-toggle"
              onClick={() => setTimerHidden(!timerHidden)}
              disabled={seconds <= 60}
            >
              {timerHidden && seconds > 60 ? "Show timer" : "Hide timer"}
            </button>
          )}
          {!untimed && (!timerHidden || seconds <= 60) && (
            <div
              className={`timer ${seconds < 60 ? "urgent" : ""}`}
              role="timer"
              aria-label="Time remaining"
            >
              <Clock3 size={18} />
              {Math.floor(seconds / 60)
                .toString()
                .padStart(2, "0")}
              :{(seconds % 60).toString().padStart(2, "0")}
            </div>
          )}
          {untimed && <span className="badge">Untimed practice</span>}
        </div>
      </div>
      <div className="practice-progress">
        <span>
          {answered} of {exam.exam.questions.length} answered{" "}
          {flags.length > 0 && `· ${flags.length} flagged`}
        </span>
        <span role="status">{saveLabel}</span>
      </div>
      <p className="sr-only" role="status">
        {!untimed && seconds <= 60 && seconds > 0
          ? "One minute or less remains. Finish your answers and review your attempt."
          : ""}
      </p>
      {hasMaterial && (
        <div
          className="study-pane-switch"
          role="group"
          aria-label="Practice workspace"
        >
          <button
            aria-pressed={mobilePane === "questions"}
            onClick={() => setMobilePane("questions")}
          >
            Questions
          </button>
          <button
            aria-pressed={mobilePane === "exhibits"}
            onClick={() => setMobilePane("exhibits")}
          >
            Supporting exhibits
          </button>
        </div>
      )}
      <div
        className={`exam-layout practice-layout assessment-desk ${hasMaterial ? "with-reference" : "without-material reading-only"}`}
        data-mobile-pane={mobilePane}
      >
        <div className="practice-questions">
          <nav className="question-dots" aria-label="Choose question">
            {exam.exam.questions.map((question, i) => (
              <button
                key={question.number}
                className={
                  i === index
                    ? "active"
                    : responses[question.number]?.trim()
                      ? "answered"
                      : ""
                }
                onClick={() => chooseQuestion(i)}
                aria-current={index === i ? "step" : undefined}
                aria-label={`Question ${question.number}${responses[question.number]?.trim() ? ", answered" : ""}${flags.includes(question.number) ? ", flagged" : ""}`}
              >
                {question.number}
                {flags.includes(question.number) ? (
                  <Flag
                    className="flag-indicator"
                    size={12}
                    aria-hidden="true"
                  />
                ) : (
                  responses[question.number]?.trim() && (
                    <CheckCircle2
                      className="answer-indicator"
                      size={11}
                      aria-hidden="true"
                    />
                  )
                )}
              </button>
            ))}
          </nav>
          <div
            className="question-nav-legend"
            aria-label="Question status legend"
          >
            <span>
              <CheckCircle2 size={12} /> Answered
            </span>
            <span>
              <Flag size={12} /> Flagged for review
            </span>
          </div>
          <article className="question-card question-sheet">
            <div className="question-meta">
              <span>
                QUESTION {q.number} / {exam.exam.questions.length}
              </span>
              <span>{q.points} points</span>
            </div>
            <div className="question-topic">
              <span className="sheet-topic">{q.section || q.topic}</span>
              <button
                className="text-button flag-button"
                aria-pressed={flags.includes(q.number)}
                onClick={toggleFlag}
              >
                <Flag size={14} />
                {flags.includes(q.number)
                  ? "Flagged for review"
                  : "Flag for review"}
              </button>
            </div>
            <h3 ref={heading} tabIndex={-1}>
              <MathText text={q.question} />
            </h3>
            <details className="question-scoring">
              <summary>Scoring & objective</summary>
              {q.objective && <p>{q.objective}</p>}
              <p>
                {q.type === "multiple-choice" || q.type === "numeric"
                  ? `Key match: ${q.points} points or zero. ${q.type === "numeric" ? "Only the final value and requested unit are scored." : "Choose one option."}`
                  : "Use the marking guide after submission to self-score your written response."}
              </p>
            </details>
            {q.subparts?.map((part) => (
              <p key={part.label}>
                <strong>
                  {part.label} ({part.points} points)
                </strong>{" "}
                <MathText text={part.prompt} />
              </p>
            ))}
            {hasMaterial && (
              <p className="muted small">
                Use the supporting material for this question.
              </p>
            )}
            {q.type === "multiple-choice" ? (
              <fieldset className="options">
                <legend className="sr-only">Select an answer</legend>
                {q.options.map((option, i) => (
                  <label
                    key={i}
                    className={
                      responses[q.number] === String.fromCharCode(65 + i)
                        ? "selected"
                        : ""
                    }
                  >
                    <input
                      type="radio"
                      name={`q${q.number}`}
                      disabled={submitting || !seconds}
                      checked={
                        responses[q.number] === String.fromCharCode(65 + i)
                      }
                      onChange={() =>
                        answer(q.number, String.fromCharCode(65 + i))
                      }
                    />
                    <span className="option-letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <MathText text={option} />
                  </label>
                ))}
              </fieldset>
            ) : (
              <label className="response-label">
                {q.type === "numeric"
                  ? "Your answer, including the requested unit"
                  : "Your reasoning"}
                <textarea
                  value={responses[q.number] || ""}
                  maxLength={20000}
                  disabled={submitting || !seconds}
                  onChange={(event) => answer(q.number, event.target.value)}
                  placeholder={
                    q.type === "numeric"
                      ? "Enter your answer…"
                      : "Write your response. Include working where needed…"
                  }
                  rows={q.type === "numeric" ? 2 : 8}
                />
              </label>
            )}
            {(saveError || error) && (
              <div className="answer-save-error" role="alert">
                <strong>
                  {error
                    ? "Your attempt is still open."
                    : "Your latest answers haven’t reached VERA."}
                </strong>
                <p>
                  {error || saveError} Keep this tab open and retry. Your text
                  is still here.
                </p>
                <button
                  className="secondary"
                  disabled={submitting || !seconds}
                  onClick={() => {
                    void flush().catch(() => {});
                  }}
                >
                  <RotateCcw size={14} /> Retry saving
                </button>
              </div>
            )}
            <div className="question-footer">
              <button
                className="secondary"
                disabled={index === 0}
                onClick={() => chooseQuestion(index - 1)}
              >
                <ArrowLeft size={15} /> Previous
              </button>
              {index < exam.exam.questions.length - 1 ? (
                <button
                  className="primary"
                  onClick={() => chooseQuestion(index + 1)}
                >
                  Next question <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={submitting}
                  onClick={() => setConfirmFinish(true)}
                >
                  {submitting ? "Submitting…" : "Finish practice"}{" "}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </article>
          <div className="practice-exit">
            <p className="muted small">
              {untimed
                ? "Your untimed attempt stays open until you finish."
                : "The timer keeps running if you leave."}{" "}
              Return from the course library to resume.
            </p>
            <button
              className="text-button"
              disabled={submitting}
              onClick={() => {
                void flush()
                  .then(onExit)
                  .catch(() => {});
              }}
            >
              Save & leave practice <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <Exhibits
          scenario={exam.scenario}
          exhibits={exam.exam.exhibits}
          ids={q.exhibitIds}
          onSource={onSource}
          imageExhibits={exam.imageExhibits}
        />
      </div>
      {confirmFinish && (
        <Dialog
          titleId="finish-title"
          onDismiss={() => setConfirmFinish(false)}
          locked={submitting}
          className="finish-dialog"
        >
          <span className="eyebrow">REVIEW BEFORE YOU FINISH</span>
          <h2 id="finish-title">Finish this attempt?</h2>
          <p>
            You answered {answered} of {exam.exam.questions.length} questions.{" "}
            {exam.exam.questions.length - answered > 0
              ? `${exam.exam.questions.length - answered} unanswered questions will receive no points.`
              : "All questions have a response."}
          </p>
          <div className="attempt-review-list">
            {exam.exam.questions.map((question, i) => (
              <button key={question.number} onClick={() => chooseQuestion(i)}>
                <span>
                  Question {question.number}
                  <small>{question.topic}</small>
                </span>
                <span>
                  {flags.includes(question.number) && <Flag size={13} />}
                  {responses[question.number]?.trim()
                    ? "Answered"
                    : "Unanswered"}
                  <ArrowRight size={14} />
                </span>
              </button>
            ))}
          </div>
          <p className="muted">
            Select any question to return to it. Finishing locks your answers
            and opens the solutions.{" "}
            {untimed
              ? "There is no time limit."
              : "The timer keeps running until you finish."}
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              autoFocus
              onClick={() => setConfirmFinish(false)}
            >
              Keep working
            </button>
            <button
              className="primary"
              disabled={submitting}
              onClick={() => {
                void submit();
              }}
            >
              Finish & view results <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

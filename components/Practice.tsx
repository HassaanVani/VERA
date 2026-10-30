"use client";
import { useState, useEffect, useRef } from "react";
import { Clock3, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Attempt, CheckedExam } from "@/lib/contracts";
import MathText from "./MathText";
import Exhibits from "./Exhibits";
export default function Practice({
  attempt,
  exam,
  onSubmit,
  update,
}: {
  attempt: Attempt;
  exam: CheckedExam;
  onSubmit: () => void;
  update: (path: string, body: unknown) => Promise<unknown>;
}) {
  const [responses, setResponses] = useState(attempt.responses),
    [index, setIndex] = useState(0),
    [now, setNow] = useState(() => Date.now()),
    [pending, setPending] = useState(0),
    [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [mobilePane, setMobilePane] = useState("questions"),
    [confirmFinish, setConfirmFinish] = useState(false);
  const finishButton = useRef<HTMLButtonElement>(null);
  const keepWorking = useRef<HTMLButtonElement>(null);
  const answered = Object.values(responses).filter((v) => v.trim()).length;
  useEffect(() => {
    if (!confirmFinish) return;
    const previous = document.activeElement as HTMLElement | null;
    keepWorking.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmFinish(false);
      if (
        event.key === "Tab" &&
        event.shiftKey &&
        document.activeElement === keepWorking.current
      ) {
        event.preventDefault();
        finishButton.current?.focus();
      } else if (
        event.key === "Tab" &&
        !event.shiftKey &&
        document.activeElement === finishButton.current
      ) {
        event.preventDefault();
        keepWorking.current?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [confirmFinish]);
  const chain = useRef(Promise.resolve()),
    finishing = useRef(false),
    submitRef = useRef<() => void>(() => {});
  const q = exam.exam.questions[index],
    seconds = Math.max(0, Math.ceil((attempt.endsAt - now) / 1000));
  function answer(value: string) {
    if (finishing.current || seconds <= 0) return;
    const next = { ...responses, [q.number]: value };
    setResponses(next);
    setPending((p) => p + 1);
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        try {
          await update(`attempts/${attempt.id}`, { responses: next });
          setError("");
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Response could not be saved. Re-enter it to retry.",
          );
          throw e;
        } finally {
          setPending((p) => p - 1);
        }
      });
    void chain.current.catch(() => {});
  }
  async function submit() {
    if (finishing.current) return;
    finishing.current = true;
    setSubmitting(true);
    try {
      await chain.current.catch(() => {});
      if (Date.now() < attempt.endsAt)
        await update(`attempts/${attempt.id}`, { responses });
      await update(`attempts/${attempt.id}`, { submit: true });
      onSubmit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Retry.");
      finishing.current = false;
      setSubmitting(false);
    }
  }
  useEffect(() => {
    submitRef.current = () => {
      void submit();
    };
  });
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!seconds) submitRef.current();
  }, [seconds]);
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
            disabled={submitting || pending > 0}
          >
            Finish attempt
          </button>
          <div
            className={`timer ${seconds < 60 ? "urgent" : ""}`}
            role="timer"
            aria-label="Time remaining"
          >
            <Clock3 size={18} />{" "}
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
            :{(seconds % 60).toString().padStart(2, "0")}
          </div>
        </div>
      </div>
      <div className="practice-progress">
        <span>
          {answered} of {exam.exam.questions.length} answered
        </span>
        <span>Answers save automatically</span>
      </div>
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
      <div
        className="exam-layout practice-layout"
        data-mobile-pane={mobilePane}
      >
        <div className="practice-questions">
          <nav className="question-dots" aria-label="Choose question">
            {exam.exam.questions.map((n, i) => (
              <button
                key={n.number}
                className={
                  i === index ? "active" : responses[n.number] ? "answered" : ""
                }
                onClick={() => {
                  setIndex(i);
                  setMobilePane("questions");
                }}
                aria-current={index === i ? "step" : undefined}
                aria-label={`Question ${n.number}${responses[n.number] ? ", answered" : ""}`}
              >
                {n.number}
                {responses[n.number] && (
                  <CheckCircle2
                    className="answer-indicator"
                    size={11}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </nav>
          <article className="panel question-card">
            <div className="question-meta">
              <span>
                QUESTION {q.number} / {exam.exam.questions.length}
              </span>
              <span>{q.points} points</span>
            </div>
            <span className="badge">{q.topic}</span>
            <h3>
              <MathText text={q.question} />
            </h3>
            <p className="muted small">
              Use exhibits: {q.exhibitIds.join(", ")}
            </p>
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
                      onChange={() => answer(String.fromCharCode(65 + i))}
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
                Your reasoning
                <textarea
                  value={responses[q.number] || ""}
                  disabled={submitting || !seconds}
                  onChange={(e) => answer(e.target.value)}
                  placeholder="Show your working and explain your answer…"
                  rows={9}
                />
              </label>
            )}
            <div className="question-footer">
              <span className="muted small" role="status">
                {pending ? "Saving…" : "Responses saved locally"}
              </span>
              {index < exam.exam.questions.length - 1 ? (
                <button className="primary" onClick={() => setIndex(index + 1)}>
                  Next question <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={submitting || pending > 0}
                  onClick={() => setConfirmFinish(true)}
                >
                  {submitting ? "Submitting…" : "Finish practice"}{" "}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </article>
          <p className="muted small">
            The timer continues across refreshes. Answers lock when time
            expires.
          </p>
        </div>
        <Exhibits scenario={exam.scenario} />
      </div>
      {confirmFinish && (
        <div className="modal-backdrop">
          <section
            className="modal finish-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-title"
          >
            <span className="eyebrow">REVIEW BEFORE YOU FINISH</span>
            <h2 id="finish-title">Finish this attempt?</h2>
            <p>
              You answered {answered} of {exam.exam.questions.length} questions.{" "}
              {exam.exam.questions.length - answered > 0
                ? `${exam.exam.questions.length - answered} unanswered questions will receive no points.`
                : "Your responses are ready to review."}
            </p>
            <p className="muted">
              Your answers will lock. Next, you can read the solutions and score
              your written work. The timer keeps running until you finish.
            </p>
            <div className="modal-actions">
              <button
                ref={keepWorking}
                className="secondary"
                onClick={() => setConfirmFinish(false)}
              >
                Keep working
              </button>
              <button
                ref={finishButton}
                className="primary"
                disabled={submitting}
                onClick={() => {
                  setConfirmFinish(false);
                  void submit();
                }}
              >
                Finish & view results <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

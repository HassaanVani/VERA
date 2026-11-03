"use client";
import { useEffect, useState } from "react";
import type {
  Attempt,
  CheckedExam,
  FeedbackRecord,
  Packet,
  Revision,
} from "@/lib/contracts";
import { results } from "@/lib/domain";
import MathText from "./MathText";

type Solution = {
  exam: CheckedExam;
  feedback: FeedbackRecord[];
  suggestions: FeedbackRecord[];
};
const basisLabel = {
  "automatically-checked": "Automatically checked",
  "ai-suggestion": "AI suggestion",
  "self-scored": "Self-scored",
  "needs-review": "Needs review",
};
export default function Review({
  attempt,
  packet,
  api,
  refresh,
  onPlan,
  onSource,
  feedbackRevision,
  canSuggest,
}: {
  attempt: Attempt;
  packet: Packet;
  api: (route: string, body?: unknown) => Promise<unknown>;
  refresh: () => Promise<unknown>;
  onPlan: (revision: Revision) => void;
  onSource: (documentId: string, page: number) => void;
  feedbackRevision?: string;
  canSuggest: boolean;
}) {
  const [data, setData] = useState<Solution>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState("");
  const scores = JSON.stringify(attempt.selfScores);
  useEffect(() => {
    let active = true;
    void api(`attempts/${attempt.id}/solutions`)
      .then((value) => {
        if (active) setData(value as Solution);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [attempt.id, scores, feedbackRevision, version, api]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      setVersion((n) => n + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="panel">
        <h2>Opening your review</h2>
        <p role="status">
          {error || "Loading the solutions for your submitted attempt…"}
        </p>
        {error && (
          <button
            className="secondary"
            onClick={() => {
              setError("");
              setVersion((n) => n + 1);
            }}
          >
            Retry opening review
          </button>
        )}
      </section>
    );
  const { exam } = data,
    rows = results(exam, attempt);
  const automatic = rows.filter((r) => !r.selfReported),
    self = rows.filter(
      (r) => r.selfReported && attempt.selfScores[r.number] !== undefined,
    ),
    pending = rows.filter(
      (r) => r.selfReported && attempt.selfScores[r.number] === undefined,
    );
  const sum = (items: typeof rows, key: "earned" | "possible") =>
    items.reduce((n, r) => n + r[key], 0);
  return (
    <div className="review-workspace" aria-busy={busy}>
      <div className="review-summary">
        <section className="panel">
          <span className="eyebrow">AUTOMATICALLY CHECKED</span>
          <h2>
            {sum(automatic, "earned")} / {sum(automatic, "possible")}
          </h2>
          <p>
            Key matches and supported numeric answers. This does not verify
            every explanation.
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">SELF-SCORED</span>
          <h2>
            {sum(self, "earned")} / {sum(self, "possible")}
          </h2>
          <p>
            {self.length} written {self.length === 1 ? "answer" : "answers"}{" "}
            scored by you.
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">NEEDS REVIEW</span>
          <h2>
            {pending.length} written{" "}
            {pending.length === 1 ? "answer" : "answers"}
          </h2>
          <p>
            {pending.length
              ? "Score so far · written answers pending"
              : "All written answers have a self-score."}
          </p>
          {pending.length > 0 && (
            <button
              className="text-button"
              onClick={() => {
                const el = document.getElementById(
                  `score-question-${pending[0].number}`,
                );
                el?.focus();
                el?.scrollIntoView({ block: "center" });
              }}
            >
              Score next written answer
            </button>
          )}
        </section>
      </div>
      <section className="panel review-next">
        <div>
          <h2>Choose what to practice next.</h2>
          <p>
            {pending.length
              ? "Use the criteria below to score your written work. Then review a focused practice plan."
              : "Review a short plan based on the objectives you missed. You can adjust it before generating."}
          </p>
          <small>
            Written performance and related recommendations are self-reported;
            they do not establish mastery.
          </small>
        </div>
        <button
          className="primary"
          disabled={busy || pending.length > 0}
          onClick={() =>
            void run(async () =>
              onPlan((await api("follow-up", { examId: exam.id })) as Revision),
            )
          }
        >
          Create focused practice
        </button>
      </section>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="review-ai-action">
        <p>
          Want another explanation? AI suggestions use your saved answer and
          course evidence. They never change your score.
        </p>
        <button
          className="secondary"
          disabled={busy || !canSuggest}
          onClick={() =>
            void run(async () => {
              await api(`attempts/${attempt.id}/feedback`, {});
              setNotice(
                "AI suggestions requested. You can keep reviewing while they are prepared.",
              );
            })
          }
        >
          {data.suggestions.length
            ? "Refresh AI suggestions"
            : "Get AI suggestions"}
        </button>
      </div>
      <nav className="review-question-nav" aria-label="Review questions">
        <span>Jump to question</span>
        {rows.map((row) => (
          <button
            key={row.number}
            className="secondary"
            aria-label={`Review question ${row.number}: ${row.topic}, ${row.selfReported && attempt.selfScores[row.number] === undefined ? "needs a score" : `${row.earned} of ${row.possible} points`}`}
            onClick={() => {
              const target = document.getElementById(
                `review-question-${row.number}`,
              );
              target?.focus({ preventScroll: true });
              target?.scrollIntoView({ block: "start", behavior: "smooth" });
            }}
          >
            {row.number}
            <small>
              {row.selfReported && attempt.selfScores[row.number] === undefined
                ? "Pending"
                : `${row.earned}/${row.possible}`}
            </small>
          </button>
        ))}
      </nav>
      {exam.exam.questions.map((q) => {
        const row = rows.find((r) => r.number === q.number)!,
          response = attempt.responses[q.number] ?? "",
          feedback = data.feedback.find((f) => f.question === q.number),
          suggestions = data.suggestions.filter((f) => f.question === q.number);
        return (
          <article className="panel result-question review-item" key={q.number}>
            <header className="result-line">
              <span className="slot-number">
                {String(q.number).padStart(2, "0")}
              </span>
              <div>
                <h3 id={`review-question-${q.number}`} tabIndex={-1}>
                  {q.topic}
                </h3>
                <span className="muted small">
                  {q.objective || "Review the reasoning and criteria"}
                </span>
              </div>
              <strong>
                {row.selfReported && attempt.selfScores[q.number] === undefined
                  ? "Pending"
                  : row.earned}{" "}
                / {q.points}
              </strong>
            </header>
            <MathText text={q.question} />
            <div className="review-pair">
              <section className="your-response">
                <h4>Your answer</h4>
                <MathText
                  text={
                    q.type === "multiple-choice" && response
                      ? `${response}. ${q.options[response.charCodeAt(0) - 65] ?? ""}`
                      : response || "No response recorded"
                  }
                />
              </section>
              <section>
                <h4>
                  {row.selfReported
                    ? "Scoring criteria"
                    : "Automatic scoring rule"}
                </h4>
                {!row.selfReported && (
                  <p>
                    {q.type === "numeric"
                      ? "Match the final value within the stated tolerance and include the requested unit."
                      : "Select the answer that matches the key."}{" "}
                    This item awards all {q.points} points or zero. Written
                    method is not automatically graded.
                  </p>
                )}
                {row.selfReported && (
                  <ol>
                    {q.rubric.map((criterion, i) => (
                      <li key={i}>
                        {criterion.criterion}{" "}
                        <strong>{criterion.points} points</strong>
                      </li>
                    ))}
                  </ol>
                )}
                {row.selfReported && (
                  <label className="self-score">
                    Points earned
                    <select
                      aria-label={`Points earned for question ${q.number}`}
                      id={`score-question-${q.number}`}
                      disabled={busy}
                      value={attempt.selfScores[q.number] ?? ""}
                      onChange={(event) =>
                        void run(async () => {
                          await api(`attempts/${attempt.id}`, {
                            selfScores: {
                              [q.number]: Number(event.target.value),
                            },
                          });
                        })
                      }
                    >
                      <option value="" disabled>
                        Select rubric score
                      </option>
                      {Array.from({ length: q.points + 1 }, (_, n) => (
                        <option key={n} value={n}>
                          {n} / {q.points}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
            </div>
            {feedback && (
              <section className="feedback-block">
                <span className="badge">{basisLabel[feedback.basis]}</span>
                <h4>Feedback</h4>
                <p>{feedback.text}</p>
                <p>
                  <strong>Next action:</strong> {feedback.nextAction}
                </p>
                <FeedbackDispute
                  record={feedback}
                  disabled={busy}
                  save={(reason) =>
                    run(async () => {
                      await api(`feedback/${feedback.id}`, { reason });
                      setNotice(
                        "Report saved with the original feedback. Your score has not changed.",
                      );
                    })
                  }
                />
              </section>
            )}
            {suggestions.map((s) => (
              <section className="feedback-block ai-feedback" key={s.id}>
                <span className="badge amber">
                  AI suggestion · interpretation needs review
                </span>
                <blockquote>
                  {s.answerExcerpt || "Blank saved answer"}
                </blockquote>
                <p>
                  <strong>Criterion:</strong> {s.criterion}
                </p>
                <p>{s.text}</p>
                <p>
                  <strong>Next action:</strong> {s.nextAction}
                </p>
                {s.evidence.map((ref, i) => (
                  <button
                    className="source-link"
                    key={i}
                    onClick={() => onSource(ref.documentId, ref.page)}
                  >
                    {
                      packet.documents.find((d) => d.id === ref.documentId)
                        ?.name
                    }{" "}
                    · p. {ref.page}
                  </button>
                ))}
                <FeedbackDispute
                  record={s}
                  disabled={busy}
                  save={(reason) =>
                    run(async () => {
                      await api(`feedback/${s.id}`, { reason });
                      setNotice(
                        "Report saved with the original AI suggestion. Your score has not changed.",
                      );
                    })
                  }
                />
              </section>
            ))}
            <section className="review-evidence">
              <h4>Evidence</h4>
              {(q.evidence ?? []).length ? (
                q.evidence!.map((ref, i) => (
                  <button
                    className="source-link"
                    key={i}
                    onClick={() => onSource(ref.documentId, ref.page)}
                  >
                    {
                      packet.documents.find((d) => d.id === ref.documentId)
                        ?.name
                    }{" "}
                    · p. {ref.page}
                  </button>
                ))
              ) : (
                <p className="muted small">
                  This legacy question has no recorded question-level evidence.
                </p>
              )}
              <p className="muted small">
                A valid source link verifies the location, not the
                interpretation.
              </p>
            </section>
            <details>
              <summary>Solution & marking guide</summary>
              <div className="solution">
                <MathText text={q.solution} />
                <p>
                  <strong>Answer:</strong> <MathText text={q.answer} />
                </p>
                {!row.selfReported && (
                  <>
                    <h4>Model-authored method guide</h4>
                    <p className="muted small">
                      These suggested criteria explain the solution. They do not
                      award method points for a key-based response.
                    </p>
                    <ul>
                      {q.rubric.map((r, i) => (
                        <li key={i}>{r.criterion}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </details>
            <details>
              <summary>What was checked—and what wasn’t</summary>
              {exam.verification ? (
                exam.verification
                  .filter((v) => v.question === q.number)
                  .map((v, i) => (
                    <div className="verification-row" key={i}>
                      <strong>
                        {v.method} ·{" "}
                        {v.result === "unsupported"
                          ? "not automatically verified"
                          : v.result}
                      </strong>
                      <p>{v.artifact}</p>
                      <small>
                        {v.limitation} ({v.checkerVersion})
                      </small>
                    </div>
                  ))
              ) : (
                <p>
                  Legacy checking status is preserved. No new verification is
                  claimed.
                </p>
              )}
              <p>
                Independent model review is a consistency check, not proof of
                correctness.
              </p>
            </details>
          </article>
        );
      })}
    </div>
  );
}

function FeedbackDispute({
  record,
  disabled,
  save,
}: {
  record: FeedbackRecord;
  disabled: boolean;
  save: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState(""),
    [failure, setFailure] = useState("");
  return (
    <details className="feedback-report">
      <summary>
        {record.disputes.length
          ? `Reported · ${record.disputes.length} saved reports`
          : "Report incorrect or unhelpful feedback"}
      </summary>
      {record.disputes.map((d) => (
        <p key={d.id}>{d.reason}</p>
      ))}
      <label>
        What should be reviewed?
        <textarea
          rows={2}
          maxLength={2000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        className="secondary"
        disabled={disabled || reason.trim().length < 3}
        onClick={() => {
          setFailure("");
          void save(reason).then((saved) => {
            if (saved) setReason("");
            else
              setFailure(
                "Your report was not saved. Your text is still here; try again.",
              );
          });
        }}
      >
        Save feedback report
      </button>
      {failure && (
        <p className="inline-error" role="alert">
          {failure}
        </p>
      )}
      <p className="muted small">
        The original feedback and your report stay linked. Reporting does not
        change scores.
      </p>
    </details>
  );
}

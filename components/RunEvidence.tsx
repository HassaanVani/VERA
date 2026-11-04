"use client";
import { useState } from "react";
import type { RunEvidence as Evidence } from "@/lib/run-evidence";

export default function RunEvidence({ examId }: { examId: string }) {
  const [data, setData] = useState<Evidence>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/exams/${encodeURIComponent(examId)}/evidence`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("Could not open run evidence. Try again.");
      setData(await response.json());
    } catch {
      setError("Could not open run evidence. Try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <details
      className="run-evidence"
      onToggle={(e) => {
        if (e.currentTarget.open && !data && !loading && !error) void load();
      }}
    >
      <summary>
        How this was made <span>Models, retained runs & checking scope</span>
      </summary>
      {loading && <p role="status">Opening recorded run evidence…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button className="text-button" onClick={() => void load()}>
            Retry run evidence
          </button>
        </div>
      )}
      {data && (
        <div className="run-evidence-content">
          <p>{data.scope}</p>
          {!data.executions.length && (
            <p>
              Generation job or usage evidence is unavailable for this
              historical result. No zero-cost or live-generation claim is
              inferred.
            </p>
          )}
          <ol className="run-history">
            {data.executions.map((run, i) => (
              <li key={run.jobId}>
                <strong>
                  {run.current ? "This result" : `Earlier run ${i + 1}`} ·{" "}
                  {run.status}
                  {run.ready === false ? " · practice blocked" : ""}
                </strong>
                <p>
                  {run.source === "authored-example"
                    ? "Authored saved example; no live model generation."
                    : run.source === "usage-unavailable"
                      ? "Provider usage unavailable for this run."
                      : `${run.models.join(" + ")} · ${run.recordedAttempts} recorded provider attempts`}
                </p>
                {run.settledUsd !== null && (
                  <p>
                    Recorded spend ${run.settledUsd.toFixed(4)} USD
                    {run.heldUsd
                      ? ` + ${run.heldUsd.toFixed(4)} USD held (${run.uncertainAttempts} unresolved reservations)`
                      : " · no unresolved reservations"}
                    .{" "}
                    {run.providerLatencyMs !== null
                      ? `${(run.providerLatencyMs / 1000).toFixed(1)}s summed provider latency; excludes local work and queue time.`
                      : "Latency not recorded."}
                  </p>
                )}
                <p>
                  {run.repairCycles !== null
                    ? `${run.repairCycles} automatic repair cycles in this run.`
                    : "Repair count unavailable; incomplete run."}
                </p>
              </li>
            ))}
          </ol>
          <h3>Question-level coverage</h3>
          <p>
            Passing checks verify individual claims or structures. They do not
            establish whole-answer correctness. Model review remains
            provisional.
          </p>
          {data.questions.map((q) => (
            <details key={q.number} className="question-coverage">
              <summary>
                Question {q.number}{" "}
                <span>
                  {q.checks.filter((c) => c.result === "passed").length} passed
                  · {q.checks.filter((c) => c.result === "failed").length}{" "}
                  failed ·{" "}
                  {q.checks.filter((c) => c.result === "unsupported").length}{" "}
                  not automatically verified
                </span>
              </summary>
              <p>
                Independent model review: {q.modelReview.replaceAll("-", " ")}
                {q.modelReview === "consistent"
                  ? " (agreement, not proof)"
                  : ""}
                .
              </p>
              {!q.checks.length && (
                <p>No per-claim verification history recorded.</p>
              )}
              <ul>
                {q.checks.map((c, i) => (
                  <li key={i}>
                    <strong>
                      {c.method.replaceAll("-", " ")} ·{" "}
                      {c.result === "unsupported"
                        ? "not automatically verified"
                        : c.result}
                    </strong>
                    <p>{c.limitation}</p>
                    <small>Checker: {c.checkerVersion}</small>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </details>
  );
}

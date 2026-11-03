"use client";
import { Check, LoaderCircle } from "lucide-react";
import type { Job } from "@/lib/contracts";

export default function GenerationProgress({
  job,
  fixture,
  onCancel,
}: {
  job: Job;
  fixture: boolean;
  onCancel: () => void;
}) {
  const stages =
    job.kind === "analyze"
      ? ["Read sources", "Build exam plan", "Save for review"]
      : ["Build scenario", "Write questions", "Check & solve", "Save exam"];
  const stage = job.stage.toLowerCase();
  const position =
    job.status === "queued"
      ? -1
      : fixture
        ? 0
        : job.kind === "analyze"
          ? stage.includes("save")
            ? 2
            : 1
          : stage.includes("save")
            ? 3
            : /check|solve|compare|repair/.test(stage)
              ? 2
              : stage.includes("generate")
                ? 1
                : 0;
  return (
    <section className="generation-progress" aria-label="Generation progress">
      <div className="generation-heading">
        <LoaderCircle className="spin" size={19} />
        <div>
          <strong role="status">{job.stage}</strong>
          <p>
            {fixture
              ? "Opening an authored example. No model calls or credits used."
              : "You can leave this screen. Progress is saved and no exact finish time is available."}
          </p>
        </div>
        <button className="text-button" onClick={onCancel}>
          Cancel job
        </button>
      </div>
      {!fixture && (
        <ol>
          {stages.map((label, i) => (
            <li
              key={label}
              className={
                i === position ? "current" : i < position ? "done" : ""
              }
              aria-current={i === position ? "step" : undefined}
            >
              <span>{i < position ? <Check size={12} /> : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      )}
      {/repair/i.test(stage) && (
        <p className="source-warning">
          A check found a problem. VERA is repairing affected questions and will
          check them again before practice.
        </p>
      )}
    </section>
  );
}

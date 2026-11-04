"use client";
import { useState } from "react";
import type { PublicCheckedExam } from "@/lib/assessment-access";
import MathText from "./MathText";
import Exhibits from "./Exhibits";

export default function ExamPreview({
  exam,
  onSource,
}: {
  exam: PublicCheckedExam;
  onSource: (documentId: string, page: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const question =
    exam.exam.questions[Math.min(index, exam.exam.questions.length - 1)];
  const material =
    !!exam.scenario ||
    (exam.exam.exhibits ?? []).some((e) => question.exhibitIds.includes(e.id));
  return (
    <section className="assessment-preview" aria-label="Assessment preview">
      <details className="assessment-instructions">
        <summary>Instructions & scoring</summary>
        <MathText text={exam.exam.instructions} />
        <p>
          Previewing does not start the timer. Solutions open after you submit
          an attempt.
        </p>
      </details>
      <div className="preview-position">
        <span role="status" aria-live="polite">
          Preview · question {index + 1} of {exam.exam.questions.length}
        </span>
        <nav aria-label="Preview questions">
          {exam.exam.questions.map((q, i) => (
            <button
              key={q.number}
              aria-label={`Preview question ${q.number}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
            >
              {q.number}
            </button>
          ))}
        </nav>
      </div>
      <div
        className={`assessment-desk ${material ? "with-reference" : "reading-only"}`}
      >
        <article className="question-sheet" aria-labelledby="preview-stem">
          <div className="sheet-meta">
            <span>{question.section || question.topic}</span>
            <span>
              {question.points} points · {question.minutes} min
            </span>
          </div>
          <h3 id="preview-stem">
            <MathText text={question.question} />
          </h3>
          {question.subparts?.map((part) => (
            <p className="question-subpart" key={part.label}>
              <strong>
                {part.label} · {part.points} points
              </strong>
              <MathText text={part.prompt} />
            </p>
          ))}
          {question.type === "multiple-choice" && (
            <ol className="preview-options" aria-label="Answer options">
              {question.options.map((option, i) => (
                <li key={i}>
                  <span>{String.fromCharCode(65 + i)}</span>
                  <MathText text={option} />
                </li>
              ))}
            </ol>
          )}
          <p className="preview-response-note">
            {question.type === "multiple-choice"
              ? "Choose one answer when you start practice."
              : "Your response space opens when you start practice."}
          </p>
          <div className="preview-paging">
            <button
              className="text-button"
              disabled={!index}
              onClick={() => setIndex(index - 1)}
            >
              ← Previous question
            </button>
            <button
              className="text-button"
              disabled={index === exam.exam.questions.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              Next question →
            </button>
          </div>
        </article>
        <Exhibits
          scenario={exam.scenario}
          exhibits={exam.exam.exhibits}
          ids={question.exhibitIds}
          onSource={onSource}
          imageExhibits={exam.imageExhibits}
        />
      </div>
    </section>
  );
}

"use client";
import { Check, ChevronRight } from "lucide-react";

const steps = [
  { view: "packet", label: "Materials" },
  { view: "blueprint", label: "Exam plan" },
  { view: "exam", label: "Practice exam" },
  { view: "results", label: "Review & improve" },
] as const;
export default function CourseJourney({
  view,
  hasPacket,
  hasPlan,
  approved,
  hasExam,
  submitted,
  onNavigate,
}: {
  view: string;
  hasPacket: boolean;
  hasPlan: boolean;
  approved: boolean;
  hasExam: boolean;
  submitted: boolean;
  onNavigate: (view: (typeof steps)[number]["view"]) => void;
}) {
  const complete = [hasPacket, approved, submitted, false];
  const available = [true, hasPacket, hasPlan, hasExam];
  return (
    <nav className="course-journey" aria-label="Study steps">
      <ol>
        {steps.map((step, index) => (
          <li key={step.view}>
            <button
              disabled={!available[index]}
              aria-current={view === step.view ? "step" : undefined}
              onClick={() => onNavigate(step.view)}
            >
              <span
                className={`journey-number ${complete[index] ? "complete" : ""}`}
              >
                {complete[index] ? <Check size={14} /> : index + 1}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>
                  {index === 0
                    ? hasPacket
                      ? "Sources added"
                      : "Add your sources"
                    : index === 1
                      ? approved
                        ? "Approved"
                        : hasPlan
                          ? "Review needed"
                          : "Build a plan"
                      : index === 2
                        ? hasExam
                          ? submitted
                            ? "Attempt complete"
                            : "Exam available"
                          : "Generate questions"
                        : submitted
                          ? "Review your work"
                          : "After practice"}
                </small>
              </span>
              <ChevronRight size={13} className="journey-chevron" />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

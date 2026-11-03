"use client";

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
  const available = [true, hasPacket, hasPlan, hasExam];
  if (!hasPlan && view === "packet") return null;
  return (
    <nav className="course-journey" aria-label="Study steps">
      <ol>
        {steps.map((step, index) =>
          available[index] &&
          (index !== 2 || hasExam || view === "exam") &&
          (index !== 3 || submitted || view === "results") ? (
            <li key={step.view}>
              <button
                disabled={!available[index]}
                aria-current={view === step.view ? "step" : undefined}
                onClick={() => onNavigate(step.view)}
              >
                <span>
                  <strong>{step.label}</strong>
                </span>
              </button>
            </li>
          ) : null,
        )}
      </ol>
    </nav>
  );
}

import { ShieldCheck } from "lucide-react";
import type { PublicCheckedExam } from "@/lib/assessment-access";
export default function ExamChecks({ exam }: { exam: PublicCheckedExam }) {
  const description = exam.fixture
    ? "Saved demonstration. Model review was not run. Numerical claims and structure are checked locally."
    : `Recorded claim checks: ${exam.verification?.filter((v) => v.result === "passed").length ?? "legacy"}. ${exam.repairAttempts} repair cycles. Written reasoning is not automatically verified. Model review is provisional.`;
  const issues = exam.issues.map((issue, index) => (
    <p
      key={index}
      className={issue.severity === "error" ? "inline-error" : "source-warning"}
    >
      {issue.code}: {issue.message}
    </p>
  ));
  return exam.ready ? (
    <div className="exam-checks">
      <details className="check-report pass">
        <summary>
          <ShieldCheck size={17} />
          <strong>Structural checks passed · review checking coverage</strong>
          {exam.fixture && (
            <small className="authored-label">
              Saved example · no live generation
            </small>
          )}
          <span>Checking details</span>
        </summary>
        <p>{description}</p>
      </details>
      {issues}
    </div>
  ) : (
    <div className="check-report fail">
      <ShieldCheck size={21} />
      <div>
        <strong>Unresolved checks · practice blocked</strong>
        <p>{description}</p>
        {issues}
      </div>
    </div>
  );
}

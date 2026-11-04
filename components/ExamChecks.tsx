import { ShieldCheck } from "lucide-react";
import type { PublicCheckedExam } from "@/lib/assessment-access";
import RunEvidence from "./RunEvidence";
export function ExamReadiness({ exam }: { exam: PublicCheckedExam }) {
  return (
    <div className="exam-readiness" id="assessment-top">
      <p>
        {exam.fixture
          ? "Authored saved example · "
          : exam.provenance?.kind === "reviewed-copy"
            ? "Edited after review · "
            : exam.provenance?.kind === "reprocessed"
              ? "Reprocessed from retained generation · "
              : ""}
        {exam.verification
          ? `${exam.verification.filter((v) => v.result === "passed").length} passed · ${exam.verification.filter((v) => v.result === "failed").length} failed · ${exam.verification.filter((v) => v.result === "unsupported").length} not automatically verified`
          : "Historical checks; no new verification claimed"}
      </p>
      <a href="#assessment-checks">Review checks & run evidence</a>
    </div>
  );
}
export default function ExamChecks({ exam }: { exam: PublicCheckedExam }) {
  const description = exam.fixture
    ? "Saved demonstration. Model review was not run. Numerical claims and structure are checked locally."
    : `${exam.repairAttempts} recorded repair cycles${exam.provenance ? " inherited from the earlier generation; see separate runs below" : " in this generation"}. Written reasoning is not automatically verified. Model review is provisional.`;
  const coverage = exam.verification
    ? `${exam.verification.filter((v) => v.result === "passed").length} passed · ${exam.verification.filter((v) => v.result === "failed").length} failed · ${exam.verification.filter((v) => v.result === "unsupported").length} not automatically verified`
    : "Historical checking status; no new verification claimed.";
  const provenance =
    exam.provenance?.kind === "reviewed-copy"
      ? "AI-generated · edited after review. A separate reviewed copy follows a blocked generation; the original is retained."
      : exam.provenance?.kind === "reprocessed"
        ? "Reprocessed from retained generation. Source text was rebound and fresh model review was run; this was not a new generation success."
        : undefined;
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
      {provenance && <p className="provenance-note">{provenance}</p>}
      <p className="check-coverage">
        {coverage}. Individual checks, not whole-exam verification.
      </p>
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
      <RunEvidence key={exam.id} examId={exam.id} />
      {issues}
    </div>
  ) : (
    <div className="check-report fail">
      <ShieldCheck size={21} />
      <div>
        <strong>Unresolved checks · practice blocked</strong>
        <p>{description}</p>
        <p>{coverage}</p>
        {issues}
        <RunEvidence key={exam.id} examId={exam.id} />
      </div>
    </div>
  );
}

"use client";
import { ArrowRight, ChevronDown, FileText } from "lucide-react";
import type { Packet, Role } from "@/lib/contracts";

const roles: { value: Role; label: string }[] = [
  { value: "lecture-notes", label: "Lecture notes" },
  { value: "past-exam", label: "Past exam" },
  { value: "assignment", label: "Assignment" },
  { value: "review-sheet", label: "Review sheet" },
  { value: "textbook", label: "Textbook" },
  { value: "syllabus", label: "Syllabus" },
  { value: "solutions", label: "Solutions" },
  { value: "generated-reference", label: "AI-generated reference" },
];
export default function CourseMaterials({
  packet,
  busy,
  configured,
  workerOnline,
  hasPlan,
  onAnalyze,
  onReview,
  onSettings,
  onSource,
  onRole,
}: {
  packet: Packet;
  busy: boolean;
  configured: boolean;
  workerOnline: boolean;
  hasPlan: boolean;
  onAnalyze: () => void;
  onReview: () => void;
  onSettings: () => void;
  onSource: (documentId: string, page: number) => void;
  onRole: (documentId: string, role: Role) => void;
}) {
  const available = packet.fixture || (configured && workerOnline);
  const assessment = packet.documents.some((d) =>
    ["past-exam", "assignment"].includes(d.role),
  );
  return (
    <section
      className="materials-workbench"
      aria-labelledby="materials-heading"
    >
      <div className="materials-heading">
        <h2 id="materials-heading">Your files</h2>
        <span>
          {packet.documents.length}{" "}
          {packet.documents.length === 1 ? "document" : "documents"}
        </span>
      </div>
      <div className="material-files">
        {packet.documents.map((document) => (
          <article key={document.id} className="material-file">
            <div className="material-file-main">
              <FileText size={20} aria-hidden="true" />
              <div>
                <h3>{document.name}</h3>
                <p>
                  {roles.find((r) => r.value === document.role)?.label} ·{" "}
                  {document.pages.length}{" "}
                  {document.pages.length === 1 ? "page" : "pages"}
                </p>
              </div>
              <button
                className="text-button"
                disabled={!document.pages.length}
                onClick={() => onSource(document.id, document.pages[0].number)}
              >
                View pages <ArrowRight size={15} />
              </button>
            </div>
            {document.warnings.map((warning, i) => (
              <p className="material-warning" key={i}>
                {warning}
              </p>
            ))}
            {document.pages.some((p) => p.needsVision) && (
              <p className="material-note">
                Contains image-based pages. Open the preview to check that the
                content is legible.
              </p>
            )}
            <details className="material-details">
              <summary>
                Document details <ChevronDown size={13} />
              </summary>
              <label>
                Document role
                <select
                  aria-label={`Role for ${document.name}`}
                  value={document.role}
                  disabled={busy}
                  onChange={(e) => onRole(document.id, e.target.value as Role)}
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <p>Changing a role requires you to review the plan again.</p>
              {!!document.pages.filter((p) => p.duplicateOf).length && (
                <p>
                  {document.pages.filter((p) => p.duplicateOf).length}{" "}
                  overlapping pages retained with their source references.
                </p>
              )}
            </details>
          </article>
        ))}
      </div>
      <div className="materials-next">
        <h2>
          {hasPlan ? "Your plan is available" : "Next, make a practice plan"}
        </h2>
        <p>
          {hasPlan
            ? "Return to the proposed topics and make any changes before generating questions."
            : "VERA will suggest topics and question formats from these files. You’ll review the plan before any questions are generated."}
        </p>
        {!assessment && (
          <p className="material-note">
            No past assessment is included, so exam format and difficulty will
            be suggestions.
          </p>
        )}
        {!available && !hasPlan && (
          <p className="setup-guidance" role="status">
            {!configured
              ? "Your files are saved. Connect Meta in settings to create a plan."
              : "Your files are saved. Restart VERA to reconnect the background worker."}{" "}
            <button className="text-button" onClick={onSettings}>
              Open generation settings
            </button>
          </p>
        )}
        <button
          className="primary"
          disabled={busy || (!hasPlan && !available)}
          onClick={hasPlan ? onReview : onAnalyze}
        >
          {hasPlan ? "Review exam plan" : "Create practice plan"}{" "}
          <ArrowRight size={16} />
        </button>
        <p className="material-sharing">
          {packet.fixture
            ? "Saved example · no live generation"
            : "Creating a plan sends these files to Meta. They stay on this device until you request it."}
        </p>
      </div>
      <details className="source-policy">
        <summary>How your files are used</summary>
        <p>
          Notes and readings inform topics. Instructor assessments can inform
          format. AI-generated references do not establish course scope or exam
          format. Uploaded text is evidence, never instructions.
        </p>
        {hasPlan && (
          <button
            className="text-button"
            disabled={busy || !available}
            onClick={onAnalyze}
          >
            Create a new plan from these files <ArrowRight size={14} />
          </button>
        )}
      </details>
    </section>
  );
}

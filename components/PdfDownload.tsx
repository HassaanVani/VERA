"use client";
import { useState } from "react";
import { ArrowDownToLine, LoaderCircle } from "lucide-react";

export default function PdfDownload({
  examId,
  attemptId,
}: {
  examId: string;
  attemptId?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        attemptId
          ? `/api/attempts/${encodeURIComponent(attemptId)}/pdf`
          : `/api/exams/${encodeURIComponent(examId)}/pdf`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not create the PDF. Try again.");
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || "VERA-assessment.pdf";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create the PDF. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pdf-download">
      <button
        className="secondary"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <ArrowDownToLine size={16} />
        )}{" "}
        {busy
          ? "Preparing PDF…"
          : attemptId
            ? "Download review PDF"
            : "Download PDF"}
      </button>
      <span className="sr-only" role="status">
        {busy ? "Preparing your printable PDF." : ""}
      </span>
      {error && (
        <p className="pdf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./studio.css";
import "./experience.css";
import "./review.css";
import "./workspace.css";
import "./study.css";
import "./assessment.css";
export const metadata: Metadata = {
  title: "VERA · Make practice feel real",
  description:
    "Evidence-backed practice assessments with the whole picture: original questions, coherent exhibits, and worked solutions.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

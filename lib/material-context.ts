import { z } from "zod";
import { Evidence } from "./contracts";
import type { Packet } from "./contracts";
import { excludedFromModel } from "./source-policy";
import type { Attachment } from "./provider";

export const ANALYSIS_SECTION = { pages: 40, images: 12, textBytes: 90_000 };
export const MaterialNotes = z.object({
  subject: z.string().max(160),
  topics: z
    .array(
      z.object({
        topic: z.string().max(160),
        summary: z.string().max(300),
        evidence: z.array(Evidence).min(1).max(4),
      }),
    )
    .max(6),
  assessmentFacts: z
    .array(
      z.object({
        fact: z.string().max(300),
        evidence: z.array(Evidence).min(1).max(4),
      }),
    )
    .max(4),
  uncertainties: z.array(z.string().max(160)).max(4),
});

/** Page numbers and document IDs remain the original uploaded references. */
export function analysisSections(packet: Packet): Packet[] {
  const sections: Packet[] = [];
  let current: Packet = { ...packet, documents: [] };
  let count = 0,
    images = 0,
    bytes = 0;
  const flush = () => {
    if (count) sections.push(current);
    current = { ...packet, documents: [] };
    count = 0;
    images = 0;
    bytes = 0;
  };
  for (const document of packet.documents) {
    if (document.role === "generated-reference") continue;
    for (const page of document.pages) {
      if (page.duplicateOf || excludedFromModel(page)) continue;
      const pageBytes = Buffer.byteLength(page.text, "utf8");
      const visual = Number(page.needsVision && !!page.imagePath);
      if (
        count &&
        (count >= ANALYSIS_SECTION.pages ||
          images + visual > ANALYSIS_SECTION.images ||
          bytes + pageBytes > ANALYSIS_SECTION.textBytes)
      )
        flush();
      let target = current.documents.find((d) => d.id === document.id);
      if (!target) {
        target = { ...document, pages: [] };
        current.documents.push(target);
      }
      target.pages.push(page);
      count++;
      images += visual;
      bytes += pageBytes;
    }
  }
  flush();
  return sections;
}

export function visualAttachments(packet: Packet): Attachment[] {
  return packet.documents
    .filter((d) => d.role !== "generated-reference")
    .flatMap((d) =>
      d.pages
        .filter(
          (p) =>
            p.needsVision &&
            p.imagePath &&
            !p.duplicateOf &&
            !excludedFromModel(p),
        )
        .map((p) => ({
          name: `${d.id}:page-${p.number}`,
          mime:
            d.mime === "image/jpeg"
              ? ("image/jpeg" as const)
              : ("image/png" as const),
          path: p.imagePath!,
        })),
    );
}

/** Generation and feedback receive the pages actually referenced by the plan/items. */
export function evidenceContext(
  packet: Packet,
  references: { documentId: string; page: number }[],
): Packet {
  const wanted = new Set(
    references.map((ref) => `${ref.documentId}:${ref.page}`),
  );
  return {
    ...packet,
    documents: packet.documents
      .filter((d) => d.role !== "generated-reference")
      .map((d) => ({
        ...d,
        pages: d.pages.filter((p) => wanted.has(`${d.id}:${p.number}`)),
      }))
      .filter((d) => d.pages.length),
  };
}

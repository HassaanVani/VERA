import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Role, SourceDocument } from "./contracts";
import { dataDir, id } from "./store";

export const LIMITS = { files: 8, fileBytes: 10 * 1024 * 1024, packetBytes: 30 * 1024 * 1024, pages: 40, textChars: 180_000 };
export function sniff(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  throw new Error("Unsupported or unreadable file. Upload a genuine PDF, PNG, or JPEG.");
}
export function deduplicate(documents: SourceDocument[]) {
  const seen = new Map<string, string>();
  for (const d of documents.filter(d => d.role !== "generated-reference")) for (const p of d.pages) {
    // Restrict deduplication to substantial text; short captions and blank scans are not equivalent evidence.
    const normalized = p.text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    if (normalized.length < 100) continue;
    const hash = createHash("sha256").update(normalized).digest("hex");
    if (seen.has(hash)) p.duplicateOf = seen.get(hash); else seen.set(hash, `${d.id}:${p.number}`);
  }
  return documents;
}
export async function ingest(file: File, role: Role, packetId: string): Promise<SourceDocument> {
  if (file.size > LIMITS.fileBytes || file.size === 0) throw new Error(`${file.name}: file must be between 1 byte and 10 MB.`);
  const bytes = Buffer.from(await file.arrayBuffer()), mime = sniff(bytes), docId = id();
  const dir = path.join(dataDir(), "uploads", packetId, docId); await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, mime === "application/pdf" ? "source.pdf" : mime === "image/png" ? "source.png" : "source.jpg");
  const doc: SourceDocument = { id: docId, name: path.basename(file.name).slice(0, 200), role, mime, filePath, pages: [], warnings: [] };
  if (mime !== "application/pdf") { await writeFile(filePath, bytes); doc.pages = [{ number: 1, text: "Image source: read the attached image; transcription not yet available.", imagePath: filePath, needsVision: true }]; return doc; }
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const info = await parser.getInfo();
    if (info.total > LIMITS.pages) throw new Error(`${file.name}: ${info.total} pages exceeds the 40-page packet limit. Upload focused chapter excerpts.`);
    const text = await parser.getText();
    if (text.text.length > LIMITS.textChars) throw new Error(`${file.name}: extracted text is too large; upload focused excerpts.`);
    const screenshots = await parser.getScreenshot({ desiredWidth: 1100, imageDataUrl: false, imageBuffer: true });
    for (const page of text.pages) {
      const needsVision = page.text.trim().length < 80 || /[\u0000-\u0008\uFFFD]|[∑∫λ⃗]/u.test(page.text);
      const shot = screenshots.pages.find(s => s.pageNumber === page.num);
      const imagePath = shot ? path.join(dir, `page-${page.num}.png`) : undefined;
      if (imagePath && shot) await writeFile(imagePath, shot.data);
      if (!imagePath) throw new Error(`${file.name}, page ${page.num}: could not render a page image for reliable mathematical inspection.`);
      doc.pages.push({ number: page.num, text: page.text, imagePath, needsVision });
    }
    if (!doc.pages.length) throw new Error(`${file.name}: no readable pages found.`);
    if (doc.pages.some(p => p.needsVision)) doc.warnings.push("Some pages contain scans or uncertain mathematical extraction. Page images will accompany analysis.");
    await writeFile(filePath, bytes); return doc;
  } catch (e) { throw new Error(e instanceof Error ? `${file.name}: ${e.message}` : `${file.name}: unreadable PDF.`); }
  finally { await parser.destroy(); }
}

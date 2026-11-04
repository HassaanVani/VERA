import type { Blueprint, Exam, Packet } from "./contracts";
import { excludedFromModel } from "./source-policy";
// Match only whitespace and typographic quote variants, then return the actual
// page substring. Never publish a model's rewritten quotation as a literal source.
function canonicalSource(text: string) {
  let normalized = "";
  const starts: number[] = [],
    ends: number[] = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index],
      value = /\s/.test(char)
        ? " "
        : /[“”]/.test(char)
          ? '"'
          : /[‘’]/.test(char)
            ? "'"
            : char;
    if (value === " " && normalized.endsWith(" ")) {
      ends[ends.length - 1] = index + 1;
      continue;
    }
    normalized += value;
    starts.push(index);
    ends.push(index + 1);
  }
  return { normalized, starts, ends };
}
export function exactSourceSlice(page: string, proposed: string) {
  const haystack = canonicalSource(page),
    needle = canonicalSource(proposed).normalized.trim();
  if (needle.length < 8) return undefined;
  const index = haystack.normalized.indexOf(needle);
  return index < 0
    ? undefined
    : page.slice(
        haystack.starts[index],
        haystack.ends[index + needle.length - 1],
      );
}
export function bindSourcePassages(exam: Exam, packet: Packet) {
  const changes: { exhibitId: string; before: string; after: string }[] = [];
  const exhibits = exam.exhibits?.map((exhibit) => {
    if (exhibit.kind !== "passage" || exhibit.synthetic || !exhibit.source)
      return exhibit;
    const document = packet.documents.find(
        (d) => d.id === exhibit.source!.documentId,
      ),
      page = document?.pages.find((p) => p.number === exhibit.source!.page);
    if (
      !document ||
      ["solutions", "generated-reference"].includes(document.role) ||
      !page ||
      excludedFromModel(page)
    )
      return exhibit;
    const actual = exactSourceSlice(page.text, exhibit.content);
    if (actual === undefined || actual === exhibit.content) return exhibit;
    changes.push({
      exhibitId: exhibit.id,
      before: exhibit.content,
      after: actual,
    });
    return { ...exhibit, content: actual };
  });
  return { exam: changes.length ? { ...exam, exhibits } : exam, changes };
}
type Exhibit = NonNullable<Exam["exhibits"]>[number];
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

export function materialProblems(exhibit: Exhibit, packet?: Packet): string[] {
  const problems: string[] = [];
  if (exhibit.illustration && exhibit.kind !== "image")
    problems.push("Muse Image specifications belong only to image exhibits.");
  if (
    exhibit.kind === "image" &&
    (!exhibit.synthetic ||
      !exhibit.illustration ||
      exhibit.drawing ||
      exhibit.points.length)
  )
    problems.push(
      "Generated images require a synthetic label, a text alternative and an image specification; coordinate data belongs in precise diagrams.",
    );
  if (exhibit.drawing && exhibit.kind !== "diagram")
    problems.push("Drawing data belongs only to a diagram.");
  if (exhibit.kind === "diagram") {
    const points = new Map(exhibit.points.map((p) => [p.label, p]));
    if (
      points.size !== exhibit.points.length ||
      exhibit.points.some((p) => !p.label.trim())
    )
      problems.push("Diagram point labels must be unique and nonempty.");
    if (exhibit.points.some((p) => Math.abs(p.x) > 1e6 || Math.abs(p.y) > 1e6))
      problems.push("Diagram coordinates exceed the supported magnitude.");
    const drawing = exhibit.drawing;
    if (drawing) {
      for (const segment of drawing.segments) {
        if (
          !points.has(segment.from) ||
          !points.has(segment.to) ||
          segment.from === segment.to
        )
          problems.push("A segment needs two different existing point labels.");
      }
      for (const line of drawing.paths) {
        if (
          line.points.some((p) => !points.has(p)) ||
          new Set(line.points).size < (line.closed ? 3 : 2)
        )
          problems.push(
            "A path references missing or insufficient distinct vertices.",
          );
      }
      for (const circle of drawing.circles)
        if (
          !points.has(circle.center) ||
          !Number.isFinite(circle.radius) ||
          circle.radius <= 0
        )
          problems.push(
            "A circle needs an existing center and positive finite radius.",
          );
      if (
        /eigen.?direction|invariant.?probe|correct.?answer|answer.?key|solution/i.test(
          [...drawing.segments, ...drawing.paths, ...drawing.circles]
            .map((x) => x.label)
            .join(" "),
        )
      )
        problems.push("A diagram label reveals an intended answer.");
    }
  }
  if (exhibit.source) {
    const document = packet?.documents.find(
      (d) => d.id === exhibit.source!.documentId,
    );
    const page = document?.pages.find((p) => p.number === exhibit.source!.page);
    if (
      exhibit.kind !== "passage" ||
      exhibit.synthetic ||
      !page ||
      !document ||
      ["generated-reference", "solutions"].includes(document.role) ||
      excludedFromModel(page)
    )
      problems.push(
        "Source passages require a permitted, non-synthetic course page.",
      );
    else if (
      normalize(exhibit.content).length < 20 ||
      !normalize(page.text).includes(normalize(exhibit.content))
    )
      problems.push(
        "The source passage is not a literal excerpt of its cited page.",
      );
  } else if (exhibit.kind === "passage" && !exhibit.synthetic)
    problems.push(
      "A source-based passage needs a document and page reference.",
    );
  return problems;
}

// Local retrieval uses uploaded text only. Retrieved text remains untrusted evidence.
export function retrievePassages(
  packet: Packet,
  blueprint: Blueprint,
  limit = 8,
) {
  const terms = new Set(
    `${blueprint.domain} ${blueprint.slots.map((s) => `${s.topic} ${s.objective || ""}`).join(" ")}`
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu) || [],
  );
  const cited = new Set(
    blueprint.slots.flatMap((s) =>
      s.evidence.map((e) => `${e.documentId}:${e.page}`),
    ),
  );
  return packet.documents
    .filter((d) => !["generated-reference", "solutions"].includes(d.role))
    .flatMap((d) =>
      d.pages
        .filter((p) => !excludedFromModel(p) && p.text.trim().length >= 20)
        .flatMap((p) => {
          const sentences = p.text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [
            p.text,
          ];
          const chunks: string[] = [];
          let chunk = "";
          for (const sentence of sentences) {
            if ((chunk + sentence).length > 1800 && chunk) {
              chunks.push(chunk.trim());
              chunk = "";
            }
            if (sentence.length <= 2500) chunk += sentence;
            else {
              // OCR may omit punctuation. Keep literal bounded slices rather
              // than silently dropping the entire page from retrieval.
              for (let offset = 0; offset < sentence.length; offset += 1800)
                chunks.push(sentence.slice(offset, offset + 1800).trim());
            }
          }
          if (chunk.trim()) chunks.push(chunk.trim());
          return chunks.map((content) => ({
            documentId: d.id,
            documentName: d.name,
            page: p.number,
            content,
            score:
              (cited.has(`${d.id}:${p.number}`) ? 4 : 0) +
              [...terms].filter((term) => content.toLowerCase().includes(term))
                .length,
          }));
        }),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((passage) => ({
      documentId: passage.documentId,
      documentName: passage.documentName,
      page: passage.page,
      content: passage.content,
    }));
}

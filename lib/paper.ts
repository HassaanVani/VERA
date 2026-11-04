import katex from "katex";
import type { Attempt, CheckedExam, Exam, Packet } from "./contracts";
import { publicExam } from "./assessment-access";
import { diagramGeometry } from "./diagram-geometry";
import {
  readVectorResponse,
  responseText,
  type DiagramConfig,
} from "./vector-response";
import { multiply, results } from "./domain";

type Exhibit = NonNullable<Exam["exhibits"]>[number];
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function paperText(text: string) {
  return text
    .split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g)
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$")) {
        const display = part.startsWith("$$");
        return katex.renderToString(
          part.slice(display ? 2 : 1, display ? -2 : -1),
          {
            displayMode: display,
            throwOnError: false,
            trust: false,
            strict: "ignore",
            maxExpand: 1000,
          },
        );
      }
      return escapeHtml(part);
    })
    .join("");
}

export function paperDiagram(exhibit: Exhibit) {
  const { x, y, width, height, scale } = diagramGeometry(exhibit);
  const byLabel = new Map(exhibit.points.map((p) => [p.label, p]));
  const drawing = exhibit.drawing;
  const arrow = `arrow-${escapeHtml(exhibit.id).replace(/[^a-zA-Z0-9-]/g, "")}`;
  const lines = (drawing?.segments ?? [])
    .map((s) => {
      const a = byLabel.get(s.from),
        b = byLabel.get(s.to);
      return a && b
        ? `<line x1="${x(a.x)}" y1="${y(a.y)}" x2="${x(b.x)}" y2="${y(b.y)}" ${s.arrow ? `marker-end="url(#${arrow})"` : ""}/><text x="${(x(a.x) + x(b.x)) / 2 + 5}" y="${(y(a.y) + y(b.y)) / 2 - 7}">${escapeHtml(s.label)}</text>`
        : "";
    })
    .join("");
  const paths = (drawing?.paths ?? [])
    .map((p) => {
      const vertices = p.points.map((l) => byLabel.get(l));
      if (vertices.some((v) => !v)) return "";
      return `<${p.closed ? "polygon" : "polyline"} points="${vertices.map((v) => `${x(v!.x)},${y(v!.y)}`).join(" ")}" fill="${p.closed ? "#edf3f7" : "none"}"/>`;
    })
    .join("");
  const circles = (drawing?.circles ?? [])
    .map((c) => {
      const p = byLabel.get(c.center);
      return p
        ? `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${c.radius * scale}"/>`
        : "";
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:${Math.min(560, (380 * width) / height)}px;max-width:100%;height:auto" role="img" aria-label="${escapeHtml(drawing?.description || exhibit.title)}"><defs><marker id="${arrow}" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#162f46"/></marker></defs><g stroke="#162f46" stroke-width="1.6" fill="none">${drawing?.axes !== "none" ? `<g stroke="#9aa9b5" stroke-width="1"><line x1="15" y1="${y(0)}" x2="${width - 15}" y2="${y(0)}"/><line x1="${x(0)}" y1="15" x2="${x(0)}" y2="${height - 15}"/></g>` : ""}${paths}${circles}${lines}</g><g font-family="Arial" font-size="12" fill="#162f46">${exhibit.points.map((p) => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="3"/><text x="${x(p.x) + 6}" y="${y(p.y) - 7}">${escapeHtml(p.label)}</text>`).join("")}</g></svg>`;
}

function sourceLabel(
  packet: Packet,
  ref: { documentId: string; page: number },
) {
  return `${packet.documents.find((d) => d.id === ref.documentId)?.name ?? "Missing source"}, page ${ref.page}`;
}

function geometryData(ex: Exhibit) {
  const data = [
    ...ex.points.map((p) => `${p.label} (${p.x}, ${p.y})`),
    ...(ex.drawing?.segments ?? []).map(
      (s) =>
        `${s.arrow ? "Arrow" : "Segment"} ${s.from} to ${s.to}${s.label ? `: ${s.label}` : ""}`,
    ),
    ...(ex.drawing?.paths ?? []).map(
      (p) =>
        `${p.closed ? "Polygon" : "Polyline"} ${p.points.join(" to ")}${p.label ? `: ${p.label}` : ""}`,
    ),
    ...(ex.drawing?.circles ?? []).map(
      (c) =>
        `Circle centered at ${c.center}, radius ${c.radius}${c.label ? `: ${c.label}` : ""}`,
    ),
  ];
  return `<p class="caption">${escapeHtml(ex.drawing?.description || "Use the stated coordinates.")}</p><p class="caption">${data.map(escapeHtml).join("; ")}</p>`;
}

function vectorPaper(
  ex: Exhibit | undefined,
  config: DiagramConfig,
  response = "",
) {
  if (config.minX >= config.maxX || config.minY >= config.maxY)
    throw new Error(
      "The PDF response diagram has invalid bounds. Generate a new assessment.",
    );
  const scale = Math.min(
    310 / (config.maxX - config.minX),
    210 / (config.maxY - config.minY),
  );
  const w = (config.maxX - config.minX) * scale + 80,
    h = (config.maxY - config.minY) * scale + 70;
  const x = (n: number) => 40 + (n - config.minX) * scale,
    y = (n: number) => h - 35 - (n - config.minY) * scale;
  let grid = "";
  const stepX = Math.max(1, Math.ceil((config.maxX - config.minX) / 12)),
    stepY = Math.max(1, Math.ceil((config.maxY - config.minY) / 12));
  for (
    let n = Math.ceil(config.minX / stepX) * stepX;
    n <= config.maxX;
    n += stepX
  )
    grid += `<line x1="${x(n)}" y1="35" x2="${x(n)}" y2="${h - 35}"/><text x="${x(n)}" y="${h - 16}" text-anchor="middle">${n}</text>`;
  for (
    let n = Math.ceil(config.minY / stepY) * stepY;
    n <= config.maxY;
    n += stepY
  )
    grid += `<line x1="40" y1="${y(n)}" x2="${w - 40}" y2="${y(n)}"/><text x="32" y="${y(n) + 4}" text-anchor="end">${n}</text>`;
  const points = new Map(ex?.points.map((p) => [p.label, p]) ?? []);
  const shapes =
    (ex?.drawing?.paths ?? [])
      .map((p) => {
        const vertices = p.points.map((label) => points.get(label));
        if (vertices.some((v) => !v)) return "";
        return `<${p.closed ? "polygon" : "polyline"} points="${vertices.map((v) => `${x(v!.x)},${y(v!.y)}`).join(" ")}" fill="none"/>`;
      })
      .join("") +
    (ex?.drawing?.circles ?? [])
      .map((c) => {
        const center = points.get(c.center);
        return center
          ? `<circle cx="${x(center.x)}" cy="${y(center.y)}" r="${c.radius * scale}" fill="none"/>`
          : "";
      })
      .join("");
  const givens = (ex?.drawing?.segments ?? [])
    .map((s) => {
      const a = points.get(s.from),
        b = points.get(s.to);
      return a && b
        ? `<line x1="${x(a.x)}" y1="${y(a.y)}" x2="${x(b.x)}" y2="${y(b.y)}" ${s.arrow ? 'marker-end="url(#vgiven)"' : ""}/>`
        : "";
    })
    .join("");
  const vectors = readVectorResponse(response)?.vectors ?? [];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="width:${w}px;max-width:100%;height:auto" role="img" aria-label="Vector response grid"><defs>${["vgiven", "vanswer"].map((id) => `<marker id="${id}" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="${id === "vgiven" ? "#233a4a" : "#0068aa"}"/></marker>`).join("")}</defs><g stroke="#d9e2e8" stroke-width=".7" font-size="9">${grid}</g><rect x="40" y="35" width="${w - 80}" height="${h - 70}" stroke="#8fa0ad" fill="none"/><g stroke="#233a4a" stroke-width="1.6">${shapes}${givens}</g><g font-size="11">${[...points.values()].map((p) => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="3" fill="#233a4a"/><text x="${x(p.x) + 5}" y="${y(p.y) - 7}">${escapeHtml(p.label)}</text>`).join("")}</g><g stroke="#0068aa" stroke-width="2.3">${vectors.map((v, i) => `<line x1="${x(v.from[0])}" y1="${y(v.from[1])}" x2="${x(v.to[0])}" y2="${y(v.to[1])}" marker-end="url(#vanswer)"/><text x="${x(v.to[0]) + 6}" y="${y(v.to[1]) + 13}">Answer ${i + 1}</text>`).join("")}</g></svg><p class="caption">${vectors.length ? "Your saved vectors are blue; given geometry is dark." : "Draw your answer on this coordinate grid."} Equal horizontal and vertical units. Bounds: x ${config.minX} to ${config.maxX}, y ${config.minY} to ${config.maxY}. Drawing correctness requires self-scoring.</p>${ex ? geometryData(ex) : ""}`;
}

function legacyPaperExhibits(
  scenario: NonNullable<ReturnType<typeof publicExam>["scenario"]>,
): Exhibit[] {
  const base = {
    synthetic: true,
    content: "",
    columns: [] as string[],
    rows: [] as string[][],
    points: [] as Exhibit["points"],
  };
  const points = [{ label: "O", x: 0, y: 0 }],
    segments: NonNullable<Exhibit["drawing"]>["segments"] = [];
  for (const [i, vector] of scenario.vectors.entries()) {
    const output = multiply(scenario.matrix, vector.input);
    points.push(
      { label: `v${i + 1}`, x: vector.input[0], y: vector.input[1] },
      { label: `Av${i + 1}`, x: output[0], y: output[1] },
    );
    segments.push(
      { from: "O", to: `v${i + 1}`, arrow: true, label: "input" },
      { from: "O", to: `Av${i + 1}`, arrow: true, label: "transformed" },
    );
  }
  return [
    {
      ...base,
      id: "calibration",
      kind: "passage",
      title: "Calibration sheet",
      content: `${scenario.title}\n${scenario.company}\n${scenario.context}\n\n$A = \\begin{pmatrix}${scenario.matrix[0].join(" & ")} \\\\ ${scenario.matrix[1].join(" & ")}\\end{pmatrix}$`,
    },
    {
      ...base,
      id: "vectors",
      kind: "table",
      title: "Vector measurements",
      columns: ["Probe", "Input", "Transformed output"],
      rows: scenario.vectors.map((v) => [
        v.label,
        `(${v.input.join(", ")})`,
        `(${multiply(scenario.matrix, v.input).join(", ")})`,
      ]),
    },
    {
      ...base,
      id: "diagram",
      kind: "diagram",
      title: "Given transformation diagram",
      points,
      drawing: {
        axes: "cartesian",
        description:
          "Given input and transformed vectors share equal coordinate units. Exact coordinates and arrow relationships are listed below.",
        segments,
        paths: [],
        circles: [],
      },
    },
  ];
}

// Always project through the public allowlist first, even when called with a private record.
// Only an explicitly submitted attempt may add answer-bearing sections.
export function assessmentPaper(
  checked: CheckedExam,
  packet: Packet,
  assets: Record<string, string>,
  mathCss: string,
  attempt?: Attempt,
) {
  if (attempt && (!attempt.submittedAt || attempt.examId !== checked.id))
    throw new Error("Submit this attempt before exporting its review.");
  const safe = publicExam(checked),
    exam = {
      ...safe.exam,
      exhibits:
        safe.exam.exhibits ??
        (safe.scenario && safe.exam.schemaVersion !== 2
          ? legacyPaperExhibits(safe.scenario)
          : []),
    };
  const renderExhibit = (ex: Exhibit) => {
    let body = ex.content
      ? `<div class="passage ${ex.readingLayout === "prose" ? "prose" : ""}">${paperText(ex.content)}</div>`
      : "";
    if (ex.kind === "diagram") body += paperDiagram(ex) + geometryData(ex);
    if (ex.kind === "table")
      body += `<table><thead><tr>${ex.columns.map((c) => `<th>${paperText(c)}</th>`).join("")}</tr></thead><tbody>${ex.rows.map((r) => `<tr>${r.map((c) => `<td>${paperText(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    if (ex.kind === "image") {
      const image = safe.imageExhibits.find((i) => i.exhibitId === ex.id);
      if (!image || !assets[ex.id])
        throw new Error(
          "A figure is unavailable. Restore it or generate a new assessment before exporting.",
        );
      body += `<img src="${assets[ex.id]}" alt="${escapeHtml(image.description)}"/><p class="caption">${escapeHtml(image.description)}</p><p class="caption">Muse Image. AI visual review: ${escapeHtml(image.reviewStatus)}. Pixel geometry is not automatically verified; use the stated data.</p>`;
    }
    return `<section class="reference"><h3>${escapeHtml(ex.title)}${ex.synthetic ? ' <span class="label">Synthetic reference</span>' : ""}</h3>${body}${ex.source ? `<p class="caption">Source: ${escapeHtml(sourceLabel(packet, ex.source))}. Location and literal matching do not establish the interpretation.</p>` : ""}</section>`;
  };
  const scoreRows = attempt ? results(checked, attempt) : [];
  const questions = exam.questions
    .map((q) => {
      const refs = (exam.exhibits ?? []).filter((e) =>
        q.exhibitIds.includes(e.id),
      );
      const vector = q.responseDiagram
        ? `<section class="reference"><h3>Vector response</h3>${vectorPaper(
            refs.find((e) => e.id === q.responseDiagram!.exhibitId),
            q.responseDiagram,
            attempt?.responses[q.number],
          )}</section>`
        : "";
      const privateQ = attempt
        ? checked.exam.questions.find((p) => p.number === q.number)
        : undefined;
      const row = scoreRows.find((r) => r.number === q.number);
      const review =
        privateQ && attempt
          ? `<section class="solution"><h3>Your answer</h3><div class="answer">${paperText(responseText(attempt.responses[q.number] || "") || "No answer submitted.")}</div><h3>Scoring criteria</h3><ul>${privateQ.rubric.map((r) => `<li>${paperText(r.criterion)} <strong>(${r.points} points)</strong></li>`).join("")}</ul><p class="caption">${row?.selfReported ? (attempt.selfScores[q.number] === undefined ? "Needs review - no self-score recorded." : `Self-scored: ${row.earned} / ${row.possible}. This is your own assessment.`) : `Automatically checked key match: ${row?.earned} / ${row?.possible}. This does not verify the explanation.`}</p><h3>Worked solution / suggested answer</h3><div class="answer">${paperText(privateQ.answer)}</div><div class="passage">${paperText(privateQ.solution)}</div></section>`
          : q.responseDiagram
            ? `<p class="caption">Question ${q.number} · Explanation: __________________________________________</p>`
            : `<div class="working"><span>${q.responseDiagram ? "Draw your vectors on the reference diagram and explain your reasoning." : q.type === "multiple-choice" ? "Answer: __________" : "Your response / working"}</span><div></div></div>`;
      return `<section class="question${q.responseDiagram ? " vector-question" : ""}"><div class="question-stimulus"><header class="question-heading"><span>QUESTION ${q.number}${q.section ? ` / ${escapeHtml(q.section)}` : ""}</span><strong>${q.points} points · ${q.minutes} min</strong></header><h2>${escapeHtml(q.topic)}</h2><div class="prompt">${paperText(q.question)}</div>${q.subparts?.map((s) => `<p><strong>${escapeHtml(s.label)}</strong> ${paperText(s.prompt)} <span class="caption">(${s.points} points)</span></p>`).join("") || ""}${q.options.length ? `<ol class="options" type="A">${q.options.map((o) => `<li>${paperText(o)}</li>`).join("")}</ol>` : ""}${refs
        .filter((r) => r.id !== q.responseDiagram?.exhibitId)
        .map(
          (r) =>
            `<p class="caption">Use reference sheet: <strong>${escapeHtml(r.title)}</strong> (after the questions).</p>`,
        )
        .join(
          "",
        )}</div>${vector}<div class="question-tail">${review}${q.evidence?.length ? `<p class="caption evidence">Course evidence: ${q.evidence.map((r) => escapeHtml(sourceLabel(packet, r))).join("; ")}</p>` : ""}</div></section>`;
    })
    .join("");
  const sheets = (exam.exhibits ?? [])
    .filter((e) =>
      exam.questions.some(
        (q) =>
          q.exhibitIds.includes(e.id) && q.responseDiagram?.exhibitId !== e.id,
      ),
    )
    .map(
      (e) =>
        `<section class="reference-sheet"><p class="meta">REFERENCE SHEET · Questions ${exam.questions
          .filter((q) => q.exhibitIds.includes(e.id))
          .map((q) => q.number)
          .join(", ")}</p>${renderExhibit(e)}</section>`,
    )
    .join("");
  const verification = safe.verification ?? [];
  const scope = [
    ...new Set(
      verification.map(
        (v) =>
          `${v.method}: ${v.result} (${v.checkerVersion}). ${v.limitation}`,
      ),
    ),
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;"><title>${escapeHtml(exam.title)}</title><style>${mathCss}
*{box-sizing:border-box}body{margin:0;color:#182633;font:11pt/1.55 Georgia,'Times New Roman',serif;overflow-wrap:anywhere}h1,h2,h3,.brand,.meta,.question-heading,.caption,.label,.working{font-family:Arial,sans-serif}h1{font-size:21pt;line-height:1.15;margin:10px 0 14px;letter-spacing:-.8px}h2{font-size:16pt;line-height:1.3;margin:10px 0 16px}h3{font-size:11pt;margin:15px 0 9px}p{orphans:3;widows:3}.brand{font-weight:800;font-size:12pt;letter-spacing:5px;color:#234e6a}.meta{font-size:10pt;color:#435568}.cover .meta{font-size:9pt;margin:7px 0}.cover .instructions{font-size:9.5pt;line-height:1.45}.cover .caption{margin-bottom:0}.vector-question .reference{margin:12px 0;padding-top:0}.vector-question .reference svg{margin:5px auto}.vector-question .evidence{margin-top:8px}.vector-question .working div{height:10mm}.cover{border-bottom:2px solid #1e526f;padding-bottom:12px;margin-bottom:20px}.instructions,.passage,.prompt,.answer{white-space:pre-wrap}.prose{white-space:normal}.question{margin-top:26px}.question:not(.vector-question){break-inside:avoid}.question+.question{border-top:1px solid #bacbd6;padding-top:22px}.question-heading{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #b5c4cd;padding:0 0 8px;font-size:9pt;color:#31536a;break-after:avoid}.prompt{font-size:12pt}.options{padding-left:25px}.options li{padding-left:6px;margin:9px 0;break-inside:avoid}.reference{border-left:2px solid #bacbd6;padding:2px 0 2px 16px;margin:22px 0}.reference img{display:block;max-width:100%;max-height:155mm;width:auto;height:auto;object-fit:contain;margin:12px auto}.reference svg{display:block;max-height:120mm;margin:14px auto}.reference h3{break-after:avoid}.reference img,.reference svg{break-inside:avoid}.caption{font-size:8.5pt;line-height:1.5;color:#4c5d69}.label{font-size:8pt;font-weight:normal;display:block;margin-top:3px}.question-stimulus,.question-tail{break-inside:avoid}.working{font-size:9pt;color:#526777;margin-top:24px;break-inside:avoid}.working div{height:25mm;background:repeating-linear-gradient(to bottom,transparent,transparent 27px,#e3e9ed 28px);margin-top:8px}.solution{border-top:1px solid #bacbd6;margin-top:24px}.evidence{margin-top:20px}.reference-sheet{break-before:page}.checking{break-inside:avoid;margin-top:28px;border-top:1px solid #bacbd6;padding-top:16px;font-size:10pt}.checking li{margin-bottom:9px}table{border-collapse:collapse;width:100%;font-size:10pt;margin:12px 0;table-layout:fixed}thead{display:table-header-group}th,td{border-bottom:1px solid #ccd5dc;padding:7px;text-align:left}tr{break-inside:avoid}h2,h3{break-after:avoid}.katex{font-size:1.08em}.katex-display{margin:14px 0}.katex-display>.katex{white-space:normal}.katex-html{overflow-wrap:normal}svg text{stroke:none;fill:#162f46;font-family:Arial;font-size:12px}img,svg{-webkit-print-color-adjust:exact}ul{padding-left:20px}
</style></head><body><header class="cover"><div class="brand">VERA</div><p class="meta">${attempt ? "SUBMITTED ATTEMPT REVIEW - CONTAINS SOLUTIONS" : "PRACTICE QUESTION PAPER - NO SOLUTIONS"}${checked.fixture ? " · Authored saved example" : safe.provenance?.kind === "reviewed-copy" ? " · AI-generated, edited after review" : safe.provenance?.kind === "reprocessed" ? " · Reprocessed from retained AI generation" : " · AI-generated practice"}</p><h1>${escapeHtml(exam.title)}</h1><p class="meta">${escapeHtml(packet.name)} · ${exam.questions.length} ${exam.questions.length === 1 ? "question" : "questions"} · ${exam.totalPoints} points · ${exam.minutes} minutes suggested</p>${!checked.ready ? "<p><strong>NOT READY FOR PRACTICE. Known blocking errors remain.</strong></p>" : ""}<div class="instructions">${paperText(exam.instructions)}</div>${attempt ? `<p class="caption">Submitted: ${escapeHtml(new Date(attempt.submittedAt!).toISOString())}. Responses and self-scores reflect the server record at export.</p>` : '<p class="caption">For personal practice. Paper responses are not automatically saved to VERA. Check course rules before using uploaded material outside this workspace.</p>'}</header><main>${questions}${sheets}<section class="checking"><h2>Checking scope & source notes</h2><p>${verification.filter((v) => v.result === "passed").length} passed, ${verification.filter((v) => v.result === "failed").length} failed, ${verification.filter((v) => v.result === "unsupported").length} unsupported recorded checks. These are individual checks, not whole-exam verification. Model review is provisional.</p>${!verification.length ? "<p>Historical checking status preserved. No new automatic verification is claimed.</p>" : `<ul>${scope.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>`}${safe.issues.length ? `<h3>Recorded findings</h3><ul>${safe.issues.map((i) => `<li>${escapeHtml(i.severity)}: ${escapeHtml(i.message)}</li>`).join("")}</ul>` : ""}${safe.provenance ? `<p>${safe.provenance.kind === "reviewed-copy" ? "Separate copy edited after a blocked generation, followed by fresh model review. The unedited automatic output did not pass." : "Reprocessed from retained generation with source binding and fresh model review. This is not a fresh automatic generation success."} Predecessor assessment: ${escapeHtml(safe.provenance.parentExamId)}.</p>` : ""}<p>Evidence references identify the uploaded document and original page. They establish location, not correctness of interpretation. Open the corresponding course in VERA to inspect original pages. AI-generated questions and suggested solutions may contain errors; written and vector responses require self-scoring.</p><p class="caption">Assessment ${escapeHtml(checked.id)} · ${escapeHtml(checked.createdAt)}</p></section></main></body></html>`;
}

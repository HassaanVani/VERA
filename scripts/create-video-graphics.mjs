import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

// Editable, deterministic brand artwork. No application state or API calls.
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "assets", "video");
const font = await readFile(path.join(root, "public", "fonts", "Manrope.ttf"));
const blue = "#75c8ff", white = "#edf6fc", muted = "#95aaba", ink = "#030609";
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const text = (x, y, value, size = 28, options = "") => `<text x="${x}" y="${y}" font-size="${size}" ${options}>${esc(value)}</text>`;
const mark = (x, y, scale, color = blue, opacity = 1) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" opacity="${opacity}"><path d="M5 8L20 34L35 8"/><path d="M11 8L20 24L29 8"/><path d="M17 8L20 13L23 8"/></g>`;
const line = (d, options = "") => `<path d="${d}" fill="none" stroke="#456379" stroke-width="2" ${options}/>`;
const arrow = (d, options = "") => line(d, `marker-end="url(#arrow)" ${options}`);
const shell = (title, description, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 1920 1080" role="img" aria-labelledby="title description">
<title id="title">${esc(title)}</title><desc id="description">${esc(description)}</desc>
<defs><style>@font-face{font-family:Manrope;src:url(data:font/ttf;base64,${font.toString("base64")}) format('truetype');font-weight:200 800}text{font-family:Manrope,Arial,sans-serif;fill:${white};font-weight:500}</style>
<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="#6f9ab8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></marker>
</defs><rect width="1920" height="1080" fill="${ink}"/>${body}</svg>`;

const thumbnail = shell("VERA — Practice with evidence", "The original nested V logo above the VERA name, in light blue on midnight black.", `
${mark(680, -70, 14, blue, 0.025)}
${mark(760, 130, 10)}
${text(975, 776, "VERA", 188, 'text-anchor="middle" font-weight="650" letter-spacing="30"')}
${text(960, 865, "Practice with evidence.", 34, `text-anchor="middle" style="fill:${muted}"`)}
<path d="M920 948H1000" stroke="${blue}" stroke-width="2"/>
`);

const fullName = shell("VERA — Verified Exam and Revision Architect", "VERA expands to Verified Exam and Revision Architect. The original logo appears to the right of the full name.", `
${text(144, 315, "VERA", 178, 'font-weight="650" letter-spacing="20"')}
<path d="M148 376H230" stroke="${blue}" stroke-width="3"/>
<text x="144" y="548" font-size="76" font-weight="550"><tspan fill="${blue}">V</tspan>erified <tspan fill="${blue}">E</tspan>xam</text>
<text x="144" y="664" font-size="76" font-weight="550"><tspan fill="${muted}" font-weight="400">and </tspan><tspan fill="${blue}">R</tspan>evision <tspan fill="${blue}">A</tspan>rchitect</text>
<path d="M1232 235V800" stroke="#1a2a36" stroke-width="1"/>
${mark(1270, 235, 13)}
${text(148, 904, "Your materials. A plan you control. Practice you can inspect.", 28, `style="fill:${muted}"`)}
`);

function node(x, y, { label, title, detail, note, color = blue, optional = false }) {
  return `<g><rect x="${x}" y="${y}" width="360" height="190" rx="8" fill="#080d13" stroke="${optional ? "#395164" : "#223544"}" stroke-width="1.5" ${optional ? 'stroke-dasharray="6 6"' : ""}/>
<path d="M${x + 25} ${y}H${x + 84}" stroke="${color}" stroke-width="3"/>
${text(x + 25, y + 39, label, 16, `letter-spacing="1.2" font-weight="700" style="fill:${color}"`)}
${text(x + 25, y + 86, title, 26, 'font-weight="650"')}
${text(x + 25, y + 126, detail, 19, `style="fill:${muted}"`)}
${note ? text(x + 25, y + 155, note, 19, `style="fill:${muted}"`) : ""}</g>`;
}

const pipeline = shell("How VERA builds a practice exam", "Course evidence is understood by Muse Spark, then the student approves a plan. Muse Spark generates the exam. Optional figures use Muse Image followed by Spark visual review; exact figures may use SVG. VERA runs code checks, Spark solves with the key withheld, and a separate Spark pass compares solutions. Targeted repair can repeat checking up to twice. Unresolved blocking errors prevent practice. Model reviews remain provisional.", `
${text(120, 131, "From material to practice.", 60, 'font-weight="650" letter-spacing="-1.5"')}
${text(122, 184, "An approved plan, separate solving, and checks you can inspect.", 27, `style="fill:${muted}"`)}
${mark(1591, 78, 2.1)}${text(1693, 139, "VERA", 32, 'font-weight="650" letter-spacing="5"')}
${text(122, 250, "START WITH YOUR COURSE PAGES", 17, `letter-spacing="1.6" style="fill:${muted}"`)}
${arrow("M480 377H548")}${arrow("M920 377H988")}
${arrow("M1360 377H1428", 'stroke-dasharray="5 6"')}
${text(1400, 350, "IF NEEDED", 12, `text-anchor="middle" letter-spacing="0.6" style="fill:${muted}"`)}
${line("M1180 472V535H1620")}${arrow("M1620 472V598")}
${text(1300, 525, "Direct route for text / SVG", 17, `text-anchor="middle" style="fill:${muted}"`)}
${arrow("M1440 705H1372")}${arrow("M1000 705H932")}${arrow("M560 705H492")}
${text(520, 681, "READY", 13, `text-anchor="middle" letter-spacing="1" style="fill:${muted}"`)}
${arrow("M740 800V892H1620V812", 'style="stroke:#75c8ff"')}
<rect x="855" y="866" width="650" height="50" rx="6" fill="${ink}"/>
${text(1180, 898, "Targeted repair · Muse Spark · up to 2 cycles", 24, `text-anchor="middle" style="fill:${blue}"`)}
${node(120, 282, { label: "META · MUSE SPARK", title: "Understand sources", detail: "Page-linked objectives and topics.", note: "Preserve source references." })}
${node(560, 282, { label: "STUDENT DECISION", title: "Review & approve plan", detail: "Adjust topics, time and formats.", note: "Edits require fresh approval.", color: white })}
${node(1000, 282, { label: "META · MUSE SPARK", title: "Generate exam", detail: "Questions, rubrics and exhibits.", note: "Follow the approved plan." })}
${node(1440, 282, { label: "OPTIONAL · META FIGURES", title: "Create & inspect figures", detail: "Muse Image → Spark visual review.", note: "Precise figures can use SVG.", optional: true })}
${node(1440, 610, { label: "VERA · DETERMINISTIC CODE", title: "Run supported checks", detail: "References, totals, calculations.", note: "Report coverage and limitations.", color: "#b7c8d3" })}
${node(1000, 610, { label: "META · MUSE SPARK", title: "Solve without the key", detail: "A separate solution pass.", note: "Answer key withheld." })}
${node(560, 610, { label: "META · MUSE SPARK", title: "Compare solutions", detail: "Surface disputes and uncertainty.", note: "Repair errors, then rerun checks." })}
${node(120, 610, { label: "STUDENT WORKSPACE", title: "Practice & review", detail: "Known blocking errors resolved.", note: "Review limits stay visible.", color: white })}
${text(122, 866, "Unresolved blocking errors", 21, `style="fill:${muted}"`)}
${text(122, 896, "prevent practice.", 21, `style="fill:${muted}"`)}
<path d="M120 959H1800" stroke="#1a2a36"/>
${text(122, 1002, "Spark passes use Muse Spark 1.3; generated images use Muse Image 1.0.", 19, `style="fill:${muted}"`)}
${text(122, 1034, "Model reviews are provisional. Passing supported checks does not verify every answer.", 19, `style="fill:${muted}"`)}
`);

await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  for (const [name, svg] of [["vera-thumbnail", thumbnail], ["vera-full-name", fullName], ["vera-ai-pipeline", pipeline]]) {
    await writeFile(path.join(destination, `${name}.svg`), svg, "utf8");
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden}svg{display:block;width:1920px;height:1080px}</style></head><body>${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const overflowing = await page.locator("svg text").evaluateAll((elements) => elements.flatMap((element) => {
      const box = element.getBBox();
      return box.x < 0 || box.y < 0 || box.x + box.width > 1920 || box.y + box.height > 1080 ? [element.textContent] : [];
    }));
    if (overflowing.length) throw new Error(`Text exceeds canvas in ${name}: ${overflowing.join("; ")}`);
    const crowded = await page.locator("svg g").evaluateAll((groups) => groups.flatMap((group) => {
      const rectangle = group.querySelector(":scope > rect");
      if (!rectangle) return [];
      const right = Number(rectangle.getAttribute("x")) + Number(rectangle.getAttribute("width")) - 20;
      return [...group.querySelectorAll("text")].flatMap((element) => {
        const box = element.getBBox();
        return box.x + box.width > right ? [element.textContent] : [];
      });
    }));
    if (crowded.length) throw new Error(`Text exceeds node padding in ${name}: ${crowded.join("; ")}`);
    await page.screenshot({ path: path.join(destination, `${name}.png`) });
    console.log(`${name}: editable SVG + 3840 × 2160 PNG`);
  }
} finally {
  await browser.close();
}

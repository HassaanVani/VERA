import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "assets", "video", "opening");
const font = await readFile(path.join(root, "public", "fonts", "Manrope.ttf"));
const paper = "#f4f1ea", ink = "#252d2a", quiet = "#606e67", green = "#416b60";

const icons = [
  `<rect x="22" y="13" width="58" height="75" rx="3"/><path d="M36 13V8H66V13M36 35H66M36 49H66M36 63H55"/>`,
  `<path d="M22 75L29 54L68 15L83 30L44 69Z M29 54L44 69M59 24L74 39M22 75L44 69M18 88H83"/>`,
  `<circle cx="43" cy="42" r="28"/><path d="M63 63L84 84M29 42L39 52L57 32"/>`,
  `<path d="M77 30A34 34 0 1 0 82 65M77 30V10M77 30H57"/><path d="M36 50L47 61L66 40"/>`,
];
const labels = [["Plan", "the exam"], ["Take", "the exam"], ["Check", "the reasoning"], ["Practice", "what I missed"]];
const centers = [300, 740, 1180, 1620];

function artwork(reveal) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 1920 1080" role="img" aria-labelledby="title description">
<title id="title">One complete study loop${reveal ? " — So I built VERA" : ""}</title>
<desc id="description">Plan the exam, take the exam, check the reasoning, and practice what I missed. A restrained editorial slide on warm paper, with four line illustrations.${reveal ? " The closing line reads: So I built VERA." : ""}</desc>
<defs><style>@font-face{font-family:Manrope;src:url(data:font/ttf;base64,${font.toString("base64")}) format('truetype');font-weight:200 800}text{font-family:Manrope,Arial,sans-serif;fill:${ink}}</style>
<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#acb5ad" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<rect width="1920" height="1080" fill="${paper}"/>
<text x="960" y="261" text-anchor="middle" font-size="80" letter-spacing="-2" style="font-family:Georgia,'Times New Roman',serif">One complete study loop.</text>
<path d="M928 315H992" stroke="${green}" stroke-width="2"/>
${centers.slice(0, -1).map((x) => `<path d="M${x + 100} 487H${x + 340}" stroke="#b8c0b8" stroke-width="1.8" fill="none" marker-end="url(#arrow)"/>`).join("")}
${centers.map((x, i) => `<g transform="translate(${x - 50} 437)" stroke="${i === 3 ? green : ink}" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round" fill="none">${icons[i]}</g>
<text x="${x}" y="639" text-anchor="middle" font-size="44" font-weight="650">${labels[i][0]}</text>
<text x="${x}" y="696" text-anchor="middle" font-size="33" font-weight="450" style="fill:${quiet}">${labels[i][1]}</text>`).join("")}
${reveal ? `<text x="960" y="898" text-anchor="middle" font-size="42" font-weight="450">So I built <tspan font-weight="750" style="fill:${green}">VERA.</tspan></text>` : ""}
</svg>`;
}

await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  for (const [name, reveal] of [["study-loop", false], ["study-loop-reveal", true]]) {
    const svg = artwork(reveal);
    await writeFile(path.join(destination, `${name}.svg`), svg, "utf8");
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden}svg{display:block;width:1920px;height:1080px}</style></head><body>${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.locator("svg text").evaluateAll((elements) => elements.flatMap((element) => {
      const box = element.getBBox();
      return box.x < 96 || box.x + box.width > 1824 || box.y < 80 || box.y + box.height > 1000 ? [element.textContent] : [];
    }));
    if (overflow.length) throw new Error(`Text outside safe margins: ${overflow.join("; ")}`);
    await page.screenshot({ path: path.join(destination, `${name}.png`) });
    console.log(`${name}: 3840 × 2160 PNG and editable SVG`);
  }
} finally {
  await browser.close();
}

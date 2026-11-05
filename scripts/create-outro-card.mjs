import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "assets", "video");
const font = await readFile(path.join(root, "public", "fonts", "Manrope.ttf"));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 1920 1080" role="img" aria-labelledby="title description">
<title id="title">VERA — Materials, exam and revision together</title>
<desc id="description">Materials plus exam plus revision, together above the original VERA logo and wordmark. Closing line: Practice built around what you’re actually studying.</desc>
<defs><style>@font-face{font-family:Manrope;src:url(data:font/ttf;base64,${font.toString("base64")}) format('truetype');font-weight:200 800}text{font-family:Manrope,Arial,sans-serif;fill:#edf6fc}</style></defs>
<rect width="1920" height="1080" fill="#030609"/>
<text x="470" y="210" text-anchor="middle" font-size="51" font-weight="550" letter-spacing="-1">Materials</text>
<text x="715" y="207" text-anchor="middle" font-size="32" font-weight="400" style="fill:#75c8ff">+</text>
<text x="960" y="210" text-anchor="middle" font-size="51" font-weight="550" letter-spacing="-1">Exam</text>
<text x="1205" y="207" text-anchor="middle" font-size="32" font-weight="400" style="fill:#75c8ff">+</text>
<text x="1450" y="210" text-anchor="middle" font-size="51" font-weight="550" letter-spacing="-1">Revision</text>
<text x="960" y="282" text-anchor="middle" font-size="28" font-weight="450" style="fill:#95aaba">Together in one place.</text>
<g transform="translate(800 333) scale(8)" fill="none" stroke="#75c8ff" stroke-width="2.2" stroke-linejoin="round"><path d="M5 8L20 34L35 8"/><path d="M11 8L20 24L29 8"/><path d="M17 8L20 13L23 8"/></g>
<text x="973" y="814" text-anchor="middle" font-size="174" font-weight="650" letter-spacing="26">VERA</text>
<text x="960" y="916" text-anchor="middle" font-size="31" font-weight="450" style="fill:#b5c7d3">Practice built around what you’re actually studying.</text>
</svg>`;

await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, "vera-together-outro.svg"), svg, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden}svg{display:block;width:1920px;height:1080px}</style></head><body>${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.locator("svg text").evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBBox();
    return box.x < 120 || box.x + box.width > 1800 || box.y < 80 || box.y + box.height > 1000 ? [element.textContent] : [];
  }));
  if (overflow.length) throw new Error(`Text outside video-safe margins: ${overflow.join("; ")}`);
  await page.screenshot({ path: path.join(destination, "vera-together-outro.png") });
  console.log("vera-together-outro: 3840 × 2160 PNG and editable SVG.");
} finally {
  await browser.close();
}

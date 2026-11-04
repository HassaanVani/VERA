import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Attempt, CheckedExam, ImageArtifact, Packet } from "./contracts";
import { get } from "./store";
import { assessmentPaper } from "./paper";

const require = createRequire(import.meta.url);
let mathStyles: Promise<string> | undefined;
function mathCss() {
  return (mathStyles ??= (async () => {
    const root = path.dirname(
      require.resolve(/* turbopackIgnore: true */ "katex/dist/katex.min.css"),
    );
    let css = await readFile(path.join(root, "katex.min.css"), "utf8");
    const urls = [
      ...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1])),
    ];
    for (const url of urls) {
      const font = await readFile(path.join(root, url));
      const mime = url.endsWith(".woff2")
        ? "font/woff2"
        : url.endsWith(".woff")
          ? "font/woff"
          : "font/ttf";
      css = css.replaceAll(
        `url(${url})`,
        `url(data:${mime};base64,${font.toString("base64")})`,
      );
    }
    return css;
  })());
}

export async function paperHtml(
  exam: CheckedExam,
  packet: Packet,
  attempt?: Attempt,
) {
  const assets: Record<string, string> = {};
  for (const image of exam.imageExhibits ?? []) {
    const asset = get<ImageArtifact>("image", image.assetId);
    if (!asset || asset.exhibitId !== image.exhibitId)
      throw new Error(
        "A linked figure is missing. Restore it or generate a new assessment.",
      );
    const bytes = await readFile(asset.path);
    if (
      bytes.length > 20_000_000 ||
      createHash("sha256").update(bytes).digest("hex") !== asset.sha256
    )
      throw new Error(
        "A figure failed its file integrity check. Generate a new assessment.",
      );
    assets[image.exhibitId] =
      `data:image/png;base64,${bytes.toString("base64")}`;
  }
  return assessmentPaper(exam, packet, assets, await mathCss(), attempt);
}

// A single bounded local renderer avoids competing Chromium processes and makes
// failure recoverable without consuming model tokens or writing partial files.
let rendering = false;
export async function exportPdf(
  exam: CheckedExam,
  packet: Packet,
  attempt?: Attempt,
) {
  if (rendering)
    throw new Error("Another PDF is being prepared. Try again in a moment.");
  rendering = true;
  let browser: import("playwright").Browser | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const html = await paperHtml(exam, packet, attempt);
    const { chromium } = await import("playwright");
    const configured = process.env.VERA_PDF_BROWSER;
    if (configured && !path.isAbsolute(configured))
      throw new Error(
        "VERA_PDF_BROWSER must be an absolute browser executable path.",
      );
    try {
      browser = await chromium.launch({
        headless: true,
        timeout: 15000,
        ...(configured
          ? { executablePath: configured }
          : { channel: "chrome" }),
      });
    } catch {
      if (configured)
        throw new Error(
          "The configured PDF browser could not start. Check VERA_PDF_BROWSER and retry.",
        );
      try {
        browser = await chromium.launch({ headless: true, timeout: 15000 });
      } catch {
        throw new Error(
          "PDF export needs Chrome or Chromium. Install Chrome, or run npm run setup:pdf, then retry.",
        );
      }
    }
    deadline = setTimeout(() => {
      void browser?.close();
    }, 30000);
    const context = await browser.newContext({
      javaScriptEnabled: false,
      offline: true,
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 15000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      tagged: true,
      outline: true,
      margin: { top: "18mm", bottom: "19mm", left: "19mm", right: "19mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;margin:0 19mm;font:9px Arial;color:#526777;display:flex;justify-content:space-between"><span>VERA · Personal practice · Check scope inside</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
  } finally {
    if (deadline) clearTimeout(deadline);
    await browser?.close().catch(() => {});
    rendering = false;
  }
}

export function pdfFilename(title: string, review = false) {
  const stem =
    title
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 90) || "assessment";
  return `VERA-${stem}${review ? "-review" : ""}.pdf`;
}

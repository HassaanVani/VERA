import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.VERA_TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.VERA_BROWSER_EXECUTABLE
    ? { executablePath: process.env.VERA_BROWSER_EXECUTABLE }
    : { channel: "chrome" }),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [],
  errors = [];
const check = (name, value) => {
  if (!value) throw Error(name);
  checks.push(name);
};
const snapshot = async () =>
  (await page.request.get(`${base}/api/workspace`)).json();
const post = async (route, data) => {
  const r = await page.request.post(`${base}/api/${route}`, {
    data,
    headers: { "x-vera-local": "1" },
  });
  if (!r.ok()) throw Error(await r.text());
  return r.json();
};
async function until(select) {
  for (let i = 0; i < 100; i++) {
    const value = select(await snapshot());
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error("Worker did not finish");
}
await mkdir("output/pdf-browser", { recursive: true });
page.on("pageerror", (e) => errors.push(e.message));
try {
  check(
    "isolated credential-disabled workspace",
    (await snapshot()).meta.testWorkspace === true,
  );
  const { packetId } = await post("demo", { kind: "general" });
  const revision = await until((s) =>
    s.revisions.find((r) => r.packetId === packetId),
  );
  const approved = await post(`revisions/${revision.id}`, {
    blueprint: revision.blueprint,
    approve: true,
  });
  await post("jobs", { kind: "generate", packetId, revisionId: approved.id });
  const exam = await until((s) =>
    s.exams.find((e) => e.packetId === packetId && e.ready),
  );
  await page.goto(`${base}/?course=${packetId}&view=exam&exam=${exam.id}`);
  const download = page.getByRole("button", {
    name: "Download PDF",
    exact: true,
  });
  await download.waitFor();
  await page.route("**/api/exams/*/pdf", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "PDF browser temporarily unavailable. Try again.",
      }),
    }),
  );
  await download.click();
  await page
    .getByRole("alert")
    .filter({ hasText: "PDF browser temporarily unavailable" })
    .waitFor();
  check(
    "failed PDF download has an inline retryable error",
    await download.isEnabled(),
  );
  await page.unroute("**/api/exams/*/pdf");
  const event = page.waitForEvent("download");
  await download.click();
  const file = await event;
  check(
    "PDF rather than JSON download filename",
    file.suggestedFilename().endsWith(".pdf"),
  );
  await file.saveAs("output/pdf-browser/question-paper.pdf");
  const response = await page.request.get(`${base}/api/exams/${exam.id}/pdf`);
  check(
    "actual PDF signature",
    (await response.body()).subarray(0, 5).toString() === "%PDF-",
  );
  check(
    "PDF MIME, attachment and no-store headers",
    response.headers()["content-type"] === "application/pdf" &&
      response.headers()["cache-control"] === "no-store" &&
      response.headers()["content-disposition"].includes("attachment"),
  );
  check(
    "error clears after successful retry",
    (await page
      .getByRole("alert")
      .filter({ hasText: "PDF browser temporarily unavailable" })
      .count()) === 0,
  );
  const attempt = await post("attempts", { examId: exam.id, mode: "untimed" });
  const denied = await page.request.get(
    `${base}/api/attempts/${attempt.id}/pdf`,
  );
  check("active attempt review PDF forbidden", denied.status() === 403);
  check(
    "missing assessment fails clearly",
    (await page.request.get(`${base}/api/exams/no-such-exam/pdf`)).status() ===
      404,
  );
  await post(`attempts/${attempt.id}`, {
    responses: {
      1: "A",
      2: "6 words",
      3: "Saved answer for PDF review",
      4: "My evidence-based response",
    },
    submit: true,
  });
  await page.goto(`${base}/?course=${packetId}&view=results&exam=${exam.id}`);
  const reviewButton = page.getByRole("button", {
    name: "Download review PDF",
    exact: true,
  });
  await reviewButton.waitFor();
  const reviewEvent = page.waitForEvent("download");
  await reviewButton.click();
  const review = await reviewEvent;
  await review.saveAs("output/pdf-browser/submitted-review.pdf");
  check(
    "submitted review PDF download",
    review.suggestedFilename().endsWith("-review.pdf"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    "mobile review export fits viewport",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "output/pdf-browser/review-mobile.png",
    fullPage: true,
  });
  check(
    "export needs no model spending",
    (await snapshot()).usage.spent === 0 ||
      (await snapshot()).usage.total === 0 ||
      (await snapshot()).usage.recent.length === 0,
  );
  check("no browser exceptions", errors.length === 0);
  await writeFile(
    "output/pdf-browser/report.json",
    JSON.stringify(
      { checks, errors, examId: exam.id, attemptId: attempt.id },
      null,
      2,
    ),
  );
  console.log(`${checks.length} PDF browser checks passed`);
} finally {
  await browser.close();
}

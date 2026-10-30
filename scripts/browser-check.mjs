import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const pw = process.env.VERA_PLAYWRIGHT_MODULE;
const { chromium } = await import(pw ? pathToFileURL(pw).href : "playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VERA_BROWSER_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("output/browser", { recursive: true });
const base = process.env.VERA_TEST_URL || "http://127.0.0.1:3000";
const snapshot = () =>
  page.request.get(`${base}/api/workspace`).then((r) => r.json());
const screenshot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `output/browser/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
};
try {
  await page.goto(base);
  await page.getByRole("heading", { name: "Your course library." }).waitFor();
  await page.getByRole("button", { name: "Open sample course" }).waitFor();
  await screenshot("overview-desktop");
  await page
    .getByRole("textbox", { name: "Search courses" })
    .fill("no-such-course-VERA");
  await page.getByRole("heading", { name: "No matching courses" }).waitFor();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("button", { name: "Open sample course" }).click();
  await page
    .getByRole("heading", { name: "Question plan" })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Approve exam plan" }).click();
  await page.getByRole("button", { name: "Generate practice exam" }).waitFor();
  await screenshot("blueprint-desktop");
  await page.getByRole("button", { name: "Generate practice exam" }).click();
  await page
    .getByText("Numerical & structural checks passed", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByRole("tab", { name: "02 Measurements" }).click();
  await page.getByRole("cell", { name: "(3, 1)", exact: true }).waitFor();
  await page.getByRole("tab", { name: "03 Diagram" }).click();
  await screenshot("assessment-desktop");
  await page
    .getByRole("button", { name: "Show solutions & marking guide" })
    .click();
  await page.getByText("WORKED SOLUTION", { exact: true }).first().waitFor();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("radio").first().check();
  await page.getByText("Responses saved locally", { exact: true }).waitFor();
  const data = await snapshot();
  const attempt = data.attempts[0],
    exam = data.exams.find((e) => e.id === attempt.examId);
  if (attempt.responses["1"] !== "A")
    throw new Error("Autosave did not persist selected MC answer.");
  await page.reload();
  // The active view and selected course are restored as well as the answer.
  await page.getByRole("radio").first().waitFor();
  if (!(await page.getByRole("radio").first().isChecked()))
    throw new Error("Answer did not survive refresh.");
  await page.getByRole("button", { name: "Question 3", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your reasoning" })
    .fill("A(2,-1) = (5,-1). The coordinate ratios differ.");
  await page.getByText("Responses saved locally", { exact: true }).waitFor();
  await screenshot("practice-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Supporting exhibits", exact: true })
    .click();
  await page.getByRole("tab", { name: "02 Measurements" }).click();
  await page.getByRole("cell", { name: "(3, 1)", exact: true }).waitFor();
  await page.getByRole("tab", { name: "02 Measurements" }).focus();
  await page.keyboard.press("ArrowRight");
  if (
    (await page
      .getByRole("tab", { name: "03 Diagram" })
      .getAttribute("aria-selected")) !== "true"
  )
    throw new Error("Exhibit keyboard navigation failed.");
  await screenshot("practice-mobile-exhibits");
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("textbox", { name: "Your reasoning" }).waitFor();
  await screenshot("practice-mobile");
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw new Error("Mobile practice overflows.");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Question 5", exact: true }).click();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await page.getByRole("dialog", { name: "Finish this attempt?" }).waitFor();
  await page.getByRole("button", { name: "Finish & view results" }).click();
  await page.getByText("PRACTICE SCORE", { exact: true }).waitFor();
  if (
    await page
      .getByRole("button", { name: "Create focused practice" })
      .isEnabled()
  )
    throw new Error("Follow-up must wait for written-answer scores.");
  for (const [i, select] of (
    await page.getByLabel("Points earned").all()
  ).entries()) {
    await select.selectOption(i === 0 ? "2" : "3");
    await page.waitForTimeout(350);
  }
  await screenshot("results-desktop");
  await page.getByRole("button", { name: "Create focused practice" }).click();
  await page
    .getByRole("heading", { name: /Targeted follow-up/ })
    .waitFor({ timeout: 30000 });
  const after = await snapshot();
  if (
    after.exams[0].exam.questions.length !== 3 ||
    after.exams[0].scenario.matrix[0][0] === exam.scenario.matrix[0][0]
  )
    throw new Error("Follow-up did not create a fresh focused scenario.");
  const forbidden = await page.request.post(`${base}/api/demo`, { data: {} });
  if (forbidden.status() !== 400)
    throw new Error("Missing local-request header was accepted.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await screenshot("overview-mobile");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (overflow) throw new Error("Mobile overview overflows horizontally.");
  await page
    .getByRole("button", { name: "Add course materials", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  if (await page.getByRole("dialog").count())
    throw new Error("Upload dialog did not close with Escape.");
  await page
    .getByRole("button", { name: "Add course materials", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Course name" })
    .fill("Image ingestion · browser check");
  await page
    .locator('input[type="file"]')
    .setInputFiles("fixtures/probe-matrix.png");
  await page
    .getByRole("button", { name: "Save materials", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Course evidence", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "p. 1", exact: true }).click();
  await page.getByRole("dialog", { name: "Source page" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Build exam plan" }).click();
  await page
    .getByRole("alert")
    .getByText(/Add MODEL_API_KEY/)
    .waitFor();
  if (errors.length)
    throw new Error(`Browser exceptions: ${errors.join("; ")}`);
  await writeFile(
    "output/browser/report.json",
    JSON.stringify(
      {
        status: "passed",
        checkedAt: new Date().toISOString(),
        errors,
        checks: [
          "demo analysis",
          "blueprint approval",
          "saved exam generation",
          "exhibits",
          "solutions",
          "MC autosave",
          "refresh recovery",
          "free-response autosave",
          "submission",
          "self-grading",
          "targeted follow-up",
          "local-request header",
          "mobile overflow",
          "mobile practice panes",
          "keyboard exhibit tabs",
          "finish review",
          "grading prerequisites",
          "URL view restoration",
          "course search",
          "dialog Escape",
          "image upload",
          "source inspection",
          "missing-key recovery",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Browser workflow checks passed. Screenshots: output/browser/.");
} finally {
  await browser.close();
}

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
  const initialAttempts = (await snapshot()).attempts.length;
  await page.goto(base);
  await page.getByRole("heading", { name: "Your course library." }).waitFor();
  await page.getByRole("button", { name: "Open sample course" }).waitFor();
  await screenshot("overview-desktop");
  await page.getByRole("button", { name: "Open sample course" }).click();
  await page
    .getByRole("heading", { name: "Question plan" })
    .waitFor({ timeout: 30000 });
  // Required fields are recoverable and drafts survive an accidental refresh.
  const originalTitle = await page
    .getByLabel("Exam title", { exact: true })
    .inputValue();
  await page.getByLabel("Exam title", { exact: true }).fill("");
  await page.getByRole("button", { name: "Approve exam plan" }).click();
  await page
    .getByRole("alert")
    .getByText("Check these details before continuing")
    .waitFor();
  if (
    (await page
      .getByLabel("Exam title", { exact: true })
      .getAttribute("aria-invalid")) !== "true"
  )
    throw new Error("Invalid title was not associated with its field.");
  await page
    .getByLabel("Exam title", { exact: true })
    .fill(originalTitle + " · recovered draft");
  await page.reload();
  await page
    .getByText("Recovered your unfinished edits from this browser.", {
      exact: true,
    })
    .waitFor();
  if (
    (await page.getByLabel("Exam title", { exact: true }).inputValue()) !==
    originalTitle + " · recovered draft"
  )
    throw new Error("Plan edits were lost on refresh.");
  await page
    .getByRole("button", { name: "Discard edits", exact: true })
    .click();
  await page.getByRole("button", { name: "Approve exam plan" }).click();
  await page.getByRole("button", { name: "Generate practice exam" }).waitFor();
  await page.getByLabel("Question 1 points", { exact: true }).fill("0");
  if (
    await page.getByRole("button", { name: "Generate practice exam" }).count()
  )
    throw new Error("Editing an approved plan did not remove generation.");
  await page
    .getByRole("button", { name: "Discard edits", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("blueprint-mobile");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Mobile plan overflows.");
  const titleWidth = await page
    .getByLabel("Exam title", { exact: true })
    .evaluate((el) => el.getBoundingClientRect().width);
  if (titleWidth < 220)
    throw new Error("Exam title field is too narrow to edit.");
  await page.setViewportSize({ width: 1440, height: 1100 });
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
  await page
    .getByRole("dialog", { name: "Ready to start practice?" })
    .waitFor();
  if ((await snapshot()).attempts.length !== initialAttempts)
    throw new Error("Practice timer started before explicit confirmation.");
  await page
    .getByRole("button", { name: "Keep previewing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start timed practice", exact: true })
    .click();
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "Flag for review", exact: true })
    .click();
  await page.getByText("Responses saved locally", { exact: true }).waitFor();
  const data = await snapshot();
  const attempt = data.attempts[0],
    exam = data.exams.find((e) => e.id === attempt.examId);
  if (attempt.responses["1"] !== "A")
    throw new Error("Autosave did not persist selected MC answer.");
  await page.reload();
  // The active view and selected course are restored as well as the answer.
  await page.getByRole("radio").first().waitFor();
  await page
    .getByRole("button", { name: "Question 1, answered, flagged", exact: true })
    .waitFor();
  if (!(await page.getByRole("radio").first().isChecked()))
    throw new Error("Answer did not survive refresh.");
  await page.getByRole("button", { name: "Question 3", exact: true }).click();
  let answerSaveRequests = 0;
  const countAnswerSave = (request) => {
    if (request.method() === "POST" && request.url().includes("/api/attempts/"))
      answerSaveRequests++;
  };
  page.on("request", countAnswerSave);
  const typedSave = page.waitForResponse(
    (response) =>
      response.url().includes("/api/attempts/") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("textbox", { name: "Your reasoning" })
    .pressSequentially("A(2,-1) = (5,-1). The coordinate ratios differ.", {
      delay: 10,
    });
  if (
    (await page
      .getByRole("textbox", { name: "Your reasoning" })
      .inputValue()) !== "A(2,-1) = (5,-1). The coordinate ratios differ."
  )
    throw new Error("Question navigation stole focus while typing.");
  await typedSave;
  await page.getByText("Responses saved locally", { exact: true }).waitFor();
  page.off("request", countAnswerSave);
  if (answerSaveRequests !== 1)
    throw new Error(
      `Typing queued ${answerSaveRequests} saves instead of one debounced save.`,
    );
  // A failed request must never be followed by a false saved indication.
  await page.route("**/api/attempts/*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Save interrupted for recovery check.",
          }),
        })
      : route.continue(),
  );
  await page
    .getByRole("textbox", { name: "Your reasoning" })
    .fill("Unsaved recovery draft: A(2,-1) = (5,-1).");
  await page.getByText("Answers not saved", { exact: true }).waitFor();
  if (await page.getByText("Responses saved locally", { exact: true }).count())
    throw new Error("Failed save is being shown as saved.");
  await page.reload();
  await page.getByRole("textbox", { name: "Your reasoning" }).waitFor();
  if (
    !(
      await page.getByRole("textbox", { name: "Your reasoning" }).inputValue()
    ).startsWith("Unsaved recovery draft")
  )
    throw new Error("Unsaved text did not survive reload.");
  await page.getByText("Answers not saved", { exact: true }).waitFor();
  await page.unroute("**/api/attempts/*");
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  await page.getByText("Responses saved locally", { exact: true }).waitFor();
  const recovered = await snapshot();
  if (
    !recovered.attempts[0].responses["3"].startsWith("Unsaved recovery draft")
  )
    throw new Error("Retry did not save recovered text.");
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
  await page
    .getByRole("button", { name: "Save & leave practice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume practice", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume practice", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Your reasoning" }).waitFor();
  if ((await snapshot()).attempts[0].id !== attempt.id)
    throw new Error("Resume created a new attempt.");
  await page
    .getByRole("button", { name: "Question 1, answered, flagged", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Question 5", exact: true }).click();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await page.getByRole("dialog", { name: "Finish this attempt?" }).waitFor();
  await page.getByRole("button", { name: /Question 2.*Unanswered/ }).click();
  await page.getByRole("button", { name: "Question 2", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Finish attempt", exact: true })
    .click();
  await page.getByRole("button", { name: "Finish & view results" }).click();
  await page.getByText("PRACTICE SCORE", { exact: true }).waitFor();
  await page
    .getByText("Score so far · written answers pending", { exact: true })
    .waitFor();
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
  await page
    .getByRole("textbox", { name: "Search courses" })
    .fill("no-such-course-VERA");
  await page.getByRole("heading", { name: "No matching courses" }).waitFor();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
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
    .getByRole("button", { name: "Review materials", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Image ingestion · browser check",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Back to files", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Course name" }).waitFor();
  await page
    .getByRole("button", { name: "Review materials", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save materials", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Course evidence", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "p. 1", exact: true }).click();
  await page.getByRole("dialog", { name: "Source page" }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("heading", {
      name: "Your materials are saved. Connect Meta to build a plan.",
      exact: true,
    })
    .waitFor();
  if (
    await page
      .getByRole("button", { name: "Build exam plan", exact: true })
      .isEnabled()
  )
    throw new Error(
      "Unconfigured live analysis should explain its prerequisite before starting.",
    );
  await page.route("**/api/workspace", (route) =>
    route.abort("connectionrefused"),
  );
  await page.getByText("VERA isn’t responding.", { exact: true }).waitFor();
  await page.unroute("**/api/workspace");
  await page
    .getByRole("button", { name: "Try reconnecting", exact: true })
    .click();
  await page.getByText("Local workspace", { exact: true }).waitFor();
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
          "missing-key prerequisite guidance",
          "plan validation and error focus",
          "draft refresh recovery",
          "approval invalidation after editing",
          "explicit timer-start confirmation",
          "question flag persistence",
          "question position restoration",
          "failed-save feedback",
          "unsaved response recovery",
          "explicit save retry",
          "question-level finish review",
          "partial-score labeling",
          "upload document-role review",
          "save and leave practice",
          "library resume",
          "resume preserves attempt and timer",
          "mobile plan field widths and overflow",
          "debounced typed autosave",
          "workspace disconnect and reconnect",
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

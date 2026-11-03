import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.VERA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.VERA_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VERA_BROWSER_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const base = process.env.VERA_TEST_URL || "http://127.0.0.1:3001",
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("output/browser-v2", { recursive: true });
const snapshot = () =>
  page.request.get(`${base}/api/workspace`).then((r) => r.json());
const shot = async (name) => {
  await page.screenshot({
    path: `output/browser-v2/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
};
const check = (name, condition) => {
  if (!condition) throw new Error(name);
  checks.push(name);
};
try {
  await page.goto(base);
  await page.getByText("Explore a saved example", { exact: true }).click();
  await page.getByRole("button", { name: "Try evidence & decisions" }).click();
  await page
    .getByRole("heading", { name: "Question plan", exact: true })
    .waitFor();
  await page.getByLabel("Subject", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Source evidence & difficulty" })
    .count();
  const firstSource = page
    .getByRole("button", { name: /VERA original evidence.*p\. 1/ })
    .first();
  const planDraft = page.getByLabel("Exam title", { exact: true });
  await planDraft.fill("Evidence and decisions · my practice");
  await page
    .getByText("Source evidence & difficulty", { exact: true })
    .first()
    .click();
  await firstSource.click();
  await page.getByRole("dialog", { name: "Source page" }).waitFor();
  await page.keyboard.press("Escape");
  check(
    "source viewing preserves plan edits",
    (await planDraft.inputValue()) === "Evidence and decisions · my practice",
  );
  await page.getByRole("button", { name: "Approve exam plan" }).click();
  await page.getByRole("button", { name: "Generate practice exam" }).click();
  await page
    .getByText("Structural checks passed · review checking coverage", {
      exact: true,
    })
    .waitFor({ timeout: 30000 });
  const data = await snapshot(),
    exam = data.exams.find(
      (e) => e.exam.title === "Evidence and decisions · my practice",
    );
  check(
    "generic exam has no forced matrix",
    !exam.scenario && exam.exam.exhibits.length === 0,
  );
  check(
    "generic exam supports four appropriate formats",
    exam.exam.questions.map((q) => q.type).join(",") ===
      "multiple-choice,numeric,short-answer,essay",
  );
  check(
    "no empty exhibit workspace",
    (await page
      .getByRole("region", { name: "Supporting exhibits" })
      .count()) === 0,
  );
  const serialized = JSON.stringify(exam);
  check(
    "workspace excludes private grading fields",
    !['"answer":', '"numeric":', '"claims":', '"solution":', '"rubric":'].some(
      (key) => serialized.includes(key),
    ),
  );
  await shot("generic-preview-desktop");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("radio", { name: /Untimed practice/ }).check();
  await page
    .getByRole("button", { name: "Start untimed practice", exact: true })
    .click();
  await page.getByText("Untimed practice", { exact: true }).waitFor();
  check(
    "untimed practice hides countdown",
    (await page.getByRole("timer").count()) === 0,
  );
  const attempt = (await snapshot()).attempts.find((a) => a.examId === exam.id);
  const denied = await page.request.get(
    `${base}/api/attempts/${attempt.id}/solutions`,
  );
  check("unsubmitted attempt cannot fetch solutions", denied.status() === 403);
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your answer, including the requested unit" })
    .fill("18-12 words");
  await page
    .getByText("Answers saved on this device’s VERA server", { exact: true })
    .waitFor();
  await page.reload();
  check(
    "untimed answer and question survive refresh",
    (await page
      .getByRole("textbox", {
        name: "Your answer, including the requested unit",
      })
      .inputValue()) === "18-12 words",
  );
  await page.getByRole("button", { name: "Question 3", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your reasoning" })
    .fill("Write a definition from memory before checking the notes.");
  await page.getByRole("button", { name: "Question 4", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your reasoning" })
    .fill(
      "Randomize students into equal-time practice groups. Compare delayed recall and acknowledge that a small sample limits the conclusions.",
    );
  await page
    .getByText("Answers saved on this device’s VERA server", { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    "mobile practice hides irrelevant exhibit switch",
    (await page
      .getByRole("button", { name: "Supporting exhibits", exact: true })
      .count()) === 0,
  );
  check(
    "generic practice has no horizontal overflow",
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
  );
  await shot("untimed-practice-mobile");
  await page
    .getByRole("button", { name: "Finish practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Finish & view results" }).click();
  await page.getByText("AUTOMATICALLY CHECKED", { exact: true }).waitFor();
  check(
    "numeric arithmetic alternative is automatically scored",
    (await page
      .getByRole("heading", { name: "10 / 10", exact: true })
      .count()) === 1,
  );
  check(
    "written work is explicitly ungraded",
    (await page
      .getByText("Score so far · written answers pending", { exact: true })
      .count()) === 1,
  );
  check(
    "review shows evidence links",
    (await page
      .getByRole("button", { name: /VERA original evidence.*p\. 1/ })
      .count()) >= 4,
  );
  check(
    "review has no horizontal overflow",
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
  );
  await shot("review-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const reports = page.getByText("Report incorrect or unhelpful feedback", {
    exact: true,
  });
  await reports.first().click();
  await page
    .getByRole("textbox", { name: "What should be reviewed?" })
    .fill(
      "Please explain the difference between a matching key and verified reasoning.",
    );
  await page.route("**/api/feedback/*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Report save interrupted for recovery test.",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Save feedback report", exact: true })
    .click();
  await page
    .getByText(
      "Your report was not saved. Your text is still here; try again.",
      { exact: true },
    )
    .waitFor();
  check(
    "failed feedback report preserves typed text",
    (
      await page
        .getByRole("textbox", { name: "What should be reviewed?" })
        .inputValue()
    ).includes("matching key"),
  );
  await page.unroute("**/api/feedback/*");
  await page
    .getByRole("button", { name: "Save feedback report", exact: true })
    .click();
  await page
    .getByText(
      "Report saved with the original feedback. Your score has not changed.",
      { exact: true },
    )
    .waitFor();
  await page.reload();
  await page.getByText("Reported · 1 saved reports", { exact: true }).waitFor();
  check("feedback reports persist across refresh", true);
  check(
    "both written grading controls are available",
    (await page.getByLabel(/Points earned/).count()) === 2,
  );
  for (const select of await page.getByLabel(/Points earned/).all()) {
    await select.selectOption("3");
    await page.waitForTimeout(450);
  }
  await page
    .getByText("All written answers have a self-score.", { exact: true })
    .waitFor();
  await page
    .getByText("What was checked—and what wasn’t", { exact: true })
    .nth(1)
    .click();
  await page.getByText("arithmetic · passed", { exact: true }).waitFor();
  check(
    "checking limitations remain visible",
    (await page
      .getByText("written-reasoning · not automatically verified", {
        exact: true,
      })
      .count()) > 0,
  );
  await shot("review-desktop");
  await page
    .getByRole("button", { name: "Create focused practice", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Question plan", exact: true })
    .waitFor();
  const plan = (await snapshot()).revisions[0];
  check(
    "follow-up remains editable and unapproved",
    !plan.approved && plan.parentExamId === exam.id,
  );
  await page
    .getByRole("button", { name: "Approve exam plan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate practice exam", exact: true })
    .click();
  await page
    .getByText("Structural checks passed · review checking coverage", {
      exact: true,
    })
    .waitFor({ timeout: 30000 });
  const focused = (await snapshot()).exams[0];
  check(
    "generic follow-up keeps appropriate questions and no forced scenario",
    focused.ready &&
      !focused.scenario &&
      focused.exam.questions.length === 2 &&
      focused.exam.questions.every((q) =>
        ["short-answer", "essay"].includes(q.type),
      ),
  );
  await page
    .getByRole("button", { name: /^Materials/ })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Material readiness", exact: true })
    .waitFor();
  await page
    .getByRole("combobox", {
      name: "Role for VERA original evidence and learning notes",
    })
    .selectOption("textbook");
  await page.waitForTimeout(400);
  check(
    "material roles can be corrected",
    (await snapshot()).packets.find((p) => p.id === exam.packetId).documents[0]
      .role === "textbook",
  );
  check(
    "role correction invalidates latest approval",
    !(await snapshot()).revisions[0].approved,
  );
  check("no browser exceptions", errors.length === 0);
  await writeFile(
    "output/browser-v2/report.json",
    JSON.stringify(
      { status: "passed", checkedAt: new Date().toISOString(), checks, errors },
      null,
      2,
    ),
  );
  console.log(
    `${checks.length} additional cross-subject browser checks passed.`,
  );
} catch (error) {
  await shot("failure");
  throw error;
} finally {
  await browser.close();
}

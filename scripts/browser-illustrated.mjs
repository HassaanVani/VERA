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
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(15000);
const base = process.env.VERA_TEST_URL || "http://127.0.0.1:3001";
const checks = [],
  errors = [],
  measurements = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("output/illustrated", { recursive: true });
const snapshot = () =>
  page.request.get(`${base}/api/workspace`).then((r) => r.json());
const check = (name, value) => {
  if (!value) throw new Error(name);
  checks.push(name);
};
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `output/illustrated/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
};
try {
  if (!(await snapshot()).meta.testWorkspace)
    throw new Error(
      "Use an isolated credential-disabled VERA_TEST_WORKSPACE=1 server.",
    );
  await page.goto(base);
  await page.getByText("Explore a saved example", { exact: true }).click();
  await page
    .getByRole("button", { name: "Explore diagrams & documents" })
    .click();
  await page
    .getByRole("heading", { name: "Question plan", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Approve exam plan" }).click();
  await page.getByRole("button", { name: "Generate practice exam" }).click();
  await page
    .getByText("Structural checks passed · review checking coverage", {
      exact: true,
    })
    .waitFor({ timeout: 30000 });
  const exam = (await snapshot()).exams[0];
  check(
    "one preview question at a time",
    (await page.locator(".question-sheet h3").count()) === 1,
  );
  check(
    "diagram renders a polygon, circle and arrow",
    (await page.locator(".geometry-reference svg polygon").count()) === 1 &&
      (await page.locator(".geometry-reference svg > circle").count()) === 1 &&
      (await page.locator(".geometry-reference line[marker-end]").count()) ===
        1,
  );
  await page.getByText("Diagram data & description", { exact: true }).click();
  check(
    "diagram has exact accessible point data",
    (await page.locator(".diagram-data").innerText()).includes("A: (6, 0)"),
  );
  await shot("diagram-preview-desktop");
  await page
    .getByRole("button", { name: "Preview question 3", exact: true })
    .click();
  check(
    "question selects only relevant reference",
    (await page.locator(".geometry-reference").count()) === 0 &&
      (await page
        .getByRole("button", { name: "View original · page 2" })
        .count()) === 1,
  );
  await page.getByRole("button", { name: "View original · page 2" }).click();
  await page.getByRole("dialog", { name: "Source page" }).waitFor();
  await page
    .frameLocator(".source-modal iframe")
    .getByText(/We ask the council/)
    .waitFor();
  check(
    "source opens its actual cited page",
    (await page.getByLabel("Source page number").inputValue()) === "2",
  );
  await page.keyboard.press("Escape");
  await shot("source-preview-desktop");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("radio", { name: /Untimed practice/ }).check();
  await page
    .getByRole("button", { name: "Start untimed practice", exact: true })
    .click();
  const numeric = page.getByRole("textbox", {
    name: "Your answer, including the requested unit",
  });
  await numeric.fill("12 m²");
  await page
    .getByText("Answers saved on this device’s VERA server", { exact: true })
    .waitFor();
  const attempt = (await snapshot()).attempts.find((a) => a.examId === exam.id);
  const denied = await page.request.get(
    `${base}/api/attempts/${attempt.id}/solutions`,
  );
  check(
    "illustrated attempt withholds solutions",
    denied.status() === 403 && !JSON.stringify(exam).includes('"solution":'),
  );
  for (const width of [2560, 1920, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 1080 });
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      question: document
        .querySelector(".question-sheet")
        .getBoundingClientRect().width,
      primary: getComputedStyle(
        document.querySelector(".question-footer .primary"),
      ).backgroundColor,
      primaryText: getComputedStyle(
        document.querySelector(".question-footer .primary"),
      ).color,
    }));
    measurements.push(layout);
    check(
      `question and reference do not overflow at ${width}px`,
      !layout.overflow,
    );
    if (width >= 1024)
      check(`reading column is bounded at ${width}px`, layout.question <= 761);
    if (width === 1920) await shot("diagram-practice-desktop");
    if (width === 390) {
      check("mobile starts with the question", await numeric.isVisible());
      await page
        .getByRole("button", { name: "Supporting exhibits", exact: true })
        .click();
      check(
        "mobile can switch to diagram",
        (await page.locator(".geometry-reference").isVisible()) &&
          !(await numeric.isVisible()),
      );
      await shot("diagram-practice-mobile");
      await page
        .getByRole("button", { name: "Questions", exact: true })
        .click();
      check("mobile can return to answer", await numeric.isVisible());
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  check(
    "answer survives refresh with diagram",
    (await numeric.inputValue()) === "12 m²",
  );
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await numeric.fill("7.065 m²");
  await page.getByRole("button", { name: "Question 3", exact: true }).click();
  const written = page.getByRole("textbox", { name: "Your reasoning" });
  await written.fill(
    "The author requests access to the river. The petition alone cannot establish whether every resident agreed; another record or viewpoint is needed.",
  );
  await page.getByRole("button", { name: "View original · page 2" }).click();
  await page.getByRole("dialog", { name: "Source page" }).waitFor();
  await page.keyboard.press("Escape");
  check(
    "source viewer preserves practice response",
    (await written.inputValue()).includes("another record"),
  );
  await shot("source-practice-desktop");
  await page
    .getByRole("button", { name: "Finish practice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish & view results", exact: true })
    .click();
  await page.getByRole("heading", { name: "10 / 10", exact: true }).waitFor();
  check(
    "numeric work scored and interpretation remains ungraded",
    (await page
      .getByText("Score so far · written answers pending", { exact: true })
      .count()) === 1,
  );
  await shot("illustrated-review");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByText("Explore a saved example", { exact: true }).click();
  await page
    .getByRole("button", { name: "Explore diagrams & documents" })
    .click();
  await page.getByRole("button", { name: "Approve exam plan" }).click();
  await page.getByRole("button", { name: "Generate practice exam" }).click();
  await page
    .getByText("Structural checks passed · review checking coverage", {
      exact: true,
    })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("radio", { name: /Timed exam/ }).check();
  await page
    .getByRole("button", { name: "Start timed practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Hide timer", exact: true }).click();
  check(
    "timer can be hidden without stopping attempt",
    (await page.getByRole("timer").count()) === 0 &&
      (await page
        .getByRole("button", { name: "Show timer", exact: true })
        .count()) === 1,
  );
  await page.getByRole("button", { name: "Show timer", exact: true }).click();
  check("timer can be restored", (await page.getByRole("timer").count()) === 1);
  check("no browser exceptions", errors.length === 0);
  await writeFile(
    "output/illustrated/report.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checks, errors, measurements },
      null,
      2,
    ),
  );
  console.log(`${checks.length} illustrated assessment checks passed.`);
} catch (error) {
  await shot("failure");
  throw error;
} finally {
  await browser.close();
}

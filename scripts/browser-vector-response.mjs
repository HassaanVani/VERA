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
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  hasTouch: true,
});
page.setDefaultTimeout(15000);
const base = process.env.VERA_TEST_URL || "http://127.0.0.1:3001",
  checks = [],
  errors = [],
  measurements = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () =>
  page.request.get(`${base}/api/workspace`).then((r) => r.json());
const check = (name, value) => {
  if (!value) throw Error(name);
  checks.push(name);
};
const shot = (name) =>
  page.screenshot({
    path: `output/vector-study/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
await mkdir("output/vector-study", { recursive: true });
async function saveAfter(action) {
  const ack = page.waitForResponse(
    (r) =>
      r.url().includes("/api/attempts/") && r.request().method() === "POST",
  );
  await action();
  check("drawing update acknowledged by server", (await ack).ok());
}
async function at(x, y) {
  return page.locator(".vector-answer-canvas").evaluate(
    (svg, { x, y }) => {
      const matrix = svg.getScreenCTM();
      const scale = Math.min(500 / 7, 340 / 6),
        height = 6 * scale + 80;
      const point = new DOMPoint(
        40 + (x + 1) * scale,
        height - 40 - (y + 1) * scale,
      ).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    },
    { x, y },
  );
}
async function tap(x, y) {
  const point = await at(x, y);
  await page.touchscreen.tap(point.x, point.y);
}
try {
  if (!(await snapshot()).meta.testWorkspace)
    throw Error(
      "Use an isolated credential-disabled VERA_TEST_WORKSPACE=1 server.",
    );
  await page.goto(base);
  await page.getByText("Explore a saved example", { exact: true }).click();
  await page.getByRole("button", { name: "Try vector drawing" }).click();
  await page
    .getByRole("heading", { name: "Question plan", exact: true })
    .waitFor();
  check(
    "plan declares vector answer method",
    (await page
      .getByRole("combobox", { name: "Question 1 answer method", exact: true })
      .count()) === 1 ||
      (await page.getByText("A transformed vector", { exact: true }).count()) >
        0,
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
  const workspace = await snapshot(),
    exam = workspace.exams[0];
  check("drawing example is labeled authored", exam.fixture === true);
  check(
    "authored status is visible before opening checking details",
    await page.locator(".authored-label").isVisible(),
  );
  check(
    "public drawing payload excludes keys",
    !["answer", "solution", "rubric", "claims"].some((field) =>
      JSON.stringify(exam).includes(`"${field}":`),
    ),
  );
  const first = await page.locator(".question-sheet").boundingBox(),
    firstFooter = await page.locator(".preview-paging").boundingBox();
  await page
    .getByRole("button", { name: "Preview question 2", exact: true })
    .click();
  const second = await page.locator(".question-sheet").boundingBox(),
    secondFooter = await page.locator(".preview-paging").boundingBox();
  check(
    "preview question has a stable top anchor",
    Math.abs(first.y - second.y) < 2,
  );
  check(
    "preview footer stays level across different prompt lengths",
    Math.abs(firstFooter.y - secondFooter.y) < 2,
  );
  check("question begins above the viewport midpoint", first.y < 540);
  measurements.push({ first, second, firstFooter, secondFooter });
  await shot("preview-desktop");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("radio", { name: /Untimed practice/ }).check();
  await page
    .getByRole("button", { name: "Start untimed practice", exact: true })
    .click();
  await page.locator(".vector-answer-canvas").waitFor();
  check(
    "drawing replaces the detached duplicate reference",
    (await page.locator(".exhibit-panel").count()) === 0,
  );
  const attempt = (await snapshot()).attempts.find((a) => a.examId === exam.id);
  check(
    "solutions remain private while drawing",
    (
      await page.request.get(`${base}/api/attempts/${attempt.id}/solutions`)
    ).status() === 403,
  );
  await page
    .getByText("Enter exact coordinates instead", { exact: true })
    .click();
  for (const [name, value] of [
    ["Start x", "0"],
    ["Start y", "0"],
    ["End x", "4"],
    ["End y", "2"],
  ])
    await page.getByRole("spinbutton", { name, exact: true }).fill(value);
  await saveAfter(() =>
    page.getByRole("button", { name: "Add vector", exact: true }).click(),
  );
  check(
    "keyboard coordinate entry creates the intended vector",
    (await page.locator(".vector-list").innerText()).includes(
      "(0, 0) → (4, 2)",
    ),
  );
  await saveAfter(() =>
    page
      .getByRole("button", { name: "Remove last vector", exact: true })
      .click(),
  );
  check(
    "removing the only vector restores an unanswered response",
    !(await snapshot()).attempts.find((a) => a.id === attempt.id).responses[1],
  );
  await page.locator(".vector-answer-canvas").scrollIntoViewIfNeeded();
  await tap(0, 0);
  await saveAfter(() => tap(2, 1));
  check(
    "touch start/end entry saves exact coordinates",
    (await page.locator(".vector-list").innerText()).includes(
      "(0, 0) → (2, 1)",
    ),
  );
  const start = await at(1, 0),
    end = await at(3, 2);
  await saveAfter(async () => {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  });
  check(
    "pointer drag adds a separate vector",
    (await page.locator(".vector-list li").count()) === 2,
  );
  await saveAfter(() =>
    page
      .getByRole("textbox", { name: "Explain your drawing", exact: true })
      .fill(
        "I used the given components and distinguished the final vector from the intermediate arrow.",
      ),
  );
  await page.reload();
  await page.locator(".vector-answer-canvas").waitFor();
  check(
    "refresh restores the vectors and explanation",
    (await page.locator(".vector-list li").count()) === 2 &&
      (
        await page
          .getByRole("textbox", { name: "Explain your drawing", exact: true })
          .inputValue()
      ).includes("given components"),
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const firstStem = await page.locator(".question-sheet h3").boundingBox();
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await page.waitForFunction(() => scrollY < 2);
  const secondStem = await page.locator(".question-sheet h3").boundingBox();
  check(
    "practice navigation keeps the question's top position",
    Math.abs(firstStem.y - secondStem.y) < 3,
  );
  measurements.push({ firstStem, secondStem });
  await page
    .getByText("Enter exact coordinates instead", { exact: true })
    .click();
  for (const [name, value] of [
    ["Start x", "0"],
    ["Start y", "0"],
    ["End x", "1"],
    ["End y", "4"],
  ])
    await page.getByRole("spinbutton", { name, exact: true }).fill(value);
  await saveAfter(() =>
    page.getByRole("button", { name: "Add vector", exact: true }).click(),
  );
  await shot("drawing-desktop");
  for (const width of [2560, 1920, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      `drawing and controls fit at ${width}px`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (width === 390) await shot("drawing-mobile");
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page
    .getByRole("button", { name: "Finish practice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish & view results", exact: true })
    .click();
  await page.getByText("AUTOMATICALLY CHECKED", { exact: true }).waitFor();
  check(
    "review shows read-only drawings for both questions",
    (await page.locator(".is-readonly .vector-answer-canvas").count()) === 2,
  );
  check(
    "review does not print raw vector JSON",
    !(await page.locator(".review-workspace").innerText()).includes(
      "VERA_VECTOR_V1",
    ),
  );
  check(
    "ungraded drawing is marked for self-review",
    (await page.getByText("2 written answers", { exact: true }).count()) > 0,
  );
  const locked = await page.request.post(`${base}/api/attempts/${attempt.id}`, {
    headers: { "x-vera-local": "1" },
    data: { responses: { 1: "" } },
  });
  check("submitted drawing is locked by the server", !locked.ok());
  await shot("review-desktop");
  check("no browser exceptions", errors.length === 0);
  await writeFile(
    "output/vector-study/report.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checks, errors, measurements },
      null,
      2,
    ),
  );
  console.log(`${checks.length} vector response checks passed.`);
} catch (error) {
  await shot("failure");
  throw error;
} finally {
  await browser.close();
}

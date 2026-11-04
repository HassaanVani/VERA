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
await mkdir("output/preparation", { recursive: true });
const snapshot = () =>
  page.request.get(`${base}/api/workspace`).then((r) => r.json());
const check = (name, value) => {
  if (!value) throw new Error(name);
  checks.push(name);
};
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `output/preparation/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
};
async function inspect(view) {
  for (const width of [2560, 1920, 1440, 1024, 821, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 1080 });
    const layout = await page.evaluate(() => {
      const main = document.querySelector("main").getBoundingClientRect();
      const heading = document
        .querySelector(".page-title")
        .getBoundingClientRect();
      const brand = document
        .querySelector(".brand-home")
        .getBoundingClientRect();
      const primary = document
        .querySelector(".material-files, .plan-primary")
        .getBoundingClientRect();
      return {
        width: innerWidth,
        main: { left: main.left, right: main.right, width: main.width },
        contentLeft: heading.left,
        brandLeft: brand.left,
        primaryWidth: primary.width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    measurements.push({ view, ...layout });
    check(`${view}: no horizontal overflow at ${width}px`, !layout.overflow);
    check(
      `${view}: centered page boundary at ${width}px`,
      Math.abs(layout.main.left - (width - layout.main.right)) < 2 &&
        layout.main.width <= 1441,
    );
    check(
      `${view}: header and content align at ${width}px`,
      Math.abs(layout.contentLeft - layout.brandLeft) < 2,
    );
    if (width >= 1024)
      check(
        `${view}: primary content has a readable width at ${width}px`,
        layout.primaryWidth <= 981,
      );
    if (width === 1920 || width === 390) await shot(`${view}-${width}`);
    if (view === "materials" && width === 390) {
      const action = await page
        .locator(".materials-action .primary")
        .boundingBox();
      const policy = await page.locator(".source-policy").boundingBox();
      check(
        "mobile materials prioritize the next action before policy details",
        action.y + action.height <= policy.y,
      );
    }
    if (view === "plan" && width === 390) {
      const assumptions = await page.locator(".plan-assumptions").boundingBox();
      const approval = await page.locator(".plan-footer").boundingBox();
      check(
        "mobile assumptions remain visible before approval",
        assumptions.y + assumptions.height <= approval.y,
      );
    }
  }
}
try {
  if (!(await snapshot()).meta.testWorkspace)
    throw new Error(
      "Use an isolated credential-disabled VERA_TEST_WORKSPACE=1 server.",
    );
  await page.goto(base);
  await page.getByText("Explore a saved example", { exact: true }).click();
  await page.getByRole("button", { name: "Try evidence & decisions" }).click();
  await page
    .getByRole("heading", { name: "Question plan", exact: true })
    .waitFor();
  await inspect("plan");
  await page.setViewportSize({ width: 1920, height: 1080 });
  const column = await page.locator(".plan-primary").boundingBox(),
    footer = await page.locator(".plan-footer").boundingBox();
  check(
    "approval stays within the question column",
    Math.abs(column.x + column.width - footer.x - footer.width) < 2,
  );
  await page.getByText("Title and subject", { exact: true }).click();
  const title = page.getByLabel("Exam title", { exact: true });
  await title.fill("My balanced practice plan");
  await page.locator(".plan-question summary").first().click();
  const format = page.getByLabel("Question 1 format", { exact: true });
  await format.selectOption("numeric");
  check(
    "format balance updates with actual edits",
    (await page
      .locator(".balance-list")
      .first()
      .locator("li")
      .filter({ hasText: "Numeric answer" })
      .locator("span")
      .last()
      .innerText()) === "2",
  );
  await format.selectOption("multiple-choice");
  await page.getByText("Why these topics?", { exact: true }).click();
  await page.locator(".plan-evidence .source-link").first().click();
  await page.getByRole("dialog", { name: "Source page" }).waitFor();
  await page.keyboard.press("Escape");
  check(
    "evidence viewing preserves edited title",
    (await title.inputValue()) === "My balanced practice plan",
  );
  for (const width of [1024, 821, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      `expanded plan fields fit at ${width}px`,
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
    );
  }
  await shot("plan-editing-mobile");
  const savedResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/revisions/") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  check(
    "draft save receives a server acknowledgment",
    (await savedResponse).ok(),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "My balanced practice plan", exact: true })
    .waitFor();
  check("saved plan edits survive refresh", true);
  await page
    .getByRole("button", { name: /^Materials/ })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Your files", exact: true })
    .waitFor();
  check(
    "readiness reports actual extracted page count",
    (await page.locator(".material-text-coverage").innerText()) ===
      "1 page with extracted text · 1 total",
  );
  await inspect("materials");
  await page.getByText("Document details", { exact: true }).click();
  await page
    .getByRole("combobox", {
      name: "Role for VERA original evidence and learning notes",
    })
    .selectOption("past-exam");
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".materials-action")
        .textContent.includes("No past assessment"),
  );
  check("readiness guidance follows the corrected document role", true);
  await page.getByRole("button", { name: "View pages", exact: true }).click();
  await page.getByRole("dialog", { name: "Source page" }).waitFor();
  await page.keyboard.press("Escape");
  check(
    "source viewing returns to document controls",
    await page
      .getByRole("combobox", {
        name: "Role for VERA original evidence and learning notes",
      })
      .isVisible(),
  );
  await page
    .getByRole("button", { name: "Review exam plan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve exam plan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate practice exam", exact: true })
    .waitFor();
  check("saved plan can be approved after returning from materials", true);
  check("no browser exceptions", errors.length === 0);
  await writeFile(
    "output/preparation/report.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checks, errors, measurements },
      null,
      2,
    ),
  );
  console.log(
    `${checks.length} preparation layout and workflow checks passed.`,
  );
} catch (error) {
  await shot("failure");
  throw error;
} finally {
  await browser.close();
}

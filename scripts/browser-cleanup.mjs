import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const base = process.env.VERA_TEST_URL || "http://127.0.0.1:3001";
const checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("output/cleanup", { recursive: true });
function check(name, value) {
  if (!value) throw new Error(name);
  checks.push(name);
}
async function shot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `output/cleanup/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
try {
  const snapshot = await page.request
    .get(`${base}/api/workspace`)
    .then((r) => r.json());
  if (snapshot.meta.configured)
    throw new Error("Run cleanup tests with credentials explicitly disabled.");
  await page.goto(base);
  await page.getByRole("group", { name: "Filter courses" }).waitFor();
  check(
    "one upload entry point",
    (await page
      .getByRole("button", { name: "Add course materials", exact: true })
      .count()) === 1,
  );
  check("no generic sidebar", (await page.locator(".sidebar").count()) === 0);
  check(
    "no linear algebra template in default library",
    !/transformation lab|eigenvalue|northstar|linear algebra/i.test(
      await page.locator("body").innerText(),
    ),
  );
  check(
    "sample starts collapsed",
    !(await page.locator(".example-disclosure").getAttribute("open")),
  );
  await shot("library-desktop");
  await page
    .getByRole("button", { name: "Add course materials", exact: true })
    .click();
  const name = page.getByRole("textbox", { name: "Course name", exact: true });
  check(
    "course name starts blank with subject-neutral placeholder",
    (await name.inputValue()) === "" &&
      !/algebra/i.test(await name.getAttribute("placeholder")),
  );
  check(
    "one dismissal control in initial upload",
    (await page
      .getByRole("dialog")
      .getByRole("button", { name: /Close upload|Cancel/ })
      .count()) === 1,
  );
  await name.fill("My course draft");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "lecture-page.png",
      mimeType: "image/png",
      buffer: await readFile("fixtures/probe-matrix.png"),
    });
  const role = page.getByRole("combobox", {
    name: "Role for lecture-page.png",
  });
  check(
    "uploaded document role starts unassigned",
    (await role.inputValue()) === "",
  );
  check(
    "review requires an explicit document role",
    await page
      .getByRole("button", { name: "Review materials", exact: true })
      .isDisabled(),
  );
  await role.selectOption("assignment");
  await page
    .getByRole("button", { name: "Review materials", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to files", exact: true })
    .click();
  check(
    "review back preserves chosen role",
    (await role.inputValue()) === "assignment",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Add course materials", exact: true })
    .click();
  check(
    "closing upload preserves unfinished course name",
    (await name.inputValue()) === "My course draft",
  );
  await shot("upload-desktop");
  await page.keyboard.press("Escape");
  await page.getByText("Explore a saved example", { exact: true }).click();
  await page.getByRole("button", { name: "Try evidence & decisions" }).click();
  await page
    .getByRole("heading", { name: "Question plan", exact: true })
    .waitFor();
  check(
    "one course navigation",
    (await page.getByRole("navigation", { name: "Study steps" }).count()) === 1,
  );
  check(
    "no competing upload action inside a course",
    (await page
      .getByRole("button", { name: /New course|Add course materials/ })
      .count()) === 0,
  );
  const title = page.getByLabel("Exam title", { exact: true });
  await title.fill("My retained plan edits");
  await page
    .getByRole("navigation", { name: "Study steps" })
    .getByRole("button", { name: /^Materials/ })
    .click();
  await page
    .getByRole("heading", { name: "Material readiness", exact: true })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Study steps" })
    .getByRole("button", { name: /^Exam plan/ })
    .click();
  check(
    "course traversal preserves plan edits",
    (await title.inputValue()) === "My retained plan edits",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      `plan fits ${width}px`,
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
    );
    check(
      `all study steps visible at ${width}px`,
      (await page
        .getByRole("navigation", { name: "Study steps" })
        .getByRole("button")
        .count()) === 4,
    );
  }
  await shot("plan-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("plan-mobile");
  await page.getByRole("button", { name: "Library", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "Your courses", exact: true })
    .waitFor();
  await page.getByRole("group", { name: "Filter courses" }).waitFor();
  check(
    "library reachable by keyboard without a mobile drawer",
    (await page
      .getByRole("group", { name: "Filter courses" })
      .getByRole("button", { name: /Your courses/ })
      .getAttribute("aria-pressed")) === "true",
  );
  check(
    "saved courses are preserved behind explicit collection",
    (
      await page.getByRole("button", { name: /Saved examples/ }).innerText()
    ).match(/\d+/)?.[0] !== "0",
  );
  check(
    "saved examples do not replace own materials",
    !(await page.locator(".course-row .sample-label").count()),
  );
  check(
    "mobile library fits",
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
  );
  await shot("library-mobile");
  await page
    .getByRole("button", { name: "Add course materials", exact: true })
    .click();
  check(
    "mobile upload fits",
    !(await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth > e.clientWidth)),
  );
  await shot("upload-mobile");
  await page.keyboard.press("Escape");
  check("no page exceptions", errors.length === 0);
  await writeFile(
    "output/cleanup/report.json",
    JSON.stringify(
      { status: "passed", checkedAt: new Date().toISOString(), checks, errors },
      null,
      2,
    ),
  );
  console.log(`${checks.length} UI cleanup checks passed.`);
} catch (e) {
  await shot("cleanup-failure");
  throw e;
} finally {
  await browser.close();
}

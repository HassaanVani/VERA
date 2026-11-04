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
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(15000);
const base = process.env.VERA_TEST_URL || "http://127.0.0.1:3001";
const checks = [],
  errors = [],
  measurements = [];
const check = (name, value) => {
  if (!value) throw Error(name);
  checks.push(name);
};
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("output/muse-images", { recursive: true });
try {
  const workspace = await page.request
    .get(`${base}/api/workspace`)
    .then((r) => r.json());
  if (!workspace.meta.testWorkspace)
    throw Error(
      "Use an isolated credential-disabled VERA_TEST_WORKSPACE=1 server.",
    );
  const fixture = JSON.parse(
    await readFile("output/muse-images/fixture.json", "utf8"),
  );
  const courseUrl = `${base}/?course=${fixture.packetId}&view=exam&exam=${fixture.examId}`;
  await page.goto(`${base}/?course=${fixture.packetId}&view=blueprint`);
  const rendering = page.getByRole("combobox", {
    name: "Diagram rendering",
    exact: true,
  });
  await rendering.waitFor();
  check(
    "plan exposes the saved Muse Image preference",
    (await rendering.inputValue()) === "muse-image",
  );
  await rendering.selectOption("precise");
  await page.getByRole("button", { name: "Save draft", exact: true }).waitFor();
  check(
    "diagram preference edits require approval again",
    await page
      .getByRole("button", { name: "Approve exam plan", exact: true })
      .isVisible(),
  );
  const savedPreference = page.waitForResponse(
    (response) =>
      response.url().includes("/api/revisions/") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  check(
    "diagram preference save is acknowledged",
    (await savedPreference).ok(),
  );
  await page.reload();
  await rendering.waitFor();
  check(
    "diagram preference survives save and refresh",
    (await rendering.inputValue()) === "precise",
  );
  await page.goto(courseUrl);
  await page.locator(".generated-figure").waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector(".generated-figure");
    return image?.complete && image.naturalWidth > 0;
  });
  check(
    "private image endpoint decodes in preview",
    await page
      .locator(".generated-figure")
      .evaluate((i) => i.naturalWidth === 900),
  );
  check(
    "figure has a meaningful text alternative",
    (await page.locator(".generated-figure").getAttribute("alt")).includes(
      "Group A",
    ),
  );
  check(
    "full-size figure opens the assessment-linked asset",
    (
      await page
        .getByRole("link", { name: "Open full-size figure", exact: true })
        .getAttribute("href")
    ).endsWith(`/images/${fixture.assetId}`),
  );
  check(
    "image is explicitly synthetic",
    (await page.getByText("Synthetic material", { exact: true }).count()) > 0,
  );
  check(
    "AI review is distinct from geometry verification",
    (await page
      .getByText("AI visual review completed", { exact: false })
      .count()) === 1 &&
      (await page
        .getByText(/Image geometry is not automatically verified/)
        .count()) === 1,
  );
  await page.getByText("Figure description", { exact: true }).click();
  check(
    "expanded figure description is available",
    await page
      .getByText(
        "Two groups labeled Group A and Group B complete the same recall task.",
        { exact: true },
      )
      .isVisible(),
  );
  const data = await page.request
    .get(`${base}/api/workspace`)
    .then((r) => r.text());
  for (const field of [
    '"answer":',
    '"solution":',
    '"rubric":',
    '"illustration":',
    "PRIVATE_BROWSER_IMAGE_BRIEF",
    "generated-images",
  ])
    check(`workspace withholds ${field}`, !data.includes(field));
  const asset = await page.request.get(
    `${base}/api/exams/${fixture.examId}/images/${fixture.assetId}`,
  );
  check(
    "image API supplies PNG and nosniff",
    asset.headers()["content-type"] === "image/png" &&
      asset.headers()["x-content-type-options"] === "nosniff",
  );
  check(
    "unlinked image is unavailable",
    (
      await page.request.get(
        `${base}/api/exams/missing/images/${fixture.assetId}`,
      )
    ).status() === 404,
  );
  await page.screenshot({
    path: "output/muse-images/preview-desktop.png",
    fullPage: true,
  });
  const button = page.getByRole("button", {
    name: "Start practice",
    exact: true,
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  check(
    "mobile preview presents the question before its image sheet",
    await page.evaluate(
      () =>
        document.querySelector(".question-sheet").getBoundingClientRect().top <
        document.querySelector(".exhibit-panel").getBoundingClientRect().top,
    ),
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  const colors = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      color: s.color,
      background: s.backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
    };
  });
  const ratio = ({ color, background }) => {
    const lum = (rgb) =>
      rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    const a = lum(color),
      b = lum(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  check("primary action meets text contrast", ratio(colors) >= 4.5);
  check("workspace is midnight black", colors.page === "rgb(3, 6, 9)");
  await button.hover();
  await page.waitForTimeout(250);
  const hover = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, background: s.backgroundColor };
  });
  check("hover action meets text contrast", ratio(hover) >= 4.5);
  measurements.push({
    colors,
    normalContrast: ratio(colors),
    hoverContrast: ratio(hover),
  });
  await page
    .getByRole("button", { name: "Preview question 2", exact: true })
    .click();
  check(
    "irrelevant image desk is hidden",
    (await page.locator(".generated-figure").count()) === 0,
  );
  await page
    .getByRole("button", { name: "Preview question 1", exact: true })
    .click();
  await button.click();
  await page.getByRole("radio", { name: /Untimed practice/ }).check();
  await page
    .getByRole("button", { name: "Start untimed practice", exact: true })
    .click();
  await page
    .locator(".practice-layout .generated-figure")
    .waitFor({ state: "visible" });
  check(
    "generated figure remains beside active question",
    await page.locator(".generated-figure").isVisible(),
  );
  await page.getByRole("radio").first().check();
  await page
    .getByText("Answers saved on this device’s VERA server", { exact: true })
    .waitFor();
  for (const width of [2560, 1920, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      `no horizontal overflow at ${width}`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page
    .getByRole("button", { name: "Supporting exhibits", exact: true })
    .click();
  check(
    "mobile reference switch exposes figure",
    await page.locator(".generated-figure").isVisible(),
  );
  await page.screenshot({
    path: "output/muse-images/practice-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await page.locator(".practice-layout").waitFor();
  check(
    "refresh preserves active image attempt",
    (await page.locator(".practice-layout").count()) === 1,
  );
  check("no browser exceptions", errors.length === 0);
  await writeFile(
    "output/muse-images/report.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checks, errors, measurements },
      null,
      2,
    ),
  );
  console.log(`${checks.length} Muse Image browser checks passed.`);
} catch (error) {
  await page.screenshot({
    path: "output/muse-images/failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}

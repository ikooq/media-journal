import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];
async function login(page: Page, partner = false) {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill((partner ? process.env.E2E_PARTNER_EMAIL : process.env.E2E_EMAIL)!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(
      (partner ? process.env.E2E_PARTNER_PASSWORD : process.env.E2E_PASSWORD)!,
    );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
  await page.getByRole("button", { name: "Account menu" }).click();
  const select = page.getByLabel("Active space");
  const options = await select
    .locator("option")
    .evaluateAll((elements) =>
      elements
        .filter((e) => e.textContent?.startsWith("E2E "))
        .map((e) => (e as HTMLOptionElement).value),
    );
  if (options.length) {
    await select.selectOption(options.at(-1)!);
    await expect(select).not.toBeVisible({ timeout: 30000 });
  } else
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
}
async function settled(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}
async function noOverflow(page: Page, scope = "body") {
  const result = await page.locator(scope).evaluate((element) => ({
    width: element.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(
    result.width,
    `${scope} overflows at ${result.viewport}px`,
  ).toBeLessThanOrEqual(result.viewport + 1);
}
async function accessible(page: Page) {
  await expect(page).toHaveTitle(/our shelf/i);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test("frontend routes are responsive, accessible and use real hosted content", async ({
  page,
}, testInfo) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  const routes = [
    "/",
    "/library",
    "/calendar",
    "/us",
    "/collections",
    "/settings/profile",
    "/settings/space",
  ];
  const checked: string[] = [];
  let detail: string | null = null,
    collection: string | null = null;
  for (const route of routes) {
    await page.goto(route);
    await settled(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route === "/library")
      detail = await page
        .locator('main a[href^="/library/"]')
        .first()
        .getAttribute("href");
    if (route === "/collections")
      collection = await page
        .locator('main a[href^="/collections/"]')
        .first()
        .getAttribute("href");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await settled(page);
      await noOverflow(page);
      if ([390, 1440].includes(width)) {
        await accessible(page);
        await page.screenshot({
          path: testInfo.outputPath(
            `${route.replaceAll("/", "-") || "home"}-${width}.png`,
          ),
          fullPage: true,
          animations: "disabled",
        });
      }
      checked.push(`${route}@${width}`);
    }
  }
  for (const route of [detail, collection].filter(Boolean) as string[]) {
    await page.goto(route);
    await settled(page);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await settled(page);
      await noOverflow(page);
      checked.push(`${route}@${width}`);
    }
    await accessible(page);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/library");
  await settled(page);
  const art = page.locator(".media-art").first();
  const surface = art.locator("..");
  const bounds = await art.boundingBox();
  expect(bounds).not.toBeNull();
  const resting = await surface.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.mouse.move(bounds!.x + 12, bounds!.y + 12);
  await expect
    .poll(() =>
      surface.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(resting);
  await page.mouse.move(0, 0);
  const title = await page
    .locator('main article a[href^="/library/"]')
    .last()
    .innerText();
  await page.keyboard.press("Control+k");
  const searchDialog = page.getByRole("dialog", { name: "Search your shelf" });
  await expect(searchDialog).toBeVisible();
  await expect(page.getByLabel("Search the journal")).toBeFocused();
  await page.getByLabel("Search the journal").fill(title);
  await expect(
    searchDialog.getByRole("link").filter({ hasText: title }).first(),
  ).toBeVisible();
  await accessible(page);
  await page
    .getByLabel("Search the journal")
    .fill(`No matching saved discovery ${Date.now()}`);
  await expect(searchDialog.getByText(/No results for/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchDialog).not.toBeVisible();
  expect(errors).toEqual([]);
  await testInfo.attach("responsive-audit.json", {
    body: JSON.stringify({ checked, consoleErrors: errors }),
    contentType: "application/json",
  });
  console.log(
    `PASS frontend ${checked.length} route/viewport combinations; WCAG A/AA scans and no page overflow`,
  );
});

test("mobile touch creation, keyboard dialogs, reduced motion and journal persistence", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(240000);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    timezoneId: "Asia/Qyzylorda",
  });
  const page = await context.newPage();
  try {
    await login(page, true);
    await page.goto("/library");
    await settled(page);
    await page.getByRole("button", { name: "Filters", exact: true }).tap();
    const filters = page.getByRole("dialog", { name: "Refine your library" });
    await expect(filters).toBeVisible();
    await noOverflow(page, "dialog");
    await accessible(page);
    await page.keyboard.press("Escape");
    await expect(filters).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Filters", exact: true }),
    ).toBeFocused();
    const add = page
      .getByRole("button", { name: "Add media", exact: true })
      .filter({ visible: true });
    await add.tap();
    const dialog = page.getByRole("dialog", { name: "Keep the good stuff." });
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(add).toBeFocused();
    await add.tap();
    await dialog.getByRole("button", { name: "Create a manual entry" }).tap();
    const title = `Mobile UI verification ${Date.now()}`;
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    const participants = dialog
      .getByRole("group", { name: "Who was there?" })
      .getByRole("button");
    await expect(participants).toHaveCount(2);
    for (const button of await participants.all())
      if ((await button.getAttribute("aria-pressed")) === "false")
        await button.tap();
    const status = dialog.getByRole("radio", { name: "Watched", exact: true });
    await status.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      dialog.getByRole("radio", { name: "Watching", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(status).toHaveAttribute("aria-checked", "true");
    await accessible(page);
    await noOverflow(page, "dialog");
    await dialog.getByRole("button", { name: "Save to our shelf" }).tap();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("link", { name: title, exact: true }).tap();
    await expect(page).toHaveURL(/\/library\/[a-f0-9-]+$/);
    const reflection =
      "Ә І Ң Ғ Ү Ұ Қ Ө Һ — a thought kept from a real mobile session.\n\n" +
      "This is a real mobile acceptance reflection, checking that long paragraphs remain readable and persist in PostgreSQL. ".repeat(
        8,
      );
    await page.getByLabel("Your reflection").fill(reflection);
    await page.getByRole("button", { name: "Keep this thought" }).tap();
    await expect(page.getByText(reflection, { exact: true })).toBeVisible();
    await noOverflow(page);
    await accessible(page);
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Calendar", exact: true })
      .tap();
    await expect(page).toHaveURL(/\/calendar$/);
    await settled(page);
    await expect(
      page.getByRole("link").filter({ hasText: title }).first(),
    ).toBeVisible();
    const selected = page.locator('button[data-day][aria-pressed="true"]');
    await selected.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.locator('button[data-day][aria-pressed="true"]'),
    ).toBeFocused();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Us", exact: true })
      .tap();
    await expect(page).toHaveURL(/\/us$/);
    await settled(page);
    await noOverflow(page);
    await accessible(page);
    const durations = await page
      .locator(".route-enter")
      .evaluate((element) => getComputedStyle(element).animationDuration);
    expect(parseFloat(durations)).toBeLessThan(0.01);
    await page.screenshot({
      path: testInfo.outputPath("us-touch-reduced-motion.png"),
      fullPage: true,
      animations: "disabled",
    });
    console.log(
      "PASS mobile real save/note/Calendar, keyboard focus trapping/return, segmented controls, Kazakh text and reduced motion",
    );
  } finally {
    await context.close();
  }
});

test("authentication screens remain responsive and accessible", async ({
  page,
}) => {
  test.setTimeout(180000);
  for (const route of [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ]) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(page);
    }
    await accessible(page);
  }
});

import { chromium, expect as baseExpect } from "@playwright/test";
import nextEnv from "@next/env";
import { mkdir } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const expect = baseExpect.configure({ timeout: 30000 });
const phase = process.env.UI_CAPTURE_PHASE ?? "after";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const folder = `output/playwright/${phase}`;
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({
  baseURL,
  timezoneId: "Asia/Qyzylorda",
});
const page = await context.newPage();
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.screenshot({
    path: `${folder}/auth-desktop.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 45000 });
  await page.getByRole("button", { name: "Account menu" }).click();
  const options = await page
    .getByLabel("Active space")
    .locator("option")
    .evaluateAll((elements) =>
      elements
        .filter((e) => e.textContent.startsWith("E2E "))
        .map((e) => e.value),
    );
  if (options.length) {
    await page.getByLabel("Active space").selectOption(options.at(-1));
    await expect(page.getByLabel("Active space")).not.toBeVisible();
  }
  for (const [name, route] of [
    ["home", "/"],
    ["library", "/library"],
    ["us", "/us"],
    ["calendar", "/calendar"],
    ["collections", "/collections"],
    ["settings", "/settings/space"],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route);
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await page.screenshot({
      path: `${folder}/${name}-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${folder}/${name}-mobile.png`,
      fullPage: true,
      animations: "disabled",
    });
    console.log(`Captured ${phase} ${name}`);
  }
  await page.goto("/library");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const detail = await page
    .locator('main a[href^="/library/"]')
    .first()
    .getAttribute("href");
  if (detail) {
    await page.goto(detail);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `${folder}/detail-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await page
    .getByRole("button", { name: "Add media", exact: true })
    .filter({ visible: true })
    .click();
  await page.screenshot({
    path: `${folder}/add-mobile.png`,
    animations: "disabled",
  });
} finally {
  await context.close();
  await browser.close();
}

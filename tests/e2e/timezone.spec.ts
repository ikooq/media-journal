import { test, expect } from "@playwright/test";

test("journal dates hydrate in the viewer's timezone without server-clock mismatches", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(150000);
  const auth = await browser.newContext({ baseURL });
  const login = await auth.newPage();
  await login.goto("/login");
  await login.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await login
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await login.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(login).not.toHaveURL(/\/login/, { timeout: 30000 });
  const state = await auth.storageState();
  await auth.close();
  for (const timezoneId of ["Pacific/Kiritimati", "Etc/GMT+12"]) {
    const context = await browser.newContext({
      baseURL,
      storageState: state,
      timezoneId,
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) =>
        errors.push(`${new URL(page.url()).pathname}: ${error.message}`),
      );
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto("/calendar");
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
        timeout: 30000,
      });
      const today = await page.evaluate(() => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      });
      await expect(page.locator(`button[data-day="${today}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors, timezoneId).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

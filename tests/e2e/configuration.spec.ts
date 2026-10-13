import { test, expect } from "@playwright/test";
test("missing configuration never reveals demo content", async ({ page }) => {
  test.skip(
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    "Configuration fallback is tested only without Supabase credentials.",
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A private home for your memories." }),
  ).toBeVisible();
  await expect(page.getByText("Interstellar", { exact: true })).toHaveCount(0);
  await page.goto("/login");
  await expect(
    page.getByText("NEXT_PUBLIC_SUPABASE_URL", { exact: true }),
  ).toBeVisible();
});
test("configured app redirects unauthenticated private routes", async ({
  page,
}) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "Needs local or hosted Supabase.",
  );
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

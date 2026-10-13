import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}
test("two browser accounts persist shared memories independently of browser storage", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(360000);
  const email = process.env.E2E_EMAIL,
    password = process.env.E2E_PASSWORD,
    partnerEmail = process.env.E2E_PARTNER_EMAIL,
    partnerPassword = process.env.E2E_PARTNER_PASSWORD;
  test.skip(
    !email || !password || !partnerEmail || !partnerPassword,
    "Set both disposable test-account credentials to run the complete Supabase flow.",
  );
  const a = await browser.newContext({ baseURL, timezoneId: "Asia/Qyzylorda" });
  const b = await browser.newContext({ baseURL, timezoneId: "Asia/Qyzylorda" });
  const first = await a.newPage();
  const second = await b.newPage();
  const browserErrors: string[] = [];
  const realtimeEvents = { A: [] as string[], B: [] as string[] };
  for (const page of [first, second]) {
    const account = page === first ? "A" : "B";
    page.on("websocket", (socket) => {
      if (!socket.url().includes("/realtime/")) return;
      socket.on("framereceived", ({ payload }) => {
        try {
          const raw = JSON.parse(String(payload));
          const message = Array.isArray(raw)
            ? { event: raw[3], payload: raw[4] }
            : raw;
          if (message.event === "postgres_changes")
            realtimeEvents[account].push(message.payload.data.table);
          if (message.event === "system" && message.payload?.status === "error")
            browserErrors.push(`Realtime ${account} subscription error`);
        } catch {
          // Binary frames are not application errors.
        }
      });
      socket.on("socketerror", () =>
        browserErrors.push(`Realtime ${account} socket error`),
      );
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
  }
  await login(first, email!, password!);
  if (
    await first
      .getByRole("button", { name: "Create shared space", exact: true })
      .isVisible()
  ) {
    await first.getByLabel("Your display name").fill("Test Alice");
    await first
      .getByRole("button", { name: "Create shared space", exact: true })
      .click();
  }
  const suffix = Date.now();
  await first.goto("/settings/space");
  await first.getByLabel("New space name").fill(`E2E ${suffix}`);
  await first.getByRole("button", { name: "Create", exact: true }).click();
  await expect(first).toHaveURL(baseURL! + "/");
  await first.goto("/settings/space");
  await first
    .getByRole("button", { name: "Create partner invitation" })
    .click();
  const invite = await first.getByLabel("Invitation link").inputValue();
  await login(second, partnerEmail!, partnerPassword!);
  await second.goto(invite);
  await second.getByRole("button", { name: "Join shared space" }).click();
  await expect(second).toHaveURL(baseURL! + "/");
  console.log("PASS browser shared-space creation and invitation join");
  await first.goto("/library");
  await first
    .getByRole("button", { name: "Add media", exact: true })
    .filter({ visible: true })
    .click();
  await first.getByRole("button", { name: "Create a manual entry" }).click();
  const modal = first.getByRole("dialog", { name: "Keep the good stuff." });
  const title = `A shared memory ${suffix}`;
  await modal.getByLabel("Title", { exact: true }).fill(title);
  const participantButtons = modal
    .getByRole("group", { name: "Who was there?" })
    .getByRole("button");
  await expect(participantButtons).toHaveCount(2);
  for (const button of await participantButtons.all())
    if ((await button.getAttribute("aria-pressed")) === "false")
      await button.click();
  await modal.getByRole("button", { name: "Save to our shelf" }).click();
  await expect(modal).not.toBeVisible();
  await first.getByRole("link", { name: title, exact: true }).last().click();
  await expect(first).toHaveURL(/\/library\/[a-f0-9-]+$/);
  const detailUrl = first.url();
  console.log("PASS browser media creation and detail navigation");
  await first.getByLabel("Your reflection").fill(`A reflection ${suffix}`);
  await first.getByRole("button", { name: "Keep this thought" }).click();
  await expect(
    first.getByText(`A reflection ${suffix}`, { exact: true }),
  ).toBeVisible();
  await first.getByLabel("Your rating out of 10").fill("9.1");
  await first
    .getByLabel("Your rating out of 10")
    .locator("..")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await first
    .getByRole("button", { name: "Save favorite", exact: true })
    .click();
  await second.goto(detailUrl);
  await expect(
    second.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    second.getByText(`A reflection ${suffix}`, { exact: true }),
  ).toBeVisible();
  // Use client navigation, not a fresh document, to cover channel lifecycle.
  await second
    .getByRole("link", { name: "Back to library", exact: true })
    .click();
  await expect(second).toHaveURL(/\/library$/);
  await second.getByRole("link", { name: title, exact: true }).last().click();
  await expect(
    second.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await second
    .getByLabel("Your reflection")
    .fill(`Partner reflection ${suffix}`);
  await second.getByRole("button", { name: "Keep this thought" }).click();
  await expect(
    second.getByText(`Partner reflection ${suffix}`, { exact: true }),
  ).toBeVisible();
  await second.getByLabel("Your rating out of 10").fill("7.2");
  await second
    .getByLabel("Your rating out of 10")
    .locator("..")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(second.getByText("7.2", { exact: true })).toBeVisible();
  await second
    .getByRole("button", { name: "Save favorite", exact: true })
    .click();
  await expect(
    second.getByText("Loved by both", { exact: true }),
  ).toBeVisible();
  await expect(first.getByText("9.1", { exact: true })).toBeVisible();
  await expect(first.getByText("7.2", { exact: true })).toBeVisible();
  await expect(
    first.getByText(`Partner reflection ${suffix}`, { exact: true }),
  ).toBeVisible();
  await first
    .getByLabel("Reply to reflection")
    .first()
    .fill(`A reply ${suffix}`);
  await first
    .getByRole("button", { name: "Reply", exact: true })
    .first()
    .click();
  await second.getByRole("button", { name: /Notifications/ }).click();
  await expect(second.getByText("A reply to your reflection")).toBeVisible();
  console.log(
    "PASS browser notes, reply notification, ratings, favorites and live partner invalidation",
  );
  await first.goto("/collections");
  await first.getByRole("button", { name: "New collection" }).click();
  await first
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill(`Collection ${suffix}`);
  await first.getByRole("button", { name: "Save collection" }).click();
  await expect(first.getByRole("dialog")).not.toBeVisible();
  await first.goto(detailUrl);
  await first
    .getByLabel("Add to collection")
    .selectOption({ label: `Collection ${suffix}` });
  await first
    .getByLabel("Add to collection")
    .locator("..")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await first.getByLabel("Watch later intent").selectOption("together");
  await expect(first.getByLabel("Watch later intent")).toHaveValue("together");
  await first
    .getByRole("button", { name: "Add viewing session", exact: true })
    .click();
  const viewing = first.getByRole("dialog", { name: "Add viewing session" });
  await expect(
    viewing.getByRole("group", { name: "Who was there?" }).getByRole("button"),
  ).toHaveCount(2);
  for (const button of await viewing
    .getByRole("group", { name: "Who was there?" })
    .getByRole("button")
    .all())
    if ((await button.getAttribute("aria-pressed")) === "false")
      await button.click();
  await viewing
    .getByRole("button", { name: "Save session", exact: true })
    .click();
  await expect(viewing).not.toBeVisible();
  await expect(first.getByText(/2 people · Finished/)).toHaveCount(2);
  await expect(second.getByText(/2 people · Finished/)).toHaveCount(2);
  console.log(
    "PASS browser collection, watch-together and viewing-session mutations",
  );
  const videoUrl = "https://youtu.be/dQw4w9WgXcQ";
  await first
    .getByRole("button", { name: "Add media", exact: true })
    .filter({ visible: true })
    .click();
  await first.getByPlaceholder("https://youtube.com/watch?v=…").fill(videoUrl);
  await first.getByRole("button", { name: "Preview", exact: true }).click();
  await modal.getByLabel("Title", { exact: true }).fill(`Video ${suffix}`);
  await modal
    .getByRole("button", { name: "Save to our shelf", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await first
    .getByRole("button", { name: "Add media", exact: true })
    .filter({ visible: true })
    .click();
  await first.getByPlaceholder("https://youtube.com/watch?v=…").fill(videoUrl);
  await first.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    modal.getByText("This item is already in your library.", { exact: true }),
  ).toBeVisible();
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await first.goto("/library");
  await first
    .getByPlaceholder("Search your shelf")
    .filter({ visible: true })
    .fill(`A shared memory ${suffix}`);
  await expect(
    first.getByRole("link", { name: title, exact: true }).last(),
  ).toBeVisible();
  await first.goto("/calendar");
  await expect(
    first.getByRole("link").filter({ hasText: title }).first(),
  ).toBeVisible();
  await first.evaluate(() => localStorage.clear());
  await first.goto(detailUrl);
  await expect(
    first.getByText(`A reflection ${suffix}`, { exact: true }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  for (const events of Object.values(realtimeEvents)) {
    expect(events).toContain("media_items");
    expect(events).toContain("notifications");
  }
  console.log(
    `PASS browser Realtime frames: A=${realtimeEvents.A.length}, B=${realtimeEvents.B.length}; no subscription or console errors`,
  );
  await a.close();
  await b.close();
});

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const project = "https://knqbqaucbuvghptmfazo.supabase.co";
const cookieName = "sb-knqbqaucbuvghptmfazo-auth-token";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4F8AAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}
async function session(context: BrowserContext) {
  const cookies = (await context.cookies()).filter(
    (cookie) =>
      cookie.name === cookieName || cookie.name.startsWith(cookieName + "."),
  );
  const encoded = cookies
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cookie) => cookie.value)
    .join("");
  expect(encoded.startsWith("base64-")).toBe(true);
  return {
    cookies,
    data: JSON.parse(
      Buffer.from(encoded.slice(7), "base64url").toString("utf8"),
    ) as { access_token: string; refresh_token: string; expires_at: number },
  };
}
async function authenticatedArea(page: Page) {
  await expect(
    page
      .getByRole("button", { name: "Account menu" })
      .or(page.getByRole("button", { name: "Sign out", exact: true })),
  ).toBeVisible();
}

test("three real accounts restore cookie sessions, refresh and log out", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180000);
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(project);
  for (const [email, password] of [
    [process.env.E2E_EMAIL, process.env.E2E_PASSWORD],
    [process.env.E2E_PARTNER_EMAIL, process.env.E2E_PARTNER_PASSWORD],
    [process.env.E2E_OUTSIDER_EMAIL, process.env.E2E_OUTSIDER_PASSWORD],
  ]) {
    expect(email && password).toBeTruthy();
    const original = await browser.newContext({ baseURL });
    let restored: BrowserContext | undefined;
    try {
      const first = await original.newPage();
      await login(first, email!, password!);
      await authenticatedArea(first);
      const state = await original.storageState();
      // Test-only cookie transfer; no state file and no journal-content fallback.
      expect(state.origins.flatMap((origin) => origin.localStorage)).toEqual(
        [],
      );
      await original.close();
      restored = await browser.newContext({ baseURL, storageState: state });
      const page = await restored.newPage();
      expect((await page.goto("/library"))?.status()).toBe(200);
      await authenticatedArea(page);
      expect((await page.reload())?.status()).toBe(200);
      await authenticatedArea(page);
      const before = await session(restored);
      // Expire only this test session's client metadata, never forge its signed JWT.
      before.data.expires_at = Math.floor(Date.now() / 1000) - 60;
      const encoded =
        "base64-" +
        Buffer.from(JSON.stringify(before.data)).toString("base64url");
      await restored.clearCookies({ name: new RegExp("^" + cookieName) });
      const {
        name: ignoredName,
        value: ignoredValue,
        ...options
      } = before.cookies[0];
      void ignoredName;
      void ignoredValue;
      await restored.addCookies(
        Array.from(
          { length: Math.ceil(encoded.length / 3000) },
          (_, index) => ({
            ...options,
            name: `${cookieName}.${index}`,
            value: encoded.slice(index * 3000, (index + 1) * 3000),
          }),
        ),
      );
      expect((await page.reload())?.status()).toBe(200);
      await authenticatedArea(page);
      const after = (await session(restored)).data;
      expect(after.expires_at).toBeGreaterThan(Date.now() / 1000);
      // Assert token rotation without exposing either credential in failures.
      expect(after.refresh_token !== before.data.refresh_token).toBe(true);
      if (await page.getByRole("button", { name: "Account menu" }).isVisible())
        await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto("/library");
      await expect(page).toHaveURL(/\/login\?next=/);
      expect(
        (await restored.cookies()).filter((cookie) =>
          cookie.name.startsWith(cookieName),
        ),
      ).toEqual([]);
    } finally {
      await original.close();
      await restored?.close();
    }
  }
});

test("application avatar and shared-cover replacement removes old hosted objects", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180000);
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(project);
  await login(page, process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  async function upload(label: string, filename: string) {
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/assets" &&
        response.request().method() === "POST",
    );
    await page
      .getByLabel(label, { exact: true })
      .setInputFiles({ name: filename, mimeType: "image/png", buffer: png });
    const saved = await response;
    expect(saved.status()).toBe(200);
    const payload = (await saved.json()) as {
      path: string;
      url: string;
      warning?: string;
    };
    expect(payload.warning).toBeUndefined();
    await expect(
      page.getByRole("status").filter({ hasText: "Image saved." }),
    ).toBeVisible();
    const download = await context.request.get(payload.url);
    expect(download.status()).toBe(200);
    expect((await download.body()).byteLength).toBe(png.byteLength);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map((violation) => ({
        id: violation.id,
        targets: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
    return payload.path;
  }
  async function objectStatus(bucket: string, path: string) {
    const token = (await session(context)).data.access_token;
    const response = await context.request.get(
      `${project}/storage/v1/object/authenticated/${bucket}/${path}`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.status();
  }
  await page.goto("/settings/profile");
  const oldAvatar = await upload("Avatar image", "avatar-first.png");
  const newAvatar = await upload("Avatar image", "avatar-replacement.png");
  expect(newAvatar).not.toBe(oldAvatar);
  expect([400, 404]).toContain(await objectStatus("avatars", oldAvatar));
  expect(await objectStatus("avatars", newAvatar)).toBe(200);
  await page.goto("/settings/space");
  const oldCover = await upload("Space cover image", "cover-first.png");
  const newCover = await upload("Space cover image", "cover-replacement.png");
  expect(newCover).not.toBe(oldCover);
  expect([400, 404]).toContain(await objectStatus("space-assets", oldCover));
  expect(await objectStatus("space-assets", newCover)).toBe(200);
  for (const file of [
    {
      name: "forbidden.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    },
    {
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image, despite its declared MIME"),
    },
    {
      name: "oversized.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5242881),
    },
  ]) {
    const response = await context.request.post("/api/assets", {
      headers: { Origin: baseURL! },
      multipart: { kind: "avatar", file },
    });
    expect([400, 413]).toContain(response.status());
  }
  const crossOrigin = await context.request.post("/api/assets", {
    headers: { Origin: "https://untrusted.invalid" },
    multipart: {
      kind: "avatar",
      file: { name: "image.png", mimeType: "image/png", buffer: png },
    },
  });
  expect(crossOrigin.status()).toBe(403);
  expect(browserErrors).toEqual([]);
});

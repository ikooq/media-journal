import { chromium, expect } from "@playwright/test";
import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({ channel: "msedge" });
const results = [];
try {
  const auth = await browser.newContext({ baseURL });
  const login = await auth.newPage();
  await login.goto("/login");
  await login.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL);
  await login
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD);
  await login.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(login).not.toHaveURL(/\/login/, { timeout: 30000 });
  await login.getByRole("button", { name: "Account menu" }).click();
  const spaces = login.getByLabel("Active space");
  const ids = await spaces
    .locator("option")
    .evaluateAll((options) =>
      options
        .filter((option) => option.textContent.startsWith("E2E "))
        .map((option) => option.value),
    );
  if (ids.length) {
    await spaces.selectOption(ids.at(-1));
    await expect(spaces).not.toBeVisible({ timeout: 30000 });
  }
  const state = await auth.storageState();
  await auth.close();
  for (const width of process.env.UI_AUDIT_MOBILE_ONLY ? [390] : [390, 1440]) {
    for (const route of process.env.UI_AUDIT_ROUTE
      ? [process.env.UI_AUDIT_ROUTE]
      : ["/", "/library", "/us"]) {
      const context = await browser.newContext({
        baseURL,
        storageState: state,
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      if (width === 390)
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => {
        window.__journalMetrics = {
          lcp: 0,
          cls: 0,
          windowScore: 0,
          windowStart: 0,
          lastShift: 0,
          eventDuration: 0,
          longTasks: 0,
          shifts: [],
        };
        const metrics = window.__journalMetrics;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            if (entry.value > 0.005)
              metrics.shifts.push({
                value: entry.value,
                at: entry.startTime,
                sources: entry.sources.map((source) => ({
                  tag: source.node?.nodeName,
                  class: source.node?.className,
                  parent: source.node?.parentElement?.className,
                  before: source.previousRect.toJSON(),
                  after: source.currentRect.toJSON(),
                })),
              });
            if (
              entry.startTime - metrics.lastShift > 1000 ||
              entry.startTime - metrics.windowStart > 5000
            ) {
              metrics.windowScore = 0;
              metrics.windowStart = entry.startTime;
            }
            metrics.windowScore += entry.value;
            metrics.lastShift = entry.startTime;
            metrics.cls = Math.max(metrics.cls, metrics.windowScore);
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            metrics.eventDuration = Math.max(
              metrics.eventDuration,
              entry.duration,
            );
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
        new PerformanceObserver((list) => {
          metrics.longTasks += list.getEntries().length;
        }).observe({ type: "longtask", buffered: true });
      });
      await page.goto(route);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
        timeout: 45000,
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((img) =>
            img.decode().catch(() => {}),
          ),
        );
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
      await page
        .getByRole("button", { name: "Add media", exact: true })
        .filter({ visible: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Keep the good stuff." }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        return {
          lcpMs: Math.round(window.__journalMetrics.lcp),
          cls: Number(window.__journalMetrics.cls.toFixed(4)),
          ttfbMs: Math.round(nav.responseStart),
          postTtfbLcpMs: Math.round(
            window.__journalMetrics.lcp - nav.responseStart,
          ),
          observedInteractionMs: window.__journalMetrics.eventDuration,
          longTasks: window.__journalMetrics.longTasks,
          shifts: window.__journalMetrics.shifts,
          jsTransferKB: Math.round(
            resources
              .filter((r) => r.initiatorType === "script")
              .reduce((sum, r) => sum + r.transferSize, 0) / 1024,
          ),
          fontTransferKB: Math.round(
            resources
              .filter((r) => /\.woff2/.test(r.name))
              .reduce((sum, r) => sum + r.transferSize, 0) / 1024,
          ),
        };
      });
      results.push({
        route,
        width,
        cpuSlowdown: width === 390 ? 4 : 1,
        ...metrics,
      });
      console.log(JSON.stringify(results.at(-1)));
      await context.close();
    }
  }
  await mkdir("output/playwright", { recursive: true });
  await writeFile(
    process.env.UI_AUDIT_ROUTE
      ? "output/playwright/performance-diagnostic.json"
      : "output/playwright/performance.json",
    JSON.stringify(
      {
        environment:
          "Local Next production server, real hosted Supabase, cold browser cache; mobile CPU x4, no network emulation. Single samples, not field Core Web Vitals or INP.",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

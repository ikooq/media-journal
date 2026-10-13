import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { avatarForeground, contrastRatio } from "@/lib/ui-utils";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { LocalDate } from "@/components/local-date";
const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const token = (name: string) =>
  css.match(new RegExp(`--${name}: (#[a-f\\d]{6})`, "i"))![1];
describe("journal accessibility tokens", () => {
  it("renders deterministic UTC dates before the viewer's timezone is known", () => {
    for (const value of ["2026-01-01T00:30:00Z", "2026-01-01"])
      expect(
        renderToString(createElement(LocalDate, { value, relative: true })),
      ).toContain("Jan 1");
  });
  it("keeps body, muted and semantic text above AA contrast", () => {
    for (const foreground of [
      "ink",
      "muted",
      "muted-light",
      "accent",
      "destructive",
      "gold",
    ])
      for (const surface of ["page", "surface"])
        expect(
          contrastRatio(token(foreground), token(surface)),
          `${foreground} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps primary buttons readable", () => {
    expect(contrastRatio(token("accent"), "#ffffff")).toBeGreaterThanOrEqual(
      4.5,
    );
  });
  it("chooses readable initials for every existing participant color", () => {
    for (const color of [
      "#1f6b5c",
      "#d4785c",
      "#758b81",
      "#425b49",
      "#777777",
      "#ffffff",
    ])
      expect(
        contrastRatio(color, avatarForeground(color)),
      ).toBeGreaterThanOrEqual(4.5);
  });
});

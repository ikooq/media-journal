import { describe, expect, it } from "vitest";
import {
  calculateStreak,
  extractYouTubeId,
  normalizeUrl,
  progressFromSeconds,
} from "@/lib/utils";
import { selectProvider } from "@/lib/media/providers";

describe("media URL utilities", () => {
  it("normalizes tracking parameters without changing the destination", () => {
    expect(
      normalizeUrl("https://example.com/story/?utm_source=newsletter#notes"),
    ).toBe("https://example.com/story");
  });
  it("extracts regular, short and Shorts YouTube links", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=abc123")).toBe(
      "abc123",
    );
    expect(extractYouTubeId("https://youtu.be/abc123?t=10")).toBe("abc123");
    expect(extractYouTubeId("https://youtube.com/shorts/abc123")).toBe(
      "abc123",
    );
  });
  it("selects the YouTube metadata provider", () => {
    expect(selectProvider(new URL("https://youtu.be/abc123"))?.name).toBe(
      "youtube",
    );
  });
});

describe("journal calculations", () => {
  it("groups UTC timestamps into the user’s viewing day before calculating streaks", () => {
    expect(
      calculateStreak(
        ["2026-10-11T20:00:00Z", "2026-10-12T20:00:00Z"],
        new Date("2026-10-13T12:00:00Z"),
        "Asia/Qyzylorda",
      ),
    ).toBe(2);
  });
  it("clamps progress to a percentage", () => {
    expect(progressFromSeconds(75, 100)).toBe(75);
    expect(progressFromSeconds(120, 100)).toBe(100);
  });
  it("calculates a current consecutive-day streak", () => {
    const today = new Date("2026-10-13T12:00:00Z");
    expect(
      calculateStreak(
        [
          "2026-10-11T12:00:00Z",
          "2026-10-12T12:00:00Z",
          "2026-10-13T12:00:00Z",
        ],
        today,
      ),
    ).toBe(3);
  });
});

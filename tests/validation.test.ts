import { describe, expect, it } from "vitest";
import {
  commandSchema,
  ratingSchema,
  safeUrl,
  sessionSchema,
} from "@/lib/validation";
import { safeNext } from "@/lib/auth";
import { isPublicAddress, validateFetchUrl } from "@/lib/media/safe-fetch";
import { selectProvider } from "@/lib/media/providers";
import { validateImageBytes } from "@/lib/uploads";
describe("request validation", () => {
  it("accepts decimal ratings including zero and rejects out-of-range values", () => {
    expect(ratingSchema.parse(0)).toBe(0);
    expect(ratingSchema.parse(9.2)).toBe(9.2);
    expect(ratingSchema.safeParse(10.1).success).toBe(false);
  });
  it("requires participant UUIDs and valid progress", () => {
    expect(
      sessionSchema.safeParse({
        occurredAt: "2026-10-13T12:00:00Z",
        participantIds: [],
        completed: false,
        progressPercent: 101,
      }).success,
    ).toBe(false);
  });
  it("does not trust a browser-provided acting user", () => {
    const command = commandSchema.parse({
      op: "rating",
      mediaId: "11111111-1111-4111-8111-111111111111",
      userId: "attacker",
      data: { value: 8 },
    });
    expect(command).not.toHaveProperty("userId");
  });
  it("prevents unsafe navigation/redirect protocols", () => {
    expect(safeUrl.safeParse("not-a-url").success).toBe(false);
    expect(safeUrl.safeParse("https://user:password@example.com").success).toBe(
      false,
    );
    expect(safeUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/join/abc")).toBe("/join/abc");
  });
});
describe("metadata transport and uploads", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks private and reserved address %s", (address) =>
    expect(isPublicAddress(address)).toBe(false),
  );
  it("permits public IPs but blocks credentialed or nonstandard-port URLs", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(() =>
      validateFetchUrl(new URL("http://example.com:8080")),
    ).toThrow();
    expect(() =>
      validateFetchUrl(new URL("https://user:password@example.com")),
    ).toThrow();
  });
  it("matches provider hostnames at domain boundaries", () => {
    expect(
      selectProvider(new URL("https://notyoutube.com/watch?v=abc")),
    ).toBeUndefined();
    expect(
      selectProvider(new URL("https://imdb.com.evil.test/")),
    ).toBeUndefined();
  });
  it("rejects SVG and spoofed image MIME types", () => {
    expect(() =>
      validateImageBytes(
        new TextEncoder().encode("<svg><script/></svg>"),
        "image/png",
      ),
    ).toThrow();
    expect(() =>
      validateImageBytes(new Uint8Array(20), "image/svg+xml"),
    ).toThrow();
  });
});

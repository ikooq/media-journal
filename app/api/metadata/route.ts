import { NextResponse } from "next/server";
import { fetchSafeMetadata } from "@/lib/media/providers";
import { context, check, DataError } from "@/lib/data/server";
import { safeUrl } from "@/lib/validation";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const { db } = await context();
    const { data: allowed, error } = await db.rpc("consume_metadata_limit", {});
    check(error);
    if (!allowed)
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 },
      );
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing request body");
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Request too large." },
          { status: 413 },
        );
      }
      parts.push(value);
    }
    const text = Buffer.concat(parts).toString("utf8");
    const { url } = z.object({ url: safeUrl }).parse(JSON.parse(text));
    const metadata = await fetchSafeMetadata(url);
    return NextResponse.json(
      { metadata },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const unauth =
      error instanceof DataError && error.code === "UNAUTHENTICATED";
    return NextResponse.json(
      {
        error: unauth
          ? "Please sign in again."
          : error instanceof z.ZodError
            ? "Please paste a valid http or https link."
            : "Could not load metadata. You can still add this link by hand.",
      },
      { status: unauth ? 401 : 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authenticated, check, context, DataError } from "@/lib/data/server";
import { MAX_IMAGE_SIZE, validateImageBytes } from "@/lib/uploads";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin)
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const { db, user } = await authenticated();
    // Bound even chunked request bodies before parsing multipart data.
    const reader = request.body?.getReader();
    if (!reader) throw new DataError("Choose a file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_SIZE + 65536) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Choose an image smaller than 5 MB." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const buffer = new Uint8Array(size);
    let cursor = 0;
    chunks.forEach((c) => {
      buffer.set(c, cursor);
      cursor += c.length;
    });
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      body: buffer,
    }).formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || (kind !== "avatar" && kind !== "cover"))
      throw new DataError("Choose a valid image.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = validateImageBytes(bytes, file.type);
    let oldPath: string | null = null;
    let owner = user.id;
    let spaceId: string | undefined;
    if (kind === "cover") {
      const c = await context();
      spaceId = c.spaceId;
      owner = spaceId;
      const { data, error } = await db
        .from("spaces")
        .select("cover_path")
        .eq("id", spaceId)
        .single();
      check(error);
      oldPath = data?.cover_path ?? null;
    } else {
      const { data, error } = await db
        .from("profiles")
        .select("avatar_path")
        .eq("id", user.id)
        .single();
      check(error);
      oldPath = data?.avatar_path ?? null;
    }
    const bucket = kind === "avatar" ? "avatars" : "space-assets";
    const path = `${owner}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });
    check(uploadError);
    try {
      const update =
        kind === "avatar"
          ? await db
              .from("profiles")
              .update({ avatar_path: path })
              .eq("id", user.id)
              .select("id")
              .single()
          : await db
              .from("spaces")
              .update({ cover_path: path })
              .eq("id", spaceId!)
              .select("id")
              .single();
      check(update.error);
    } catch (error) {
      await db.storage.from(bucket).remove([path]);
      throw error;
    }
    let warning: string | undefined;
    if (oldPath && oldPath.startsWith(`${owner}/`)) {
      const { error } = await db.storage.from(bucket).remove([oldPath]);
      if (error)
        warning =
          "Image saved. The previous image could not be removed; you can clean it up in Storage.";
    }
    const { data, error } = await db.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    check(error);
    revalidatePath("/", "layout");
    return NextResponse.json({ url: data?.signedUrl, path, warning });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DataError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Image upload failed.",
      },
      {
        status:
          error instanceof DataError && error.code === "UNAUTHENTICATED"
            ? 401
            : 400,
      },
    );
  }
}

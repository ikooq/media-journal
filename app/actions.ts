"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  authenticated,
  bootstrap,
  check,
  context,
  DataError,
  collectionsForSpace,
  notificationsForSpace,
} from "@/lib/data/server";
import {
  commandSchema,
  idSchema,
  libraryOptionsSchema,
  validTimezone,
} from "@/lib/validation";
import {
  calendarResponseSchema,
  collectionResponseSchema,
  mediaResponseSchema,
  pageResponseSchema,
  statsResponseSchema,
} from "@/lib/data/responses";
import { normalizeUrl, extractYouTubeId } from "@/lib/utils";
import type { Json } from "@/types/database";

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; code?: string };
async function result<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Invalid input")
          : error instanceof DataError
            ? error.message
            : "Something went wrong. Please try again.",
      code: error instanceof DataError ? error.code : undefined,
    };
  }
}
export async function getBootstrap() {
  return result(bootstrap);
}
export async function getLibrary(input: unknown = {}) {
  return result(async () => {
    const options = libraryOptionsSchema.parse(input);
    const { db, spaceId } = await context();
    const { data, error } = await db.rpc("query_library", {
      s: spaceId,
      options,
    });
    check(error);
    return pageResponseSchema.parse(data);
  });
}
export async function getMedia(id: string) {
  return result(async () => {
    idSchema.parse(id);
    const { db, spaceId } = await context();
    const { data, error } = await db.rpc("media_document", {
      mid: id,
      detail: true,
    });
    check(error);
    if (!data) return null;
    const item = mediaResponseSchema.parse(data);
    return item.spaceId === spaceId ? item : null;
  });
}
export async function getStatistics(timezone: string) {
  return result(async () => {
    const { db, spaceId } = await context();
    const { data, error } = await db.rpc("space_statistics", {
      s: spaceId,
      tz: validTimezone(timezone),
    });
    check(error);
    return statsResponseSchema.parse(data);
  });
}
export async function getCalendar(input: unknown) {
  return result(async () => {
    const p = z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        timezone: z.string().max(80),
        offset: z.number().int().min(0).default(0),
      })
      .parse(input);
    if (
      new Date(p.to).getTime() - new Date(p.from).getTime() > 32 * 86400000 ||
      p.to <= p.from
    )
      throw new DataError("Choose a valid month.");
    const { db, spaceId } = await context();
    const { data, error } = await db.rpc("calendar_activity", {
      s: spaceId,
      from_day: p.from,
      to_day: p.to,
      tz: validTimezone(p.timezone),
      page_offset: p.offset,
    });
    check(error);
    return calendarResponseSchema.parse(data);
  });
}
export async function getCollections() {
  return result(collectionsForSpace);
}
export async function getCollection(id: string) {
  return result(async () => {
    idSchema.parse(id);
    const { db, spaceId } = await context();
    const { data, error } = await db
      .from("collections")
      .select("*")
      .eq("id", id)
      .eq("space_id", spaceId)
      .maybeSingle();
    check(error);
    if (!data) return null;
    const { data: document, error: documentError } = await db.rpc(
      "collection_document",
      { cid: id },
    );
    check(documentError);
    return collectionResponseSchema.parse(document);
  });
}
export async function getNotifications() {
  return result(notificationsForSpace);
}
// Client-dispatched Server Actions are serialized by Next.js. Keep independent
// refresh reads inside one action so they can actually run concurrently.
export async function getWorkspaceSnapshot(path: string, timezone: string) {
  return result(async () => {
    z.string().max(512).startsWith("/").parse(path);
    const tz = validTimezone(timezone);
    const [stats, cols, alerts, detail, lists] = await Promise.all([
      getStatistics(tz),
      getCollections(),
      getNotifications(),
      /^\/library\/[^/]+$/.test(path) ? getMedia(path.split("/")[2]) : null,
      path === "/" || path === "/us"
        ? Promise.all([
            getLibrary({ filter: "recently_watched", limit: 8 }),
            getLibrary({ filter: "watching", limit: 4 }),
            getLibrary({ filter: "watch_later", limit: 4 }),
            getLibrary({
              filter: path === "/us" ? "loved" : "favorites",
              limit: 8,
            }),
          ])
        : null,
    ]);
    return { stats, cols, alerts, detail, lists };
  });
}
export async function mutate(input: unknown) {
  return result(async () => {
    const command = commandSchema.parse(input);
    const { db, spaceId } = await context();
    if (command.op === "createMedia") {
      const youtubeId = extractYouTubeId(command.data.sourceUrl);
      command.data.canonicalUrl = youtubeId
        ? `https://www.youtube.com/watch?v=${youtubeId}`
        : normalizeUrl(command.data.sourceUrl);
      if (youtubeId) command.data.externalId = youtubeId;
    }
    const { data, error } = await db.rpc("mutate_workspace", {
      s: spaceId,
      command: command as Json,
    });
    check(error);
    revalidatePath("/", "layout");
    return z
      .object({
        id: z.string().nullable().optional(),
        duplicate: z.boolean().optional(),
      })
      .parse(data);
  });
}
export async function createSpace(input: unknown) {
  return result(async () => {
    const name = z.string().trim().min(1).max(80).parse(input);
    const { db } = await authenticated();
    const { data, error } = await db.rpc("create_shared_space", {
      space_name: name,
    });
    check(error);
    if (!data) throw new DataError("Could not create the shared space.");
    await setSpaceCookie(data);
    revalidatePath("/", "layout");
    return data;
  });
}
async function setSpaceCookie(id: string) {
  (await cookies()).set("active-space", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 31536000,
  });
}
export async function selectSpace(id: string) {
  return result(async () => {
    idSchema.parse(id);
    const { db, user } = await authenticated();
    const { data, error } = await db
      .from("space_members")
      .select("space_id")
      .eq("space_id", id)
      .eq("user_id", user.id)
      .single();
    check(error);
    if (!data) throw new DataError("Space unavailable.");
    await setSpaceCookie(id);
    revalidatePath("/", "layout");
    return id;
  });
}
export async function createInvitation() {
  return result(async () => {
    const { db, spaceId } = await context();
    const { data, error } = await db.rpc("create_space_invite", { s: spaceId });
    check(error);
    return data;
  });
}
export async function acceptInvitation(token: string) {
  return result(async () => {
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(token);
    const { db } = await authenticated();
    const { data, error } = await db.rpc("accept_space_invite", { token });
    check(error);
    if (!data) throw new DataError("This invitation could not be accepted.");
    await setSpaceCookie(data);
    revalidatePath("/", "layout");
    return data;
  });
}
export async function listInvitations() {
  return result(async () => {
    const { db, spaceId } = await context();
    const { data, error } = await db
      .from("space_invites")
      .select("id,expires_at,revoked_at,accepted_at")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(20);
    check(error);
    return data ?? [];
  });
}
export async function revokeInvitation(id: string) {
  return result(async () => {
    idSchema.parse(id);
    const { db, spaceId } = await context();
    const { error } = await db
      .from("space_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("space_id", spaceId);
    check(error);
    return null;
  });
}
export async function updateProfile(name: string) {
  return result(async () => {
    z.string().trim().min(1).max(80).parse(name);
    const { db, user } = await authenticated();
    const { error } = await db
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", user.id);
    check(error);
    revalidatePath("/", "layout");
    return null;
  });
}

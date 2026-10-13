import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  Bootstrap,
  Collection,
  Notification,
  Space,
} from "@/types/domain";
import { getInitials } from "@/lib/utils";
import { collectionResponseSchema } from "./responses";

export class DataError extends Error {
  constructor(
    message: string,
    public code = "DATA_ERROR",
  ) {
    super(message);
  }
}
export function check(error: { message: string; code?: string } | null) {
  if (error) {
    console.error(
      JSON.stringify({ event: "database_error", code: error.code }),
    );
    throw new DataError(
      error.code === "42501"
        ? "You do not have access to this record."
        : error.code === "23505"
          ? "This already exists."
          : error.code === "23514"
            ? "The data does not meet the required constraints."
            : "Could not complete that request. Check your connection and database migrations.",
      error.code,
    );
  }
}
export async function authenticated() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new DataError(
      "Your session expired. Please sign in again.",
      "UNAUTHENTICATED",
    );
  return { db, user };
}
export async function context() {
  const { db, user } = await authenticated();
  const cookie = (await cookies()).get("active-space")?.value;
  const query = db
    .from("space_members")
    .select("space_id,role")
    .eq("user_id", user.id);
  const { data: memberships, error } = await query.order("joined_at");
  check(error);
  const data =
    memberships?.find((m) => m.space_id === cookie) ?? memberships?.[0];
  if (!data)
    throw new DataError("Create or select a shared space first.", "NO_SPACE");
  return { db, user, spaceId: data.space_id, role: data.role };
}
export async function signedAsset(
  db: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  path: string | null,
) {
  if (!path) return undefined;
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  if (error) return undefined;
  return data.signedUrl;
}
export async function bootstrap(): Promise<Bootstrap> {
  const { db, user } = await authenticated();
  const [{ data: memberships, error: me }, { data: profile, error: pe }] =
    await Promise.all([
      db
        .from("space_members")
        .select("*")
        .eq("user_id", user.id)
        .order("joined_at"),
      db.from("profiles").select("*").eq("id", user.id).single(),
    ]);
  check(me);
  check(pe);
  const spaceIds = (memberships ?? []).map((m) => m.space_id);
  const { data: spaces, error: se } = spaceIds.length
    ? await db.from("spaces").select("*").in("id", spaceIds)
    : { data: [], error: null };
  check(se);
  const mapped: Space[] = await Promise.all(
    (spaces ?? []).map(async (s) => ({
      id: s.id,
      name: s.name,
      coverPath: s.cover_path,
      coverUrl: await signedAsset(db, "space-assets", s.cover_path),
      startedAt: s.relationship_started_at,
      role: memberships?.find((m) => m.space_id === s.id)?.role ?? "member",
    })),
  );
  mapped.sort((a, b) => spaceIds.indexOf(a.id) - spaceIds.indexOf(b.id));
  const cookie = (await cookies()).get("active-space")?.value;
  const active = mapped.find((s) => s.id === cookie) ?? mapped[0] ?? null;
  const [
    { data: members, error: merr },
    { data: categories, error: cerr },
    { data: tags, error: terr },
  ] = active
    ? await Promise.all([
        db.from("space_members").select("*").eq("space_id", active.id),
        db
          .from("categories")
          .select("id,name")
          .eq("space_id", active.id)
          .order("name"),
        db
          .from("tags")
          .select("id,name")
          .eq("space_id", active.id)
          .order("name"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  check(merr);
  check(cerr);
  check(terr);
  const ids = members?.map((m) => m.user_id) ?? [];
  const { data: profiles, error: prerr } = ids.length
    ? await db.from("profiles").select("*").in("id", ids)
    : { data: profile ? [profile] : [], error: null };
  check(prerr);
  const people = await Promise.all(
    (profiles ?? []).map(async (p, index) => ({
      id: p.id,
      name: p.display_name || "Member",
      initials: getInitials(p.display_name || "Member"),
      color: index % 2 === 0 ? "#1f6b5c" : "#d4785c",
      avatar: await signedAsset(db, "avatars", p.avatar_path),
      avatarPath: p.avatar_path ?? undefined,
      role: members?.find((m) => m.user_id === p.id)?.role,
    })),
  );
  return {
    currentUserId: user.id,
    email: user.email ?? "",
    people,
    spaces: mapped,
    activeSpace: active,
    categories: categories ?? [],
    tags: tags ?? [],
  };
}
export async function collectionsForSpace(): Promise<Collection[]> {
  const { db, spaceId } = await context();
  const { data, error } = await db.rpc("query_collections", { s: spaceId });
  check(error);
  return collectionResponseSchema.array().parse(data);
}
export async function notificationsForSpace(): Promise<{
  items: Notification[];
  unread: number;
}> {
  const { db, user, spaceId } = await context();
  const [{ data, error }, { count, error: ce }] = await Promise.all([
    db
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .is("read_at", null),
  ]);
  check(error);
  check(ce);
  return {
    unread: count ?? 0,
    items: (data ?? []).map((n) => {
      const payload = n.payload as { title?: string; event?: string };
      return {
        id: n.id,
        type: n.type,
        title:
          n.type === "reply"
            ? "A reply to your reflection"
            : n.type === "note"
              ? "A new reflection"
              : n.type === "watchlist"
                ? "Something to watch together"
                : "New on your shelf",
        text: payload.title ?? "Open to see more",
        createdAt: n.created_at,
        read: Boolean(n.read_at),
        mediaId: n.media_item_id ?? undefined,
      };
    }),
  };
}

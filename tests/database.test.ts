import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  calendarResponseSchema,
  collectionResponseSchema,
  mediaResponseSchema,
  pageResponseSchema,
  statsResponseSchema,
} from "@/lib/data/responses";
const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
let space: string, media: string, note: string, collection: string;
async function asUser(id: string | null) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id ?? ""}',false); set role ${id ? "authenticated" : "anon"};`,
  );
}
async function scalar<T>(sql: string, params: unknown[] = []) {
  return (await db.query<{ value: T }>(sql, params)).rows[0]?.value;
}
async function mutation(command: unknown) {
  return scalar<{ id: string; duplicate?: boolean }>(
    "select public.mutate_workspace($1,$2) value",
    [space, JSON.stringify(command)],
  );
}
beforeAll(async () => {
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated;grant select,insert,update,delete on storage.objects to authenticated;
 create table public.unrelated_app(id int primary key);insert into public.unrelated_app values(1);alter table public.unrelated_app enable row level security;
 grant select on public.unrelated_app to anon;create policy unrelated_public_read on public.unrelated_app for select to anon using(true);
 `);
  for (const file of readdirSync(path.resolve("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    // PGlite runs real Postgres/RLS but has no pgcrypto extension or Supabase services.
    const sql = readFileSync(
      path.resolve("supabase/migrations", file),
      "utf8",
    ).replace('create extension if not exists "pgcrypto";', "");
    await db.exec(sql);
  }
  await db.query(
    'insert into auth.users(id,raw_user_meta_data) values($1,\'{"display_name":"Alice"}\'),($2,\'{"display_name":"Bob"}\'),($3,\'{"display_name":"Outsider"}\')',
    [alice, bob, outsider],
  );
  await asUser(alice);
  space = (await scalar<string>(
    "select public.create_shared_space('Together') value",
  ))!;
  const token = await scalar<string>(
    "select public.create_space_invite($1) value",
    [space],
  );
  await asUser(bob);
  await scalar("select public.accept_space_invite($1) value", [token]);
  await asUser(alice);
}, 60000);
afterAll(async () => {
  await db.close();
});
describe.sequential("migrations and real PostgreSQL RLS", () => {
  it("applies hosted advisor hardening without weakening RLS", async () => {
    expect(
      await scalar<boolean>(`select coalesce('search_path=""'=any(p.proconfig),false) value
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='set_updated_at'`),
    ).toBe(true);
    expect(
      await scalar<number>(`select count(*)::int value from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`),
    ).toBe(0);
    expect(
      await scalar<number>(`select count(*)::int value from pg_indexes
        where schemaname='public' and indexname in (
          'categories_creator_idx','collection_items_added_by_idx','collections_creator_idx',
          'collections_space_updated_idx','media_items_creator_idx','media_items_parent_space_idx',
          'note_replies_author_idx','notes_media_space_idx','notes_author_idx','notes_space_created_idx',
          'notifications_media_space_idx','notifications_actor_idx','notifications_space_created_idx',
          'ratings_user_idx','space_invites_accepted_by_idx','space_invites_creator_idx',
          'space_invites_space_created_idx','spaces_creator_idx','tags_creator_idx',
          'usefulness_ratings_user_idx','viewing_sessions_media_space_idx',
          'viewing_sessions_creator_idx','watchlist_user_idx')`),
    ).toBe(23);
  });
  it("leaves unrelated application tables and their policies untouched", async () => {
    await asUser(null);
    expect(
      await scalar<number>(
        "select count(*)::int value from public.unrelated_app",
      ),
    ).toBe(1);
    await asUser(alice);
  });
  it("uses single-use expiring invitation capabilities", async () => {
    const token = await scalar<string>(
      "select public.create_space_invite($1) value",
      [space],
    );
    await asUser(bob);
    await scalar("select public.accept_space_invite($1) value", [token]);
    await expect(
      scalar("select public.accept_space_invite($1) value", [token]),
    ).rejects.toThrow();
    await expect(
      scalar("select public.create_space_invite($1) value", [space]),
    ).rejects.toThrow();
    await asUser(alice);
  });
  it("creates profile, membership and default categories atomically", async () => {
    expect(
      await scalar<number>(
        "select count(*)::int value from public.categories where space_id=$1",
        [space],
      ),
    ).toBe(12);
    expect(
      await scalar<number>(
        "select count(*)::int value from public.space_members where space_id=$1",
        [space],
      ),
    ).toBe(2);
  });
  it("creates canonical media, session, participants and normalized taxonomy", async () => {
    const r = await mutation({
      op: "createMedia",
      data: {
        title: "A shared film",
        sourceProvider: "manual",
        sourceUrl: "https://example.com/movie",
        canonicalUrl: "https://example.com/movie",
        type: "movie",
        status: "watched",
        contentIntent: "both",
        categories: ["Movies", " movies "],
        tags: ["Curiosity"],
        session: {
          occurredAt: "2026-10-12T01:00:00+05:00",
          participantIds: [alice, bob],
          completed: true,
          progressPercent: 100,
        },
        favorite: true,
      },
    });
    media = r!.id;
    expect(media).toBeTruthy();
    expect(
      await scalar<number>(
        "select count(*)::int value from public.viewing_session_participants",
      ),
    ).toBe(2);
  });
  it("detects duplicate creation in the transaction", async () => {
    const r = await mutation({
      op: "createMedia",
      data: {
        title: "Duplicate",
        sourceProvider: "manual",
        sourceUrl: "https://example.com/movie",
        canonicalUrl: "https://example.com/movie",
        type: "movie",
        status: "watched",
        contentIntent: "both",
      },
    });
    expect(r?.duplicate).toBe(true);
    expect(r?.id).toBe(media);
  });
  it("preserves personal ratings and rejects ranges", async () => {
    await mutation({ op: "rating", mediaId: media, data: { value: 9.1 } });
    await asUser(bob);
    await mutation({ op: "rating", mediaId: media, data: { value: 7.2 } });
    expect(
      await scalar<number>("select count(*)::int value from public.ratings"),
    ).toBe(2);
    await expect(
      mutation({ op: "rating", mediaId: media, data: { value: 11 } }),
    ).rejects.toThrow();
    await asUser(alice);
  });
  it("allows unique favorites and blocks deleting another person’s record", async () => {
    await mutation({ op: "favorite", mediaId: media, data: { value: true } });
    await mutation({ op: "favorite", mediaId: media, data: { value: true } });
    await asUser(bob);
    await db.query("delete from public.favorites where user_id=$1", [alice]);
    expect(
      await scalar<number>(
        "select count(*)::int value from public.favorites where user_id=$1",
        [alice],
      ),
    ).toBe(1);
    await asUser(alice);
  });
  it("enforces note/reply authors and notification fan-out", async () => {
    note = (await mutation({
      op: "createNote",
      mediaId: media,
      data: { body: "A private reflection about learning" },
    }))!.id;
    await asUser(bob);
    await expect(
      mutation({
        op: "updateNote",
        mediaId: media,
        data: {
          id: note,
          body: "Overwrite",
          isPinned: false,
          isImportant: false,
        },
      }),
    ).rejects.toThrow();
    expect(
      await scalar<number>(
        "select count(*)::int value from public.notifications where user_id=$1 and type='note'",
        [bob],
      ),
    ).toBe(1);
    const reply = (await mutation({
      op: "createReply",
      mediaId: media,
      data: { noteId: note, body: "A response" },
    }))!.id;
    await asUser(alice);
    await expect(
      mutation({ op: "deleteReply", mediaId: media, data: { id: reply } }),
    ).rejects.toThrow();
    expect(
      await scalar<number>(
        "select count(*)::int value from public.notifications where user_id=$1 and type='reply'",
        [alice],
      ),
    ).toBe(1);
  });
  it("searches reflections without loading the entire library", async () => {
    const page = await scalar<{ total: number }>(
      "select public.query_library($1,$2) value",
      [space, JSON.stringify({ query: "learning" })],
    );
    expect(page?.total).toBe(1);
  });
  it("persists collection membership/order and rejects incomplete permutations", async () => {
    collection = (await mutation({
      op: "saveCollection",
      data: { title: "Weekend", description: "" },
    }))!.id;
    await mutation({
      op: "collectionAdd",
      mediaId: media,
      data: { id: collection },
    });
    await mutation({
      op: "collectionOrder",
      data: { id: collection, itemIds: [media] },
    });
    expect(
      await scalar<number>(
        "select position value from public.collection_items where collection_id=$1",
        [collection],
      ),
    ).toBe(0);
    await expect(
      mutation({
        op: "collectionOrder",
        data: { id: collection, itemIds: [] },
      }),
    ).rejects.toThrow();
  });
  it("lets either member reorder a collection without changing who added an item", async () => {
    await asUser(bob);
    const second = (await mutation({
      op: "createMedia",
      data: {
        title: "Partner item",
        sourceProvider: "manual",
        sourceUrl: "https://example.com/partner",
        canonicalUrl: "https://example.com/partner",
        type: "book",
        status: "watch_later",
        contentIntent: "useful",
      },
    }))!.id;
    await mutation({
      op: "collectionAdd",
      mediaId: second,
      data: { id: collection },
    });
    await asUser(alice);
    await mutation({
      op: "collectionOrder",
      data: { id: collection, itemIds: [second, media] },
    });
    const row = (
      await db.query<{ added_by: string; position: number }>(
        "select added_by,position from public.collection_items where collection_id=$1 and media_item_id=$2",
        [collection, second],
      )
    ).rows[0];
    expect(row).toEqual({ added_by: bob, position: 0 });
  });
  it("isolates all space records from anonymous and nonmember roles", async () => {
    await asUser(outsider);
    expect(
      await scalar<number>(
        "select count(*)::int value from public.media_items",
      ),
    ).toBe(0);
    expect(
      await scalar("select public.media_document($1,true) value", [media]),
    ).toBeNull();
    await expect(
      mutation({
        op: "createNote",
        mediaId: media,
        data: { body: "intrusion" },
      }),
    ).rejects.toThrow();
    await asUser(null);
    await expect(
      db.query("select * from public.media_items"),
    ).rejects.toThrow();
    await asUser(alice);
  });
  it("aggregates calendar dates in the requested timezone", async () => {
    const result = await scalar<{ days: { day: string; count: number }[] }>(
      "select public.calendar_activity($1,'2026-10-01','2026-11-01','Asia/Qyzylorda',0) value",
      [space],
    );
    expect(result?.days[0]?.day).toBe("2026-10-12");
    const stats = await scalar<{ sharedMoments: number }>(
      "select public.space_statistics($1,'Asia/Qyzylorda') value",
      [space],
    );
    expect(stats?.sharedMoments).toBe(1);
  });
  it("protects storage ownership and shared asset access", async () => {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('avatars',$1)",
      [`${alice}/photo.webp`],
    );
    await asUser(bob);
    expect(
      await scalar<number>("select count(*)::int value from storage.objects"),
    ).toBe(1);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('avatars',$1)",
        [`${alice}/intrusion.webp`],
      ),
    ).rejects.toThrow();
    await asUser(outsider);
    expect(
      await scalar<number>("select count(*)::int value from storage.objects"),
    ).toBe(0);
    await asUser(alice);
  });
  it("rejects cross-space foreign keys and taxonomy/collection links even for a member of both spaces", async () => {
    const other = await scalar<string>(
      "select public.create_shared_space('Another') value",
    );
    await expect(
      db.query(
        "insert into public.viewing_sessions(space_id,media_item_id,created_by) values($1,$2,$3)",
        [other, media, alice],
      ),
    ).rejects.toThrow();
    const category = await scalar<string>(
      "select id value from public.categories where space_id=$1 limit 1",
      [other],
    );
    await expect(
      db.query("insert into public.media_categories values($1,$2)", [
        media,
        category,
      ]),
    ).rejects.toThrow();
    const foreignCollection = await scalar<{ id: string }>(
      "select public.mutate_workspace($1,$2) value",
      [
        other,
        JSON.stringify({
          op: "saveCollection",
          data: { title: "Other", description: "" },
        }),
      ],
    );
    await expect(
      mutation({
        op: "collectionAdd",
        mediaId: media,
        data: { id: foreignCollection?.id },
      }),
    ).rejects.toThrow();
  });
  it("keeps creator/scope immutable and allows only notification acknowledgement", async () => {
    await expect(
      db.query("update public.media_items set created_by=$1 where id=$2", [
        bob,
        media,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update public.notifications set payload='{}' where user_id=$1",
        [alice],
      ),
    ).rejects.toThrow();
    await mutation({ op: "notificationRead", data: {} });
    expect(
      await scalar<number>(
        "select count(*)::int value from public.notifications where user_id=$1 and read_at is null",
        [alice],
      ),
    ).toBe(0);
  });
  it("enforces participant membership and rolls back the entire failed media creation", async () => {
    await expect(
      mutation({
        op: "createMedia",
        data: {
          title: "Invalid participant",
          sourceProvider: "manual",
          sourceUrl: "https://example.com/invalid",
          canonicalUrl: "https://example.com/invalid",
          type: "movie",
          status: "watched",
          contentIntent: "both",
          session: {
            occurredAt: "2026-10-12T01:00:00+05:00",
            participantIds: [outsider],
            completed: true,
            progressPercent: 100,
          },
        },
      }),
    ).rejects.toThrow();
    expect(
      await scalar<number>(
        "select count(*)::int value from public.media_items where canonical_url='https://example.com/invalid'",
      ),
    ).toBe(0);
  });
  it("returns valid application contracts for every read RPC", async () => {
    const item = mediaResponseSchema.parse(
      await scalar("select public.media_document($1,true) value", [media]),
    );
    expect(item.notes.some((n) => n.id === note)).toBe(true);
    const list = collectionResponseSchema
      .array()
      .parse(
        await scalar("select public.query_collections($1) value", [space]),
      );
    expect(list.find((c) => c.id === collection)?.itemCount).toBe(2);
    const detail = collectionResponseSchema.parse(
      await scalar("select public.collection_document($1) value", [collection]),
    );
    expect(detail.itemIds).toHaveLength(2);
    statsResponseSchema.parse(
      await scalar(
        "select public.space_statistics($1,'Asia/Qyzylorda') value",
        [space],
      ),
    );
    calendarResponseSchema.parse(
      await scalar(
        "select public.calendar_activity($1,'2026-10-01','2026-11-01','Asia/Qyzylorda',0) value",
        [space],
      ),
    );
  });
  it("paginates library results in SQL while preserving the full match count", async () => {
    const page = pageResponseSchema.parse(
      await scalar("select public.query_library($1,$2) value", [
        space,
        JSON.stringify({ limit: 1, offset: 0 }),
      ]),
    );
    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(2);
    const next = pageResponseSchema.parse(
      await scalar("select public.query_library($1,$2) value", [
        space,
        JSON.stringify({ limit: 1, offset: 1 }),
      ]),
    );
    expect(next.items[0].id).not.toBe(page.items[0].id);
  });
});

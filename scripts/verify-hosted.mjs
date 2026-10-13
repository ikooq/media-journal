import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Real user JWTs only. Never use a service-role key to make RLS assertions.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(
  url,
  "https://knqbqaucbuvghptmfazo.supabase.co",
  "Wrong project: verification is restricted to MediaJournal",
);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(
  key?.startsWith("sb_publishable_"),
  "Active publishable key required",
);
const credentials = [
  ["A", "E2E_EMAIL", "E2E_PASSWORD"],
  ["B", "E2E_PARTNER_EMAIL", "E2E_PARTNER_PASSWORD"],
  ["C", "E2E_OUTSIDER_EMAIL", "E2E_OUTSIDER_PASSWORD"],
];
const clients = credentials.map(() =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
const [a, b, c] = clients;
const observations = { a: [], b: [], c: [] };
const channels = [];
const passed = [];
const fixture = { run: randomUUID(), project: "knqbqaucbuvghptmfazo" };
mkdirSync("output/hosted", { recursive: true });
function record(label) {
  passed.push(label);
  console.log(`PASS ${label}`);
}
function saveFixture() {
  writeFileSync(
    "output/hosted/hosted-verification.json",
    JSON.stringify({ fixture, passed, observations }, null, 2),
  );
}
function ok(response, label) {
  if (response.error)
    throw new Error(
      `${label}: ${response.error.code ?? response.error.statusCode ?? ""} ${response.error.message ?? ""}`,
    );
  return response.data;
}
async function poll(predicate, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
async function mutate(client, command) {
  return ok(
    await client.rpc("mutate_workspace", { s: fixture.spaceId, command }),
    command.op,
  );
}
async function rejected(query, label) {
  const response = await query;
  assert.ok(response.error, `${label} unexpectedly allowed`);
  record(
    `${label} rejected (${response.error.code ?? response.error.statusCode})`,
  );
}
async function untouched(query, label) {
  const response = await query;
  if (response.error)
    assert.equal(
      response.error.code,
      "42501",
      `${label}: unexpected failure instead of authorization denial`,
    );
  else
    assert.deepEqual(response.data, [], `${label} affected another user's row`);
  record(`${label} rejected by database`);
}
async function subscribe(client, actor, userId) {
  const channel = client
    .channel(`hosted-${fixture.run}-${actor}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "media_items",
        filter: `space_id=eq.${fixture.spaceId}`,
      },
      (payload) =>
        observations[actor].push({
          table: "media_items",
          event: payload.eventType,
          id: payload.new.id ?? payload.old.id,
        }),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) =>
        observations[actor].push({
          table: "notifications",
          event: payload.eventType,
          type: payload.new.type,
          actor: payload.new.actor_id,
        }),
    );
  channels.push([client, channel]);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Realtime ${actor} timed out`)),
      20000,
    );
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(
          new Error(`Realtime ${actor}: ${status} ${error?.message ?? ""}`),
        );
      }
    });
  });
}

try {
  for (let i = 0; i < credentials.length; i++) {
    const [name, emailVariable, passwordVariable] = credentials[i];
    const email = process.env[emailVariable],
      password = process.env[passwordVariable];
    assert.ok(
      email && password && !/[<>]/.test(email + password),
      `Missing real credentials for ${name}`,
    );
    const result = await clients[i].auth.signInWithPassword({
      email,
      password,
    });
    const data = ok(result, `Account ${name} login`);
    fixture[`user${name}`] = data.user.id;
    const refresh = ok(
      await clients[i].auth.refreshSession(),
      `Account ${name} refresh`,
    );
    assert.equal(refresh.user.id, data.user.id);
    assert.equal(
      ok(await clients[i].auth.getUser(), `Account ${name} user validation`)
        .user.id,
      data.user.id,
    );
    record(`Account ${name} actual Auth login, refresh, user validation`);
  }
  assert.equal(
    new Set([fixture.userA, fixture.userB, fixture.userC]).size,
    3,
    "Three distinct users required",
  );
  fixture.spaceId = ok(
    await a.rpc("create_shared_space", {
      space_name: `Hosted verification ${fixture.run}`,
    }),
    "Create space",
  );
  saveFixture();
  ok(
    await a
      .from("profiles")
      .update({ display_name: "Hosted Alice" })
      .eq("id", fixture.userA),
    "Update profile A",
  );
  ok(
    await b
      .from("profiles")
      .update({ display_name: "Hosted Bob" })
      .eq("id", fixture.userB),
    "Update profile B",
  );
  const invite = ok(
    await a.rpc("create_space_invite", { s: fixture.spaceId }),
    "Create invitation",
  );
  assert.equal(
    ok(
      await b.rpc("accept_space_invite", { token: invite }),
      "Accept invitation",
    ),
    fixture.spaceId,
  );
  await rejected(
    b.rpc("accept_space_invite", { token: invite }),
    "Used invitation",
  );
  await rejected(
    c.rpc("accept_space_invite", { token: "0".repeat(64) }),
    "Invalid invitation",
  );
  await rejected(
    b.rpc("create_space_invite", { s: fixture.spaceId }),
    "Nonowner invitation creation",
  );
  const revoked = ok(
    await a.rpc("create_space_invite", { s: fixture.spaceId }),
    "Create revocable invitation",
  );
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(revoked),
  );
  const tokenHash = Buffer.from(hash).toString("hex");
  const invites = ok(
    await a
      .from("space_invites")
      .select("id")
      .eq("token_hash", tokenHash)
      .single(),
    "Find invite",
  );
  ok(
    await a
      .from("space_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invites.id),
    "Revoke invitation",
  );
  await rejected(
    c.rpc("accept_space_invite", { token: revoked }),
    "Revoked invitation",
  );
  await rejected(
    a
      .from("space_invites")
      .update({ space_id: randomUUID() })
      .eq("id", invites.id),
    "Invitation retargeting",
  );
  record("Profile onboarding, shared-space creation and valid invitation join");

  await Promise.all([
    subscribe(a, "a", fixture.userA),
    subscribe(b, "b", fixture.userB),
    subscribe(c, "c", fixture.userC),
  ]);
  record("Three authenticated scoped Realtime subscriptions established");
  const mediaData = {
    title: `Orbitquartz ${fixture.run}`,
    description: "Velvetsun description",
    type: "movie",
    sourceProvider: "manual",
    sourceUrl: `https://manual.our-shelf.invalid/${fixture.run}`,
    canonicalUrl: `https://manual.our-shelf.invalid/${fixture.run}`,
    status: "watched",
    contentIntent: "both",
    durationSeconds: 3600,
    categories: ["Movies"],
    tags: ["Celestine"],
    session: {
      occurredAt: "2026-10-12T20:30:00Z",
      participantIds: [fixture.userA, fixture.userB],
      completed: true,
      progressPercent: 100,
    },
  };
  const concurrent = await Promise.all([
    mutate(a, { op: "createMedia", data: mediaData }),
    mutate(b, { op: "createMedia", data: mediaData }),
  ]);
  assert.equal(concurrent[0].id, concurrent[1].id);
  assert.equal(concurrent.filter((item) => item.duplicate).length, 1);
  fixture.mediaId = concurrent[0].id;
  assert.equal(
    (await mutate(a, { op: "createMedia", data: mediaData })).duplicate,
    true,
  );
  assert.equal(
    ok(
      await b.rpc("media_document", { mid: fixture.mediaId, detail: true }),
      "B reads media",
    ).title,
    mediaData.title,
  );
  record(
    "Concurrent/repeated submissions produce one hosted media item visible to B",
  );
  fixture.noteA = (
    await mutate(a, {
      op: "createNote",
      mediaId: fixture.mediaId,
      data: { body: "Luminousmemory reflection from A" },
    })
  ).id;
  await poll(
    () => observations.b.some((event) => event.type === "note"),
    "B note notification",
  );
  assert.ok(
    ok(
      await b.rpc("media_document", { mid: fixture.mediaId, detail: true }),
      "B reads note",
    ).notes.some((note) => note.id === fixture.noteA),
  );
  record(
    "A creates note; B reads it and receives actual Realtime notification/invalidation",
  );
  fixture.replyB = (
    await mutate(b, {
      op: "createReply",
      mediaId: fixture.mediaId,
      data: { noteId: fixture.noteA, body: "Reply from B" },
    })
  ).id;
  await poll(
    () => observations.a.some((event) => event.type === "reply"),
    "A reply notification",
  );
  assert.ok(
    ok(
      await a
        .from("notifications")
        .select("id")
        .eq("space_id", fixture.spaceId)
        .eq("type", "reply"),
      "A notification persistence",
    ).length,
  );
  fixture.noteB = (
    await mutate(b, {
      op: "createNote",
      mediaId: fixture.mediaId,
      data: { body: "Personal note from B" },
    })
  ).id;
  for (const [client, rating] of [
    [a, 9.1],
    [b, 7.2],
  ]) {
    await mutate(client, {
      op: "rating",
      mediaId: fixture.mediaId,
      data: { value: rating },
    });
    await mutate(client, {
      op: "favorite",
      mediaId: fixture.mediaId,
      data: { value: true },
    });
  }
  await mutate(b, {
    op: "usefulness",
    mediaId: fixture.mediaId,
    data: { value: 4 },
  });
  await mutate(a, {
    op: "watchlist",
    mediaId: fixture.mediaId,
    data: { intent: "together" },
  });
  const document = ok(
    await b.rpc("media_document", { mid: fixture.mediaId, detail: true }),
    "B document",
  );
  assert.equal(document.ratingByUser[fixture.userA], 9.1);
  assert.equal(document.ratingByUser[fixture.userB], 7.2);
  assert.equal(document.favoriteByUser[fixture.userA], true);
  assert.equal(document.favoriteByUser[fixture.userB], true);
  assert.equal(document.watchlistByUser[fixture.userA], "together");
  assert.deepEqual(
    document.sessions[0].participantIds.sort(),
    [fixture.userA, fixture.userB].sort(),
  );
  fixture.sessionId = document.sessions[0].id;
  record(
    "B reply notifies A; independent ratings, both favorites, watch together and both session participants persist",
  );
  fixture.collectionId = (
    await mutate(a, {
      op: "saveCollection",
      data: { title: "Collaborative verification", description: "" },
    })
  ).id;
  await mutate(b, {
    op: "collectionAdd",
    mediaId: fixture.mediaId,
    data: { id: fixture.collectionId },
  });
  await mutate(a, {
    op: "collectionOrder",
    data: { id: fixture.collectionId, itemIds: [fixture.mediaId] },
  });
  const collectionItem = ok(
    await a
      .from("collection_items")
      .select("added_by,position")
      .eq("collection_id", fixture.collectionId)
      .single(),
    "Collection collaboration",
  );
  assert.equal(collectionItem.added_by, fixture.userB);
  assert.equal(collectionItem.position, 0);
  record(
    "A reorders B's collaborative collection contribution without changing its owner",
  );
  for (const query of [
    "Orbitquartz",
    "Velvetsun",
    "Celestine",
    "Movies",
    "Luminousmemory",
  ]) {
    assert.equal(
      ok(
        await a.rpc("query_library", {
          s: fixture.spaceId,
          options: { query },
        }),
        "Hosted search",
      ).total,
      1,
    );
  }
  const statistics = ok(
    await b.rpc("space_statistics", {
      s: fixture.spaceId,
      tz: "Asia/Qyzylorda",
    }),
    "Hosted statistics",
  );
  assert.equal(statistics.totalItems, 1);
  assert.equal(statistics.lovedByBoth, 1);
  assert.equal(statistics.sharedMoments, 1);
  for (const [tz, day] of [
    ["Asia/Qyzylorda", "2026-10-13"],
    ["UTC", "2026-10-12"],
  ]) {
    const calendar = ok(
      await a.rpc("calendar_activity", {
        s: fixture.spaceId,
        from_day: "2026-10-12",
        to_day: "2026-10-14",
        tz,
        page_offset: 0,
      }),
      "Calendar timezone",
    );
    assert.equal(calendar.total, 1);
    assert.equal(calendar.days[0].day, day);
  }
  record(
    "Hosted title/description/tag/category/note search, genuine statistics and UTC/local midnight calendar grouping",
  );

  const reads = [
    ["spaces", "id", fixture.spaceId],
    ["space_members", "space_id", fixture.spaceId],
    ["media_items", "id", fixture.mediaId],
    ["notes", "id", fixture.noteA],
    ["note_replies", "id", fixture.replyB],
    ["viewing_sessions", "id", fixture.sessionId],
    ["viewing_session_participants", "viewing_session_id", fixture.sessionId],
    ["collections", "id", fixture.collectionId],
    ["collection_items", "collection_id", fixture.collectionId],
    ["ratings", "media_item_id", fixture.mediaId],
    ["usefulness_ratings", "media_item_id", fixture.mediaId],
    ["favorites", "media_item_id", fixture.mediaId],
    ["watchlist", "media_item_id", fixture.mediaId],
    ["notifications", "space_id", fixture.spaceId],
    ["profiles", "id", fixture.userA],
    ["space_invites", "space_id", fixture.spaceId],
    ["categories", "space_id", fixture.spaceId],
    ["tags", "space_id", fixture.spaceId],
    ["media_categories", "media_item_id", fixture.mediaId],
    ["media_tags", "media_item_id", fixture.mediaId],
  ];
  for (const [table, column, id] of reads) {
    assert.deepEqual(
      ok(await c.from(table).select("*").eq(column, id), `C known-ID ${table}`),
      [],
    );
    record(`C known-ID ${table} read filtered by hosted RLS`);
  }
  assert.equal(
    ok(
      await c.rpc("media_document", { mid: fixture.mediaId, detail: true }),
      "C projection",
    ),
    null,
  );
  await rejected(
    c.rpc("mutate_workspace", {
      s: fixture.spaceId,
      command: {
        op: "createNote",
        mediaId: fixture.mediaId,
        data: { body: "forbidden" },
      },
    }),
    "C mutation RPC",
  );
  const inserts = [
    [
      "media_items",
      {
        space_id: fixture.spaceId,
        created_by: fixture.userC,
        source_url: `https://manual.our-shelf.invalid/${randomUUID()}`,
        canonical_url: `https://manual.our-shelf.invalid/${randomUUID()}`,
        title: "forbidden",
      },
    ],
    [
      "notes",
      {
        space_id: fixture.spaceId,
        media_item_id: fixture.mediaId,
        author_id: fixture.userC,
        body: "forbidden",
      },
    ],
    [
      "note_replies",
      { note_id: fixture.noteA, author_id: fixture.userC, body: "forbidden" },
    ],
    [
      "viewing_sessions",
      {
        space_id: fixture.spaceId,
        media_item_id: fixture.mediaId,
        created_by: fixture.userC,
      },
    ],
    [
      "ratings",
      { media_item_id: fixture.mediaId, user_id: fixture.userC, rating: 1 },
    ],
    ["favorites", { media_item_id: fixture.mediaId, user_id: fixture.userC }],
    [
      "collections",
      {
        space_id: fixture.spaceId,
        created_by: fixture.userC,
        title: "forbidden",
      },
    ],
    ["space_members", { space_id: fixture.spaceId, user_id: fixture.userC }],
    [
      "notifications",
      { space_id: fixture.spaceId, user_id: fixture.userC, type: "note" },
    ],
  ];
  for (const [table, row] of inserts)
    await rejected(c.from(table).insert(row), `C ${table} insert`);
  for (const [table, column, id, values] of [
    ["media_items", "id", fixture.mediaId, { title: "forbidden" }],
    ["notes", "id", fixture.noteA, { body: "forbidden" }],
    ["collections", "id", fixture.collectionId, { title: "forbidden" }],
    ["ratings", "media_item_id", fixture.mediaId, { rating: 1 }],
  ]) {
    await untouched(
      c.from(table).update(values).eq(column, id).select(),
      `C ${table} update`,
    );
    await untouched(
      c.from(table).delete().eq(column, id).select(),
      `C ${table} delete`,
    );
  }
  for (const [table, column, id, values] of [
    ["notes", "id", fixture.noteB, { body: "forbidden" }],
    ["note_replies", "id", fixture.replyB, { body: "forbidden" }],
    ["ratings", "media_item_id", fixture.mediaId, { rating: 1 }],
  ]) {
    let update = a.from(table).update(values).eq(column, id);
    let remove = a.from(table).delete().eq(column, id);
    if (table === "ratings") {
      update = update.eq("user_id", fixture.userB);
      remove = remove.eq("user_id", fixture.userB);
    }
    await untouched(update.select(), `A cannot update B ${table}`);
    await untouched(remove.select(), `A cannot delete B ${table}`);
  }
  await untouched(
    a
      .from("favorites")
      .delete()
      .eq("media_item_id", fixture.mediaId)
      .eq("user_id", fixture.userB)
      .select(),
    "A cannot delete B favorite",
  );
  assert.equal(
    ok(
      await b.from("notes").select("body").eq("id", fixture.noteB).single(),
      "B note intact",
    ).body,
    "Personal note from B",
  );
  assert.equal(
    ok(
      await b
        .from("ratings")
        .select("rating")
        .eq("media_item_id", fixture.mediaId)
        .eq("user_id", fixture.userB)
        .single(),
      "B rating intact",
    ).rating,
    7.2,
  );

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4F8AAAAASUVORK5CYII=",
    "base64",
  );
  fixture.avatarPath = `${fixture.userA}/${fixture.run}.png`;
  fixture.coverPath = `${fixture.spaceId}/${fixture.run}.png`;
  for (const [bucket, path] of [
    ["avatars", fixture.avatarPath],
    ["space-assets", fixture.coverPath],
  ]) {
    ok(
      await a.storage
        .from(bucket)
        .upload(path, png, { contentType: "image/png" }),
      `Upload ${bucket}`,
    );
    assert.equal(
      ok(await b.storage.from(bucket).download(path), `B download ${bucket}`)
        .size,
      png.length,
    );
    const signed = ok(
      await b.storage.from(bucket).createSignedUrl(path, 60),
      `B signed URL ${bucket}`,
    );
    const download = await fetch(signed.signedUrl);
    assert.equal(download.status, 200);
    assert.equal((await download.arrayBuffer()).byteLength, png.length);
    ok(
      await a.storage
        .from(bucket)
        .upload(path, png, { contentType: "image/png", upsert: true }),
      `Replace ${bucket}`,
    );
    await rejected(
      c.storage.from(bucket).download(path),
      `C ${bucket} download`,
    );
    await rejected(
      c.storage.from(bucket).createSignedUrl(path, 60),
      `C ${bucket} signed URL`,
    );
    await rejected(
      c.storage
        .from(bucket)
        .upload(path, png, { contentType: "image/png", upsert: true }),
      `C ${bucket} overwrite`,
    );
    await c.storage.from(bucket).remove([path]);
    assert.equal(
      ok(
        await a.storage.from(bucket).download(path),
        `${bucket} survives C deletion`,
      ).size,
      png.length,
    );
    await rejected(
      a.storage.from(bucket).upload(`${path}.txt`, Buffer.from("forbidden"), {
        contentType: "text/plain",
      }),
      `${bucket} MIME restriction`,
    );
    await rejected(
      a.storage
        .from(bucket)
        .upload(`${path}.large.png`, Buffer.alloc(5242881), {
          contentType: "image/png",
        }),
      `${bucket} size restriction`,
    );
    record(
      `${bucket} actual upload, member download, signed retrieval, replace and outsider isolation`,
    );
  }
  await poll(
    () =>
      observations.a.some(
        (event) => event.table === "media_items" && event.event === "UPDATE",
      ) &&
      observations.b.some(
        (event) => event.table === "media_items" && event.event === "UPDATE",
      ),
    "Cross-session media invalidations",
  );
  assert.deepEqual(
    observations.c,
    [],
    "C received unauthorized Realtime events",
  );
  record(
    "Realtime notes/replies/personal mutations observed; outsider received no Space 1 events",
  );
  for (const [client, channel] of channels)
    assert.equal(await client.removeChannel(channel), "ok");
  channels.length = 0;
  for (const client of clients) assert.equal(client.getChannels().length, 0);
  record("All Realtime subscriptions removed cleanly");
  for (const [bucket, path] of [
    ["avatars", fixture.avatarPath],
    ["space-assets", fixture.coverPath],
  ])
    ok(await a.storage.from(bucket).remove([path]), `Remove test ${bucket}`);
  for (const client of clients) {
    ok(await client.auth.signOut({ scope: "local" }), "Hosted logout");
    assert.equal(
      ok(await client.auth.getSession(), "Session after logout").session,
      null,
    );
  }
  record("Actual Auth logout clears each isolated client session");
  console.log(
    "Hosted API integration suite passed. Browser/session-cookie and email-recovery acceptance are separate gates.",
  );
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const [client, channel] of channels) await client.removeChannel(channel);
  for (const client of clients) {
    await client.auth.signOut({ scope: "local" });
    await client.auth.stopAutoRefresh();
    await client.realtime.disconnect();
  }
  saveFixture();
}

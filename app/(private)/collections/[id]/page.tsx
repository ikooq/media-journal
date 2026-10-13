"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from "lucide-react";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaCard } from "@/components/media-card";
import { Button } from "@/components/ui";
import { CollectionEditor } from "@/components/collection-editor";
import { useWorkspace } from "@/components/workspace-provider";
import { getCollection, getLibrary } from "@/lib/data/client";
import type { Collection, MediaPage } from "@/types/domain";
export default function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { execute, revision } = useWorkspace();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [page, setPage] = useState<MediaPage>({ items: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([
      getCollection(id),
      getLibrary({ collectionId: id, limit: 24, offset }),
    ]).then(([c, p]) => {
      if (alive) {
        if (c.ok) setCollection(c.data);
        else setError(c.error);
        if (p.ok) setPage(p.data);
        else setError(p.error);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [id, offset, revision]);
  async function move(itemId: string, delta: number) {
    if (!collection) return;
    const ids = [...collection.itemIds];
    const index = ids.indexOf(itemId);
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await execute({ op: "collectionOrder", data: { id, itemIds: ids } });
  }
  if (loading && !collection)
    return (
      <div
        role="status"
        aria-busy="true"
        className="skeleton h-72"
        aria-label="Loading collection"
      />
    );
  if (!collection)
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-4xl">Collection not found.</h1>
        <Link
          href="/collections"
          className="mt-5 inline-flex text-sm font-bold text-[var(--accent)]"
        >
          Back to collections
        </Link>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <div className="page-stack !gap-8" aria-busy={loading}>
      <Link
        href="/collections"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)]"
      >
        <ArrowLeft size={16} />
        Back to collections
      </Link>
      <section className="rounded-[var(--radius-lg)] bg-[var(--surface-soft)] p-6 sm:p-9">
        <p className="eyebrow">A shared collection</p>
        <h1 className="page-title mt-3">
          {collection.title}
          <span className="text-[var(--coral)]">.</span>
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
          {collection.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditor(true)}>
            Edit collection
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (
                window.confirm(
                  "Delete this collection? Media, notes, and viewing history will stay.",
                )
              ) {
                const r = await execute({
                  op: "deleteCollection",
                  data: { id },
                });
                if (r) router.push("/collections");
              }
            }}
          >
            Delete collection
          </Button>
        </div>
      </section>
      {error && (
        <p role="alert" className="text-[var(--coral)]">
          {error}
        </p>
      )}
      <div className="media-grid">
        {page.items.map((item) => (
          <div key={item.id}>
            <MediaCard item={item} />
            <div className="mt-3 flex items-center gap-2">
              <button
                aria-label={`Move ${item.title} earlier`}
                className="grid h-11 w-11 place-items-center rounded-full bg-white"
                disabled={collection.itemIds[0] === item.id}
                onClick={() => void move(item.id, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                aria-label={`Move ${item.title} later`}
                className="grid h-11 w-11 place-items-center rounded-full bg-white"
                disabled={collection.itemIds.at(-1) === item.id}
                onClick={() => void move(item.id, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="ml-auto min-h-11 text-xs font-bold text-[var(--coral)]"
                onClick={async () => {
                  if (window.confirm("Remove this item from the collection?"))
                    await execute({
                      op: "collectionRemove",
                      mediaId: item.id,
                      data: { id },
                    });
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {!page.total && (
        <p className="rounded-2xl bg-[var(--surface-soft)] p-10 text-center text-sm text-[var(--muted)]">
          Open any item in your library to add it to this collection.
        </p>
      )}
      <div className="flex justify-center gap-3">
        <Button
          variant="secondary"
          disabled={offset === 0 || loading}
          onClick={() => setOffset((v) => Math.max(0, v - 24))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={offset + 24 >= page.total || loading}
          onClick={() => setOffset((v) => v + 24)}
        >
          Next
        </Button>
      </div>
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"
      >
        Browse the library
        <ArrowRight size={15} />
      </Link>
      {editor && (
        <CollectionEditor
          collection={collection}
          onClose={() => setEditor(false)}
        />
      )}
    </div>
  );
}

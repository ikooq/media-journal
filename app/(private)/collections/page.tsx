"use client";
import { MediaImage } from "@/components/media-image";

import Link from "next/link";
import { useState } from "react";
import { CollectionEditor } from "@/components/collection-editor";
import { ArrowRight, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { EmptyState, MediaSkeleton } from "@/components/journal-ui";
import { Button, Card } from "@/components/ui";

export default function CollectionsPage() {
  const { collections, loading } = useWorkspace();
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <div className="page-stack">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Curated corners</p>
          <h1 className="page-title mt-3">
            Collections<span className="text-[var(--accent)]">.</span>
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            A few things that belong together.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEditorOpen(true)}>
          <Plus size={16} />
          New collection
        </Button>
      </section>
      {loading ? (
        <MediaSkeleton count={3} />
      ) : collections.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Card key={collection.id} className="group overflow-hidden">
              <Link href={`/collections/${collection.id}`} className="block">
                <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-soft)]">
                  <MediaImage
                    src={collection.coverUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#17382f]/55 to-transparent" />
                  <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[var(--accent)]">
                    {collection.itemCount ?? collection.itemIds.length} items
                  </span>
                </div>
                <div className="p-5">
                  <h2 className="section-title">{collection.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {collection.description}
                  </p>
                  <span className="text-link mt-4">
                    Open collection <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Give a few things a home."
          description="Sunday films. Ideas to come back to. A collection starts with whatever connects them."
          action={
            <Button variant="secondary" onClick={() => setEditorOpen(true)}>
              Create a collection
              <Plus size={15} />
            </Button>
          }
        />
      )}
      {editorOpen && <CollectionEditor onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

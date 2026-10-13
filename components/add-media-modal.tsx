"use client";
import Link from "next/link";
import { useState } from "react";
import { getLibrary } from "@/lib/data/client";
import { useWorkspace } from "./workspace-provider";
import { Button, Input, Badge } from "./ui";
import { Modal } from "./modal";
import { MediaImage } from "./media-image";
import { SegmentedControl } from "./journal-ui";
import {
  SessionFields,
  localDateTime,
  type SessionDraft,
} from "./session-fields";
import { normalizeUrl } from "@/lib/utils";
import { createMediaSchema } from "@/lib/validation";
import {
  mediaTypes,
  type ContentIntent,
  type MediaStatus,
  type MediaType,
} from "@/types/domain";
import type { MediaMetadata } from "@/lib/media/types";
export function AddMediaModal({ onClose }: { onClose: () => void }) {
  const { addMedia, currentUserId, collections, categories } = useWorkspace();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Partial<MediaMetadata> | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("video");
  const [intent, setIntent] = useState<ContentIntent>("both");
  const [status, setStatus] = useState<MediaStatus>("watched");
  const [categoryText, setCategoryText] = useState("");
  const [tagText, setTagText] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [rating, setRating] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDraft>({
    date: localDateTime(),
    participantIds: [currentUserId],
    completed: true,
    progressPercent: 100,
    progressSeconds: 0,
  });
  function manual() {
    setPreview({
      sourceProvider: "manual",
      canonicalUrl:
        url || `https://manual.our-shelf.invalid/${crypto.randomUUID()}`,
      thumbnailUrl: "",
    });
    setTitle("");
    setType("other");
  }
  async function lookup() {
    setError("");
    setBusy(true);
    try {
      normalizeUrl(url);
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as {
        metadata?: MediaMetadata;
        error?: string;
      };
      if (!response.ok || !payload.metadata)
        throw new Error(
          payload.error || "Could not load details. You can add them by hand.",
        );
      const m = payload.metadata;
      setPreview({
        ...m,
        subtitle:
          m.subtitle === "Add a title before saving" ? undefined : m.subtitle,
      });
      setTitle(m.title);
      setType(m.type);
      const existing = await getLibrary({
        canonicalUrl: m.canonicalUrl,
        limit: 1,
      });
      if (existing.ok) setDuplicateId(existing.data.items[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this link.");
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const sourceUrl = url.trim()
        ? normalizeUrl(url)
        : (preview?.canonicalUrl ??
          `https://manual.our-shelf.invalid/${crypto.randomUUID()}`);
      const data = createMediaSchema.parse({
        ...preview,
        title,
        type,
        contentIntent: intent,
        status,
        sourceProvider: preview?.sourceProvider ?? "manual",
        sourceUrl,
        canonicalUrl: preview?.canonicalUrl ?? sourceUrl,
        thumbnailUrl: preview?.thumbnailUrl ?? "",
        categories: split(categoryText),
        tags: split(tagText),
        collectionId: collectionId || undefined,
        favorite,
        rating: rating ? Number(rating) : undefined,
        watchlistIntent: status === "watch_later" ? "mine" : undefined,
        session:
          status !== "watch_later"
            ? {
                occurredAt: new Date(session.date).toISOString(),
                participantIds: session.participantIds,
                completed: status === "watched",
                progressPercent:
                  status === "watched" ? 100 : session.progressPercent,
                progressSeconds: session.progressSeconds || undefined,
              }
            : undefined,
      });
      const r = await addMedia(data);
      if (r?.duplicate) {
        setDuplicateId(r.id ?? null);
      } else if (r) onClose();
      else setError("Could not save. Your changes are still here.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please check the fields.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Keep the good stuff." onClose={onClose}>
      <p className="mb-6 max-w-lg text-sm leading-7 text-[var(--muted)]">
        Paste something you watched, read or discovered. We&apos;ll bring in the
        details; you make it yours.
      </p>
      {!preview ? (
        <div className="space-y-5">
          <label htmlFor="media-link" className="field-label">
            Paste a link
          </label>
          <div className="flex gap-2">
            <Input
              id="media-link"
              autoFocus
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
            />
            <Button onClick={() => void lookup()} disabled={busy || !url}>
              {busy ? "Reading…" : "Preview"}
            </Button>
          </div>
          {busy && (
            <div
              role="status"
              aria-label="Reading link details"
              className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--line)] p-4"
            >
              <div className="skeleton h-20 w-28 shrink-0" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-4" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 py-2">
            <span className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-xs text-[var(--muted)]">
              or start with a blank page
            </span>
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>
          <Button variant="secondary" className="w-full" onClick={manual}>
            Create a manual entry
          </Button>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={save}>
          <div className="flex items-center gap-4 rounded-[var(--radius-md)] bg-[var(--surface)] p-3">
            <MediaImage
              src={preview.thumbnailUrl}
              className="h-24 w-28 shrink-0 rounded-[var(--radius-sm)] object-cover"
              width={280}
              height={240}
            />
            <div className="min-w-0">
              <Badge tone="green">{preview.sourceProvider ?? "manual"}</Badge>
              <p className="mt-2 line-clamp-2 text-sm font-medium">
                {title || "Give it a title"}
              </p>
              {preview.channelName && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {preview.channelName}
                </p>
              )}
            </div>
          </div>
          {duplicateId && (
            <div
              role="status"
              className="rounded-[var(--radius-sm)] bg-[var(--warning-soft)] p-4 text-sm"
            >
              <p>This item is already in your library.</p>
              <Link
                href={`/library/${duplicateId}`}
                onClick={onClose}
                className="text-link mt-1"
              >
                Open it to add a session, note, or progress update
              </Link>
            </div>
          )}
          <label className="field-label">
            Title
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
            />
          </label>
          <Select
            label="What is it?"
            value={type}
            onChange={(v) => setType(v as MediaType)}
            options={[...mediaTypes]}
          />
          <SegmentedControl
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setSession({
                ...session,
                completed: v === "watched",
                progressPercent:
                  v === "watched"
                    ? 100
                    : session.completed
                      ? 0
                      : session.progressPercent,
              });
            }}
            options={[
              { value: "watched", label: "Watched" },
              { value: "watching", label: "Watching" },
              { value: "watch_later", label: "Watch later" },
            ]}
          />
          {status !== "watch_later" && (
            <SessionFields value={session} onChange={setSession} />
          )}
          <details className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
            <summary className="min-h-7 cursor-pointer text-sm font-medium">
              Organize & make it personal
            </summary>
            <div className="mt-5 space-y-5">
              <SegmentedControl
                label="Why save it?"
                value={intent}
                onChange={setIntent}
                options={[
                  { value: "useful", label: "Useful" },
                  { value: "entertainment", label: "Entertainment" },
                  { value: "both", label: "Both" },
                ]}
              />
              <label className="field-label">
                Categories
                <Input
                  list="known-categories"
                  value={categoryText}
                  onChange={(e) => setCategoryText(e.target.value)}
                  placeholder="Movies, Travel"
                />
                <datalist id="known-categories">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </label>
              <label className="field-label">
                Tags
                <Input
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  placeholder="Comma-separated tags"
                />
              </label>
              {collections.length > 0 && (
                <label className="field-label">
                  Collection
                  <select
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">None</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={favorite}
                    onChange={(e) => setFavorite(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Favorite
                </label>
                <label className="flex items-center gap-3 text-sm">
                  Rating
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    className="w-24"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </details>
          <details className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
            <summary className="min-h-7 cursor-pointer text-sm font-medium">
              Description & image (optional)
            </summary>
            <label className="field-label mt-4">
              Description
              <textarea
                className="editor !min-h-24"
                maxLength={20000}
                value={preview.description ?? ""}
                onChange={(e) =>
                  setPreview({ ...preview, description: e.target.value })
                }
              />
            </label>
            <label className="field-label mt-4">
              Thumbnail URL
              <Input
                type="url"
                value={preview.thumbnailUrl ?? ""}
                onChange={(e) =>
                  setPreview({ ...preview, thumbnailUrl: e.target.value })
                }
              />
            </label>
          </details>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPreview(null);
                setDuplicateId(null);
              }}
            >
              Back
            </Button>
            <Button className="flex-1" disabled={busy || Boolean(duplicateId)}>
              {busy ? "Saving…" : "Save to our shelf"}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="error-message mt-4">
          {error}
        </p>
      )}
    </Modal>
  );
}
function split(text: string) {
  return [
    ...new Set(
      text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="field-label">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, ProgressBar } from "./ui";
import { Modal } from "./modal";
import {
  SessionFields,
  localDateTime,
  type SessionDraft,
} from "./session-fields";
import { useWorkspace } from "./workspace-provider";
import type { MediaItem, ViewingSession } from "@/types/domain";
import { formatDuration } from "@/lib/utils";
import { LocalDate } from "./local-date";
export function MediaControls({ item }: { item: MediaItem }) {
  const { currentUserId, collections, execute, saveSession } = useWorkspace();
  const router = useRouter();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<
    ViewingSession | undefined
  >();
  const [collectionId, setCollectionId] = useState("");
  const [rating, setRating] = useState(
    String(item.ratingByUser[currentUserId] ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const session = item.sessions.at(-1);
  return (
    <>
      <Card variant="quiet" className="py-6">
        <p className="eyebrow">Your rating</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await execute({
              op: "rating",
              mediaId: item.id,
              data: { value: Number(rating) },
            });
            setBusy(false);
          }}
        >
          <Input
            aria-label="Your rating out of 10"
            type="number"
            min={0}
            max={10}
            step={0.1}
            required
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
          <Button disabled={busy}>Save</Button>
        </form>
        {item.contentIntent !== "entertainment" && (
          <label className="mt-5 block text-sm font-bold">
            Usefulness
            <select
              aria-label="Usefulness"
              value={item.usefulnessByUser[currentUserId] ?? ""}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3"
              onChange={(e) => {
                if (e.target.value)
                  void execute({
                    op: "usefulness",
                    mediaId: item.id,
                    data: { value: Number(e.target.value) },
                  });
              }}
            >
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
        )}
      </Card>
      <Card variant="quiet" className="py-6">
        <p className="eyebrow">Viewing history</p>
        <div className="mt-4 flex justify-between text-sm">
          <span className="capitalize">{item.status.replaceAll("_", " ")}</span>
          <span>
            {session?.progressPercent ?? (session?.completed ? 100 : 0)}%
          </span>
        </div>
        <ProgressBar
          className="mt-3"
          value={session?.progressPercent ?? (session?.completed ? 100 : 0)}
        />
        {item.durationSeconds && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            {formatDuration(
              session?.progressSeconds ??
                (session?.completed ? item.durationSeconds : 0),
            )}{" "}
            of {formatDuration(item.durationSeconds)}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setEditingSession(undefined);
              setSessionOpen(true);
            }}
          >
            Add viewing session
          </Button>
          {session && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingSession(session);
                setSessionOpen(true);
              }}
            >
              Update progress
            </Button>
          )}
        </div>
        <div className="mt-5 space-y-0 border-l border-[var(--line)] pl-4">
          {item.sessions
            .slice()
            .reverse()
            .map((s) => (
              <p
                key={s.id}
                className="relative py-2 text-xs leading-6 text-[var(--muted)]"
              >
                <LocalDate value={s.occurredAt} includeTime /> ·{" "}
                {s.participantIds.length}{" "}
                {s.participantIds.length === 1 ? "person" : "people"} ·{" "}
                {s.completed ? "Finished" : `${s.progressPercent ?? 0}%`}
              </p>
            ))}
        </div>
      </Card>
      <Card variant="quiet" className="py-6">
        <p className="eyebrow">Watch later</p>
        <select
          aria-label="Watch later intent"
          className="mt-4 h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
          value={item.watchlistByUser[currentUserId] ?? ""}
          onChange={(e) =>
            void execute({
              op: "watchlist",
              mediaId: item.id,
              data: {
                intent: e.target.value
                  ? (e.target.value as "mine" | "together")
                  : null,
              },
            })
          }
        >
          <option value="">Not on my list</option>
          <option value="mine">I want to watch</option>
          <option value="together">Want to watch together</option>
        </select>
      </Card>
      <Card variant="quiet" className="py-6">
        <p className="eyebrow">Collections</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (collectionId)
              await execute({
                op: "collectionAdd",
                mediaId: item.id,
                data: { id: collectionId },
              });
          }}
        >
          <select
            aria-label="Add to collection"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            <option value="">Choose collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <Button disabled={!collectionId}>Add</Button>
        </form>
      </Card>
      <Card variant="quiet" className="flex flex-wrap gap-2 py-6">
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          Edit media
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (
              window.confirm(
                "Archive this item? Its notes and viewing history will be preserved.",
              )
            ) {
              const r = await execute({ op: "archiveMedia", mediaId: item.id });
              if (r) router.push("/library");
            }
          }}
        >
          Archive
        </Button>
      </Card>
      {sessionOpen && (
        <SessionModal
          item={item}
          existing={editingSession}
          onClose={() => setSessionOpen(false)}
          onSave={saveSession}
        />
      )}{" "}
      {editOpen && <EditMedia item={item} onClose={() => setEditOpen(false)} />}
    </>
  );
}
function SessionModal({
  item,
  existing,
  onClose,
  onSave,
}: {
  item: MediaItem;
  existing?: ViewingSession;
  onClose: () => void;
  onSave: (id: string, s: ViewingSession) => Promise<boolean>;
}) {
  const { currentUserId } = useWorkspace();
  const [value, setValue] = useState<SessionDraft>({
    date: existing
      ? localDateTime(new Date(existing.occurredAt))
      : localDateTime(),
    participantIds: existing?.participantIds ?? [currentUserId],
    completed: existing?.completed ?? true,
    progressPercent: existing?.progressPercent ?? 100,
    progressSeconds: existing?.progressSeconds ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={existing ? "Update progress" : "Add viewing session"}
      onClose={onClose}
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            if (
              await onSave(item.id, {
                id: existing?.id ?? crypto.randomUUID(),
                occurredAt: new Date(value.date).toISOString(),
                participantIds: value.participantIds,
                completed: value.completed,
                progressPercent: value.completed ? 100 : value.progressPercent,
                progressSeconds: value.progressSeconds || undefined,
              })
            )
              onClose();
            else setError("Could not save. Your changes are still here.");
          } catch {
            setError("Choose a valid date and participants.");
          }
          setBusy(false);
        }}
      >
        <SessionFields value={value} onChange={setValue} />
        <Button disabled={busy || !value.participantIds.length}>
          Save session
        </Button>
        {error && (
          <p role="alert" className="text-sm text-[var(--coral)]">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
function EditMedia({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const { execute } = useWorkspace();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [categories, setCategories] = useState(item.categories.join(", "));
  const [tags, setTags] = useState(item.tags.join(", "));
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Edit this memory" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await execute({
            op: "updateMedia",
            mediaId: item.id,
            data: {
              title,
              description,
              type: item.type,
              status: item.status,
              contentIntent: item.contentIntent,
              categories: categories
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean),
              tags: tags
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean),
            },
          });
          if (r) onClose();
          setBusy(false);
        }}
      >
        <label className="block text-sm font-bold">
          Title
          <Input
            value={title}
            maxLength={500}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm font-bold">
          Description
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-[var(--line)] p-3 text-sm"
            value={description}
            maxLength={20000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm font-bold">
          Categories
          <Input
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
          />
        </label>
        <label className="block text-sm font-bold">
          Tags
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <Button disabled={busy}>Save changes</Button>
      </form>
    </Modal>
  );
}

"use client";
import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Avatar, Button, Input } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { LocalDate } from "./local-date";
import type { MediaItem, Note } from "@/types/domain";
export function Reflections({ item }: { item: MediaItem }) {
  const { addNote } = useWorkspace();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    if (await addNote(item.id, text.trim())) setText("");
    setBusy(false);
  }
  return (
    <section className="border-t border-[var(--line)] pt-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Personal reflections</p>
          <h2 className="section-title mt-2">What stayed with you?</h2>
        </div>
        <MessageCircle className="text-[var(--accent)]" size={20} />
      </div>
      <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--surface-soft)] p-4">
        <textarea
          aria-label="Your reflection"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={20000}
          placeholder="What did this leave you with?"
          className="editor !min-h-32 !border-0 !bg-transparent !p-1"
        />
        <div className="mt-3 flex justify-end">
          <Button disabled={busy || !text.trim()} onClick={() => void save()}>
            Keep this thought
            <Send size={15} />
          </Button>
        </div>
      </div>
      <div className="mt-7 space-y-6">
        {item.notes.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            No reflections yet. Be the first to leave one.
          </p>
        )}
        {item.notes.map((note) => (
          <NoteThread key={note.id} mediaId={item.id} note={note} />
        ))}
      </div>
    </section>
  );
}
function NoteThread({ mediaId, note }: { mediaId: string; note: Note }) {
  const { people, currentUserId, execute, replyToNote } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const author = people.find((p) => p.id === note.authorId);
  const own = currentUserId === note.authorId;
  async function update(
    body = note.body,
    pinned = Boolean(note.isPinned),
    important = Boolean(note.isImportant),
  ) {
    setBusy(true);
    const r = await execute({
      op: "updateNote",
      mediaId,
      data: { id: note.id, body, isPinned: pinned, isImportant: important },
    });
    if (r) setEditing(false);
    setBusy(false);
  }
  return (
    <article
      className={`border-b border-[var(--line)] pb-7 last:border-0 ${note.isImportant || note.isPinned ? "border-l-2 border-l-[var(--accent)] pl-4" : ""}`}
    >
      <div className="flex gap-3">
        <Avatar
          name={author?.name ?? "Member"}
          color={author?.color}
          src={author?.avatar}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              {author?.name ?? "Member"}
              {note.isPinned && " · Pinned"}
              {note.isImportant && " · Important"}
            </p>
            <span className="text-xs text-[var(--muted)]">
              <LocalDate value={note.createdAt} relative />
              {note.updatedAt && note.updatedAt !== note.createdAt
                ? " · edited"
                : ""}
            </span>
          </div>
          {editing ? (
            <div className="mt-3">
              <textarea
                aria-label="Edit reflection"
                className="min-h-24 w-full rounded-xl border border-[var(--line)] p-3 text-sm"
                value={draft}
                maxLength={20000}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  disabled={busy || !draft.trim()}
                  onClick={() => void update(draft.trim())}
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="note-body mt-3">{note.body}</p>
          )}
          {own && !editing && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-[var(--accent)]">
              <button
                disabled={busy}
                onClick={() => {
                  setDraft(note.body);
                  setEditing(true);
                }}
              >
                Edit
              </button>
              <button
                disabled={busy}
                onClick={() => void update(note.body, !note.isPinned)}
              >
                {" "}
                {note.isPinned ? "Unpin" : "Pin"}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void update(
                    note.body,
                    Boolean(note.isPinned),
                    !note.isImportant,
                  )
                }
              >
                {note.isImportant ? "Unmark important" : "Important"}
              </button>
              <button
                className="text-[var(--coral)]"
                disabled={busy}
                onClick={async () => {
                  if (window.confirm("Delete your reflection and its replies?"))
                    await execute({
                      op: "deleteNote",
                      mediaId,
                      data: { id: note.id },
                    });
                }}
              >
                Delete
              </button>
            </div>
          )}
          {note.replies.map((r) => (
            <ReplyRow key={r.id} mediaId={mediaId} reply={r} />
          ))}
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await replyToNote(mediaId, note.id, reply.trim()))
                setReply("");
              setBusy(false);
            }}
          >
            <Input
              aria-label="Reply to reflection"
              value={reply}
              maxLength={10000}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply gently…"
              className="h-11 text-xs"
            />
            <button
              disabled={busy || !reply.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white disabled:opacity-50"
              aria-label="Reply"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
function ReplyRow({
  mediaId,
  reply,
}: {
  mediaId: string;
  reply: Note["replies"][number];
}) {
  const { people, currentUserId, execute } = useWorkspace();
  const author = people.find((p) => p.id === reply.authorId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply.body);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-5 border-l border-[var(--line)] pl-4">
      <div className="flex items-start gap-3">
        <Avatar
          name={author?.name ?? "Member"}
          color={author?.color}
          src={author?.avatar}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">
            {author?.name ?? "Member"}
            {reply.updatedAt && reply.updatedAt !== reply.createdAt
              ? " · edited"
              : ""}
          </p>
          {editing ? (
            <form
              className="mt-2 flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const r = await execute({
                  op: "updateReply",
                  mediaId,
                  data: { id: reply.id, body: text.trim() },
                });
                if (r) setEditing(false);
                setBusy(false);
              }}
            >
              <Input
                aria-label="Edit reply"
                value={text}
                maxLength={10000}
                onChange={(e) => setText(e.target.value)}
              />
              <Button disabled={busy || !text.trim()}>Save</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <p className="note-body mt-2 !text-sm">{reply.body}</p>
          )}
          {currentUserId === reply.authorId && !editing && (
            <div className="mt-2 flex gap-4 text-xs text-[var(--accent)]">
              <button
                onClick={() => {
                  setText(reply.body);
                  setEditing(true);
                }}
              >
                Edit reply
              </button>
              <button
                className="text-[var(--coral)]"
                onClick={async () => {
                  if (window.confirm("Delete your reply?"))
                    await execute({
                      op: "deleteReply",
                      mediaId,
                      data: { id: reply.id },
                    });
                }}
              >
                Delete reply
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

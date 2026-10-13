"use client";
import { useState } from "react";
import { Modal } from "./modal";
import { Button, Input } from "./ui";
import { useWorkspace } from "./workspace-provider";
import type { Collection } from "@/types/domain";
export function CollectionEditor({
  collection,
  onClose,
}: {
  collection?: Collection;
  onClose: () => void;
}) {
  const { execute } = useWorkspace();
  const [title, setTitle] = useState(collection?.title ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(collection?.coverUrl ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={collection ? "Edit collection" : "A few things together"}
      onClose={onClose}
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await execute({
            op: "saveCollection",
            data: { id: collection?.id, title, description, coverUrl },
          });
          if (r) onClose();
          setBusy(false);
        }}
      >
        <label className="field-label">
          Title
          <Input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2"
          />
        </label>
        <label className="field-label">
          Description
          <textarea
            value={description}
            maxLength={5000}
            onChange={(e) => setDescription(e.target.value)}
            className="editor !min-h-28"
          />
        </label>
        <label className="field-label">
          Cover image URL (optional)
          <Input
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            className="mt-2"
          />
        </label>
        <div className="dialog-actions">
          <Button className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save collection"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

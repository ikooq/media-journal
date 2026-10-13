"use client";
import { useEffect, useState } from "react";
import { MediaImage } from "./media-image";
import { MAX_IMAGE_SIZE } from "@/lib/uploads";
export function ImageUpload({
  kind,
  current,
  onSaved,
}: {
  kind: "avatar" | "cover";
  current?: string;
  onSaved: () => Promise<void>;
}) {
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (
      file.size > MAX_IMAGE_SIZE ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPEG, PNG, or WebP image under 5 MB.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        error?: string;
        warning?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Could not upload the image.");
      await onSaved();
      setMessage(payload.warning || "Image saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setPreview("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0">
      <p className="eyebrow mb-4">
        {kind === "avatar" ? "Your familiar face" : "A picture of your world"}
      </p>
      {preview ? (
        <span
          role="img"
          className={
            kind === "avatar"
              ? "mb-5 block h-28 w-28 overflow-hidden rounded-full bg-[var(--surface-soft)]"
              : "mb-5 block aspect-[21/9] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-soft)]"
          }
          style={{
            backgroundImage: `url("${preview}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-label="Image preview"
        />
      ) : (
        <MediaImage
          src={current}
          alt="Current image"
          className={
            kind === "avatar"
              ? "mb-5 block h-28 w-28 rounded-full object-cover"
              : "mb-5 block aspect-[21/9] w-full rounded-[var(--radius-md)] object-cover"
          }
        />
      )}
      <label className="field-label">
        {kind === "avatar" ? "Replace avatar" : "Replace shared cover"}
        <input
          aria-label={kind === "avatar" ? "Avatar image" : "Space cover image"}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="mt-3 block w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-2 text-sm text-[var(--muted)] file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-[var(--surface)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--accent)]"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      <p className="mt-2 text-xs text-[var(--muted)]">
        JPEG, PNG or WebP · maximum 5 MB
      </p>
      {busy && (
        <p role="status" className="mt-3 text-sm">
          Uploading…
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-[var(--accent)]">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--coral)]">
          {error}
        </p>
      )}
    </div>
  );
}

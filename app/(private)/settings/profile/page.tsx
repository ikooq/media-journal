"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { updateProfile } from "@/lib/data/client";
import { Button, Card, Input } from "@/components/ui";
import { SettingsFrame } from "@/components/settings-frame";
import { ImageUpload } from "@/components/image-upload";
import { useWorkspace } from "@/components/workspace-provider";
export default function ProfileSettings() {
  const { people, currentUserId, email, refreshBootstrap } = useWorkspace();
  const me = people.find((p) => p.id === currentUserId);
  const [name, setName] = useState(me?.name ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(me?.name ?? ""), [me?.name]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await updateProfile(name);
    setMessage(r.ok ? "Profile saved." : r.error);
    if (r.ok) await refreshBootstrap();
    setBusy(false);
  }
  return (
    <SettingsFrame
      title="Your profile."
      description="A familiar face. A name that feels like you."
    >
      <Card className="p-5 sm:p-8">
        <ImageUpload
          kind="avatar"
          current={me?.avatar}
          onSaved={refreshBootstrap}
        />
        <form className="mt-7 space-y-4" onSubmit={save}>
          <label className="block text-sm font-bold">
            Display name
            <Input
              className="mt-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </label>
          <p className="text-sm text-[var(--muted)]">Account: {email}</p>
          <Button disabled={busy}>Save profile</Button>
          {message && (
            <p role="status" className="text-sm text-[var(--accent)]">
              {message}
            </p>
          )}
        </form>
      </Card>
      <Link
        href="/settings/space"
        className="text-sm font-bold text-[var(--accent)]"
      >
        Shared space settings →
      </Link>
    </SettingsFrame>
  );
}

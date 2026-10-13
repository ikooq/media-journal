"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSpace,
  acceptInvitation,
  updateProfile,
} from "@/lib/data/client";
import { Button, Card, Input } from "./ui";
import { createClient } from "@/lib/supabase/client";
export function Onboarding({ name }: { name: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [spaceName, setSpaceName] = useState("Our shelf");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(join = false) {
    setBusy(true);
    setError("");
    const p = await updateProfile(displayName);
    if (!p.ok) {
      setError(p.error);
      setBusy(false);
      return;
    }
    const token = invite.trim().split("/").pop() ?? "";
    const r = join
      ? await acceptInvitation(token)
      : await createSpace(spaceName);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
    } else router.refresh();
  }
  return (
    <Card className="mx-auto my-8 max-w-xl p-6 sm:my-16 sm:p-10">
      <p className="eyebrow">Make yourself at home</p>
      <h1 className="page-title mt-4 !text-4xl">Start your shared archive.</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        Create a space for your memories, or use an invitation from someone you
        know.
      </p>
      <label className="mt-7 block text-sm font-bold">
        Your display name
        <Input
          className="mt-2"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
        />
      </label>
      <label className="mt-4 block text-sm font-bold">
        Space name
        <Input
          className="mt-2"
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          maxLength={80}
        />
      </label>
      <Button
        className="mt-5 w-full"
        disabled={busy}
        onClick={() => void submit()}
      >
        Create shared space
      </Button>
      <div className="my-6 h-px bg-[var(--line)]" />
      <label className="block text-sm font-bold">
        Invitation link
        <Input
          className="mt-2"
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
          placeholder="Paste your invitation link"
        />
      </label>
      <Button
        className="mt-4 w-full"
        variant="secondary"
        disabled={busy || !invite}
        onClick={() => void submit(true)}
      >
        Join an existing space
      </Button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--coral)]">
          {error}
        </p>
      )}
      <Button
        className="mt-4 w-full"
        variant="ghost"
        onClick={async () => {
          const { error } = await createClient().auth.signOut();
          if (error) setError("Could not sign out. Please retry.");
          else {
            router.replace("/login");
            router.refresh();
          }
        }}
      >
        Sign out
      </Button>
    </Card>
  );
}

"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/lib/data/client";
import { Button, Card } from "@/components/ui";
export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function accept() {
    setBusy(true);
    const r = await acceptInvitation(token);
    if (r.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError(r.error);
      setBusy(false);
    }
  }
  return (
    <Card className="mx-auto max-w-lg p-9">
      <p className="eyebrow">An invitation</p>
      <h1 className="mt-3 font-display text-4xl">Share a little corner.</h1>
      <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
        Accept this invitation to join the shared library with your current
        account. Links expire after seven days and can only be used once.
      </p>
      <Button className="mt-6" disabled={busy} onClick={() => void accept()}>
        Join shared space
      </Button>
      {error && (
        <p className="mt-4 text-sm text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

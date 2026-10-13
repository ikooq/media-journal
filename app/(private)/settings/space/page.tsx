"use client";
import { useEffect, useState } from "react";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  createSpace,
} from "@/lib/data/client";
import { Avatar, Button, Card, Input } from "@/components/ui";
import { SettingsFrame } from "@/components/settings-frame";
import { ImageUpload } from "@/components/image-upload";
import { useWorkspace } from "@/components/workspace-provider";
import { useRouter } from "next/navigation";
type Invite = {
  id: string;
  expires_at: string;
  revoked_at: string | null;
  accepted_at: string | null;
};
export default function SpaceSettings() {
  const { activeSpace, people, execute, refreshBootstrap, categories } =
    useWorkspace();
  const [name, setName] = useState(activeSpace?.name ?? "");
  const [date, setDate] = useState(activeSpace?.startedAt ?? "");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [category, setCategory] = useState("");
  const [newSpace, setNewSpace] = useState("");
  const router = useRouter();
  useEffect(() => {
    setName(activeSpace?.name ?? "");
    setDate(activeSpace?.startedAt ?? "");
    if (activeSpace?.role === "owner") void loadInvites();
  }, [activeSpace]);
  async function loadInvites() {
    const r = await listInvitations();
    if (r.ok) setInvites(r.data);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await execute({
      op: "saveSpace",
      data: { name, startedAt: date || null },
    });
    if (r) {
      setMessage("Space saved.");
      await refreshBootstrap();
    }
    setBusy(false);
  }
  async function invite() {
    setBusy(true);
    const r = await createInvitation();
    if (r.ok) {
      setLink(`${window.location.origin}/join/${r.data}`);
      await loadInvites();
    } else setMessage(r.error);
    setBusy(false);
  }
  return (
    <SettingsFrame
      title="Your shared space."
      description="Make this little corner of the internet feel like home."
    >
      <Card className="space-y-7 p-5 sm:p-8">
        <ImageUpload
          kind="cover"
          current={activeSpace?.coverUrl}
          onSaved={refreshBootstrap}
        />
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm font-bold">
            Space name
            <Input
              required
              className="mt-2"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm font-bold">
            Our start date (optional)
            <Input
              type="date"
              className="mt-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <Button disabled={busy}>Save space</Button>
        </form>
        {message && (
          <p role="status" className="text-sm text-[var(--accent)]">
            {message}
          </p>
        )}
      </Card>
      <Card variant="quiet" className="py-7">
        <h2 className="font-display text-2xl">Members</h2>
        <div className="mt-5 space-y-3">
          {people.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <Avatar name={p.name} color={p.color} src={p.avatar} />
              <span className="flex-1 text-sm font-semibold">{p.name}</span>
              <span className="text-xs capitalize text-[var(--muted)]">
                {p.role}
              </span>
            </div>
          ))}
        </div>
        {activeSpace?.role === "owner" && (
          <div className="mt-7">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void invite()}
            >
              Create partner invitation
            </Button>
            {link && (
              <label className="mt-5 block text-sm">
                Share this one-use link privately. Expires in seven days.
                <Input
                  aria-label="Invitation link"
                  className="mt-2"
                  readOnly
                  value={link}
                />
              </label>
            )}
            <div className="mt-4 space-y-2">
              {invites
                .filter((i) => !i.revoked_at && !i.accepted_at)
                .map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span>
                      Expires {new Date(i.expires_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={async () => {
                        const r = await revokeInvitation(i.id);
                        if (r.ok) await loadInvites();
                        else setMessage(r.error);
                      }}
                      className="min-h-11 text-[var(--coral)]"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Card>
      <Card variant="quiet" className="py-7">
        <h2 className="font-display text-2xl">Categories</h2>
        <form
          className="mt-5 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await execute({
              op: "saveCategory",
              data: { name: category },
            });
            if (r) {
              setCategory("");
              await refreshBootstrap();
            }
          }}
        >
          <Input
            required
            maxLength={60}
            aria-label="New category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <Button>Add</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              title="Delete category"
              aria-label={`Delete category ${c.name}`}
              className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
              onClick={async () => {
                if (
                  window.confirm(
                    `Delete category “${c.name}”? Media and notes will stay.`,
                  )
                ) {
                  await execute({ op: "deleteCategory", data: { id: c.id } });
                  await refreshBootstrap();
                }
              }}
            >
              {c.name} ×
            </button>
          ))}
        </div>
      </Card>
      <Card variant="quiet" className="py-7">
        <h2 className="font-display text-2xl">Another shared space</h2>
        <form
          className="mt-5 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await createSpace(newSpace);
            if (r.ok) {
              router.replace("/");
              router.refresh();
            } else setMessage(r.error);
          }}
        >
          <Input
            aria-label="New space name"
            value={newSpace}
            required
            maxLength={80}
            onChange={(e) => setNewSpace(e.target.value)}
          />
          <Button>Create</Button>
        </form>
      </Card>
    </SettingsFrame>
  );
}

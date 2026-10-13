import { BookOpen } from "lucide-react";
export function ConfigurationRequired() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-8">
      <BookOpen size={32} className="text-[var(--accent)]" />
      <p className="eyebrow mt-8">Connect your shelf</p>
      <h1 className="font-display mt-3 text-4xl">
        A private home for your memories.
      </h1>
      <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
        The Supabase connection has not been configured. Set{" "}
        <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, apply the migrations
        in <code>supabase/migrations</code>, then restart the server.
      </p>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Setup commands and Auth URLs are in README.md.
      </p>
    </main>
  );
}

"use client";
import { Button } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="eyebrow mb-4">A little interruption</p>
      <h1 className="page-title">We couldn&apos;t open your shelf.</h1>
      <p className="my-5 text-[var(--muted)]">
        Please retry. If this is a new installation, check the Supabase
        environment variables and apply every database migration.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}

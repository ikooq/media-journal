"use client";
import Link from "next/link";
import { ArrowRight, Plus, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Avatar, Button } from "@/components/ui";
import { Heatmap } from "@/components/heatmap";
import { MediaCard } from "@/components/media-card";
import { SectionHeader, EmptyState, StatNumber } from "@/components/journal-ui";
import { formatDuration, greetingForHour } from "@/lib/utils";
import { useClientReady } from "@/components/local-date";

export default function HomePage() {
  const ready = useClientReady();
  const { media, people, currentUserId, statistics, loading } = useWorkspace();
  const [greeting, setGreeting] = useState("Hello"),
    [today, setToday] = useState("");
  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
    setToday(
      new Date().toLocaleDateString("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);
  const me = people.find((p) => p.id === currentUserId);
  const watched = media
    .filter((item) => item.sessions.length)
    .sort(
      (a, b) =>
        new Date(b.sessions.at(-1)!.occurredAt).getTime() -
        new Date(a.sessions.at(-1)!.occurredAt).getTime(),
    );
  const featured = watched.find((item) => item.thumbnailUrl) ?? watched[0];
  const recent = watched.filter((item) => item.id !== featured?.id);
  const continuing = media.filter((item) => item.status === "watching");
  const waiting = media.filter(
    (item) =>
      item.status === "watch_later" ||
      Object.values(item.watchlistByUser).length > 0,
  );
  const favorites = media.filter((item) =>
    Object.values(item.favoriteByUser).some(Boolean),
  );
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow mb-3">{today || "Your private journal"}</p>
          <div className="flex items-center gap-3">
            <h1 className="page-title !text-[clamp(1.8rem,3.4vw,2.75rem)]">
              {greeting}, {me?.name ?? "friend"}.
            </h1>
            <span className="hidden sm:inline-flex">
              <Avatar
                name={me?.name ?? "Member"}
                src={me?.avatar}
                color={me?.color}
              />
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            A place for what stays with you.
          </p>
        </div>
        <Link href="/library" className="text-link">
          Open your library
          <ArrowRight size={16} />
        </Link>
      </section>
      <section aria-label="Recently watched">
        <SectionHeader
          title="Recently explored"
          eyebrow="The latest chapter"
          href="/library"
        />
        {loading ? (
          <div
            className="grid items-stretch gap-5 lg:grid-cols-[1.65fr_1fr]"
            role="status"
            aria-label="Loading recent discoveries"
          >
            <div className="skeleton aspect-[16/10] min-h-[320px]" />
            <div
              className="flex min-h-[320px] flex-col rounded-[var(--radius-lg)] border border-[var(--line)] p-6 sm:p-8"
              aria-hidden
            >
              <div className="skeleton mb-7 h-10 w-10 rounded-full" />
              <div className="skeleton h-3 w-24" />
              <div className="skeleton mt-4 h-16 w-3/4" />
              <div className="skeleton mt-5 h-14 w-full" />
              <div className="skeleton mt-auto h-5 w-32" />
            </div>
          </div>
        ) : featured ? (
          <div className="grid items-stretch gap-5 lg:grid-cols-[1.65fr_1fr]">
            <MediaCard
              item={featured}
              variant="featured"
              layoutScope="home-feature"
              priority
            />
            <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
              <span className="mb-7 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <PenLine size={19} strokeWidth={1.6} />
              </span>
              <p className="eyebrow">More than a link</p>
              <h2 className="section-title mt-3 max-w-xs">
                Keep the thought,
                <br />
                not just the thing.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                A sentence, a feeling, something you want to try. The part only
                you could write.
              </p>
              <Link
                href={`/library/${featured.id}`}
                className="text-link mt-auto pt-8"
              >
                Write a reflection
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Your story starts with the first thing you save."
            description="A film, an idea, a small discovery. Make a little room for it here."
            action={
              <Button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-add-media"))
                }
              >
                <Plus size={16} />
                Save something
              </Button>
            }
          />
        )}
        {!loading && recent.length > 0 && (
          <div className="media-grid mt-8">
            {recent.slice(0, 4).map((item) => (
              <MediaCard key={item.id} item={item} layoutScope="home-recent" />
            ))}
          </div>
        )}
      </section>
      <section className="border-y border-[var(--line)] py-7 sm:py-9">
        <div className="mb-6 flex items-center justify-between">
          <p className="eyebrow">This month, in little moments</p>
          <span className="text-xs text-[var(--muted)]">
            {ready
              ? new Date().toLocaleDateString("en", { month: "long" })
              : ""}
          </span>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <StatNumber
              value={statistics.watchedThisMonth}
              label="things explored"
            />
            <div>
              <p className="stat-number">
                {formatDuration(statistics.secondsThisMonth) || "0m"}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                time well spent
              </p>
            </div>
            <StatNumber
              value={statistics.notesThisMonth}
              label="thoughts kept"
            />
            <StatNumber
              value={statistics.streak}
              suffix={statistics.streak === 1 ? "day" : "days"}
              label="current streak"
            />
          </div>
        )}
      </section>
      {continuing.length > 0 && (
        <section>
          <SectionHeader
            title="Pick up where you left off"
            eyebrow="Still in motion"
            href="/library?status=watching"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {continuing.map((item) => (
              <MediaCard key={item.id} item={item} variant="wide" />
            ))}
          </div>
        </section>
      )}
      <section className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionHeader
            title="Our activity"
            eyebrow="Little footprints"
            href="/calendar"
            action="Calendar"
          />
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
            <Heatmap />
          </div>
        </div>
        <div>
          <SectionHeader
            title="For another evening"
            eyebrow="Watch later"
            href="/library?status=watch_later"
          />
          {waiting.length ? (
            <div className="divide-y divide-[var(--line)]">
              {waiting.slice(0, 3).map((item) => (
                <MediaCard key={item.id} item={item} variant="compact" />
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface-soft)] p-7">
              <p className="section-title">Nothing waiting for you.</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Save something for a slow Sunday, or whenever the mood is right.
              </p>
              <Link
                href="/library?status=watch_later"
                className="text-link mt-4"
              >
                Browse your shelf
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>
      <section>
        <SectionHeader
          title="The ones worth keeping close"
          eyebrow="Our favorites"
          href="/library?favorites=true"
        />
        {favorites.length ? (
          <div className="media-grid">
            {favorites.slice(0, 4).map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                layoutScope="home-favorites"
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="A favorite is a little bookmark."
            description="When something means a little more, keep it close."
          />
        )}
      </section>
    </div>
  );
}

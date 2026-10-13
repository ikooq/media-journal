"use client";
import Link from "next/link";
import { ArrowRight, Camera, CalendarDays, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { MediaImage } from "@/components/media-image";
import {
  AvatarStack,
  SectionHeader,
  EmptyState,
  StatNumber,
} from "@/components/journal-ui";
import { Heatmap } from "@/components/heatmap";
import { MediaCard } from "@/components/media-card";
import { useWorkspace } from "@/components/workspace-provider";
import { getLibrary } from "@/lib/data/client";
import type { MediaItem } from "@/types/domain";
import { LocalDate } from "@/components/local-date";

export default function UsPage() {
  const { media, people, statistics, activeSpace, loading, revision } =
    useWorkspace();
  const [first, setFirst] = useState<MediaItem | null>(null),
    [today, setToday] = useState<Date | null>(null);
  const [firstBusy, setFirstBusy] = useState(true);
  useEffect(() => {
    setFirstBusy(true);
    setToday(new Date());
    let alive = true;
    void getLibrary({ sort: "oldest", limit: 1 }).then((r) => {
      if (alive) {
        if (r.ok) setFirst(r.data.items[0] ?? null);
        setFirstBusy(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [activeSpace?.id, revision]);
  const loved = media.filter(
    (item) => Object.values(item.favoriteByUser).filter(Boolean).length > 1,
  );
  const shared = media.filter((item) =>
    item.sessions.some((session) => session.participantIds.length > 1),
  );
  const togetherDays =
    today && activeSpace?.startedAt
      ? Math.max(
          0,
          Math.floor(
            (today.getTime() -
              new Date(activeSpace.startedAt + "T00:00:00").getTime()) /
              86400000,
          ),
        )
      : null;
  const topCount = Math.max(...statistics.categories.map((c) => c.count), 1);
  return (
    <div className="page-stack">
      <section className="grid items-center gap-8 overflow-hidden rounded-[var(--radius-xl)] bg-[var(--surface-soft)] p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:p-12">
        <div>
          <p className="eyebrow mb-5">Our shared chapter</p>
          <AvatarStack people={people} size="lg" />
          <h1 className="page-title mt-6">
            {people.length
              ? people.map((p) => p.name).join(" & ")
              : "Our little world."}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-[var(--muted)]">
            The films, ideas, and everyday discoveries that are becoming part of
            your story.
          </p>
          {togetherDays !== null ? (
            <p className="mt-7 flex items-center gap-2 text-sm text-[var(--accent)]">
              <CalendarDays size={16} />
              Together for {togetherDays.toLocaleString()}{" "}
              {togetherDays === 1 ? "day" : "days"}.
            </p>
          ) : (
            <Link href="/settings/space" className="text-link mt-5">
              Add your start date
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface)]">
          <MediaImage
            src={activeSpace?.coverUrl}
            alt={activeSpace?.coverUrl ? "Your shared-space cover" : ""}
            className="block aspect-[5/4] w-full object-cover"
            priority
            sizes="(max-width:767px) 85vw, 45vw"
            width={1200}
            height={960}
          />
          <Link
            href="/settings/space"
            className="absolute bottom-4 right-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--surface)] px-4 text-xs text-[var(--ink)] shadow-sm"
          >
            <Camera size={14} />
            {activeSpace?.coverUrl ? "Change cover" : "Make it yours"}
          </Link>
        </div>
      </section>
      <section
        aria-label="Our numbers"
        aria-busy={loading}
        className="grid grid-cols-2 gap-8 border-y border-[var(--line)] py-8 sm:grid-cols-4"
      >
        <StatNumber value={statistics.totalItems} label="things discovered" />
        <StatNumber value={statistics.sharedMoments} label="shared moments" />
        <StatNumber value={statistics.lovedByBoth} label="loved by both" />
        <StatNumber
          value={statistics.notesThisMonth}
          label="thoughts this month"
        />
      </section>
      <section className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <SectionHeader title="The little milestones" eyebrow="Our journey" />
          <div
            className="space-y-0 border-l border-[var(--line)] pl-6"
            aria-busy={firstBusy}
          >
            {activeSpace?.startedAt && (
              <Journey
                title="Our beginning"
                date={activeSpace.startedAt}
                description="A date worth remembering."
              />
            )}
            {first && first.spaceId === activeSpace?.id && (
              <Journey
                title="The first thing you kept"
                date={first.createdAt}
                description={first.title}
                href={`/library/${first.id}`}
              />
            )}
            {shared[0] && (
              <Journey
                title="A moment shared"
                date={shared[0].sessions.at(-1)!.occurredAt}
                description={shared[0].title}
                href={`/library/${shared[0].id}`}
              />
            )}
            {!firstBusy &&
              !first &&
              !activeSpace?.startedAt &&
              statistics.totalItems === 0 && (
                <p className="py-5 text-sm leading-7 text-[var(--muted)]">
                  Your first saved discovery will start this chapter.
                </p>
              )}
          </div>
        </div>
        <div>
          <SectionHeader
            title="A shared rhythm"
            eyebrow="The last twelve weeks"
          />
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6">
            <Heatmap />
          </div>
        </div>
      </section>
      <section className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <SectionHeader title="What draws us in" eyebrow="Our interests" />
          {statistics.categories.length ? (
            <div className="space-y-5">
              {statistics.categories.slice(0, 6).map((category) => (
                <div key={category.name}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span>{category.name}</span>
                    <span className="tabular-nums text-[var(--muted)]">
                      {category.count}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                    <div
                      className="h-full origin-left rounded-full bg-[var(--accent)]"
                      style={{ width: `${(category.count / topCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-[var(--muted)]">
              Your interests will take shape as you save and categorize things.
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-7 sm:p-9">
          <p className="eyebrow">A few things together</p>
          <h2 className="section-title mt-3">
            A home for your
            <br />
            Sunday films. Or anything.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--muted)]">
            Make a collection around whatever connects the dots for the two of
            you.
          </p>
          <Link href="/collections" className="text-link mt-6">
            <Plus size={16} />
            Explore collections
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <section>
        <SectionHeader
          title="The ones you both loved"
          eyebrow="Shared favorites"
          href="/library?favorites=true"
        />
        {loved.length ? (
          <div className="media-grid">
            {loved.slice(0, 4).map((item) => (
              <MediaCard key={item.id} item={item} layoutScope="us-loved" />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Some things speak to both of you."
            description="When you both favorite something, it will find a home here."
          />
        )}
      </section>
    </div>
  );
}
function Journey({
  title,
  date,
  description,
  href,
}: {
  title: string;
  date: string;
  description: string;
  href?: string;
}) {
  return (
    <div className="relative pb-8 pl-1">
      <span className="absolute -left-[29px] top-1.5 h-2 w-2 rounded-full border border-[var(--page)] bg-[var(--accent)]" />
      <p className="eyebrow">
        <LocalDate value={date} relative />
      </p>
      <h3 className="mt-2 text-sm font-medium">{title}</h3>
      {href ? (
        <Link
          href={href}
          className="mt-1 inline-block text-sm leading-7 text-[var(--muted)] hover:text-[var(--accent)]"
        >
          {description}
          <ArrowRight size={13} className="ml-2 inline" />
        </Link>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  Share2,
  Star,
  ArrowUpRight,
} from "lucide-react";
import { use, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { Avatar, Badge, Button } from "@/components/ui";
import { AvatarStack, EmptyState, PageSkeleton } from "@/components/journal-ui";
import { MediaImage } from "@/components/media-image";
import { Reflections } from "@/components/reflections";
import { MediaControls } from "@/components/media-controls";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDuration } from "@/lib/utils";
import { LocalDate } from "@/components/local-date";

export default function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { media, people, currentUserId, toggleFavorite, loading } =
    useWorkspace();
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const reduced = useReducedMotion();
  const item = media.find((i) => i.id === id);
  if (loading) return <PageSkeleton detail />;
  if (!item)
    return (
      <EmptyState
        title="That page wandered off."
        description="It may have been archived, or belong to a different space."
        action={
          <Link href="/library" className="text-link">
            Back to the library
            <ArrowLeft size={15} />
          </Link>
        }
      />
    );
  const favorite = Boolean(item.favoriteByUser[currentUserId]),
    ratings = Object.values(item.ratingByUser),
    average = ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : undefined,
    last = item.sessions.at(-1);
  const participants = people.filter((p) =>
    last?.participantIds.includes(p.id),
  );
  const lovedByBoth =
    Object.values(item.favoriteByUser).filter(Boolean).length >= 2;
  const poster = ["movie", "series", "book"].includes(item.type);
  let safeSource = false;
  try {
    safeSource =
      ["http:", "https:"].includes(new URL(item.sourceUrl).protocol) &&
      !item.sourceUrl.includes("manual.our-shelf.invalid");
  } catch {
    /* Keep invalid legacy links inert. */
  }
  return (
    <div className="page-stack !gap-9">
      <Link href="/library" className="text-link w-fit !text-[var(--muted)]">
        <ArrowLeft size={16} />
        Back to library
      </Link>
      <section className="detail-hero">
        <div className={`detail-art-frame ${poster ? "is-poster" : ""}`}>
          {poster && item.backdropUrl && (
            <MediaImage
              src={item.backdropUrl}
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
          )}
          <m.div
            layoutId={`artwork-library-${item.id}`}
            className={`detail-art media-art ${poster ? "is-poster" : ""}`}
          >
            <MediaImage
              src={item.thumbnailUrl || item.backdropUrl}
              alt={`Artwork for ${item.title}`}
              priority
              className="h-full w-full object-cover"
              sizes={
                poster
                  ? "(max-width:767px) 60vw, 25vw"
                  : "(max-width:767px) 92vw, 50vw"
              }
              width={poster ? 700 : 1280}
              height={poster ? 1050 : 800}
            />
          </m.div>
        </div>
        <div className="min-w-0 py-2 lg:py-6">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge tone="green">
              {item.contentIntent === "both"
                ? "Useful + fun"
                : item.contentIntent}
            </Badge>
            <span className="text-xs capitalize text-[var(--muted)]">
              {item.type}
              {item.year ? ` · ${item.year}` : ""}
              {item.durationSeconds
                ? ` · ${formatDuration(item.durationSeconds)}`
                : ""}
            </span>
          </div>
          <h1 className="page-title !text-[clamp(2.1rem,4vw,3.35rem)]">
            {item.title}
          </h1>
          {item.subtitle && item.subtitle !== "Add a title before saving" && (
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {item.subtitle}
            </p>
          )}
          {(item.authorName || item.channelName) && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              By {item.authorName || item.channelName}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AvatarStack people={participants} />
            <p className="text-sm">
              {participants.length > 1
                ? "Watched together"
                : participants.length === 1
                  ? `With ${participants[0].name}`
                  : "Not watched yet"}
            </p>
            {last && (
              <span className="text-xs text-[var(--muted)]">
                · <LocalDate value={last.occurredAt} relative />
              </span>
            )}
          </div>
          {item.categories.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {item.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]"
                >
                  {category}
                </span>
              ))}
            </div>
          )}
          <div className="mt-7 flex flex-wrap gap-2">
            <Button
              aria-pressed={favorite}
              disabled={pending}
              variant={favorite ? "secondary" : "primary"}
              onClick={async () => {
                setPending(true);
                await toggleFavorite(item.id, favorite);
                setPending(false);
              }}
            >
              <m.span
                animate={
                  reduced ? undefined : { scale: favorite ? [1, 1.2, 1] : 1 }
                }
              >
                <Heart
                  size={17}
                  className={
                    favorite
                      ? "fill-[var(--destructive)] text-[var(--destructive)]"
                      : ""
                  }
                />
              </m.span>
              {favorite ? "Loved" : "Save favorite"}
            </Button>
            {safeSource && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-secondary"
              >
                <ExternalLink size={15} />
                Open source
              </a>
            )}
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setMessage(
                    "Private page link copied. Only space members can open it.",
                  );
                } catch {
                  setMessage(
                    "Could not copy. You can copy the address from your browser.",
                  );
                }
              }}
            >
              <Share2 size={16} />
              Share
            </Button>
          </div>
          {lovedByBoth && (
            <m.p
              initial={reduced ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-sm text-[var(--accent)]"
            >
              <Heart size={13} className="fill-current" aria-hidden />
              Loved by both
            </m.p>
          )}
          {message && (
            <p
              role="status"
              className="mt-4 text-xs leading-6 text-[var(--muted)]"
            >
              {message}
            </p>
          )}
        </div>
      </section>
      <div className="grid gap-12 border-t border-[var(--line)] pt-9 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
        <div className="min-w-0 space-y-12">
          <section>
            <p className="eyebrow mb-3">A little context</p>
            <h2 className="section-title">Why it&apos;s here</h2>
            <p className="note-body mt-5 text-[var(--muted)]">
              {item.description ||
                "The link is only the beginning. Leave a thought below to remember why this mattered."}
            </p>
            {item.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </section>
          <Reflections item={item} />
        </div>
        <aside className="min-w-0">
          <section className="pb-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Our ratings</p>
              <Star size={16} className="text-[var(--gold)]" />
            </div>
            <div className="mt-5 space-y-4">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar
                    name={p.name}
                    color={p.color}
                    src={p.avatar}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    {p.name}
                    {p.id === currentUserId && (
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        (you)
                      </span>
                    )}
                  </span>
                  <span className="text-lg tabular-nums">
                    {item.ratingByUser[p.id] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-end justify-between border-t border-[var(--line)] pt-4">
              <p className="text-xs text-[var(--muted)]">Average rating</p>
              <p className="font-display text-3xl">
                {average === undefined ? "—" : average.toFixed(1)}
                <span className="ml-1 font-sans text-xs text-[var(--muted)]">
                  / 10
                </span>
              </p>
            </div>
          </section>
          <div className="detail-controls">
            <MediaControls key={item.id} item={item} />
          </div>
          <Link href="/calendar" className="text-link mt-5">
            See your timeline
            <ArrowUpRight size={15} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { Bookmark, Heart, Star, ArrowUpRight, Play } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useWorkspace } from "./workspace-provider";
import { MediaImage } from "./media-image";
import { AvatarStack, TiltSurface } from "./journal-ui";
import { Badge, ProgressBar } from "./ui";
import { cn, formatDuration } from "@/lib/utils";
import { LocalDate } from "./local-date";
import type { MediaItem } from "@/types/domain";

export function MediaCard({
  item,
  variant = "grid",
  layoutScope = "library",
  priority = false,
}: {
  item: MediaItem;
  variant?: "grid" | "wide" | "compact" | "featured";
  layoutScope?: string;
  priority?: boolean;
}) {
  const { people, currentUserId, toggleFavorite } = useWorkspace();
  const [optimistic, setOptimistic] = useState<boolean | undefined>(),
    [pending, setPending] = useState(false);
  const persisted = Boolean(item.favoriteByUser[currentUserId]);
  const favorite = optimistic ?? persisted;
  const reduced = useReducedMotion();
  useEffect(() => setOptimistic(undefined), [persisted]);
  const ratings = Object.values(item.ratingByUser);
  const avg = ratings.length
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : null;
  const last = item.sessions.at(-1);
  const participants = people.filter((p) =>
    last?.participantIds.includes(p.id),
  );
  const progress = last?.progressPercent ?? (last?.completed ? 100 : 0);
  const poster = ["movie", "series", "book"].includes(item.type);
  const together = participants.length > 1;
  const href = `/library/${item.id}`;
  const favoriteButton = (
    <m.button
      type="button"
      aria-pressed={favorite}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        setOptimistic(!favorite);
        const saved = await toggleFavorite(item.id, favorite);
        if (!saved) setOptimistic(undefined);
        setPending(false);
      }}
      whileTap={reduced ? undefined : { scale: 0.85 }}
      animate={reduced ? undefined : { scale: favorite ? [1, 1.15, 1] : 1 }}
      aria-label={
        favorite
          ? `Remove ${item.title} from favorites`
          : `Favorite ${item.title}`
      }
      className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)] text-[var(--ink)] shadow-sm disabled:opacity-60"
    >
      {favorite ? (
        <Heart
          size={17}
          className="fill-[var(--destructive)] text-[var(--destructive)]"
        />
      ) : (
        <Bookmark size={17} strokeWidth={1.6} />
      )}
    </m.button>
  );
  if (variant === "compact" || variant === "wide")
    return (
      <Link
        href={href}
        className={cn(
          "media-row group",
          variant === "wide" &&
            "border border-[var(--line)] bg-[var(--surface)] p-3",
        )}
      >
        <div className="relative shrink-0">
          <MediaImage
            src={item.thumbnailUrl}
            width={256}
            height={160}
            className="media-row-art block"
          />
          {item.status === "watching" && (
            <ProgressBar
              value={progress}
              className="absolute inset-x-0 bottom-0"
            />
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="text-xs capitalize text-[var(--muted)]">
            {item.type} ·{" "}
            {item.status === "watching" ? (
              `${progress}% complete`
            ) : (
              <LocalDate value={item.updatedAt} relative />
            )}
          </span>
          <span className="mt-1 line-clamp-2 text-sm font-medium leading-6">
            {item.title}
          </span>
          {variant === "wide" && (
            <span className="mt-3 flex items-center gap-2">
              <AvatarStack people={participants} />
              {together && (
                <span className="text-xs text-[var(--muted)]">Together</span>
              )}
              {avg && (
                <span className="ml-auto flex items-center gap-1 text-xs">
                  <Star size={12} className="text-[var(--gold)]" />
                  {avg}
                </span>
              )}
            </span>
          )}
        </span>
        <ArrowUpRight
          size={17}
          className="shrink-0 text-[var(--muted)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </Link>
    );
  if (variant === "featured")
    return (
      <article className="featured-media group">
        <Link href={href} className="featured-media-art">
          <MediaImage
            src={item.backdropUrl || item.thumbnailUrl}
            className="h-full w-full object-cover"
            priority={priority}
            sizes="(max-width:767px) 92vw, 60vw"
            width={1600}
            height={1000}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
          <span className="absolute left-5 top-5">
            <Badge tone="neutral">{item.type}</Badge>
          </span>
          <span className="absolute bottom-6 left-6 right-6">
            <span className="mb-2 block text-xs tracking-wide text-white/90">
              {together ? "A moment together" : "Recently explored"}
            </span>
            <span className="block max-w-xl font-display text-3xl leading-tight tracking-[-.04em] text-white md:text-4xl">
              {item.title}
            </span>
            <span className="mt-4 flex items-center gap-3">
              <AvatarStack people={participants} />
              <span className="text-xs text-white/90">
                <LocalDate
                  value={last?.occurredAt ?? item.updatedAt}
                  relative
                />
                {item.durationSeconds
                  ? ` · ${formatDuration(item.durationSeconds)}`
                  : ""}
              </span>
            </span>
          </span>
        </Link>
        {favoriteButton}
      </article>
    );
  return (
    <m.article layout="position" className="group min-w-0">
      <TiltSurface className="relative">
        <m.div
          layoutId={`artwork-${layoutScope}-${item.id}`}
          className="media-art"
          data-poster={poster}
        >
          <Link
            href={href}
            className="block h-full"
            aria-label={`Open ${item.title}`}
          >
            <MediaImage
              src={item.thumbnailUrl}
              alt=""
              priority={priority}
              className="h-full w-full object-cover"
              width={poster ? 600 : 960}
              height={poster ? 900 : 600}
            />
            {item.thumbnailUrl && (
              <span className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            )}
          </Link>
          {favoriteButton}
          {item.status === "watching" && (
            <div className="absolute inset-x-0 bottom-0">
              <span className="mb-3 ml-3 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs text-white">
                <Play size={11} />
                {progress}%
              </span>
              <ProgressBar value={progress} className="rounded-none" />
            </div>
          )}
        </m.div>
      </TiltSurface>
      <div className="pt-3.5">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span className="capitalize">
            {item.type}
            {item.year ? ` · ${item.year}` : ""}
          </span>
          {avg && (
            <span className="inline-flex items-center gap-1 text-[var(--ink)]">
              <Star size={12} className="text-[var(--gold)]" />
              {avg}
            </span>
          )}
        </div>
        <Link
          href={href}
          className="line-clamp-2 text-[14px] font-medium leading-6 transition hover:text-[var(--accent)] sm:text-[15px]"
        >
          {item.title}
        </Link>
        <div className="mt-3 flex min-h-7 items-center gap-2">
          <AvatarStack people={participants} />
          <span className="min-w-0 text-xs text-[var(--muted)]">
            {together ? (
              "Together"
            ) : (
              <LocalDate value={last?.occurredAt ?? item.updatedAt} relative />
            )}
          </span>
        </div>
      </div>
    </m.article>
  );
}

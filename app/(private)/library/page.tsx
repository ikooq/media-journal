"use client";
import Link from "next/link";
import {
  Grid2X2,
  LibraryBig,
  List,
  Search,
  SlidersHorizontal,
  X,
  Plus,
} from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { getLibrary } from "@/lib/data/client";
import { MediaCard } from "@/components/media-card";
import { Button, Input } from "@/components/ui";
import { EmptyState, MediaSkeleton } from "@/components/journal-ui";
import { Modal } from "@/components/modal";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";
import { mediaTypes, type MediaItem, type MediaType } from "@/types/domain";

const filters = [
  "all",
  "watching",
  "watch_later",
  "favorites",
  "together",
  "useful",
  "entertainment",
] as const;
const primaryTypes: { value: MediaType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Videos" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "book", label: "Books" },
  { value: "article", label: "Articles" },
];
export default function LibraryPage() {
  const { statistics, revision } = useWorkspace();
  const [filtered, setFiltered] = useState<MediaItem[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState<(typeof filters)[number]>("all"),
    [type, setType] = useState<MediaType | "all">("all"),
    [sort, setSort] = useState("recent"),
    [view, setView] = useState<"grid" | "list">("grid"),
    [filtersOpen, setFiltersOpen] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search),
      status = p.get("status");
    if (status === "watching" || status === "watch_later") setFilter(status);
    if (p.get("favorites") === "true") setFilter("favorites");
  }, []);
  useEffect(() => setOffset(0), [query, filter, type, sort]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await getLibrary({
        query,
        filter,
        type,
        sort,
        offset,
        limit: 24,
      });
      if (alive) {
        if (r.ok) {
          setFiltered(r.data.items);
          setTotal(r.data.total);
          setError("");
        } else setError(r.error);
        setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, filter, type, sort, offset, revision, retry]);
  const active = filter !== "all" || type !== "all" || Boolean(query);
  function reset() {
    setFilter("all");
    setType("all");
    setQuery("");
  }
  return (
    <div className="page-stack !gap-5">
      <section className="page-heading">
        <div>
          <p className="eyebrow mb-3">A well-kept world</p>
          <h1 className="page-title">Your library.</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {statistics.totalItems.toLocaleString()} things you&apos;ve chosen
            to keep.
          </p>
        </div>
        <LinkToCollections />
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            className="absolute left-4 top-4 text-[var(--muted)]"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            aria-label="Search your shelf"
            placeholder="Search your shelf"
          />
        </div>
        <Button
          variant="secondary"
          aria-label="Filters"
          className="!px-3 sm:!px-5"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">
            Filters{filter !== "all" ? " · 1" : ""}
          </span>
        </Button>
        <div
          className="flex rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-0.5"
          role="group"
          aria-label="Library view"
        >
          {(
            [
              { value: "grid", label: "Grid view", icon: Grid2X2 },
              { value: "list", label: "List view", icon: List },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setView(value)}
              aria-label={label}
              aria-pressed={view === value}
              className={cn(
                "icon-button !h-10 !w-10 !rounded-lg",
                view === value &&
                  "!bg-[var(--accent-soft)] !text-[var(--accent)]",
              )}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 border-b border-[var(--line)] pb-3">
        <div
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1"
          role="group"
          aria-label="Media type"
        >
          {primaryTypes.map((item) => (
            <button
              key={item.value}
              aria-pressed={type === item.value}
              onClick={() => setType(item.value)}
              className={cn(
                "relative min-h-11 shrink-0 whitespace-nowrap rounded-lg px-4 text-sm",
                type === item.value
                  ? "font-medium text-[var(--accent-deep)]"
                  : "text-[var(--muted)]",
              )}
            >
              {type === item.value && (
                <m.span
                  layoutId="library-type-active"
                  className="absolute inset-0 rounded-lg bg-[var(--accent-soft)]"
                />
              )}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-[var(--muted)]"
        >
          {loading
            ? "Finding your things…"
            : `${total.toLocaleString()} ${total === 1 ? "item" : "items"}`}
        </p>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>Sort by</span>
          <select
            aria-label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="max-w-44 rounded-lg border border-transparent bg-transparent px-2 text-xs text-[var(--ink)]"
          >
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest added</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
      {active && (
        <div className="-mt-4 flex flex-wrap gap-2">
          {filter !== "all" && (
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 text-xs capitalize"
              onClick={() => setFilter("all")}
            >
              {filter.replaceAll("_", " ")}
              <X size={12} />
            </button>
          )}
          {type !== "all" && (
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 text-xs capitalize"
              onClick={() => setType("all")}
            >
              {type}
              <X size={12} />
            </button>
          )}
          <button onClick={reset} className="text-link !min-h-10">
            Clear filters
            <X size={13} />
          </button>
        </div>
      )}
      <div aria-busy={loading}>
        {error ? (
          <div
            role="alert"
            className="error-message flex flex-wrap items-center justify-between gap-4"
          >
            {error}
            <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
              Retry
            </Button>
          </div>
        ) : loading && !filtered.length ? (
          <MediaSkeleton count={8} />
        ) : !filtered.length ? (
          <EmptyState
            title={
              query
                ? `No results for “${query}”.`
                : active
                  ? "Nothing on this shelf yet."
                  : "Your story starts with the first thing you save."
            }
            description={
              active
                ? "Try another word or make a little more room in your filters."
                : "Keep a film, a thought, a small piece of the internet you don't want to lose."
            }
            action={
              active ? (
                <Button variant="secondary" onClick={reset}>
                  Clear filters
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("open-add-media"))
                  }
                >
                  <Plus size={16} />
                  Add your first item
                </Button>
              )
            }
          />
        ) : (
          <div
            className={cn(
              view === "grid" ? "media-grid" : "grid gap-4 lg:grid-cols-2",
              loading && "opacity-60 transition-opacity",
            )}
          >
            {filtered.map((item, index) => (
              <MediaCard
                key={item.id}
                item={item}
                variant={view === "grid" ? "grid" : "wide"}
                priority={index < 2}
              />
            ))}
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[var(--line)] pt-7">
          <Button
            variant="secondary"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((v) => Math.max(0, v - 24))}
          >
            Previous
          </Button>
          <span className="text-xs tabular-nums text-[var(--muted)]">
            {offset + 1}–{Math.min(offset + 24, total)} of {total}
          </span>
          <Button
            variant="secondary"
            disabled={offset + 24 >= total || loading}
            onClick={() => setOffset((v) => v + 24)}
          >
            Next
          </Button>
        </div>
      )}
      {filtersOpen && (
        <Modal
          title="Refine your library"
          onClose={() => setFiltersOpen(false)}
        >
          <fieldset>
            <legend className="field-label mb-4">On this shelf</legend>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm capitalize",
                    filter === item
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                      : "border-[var(--line)] bg-[var(--surface)]",
                  )}
                >
                  {item.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field-label mt-7">
            Media format
            <select
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as MediaType | "all")}
            >
              <option value="all">All formats</option>
              {mediaTypes.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function LinkToCollections() {
  return (
    <Link href="/collections" className="text-link hidden sm:inline-flex">
      <LibraryBig size={15} />
      Collections
    </Link>
  );
}

"use client";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { getCalendar } from "@/lib/data/client";
import type { CalendarPage as CalendarData } from "@/types/domain";
import { MediaImage } from "@/components/media-image";
import { AvatarStack, SectionHeader } from "@/components/journal-ui";
import { MediaCard } from "@/components/media-card";
import { useWorkspace } from "@/components/workspace-provider";
import { cn, dateKey, formatDuration } from "@/lib/utils";
import { useClientReady } from "@/components/local-date";

export default function CalendarPage() {
  const ready = useClientReady();
  if (!ready)
    return (
      <div
        className="page-stack"
        role="status"
        aria-label="Loading your calendar"
        aria-busy="true"
      >
        <div>
          <p className="eyebrow mb-3">Your days, remembered</p>
          <h1 className="page-title">Calendar.</h1>
          <div className="skeleton mt-3 h-5 w-64 max-w-full" />
        </div>
        <div className="skeleton h-[460px]" />
      </div>
    );
  return <LocalCalendar />;
}
function LocalCalendar() {
  const { revision, people } = useWorkspace();
  const [monthData, setMonthData] = useState<CalendarData>({
      total: 0,
      days: [],
      entries: [],
    }),
    [dayData, setDayData] = useState<CalendarData>({
      total: 0,
      days: [],
      entries: [],
    }),
    [busy, setBusy] = useState(true),
    [dayBusy, setDayBusy] = useState(true),
    [error, setError] = useState(""),
    [dayOffset, setDayOffset] = useState(0),
    [monthOffset, setMonthOffset] = useState(0),
    [selected, setSelected] = useState(dateKey());
  const month = new Date();
  month.setDate(1);
  month.setMonth(month.getMonth() + monthOffset);
  const year = month.getFullYear(),
    monthIndex = month.getMonth(),
    firstDay = new Date(year, monthIndex, 1).getDay(),
    daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array(firstDay === 0 ? 6 : firstDay - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);
  const hours = monthData.days.reduce((sum, d) => sum + d.seconds, 0);
  useEffect(() => {
    const day = new URLSearchParams(window.location.search).get("day");
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const value = new Date(day + "T12:00:00");
      if (!Number.isNaN(value.getTime()) && dateKey(value) === day) {
        const now = new Date();
        setMonthOffset(
          (value.getFullYear() - now.getFullYear()) * 12 +
            value.getMonth() -
            now.getMonth(),
        );
        setSelected(day);
      }
    }
  }, []);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    void getCalendar({
      from: dateKey(new Date(year, monthIndex, 1)),
      to: dateKey(new Date(year, monthIndex + 1, 1)),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).then((r) => {
      if (alive) {
        if (r.ok) {
          setMonthData(r.data);
          setError("");
        } else setError(r.error);
        setBusy(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [year, monthIndex, revision]);
  useEffect(() => setDayOffset(0), [selected]);
  useEffect(() => {
    let alive = true;
    setDayBusy(true);
    const end = new Date(selected + "T12:00:00");
    end.setDate(end.getDate() + 1);
    void getCalendar({
      from: selected,
      to: dateKey(end),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: dayOffset,
    }).then((r) => {
      if (alive) {
        if (r.ok) setDayData(r.data);
        else setError(r.error);
        setDayBusy(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [selected, revision, dayOffset]);
  function navigate(delta: number) {
    const target = new Date(year, monthIndex + delta, 1);
    setMonthOffset((v) => v + delta);
    setSelected(dateKey(target));
  }
  function dayKeyboard(e: React.KeyboardEvent<HTMLButtonElement>, day: number) {
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (!(e.key in deltas) && !["Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const target = new Date(
      year,
      monthIndex,
      e.key === "Home"
        ? 1
        : e.key === "End"
          ? daysInMonth
          : day + deltas[e.key],
    );
    const key = dateKey(target);
    const now = new Date();
    setMonthOffset(
      (target.getFullYear() - now.getFullYear()) * 12 +
        target.getMonth() -
        now.getMonth(),
    );
    setSelected(key);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(`[data-day="${key}"]`)
        ?.focus({ preventScroll: true }),
    );
  }
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow mb-3">Your days, remembered</p>
          <h1 className="page-title">Calendar.</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Not every day needs a story. Keep the ones that do.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="min-w-32 text-center text-sm font-medium">
            {month.toLocaleDateString("en", { month: "long", year: "numeric" })}
          </h2>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => navigate(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="grid items-start gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section
          className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-6"
          aria-label="Activity calendar"
          aria-busy={busy}
        >
          <div className="mb-3 grid grid-cols-7 text-center text-[11px] text-[var(--muted)]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((day, index) => {
              if (!day)
                return <span key={`empty-${index}`} className="calendar-day" />;
              const key = dateKey(new Date(year, monthIndex, day)),
                data = monthData.days.find((d) => d.day === key),
                entries = monthData.entries.filter(
                  ({ session }) =>
                    dateKey(new Date(session.occurredAt)) === key,
                ),
                thumbnail = entries.find(({ item }) => item.thumbnailUrl)?.item
                  .thumbnailUrl,
                together = entries.some(
                  ({ session }) => session.participantIds.length > 1,
                ),
                label = `${new Date(year, monthIndex, day).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}, ${data?.count ?? 0} memories`;
              return (
                <button
                  type="button"
                  key={key}
                  data-day={key}
                  aria-label={label}
                  aria-pressed={selected === key}
                  tabIndex={
                    selected === key ||
                    (!selected.startsWith(
                      `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
                    ) &&
                      day === 1)
                      ? 0
                      : -1
                  }
                  onKeyDown={(e) => dayKeyboard(e, day)}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "calendar-day",
                    selected === key && "selected",
                    Boolean(data?.count) && "has-activity",
                  )}
                >
                  {selected === key && (
                    <m.span
                      layoutId="calendar-selected"
                      className="absolute inset-0 rounded-[inherit] bg-[var(--accent)]"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  <span className="relative z-10">{day}</span>
                  {thumbnail && (
                    <MediaImage
                      src={thumbnail}
                      className="absolute inset-x-2 bottom-2 hidden h-9 w-[calc(100%-16px)] rounded-md object-cover opacity-80 lg:block"
                      width={160}
                      height={90}
                    />
                  )}
                  {Boolean(data?.count) && (
                    <span
                      className={cn(
                        "absolute bottom-2.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full lg:bottom-1",
                        selected === key ? "bg-white" : "bg-[var(--accent)]",
                      )}
                      aria-hidden
                    />
                  )}
                  {together && (
                    <span
                      className={cn(
                        "absolute right-1.5 top-2.5 h-1 w-1 rounded-full",
                        selected === key ? "bg-white" : "bg-[var(--accent)]",
                      )}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
            <span>
              {monthData.days.length} active{" "}
              {monthData.days.length === 1 ? "day" : "days"}
            </span>
            <span>
              {monthData.total} {monthData.total === 1 ? "memory" : "memories"}{" "}
              · {formatDuration(hours) || "0m"}
            </span>
          </div>
        </section>
        <section className="min-w-0" aria-busy={dayBusy}>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">A page in your story</p>
              <h2 className="section-title">
                {new Date(selected + "T12:00:00").toLocaleDateString("en", {
                  month: "long",
                  day: "numeric",
                })}
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {dayData.total} {dayData.total === 1 ? "moment" : "moments"}
            </p>
          </div>
          {dayBusy ? (
            <div
              role="status"
              aria-label="Loading day timeline"
              className="space-y-4"
            >
              <div className="skeleton h-24" />
              <div className="skeleton h-24" />
            </div>
          ) : dayData.entries.length ? (
            <div className="divide-y divide-[var(--line)]">
              {dayData.entries.map(({ item, session }) => (
                <Link
                  key={session.id}
                  href={`/library/${item.id}`}
                  className="group flex gap-4 py-5"
                >
                  <span className="w-10 shrink-0 pt-1 text-xs tabular-nums text-[var(--muted)]">
                    {new Date(session.occurredAt).toLocaleTimeString("en", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <MediaImage
                    src={item.thumbnailUrl}
                    className="h-20 w-20 shrink-0 rounded-[var(--radius-sm)] object-cover"
                    width={160}
                    height={160}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-3 text-sm font-medium leading-6">
                      {item.title}
                    </span>
                    <span className="mt-3 flex flex-wrap items-center gap-2">
                      <AvatarStack
                        people={people.filter((p) =>
                          session.participantIds.includes(p.id),
                        )}
                      />
                      <span className="text-xs text-[var(--muted)]">
                        {session.participantIds.length > 1
                          ? "Together"
                          : "A moment for yourself"}
                      </span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface-soft)] px-6 py-10">
              <p className="section-title">A little space to breathe.</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Nothing saved for this day. Your next discovery can wait until
                you&apos;re ready.
              </p>
            </div>
          )}
          {dayData.total > 100 && (
            <div className="mt-5 flex gap-4">
              <button
                className="text-link"
                disabled={dayOffset === 0}
                onClick={() => setDayOffset((v) => Math.max(0, v - 100))}
              >
                Previous entries
              </button>
              <button
                className="text-link"
                disabled={dayOffset + 100 >= dayData.total}
                onClick={() => setDayOffset((v) => v + 100)}
              >
                Next entries
              </button>
            </div>
          )}
        </section>
      </div>
      <section>
        <SectionHeader
          title="The month's chapters"
          eyebrow="A few recent moments"
          href="/library"
          action="Library"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {monthData.entries.slice(0, 4).map(({ item, session }) => (
            <MediaCard key={session.id} item={item} variant="wide" />
          ))}
        </div>
        {!busy && !monthData.entries.length && (
          <Link href="/library" className="text-link">
            Find something worth keeping
            <ArrowRight size={15} />
          </Link>
        )}
      </section>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { useWorkspace } from "./workspace-provider";
import { dateKey } from "@/lib/utils";
import { useClientReady } from "./local-date";
export function Heatmap() {
  const ready = useClientReady();
  if (!ready)
    return (
      <div aria-busy="true" role="status" aria-label="Loading activity">
        <div className="mx-auto grid max-w-[320px] grid-cols-12 gap-1.5">
          {Array.from({ length: 12 }, (_, week) => (
            <div key={week} className="grid grid-rows-7 gap-1.5 sm:gap-2">
              {Array.from({ length: 7 }, (_, day) => (
                <span
                  key={day}
                  className="skeleton aspect-square min-h-3 rounded-[3px]"
                />
              ))}
            </div>
          ))}
        </div>
        <div className="skeleton mt-4 h-8" />
      </div>
    );
  return <LocalHeatmap />;
}
function LocalHeatmap() {
  const { statistics } = useWorkspace();
  const [focused, setFocused] = useState<string | null>(null);
  const [tabStop, setTabStop] = useState(83);
  const grid = useRef<HTMLDivElement>(null);
  const activity = new Map(
    statistics.heatmap.map(({ day, count }) => [day, count]),
  );
  const today = new Date(),
    start = new Date(today);
  start.setDate(today.getDate() - 83);
  const cells = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: dateKey(date),
      count: activity.get(dateKey(date)) ?? 0,
    };
  });
  return (
    <div>
      <div
        ref={grid}
        role="group"
        className="mx-auto grid max-w-[320px] grid-cols-12 gap-1.5"
        aria-label="Activity over the last 12 weeks"
      >
        {Array.from({ length: 12 }, (_, week) => (
          <div key={week} className="grid grid-rows-7 gap-1.5 sm:gap-2">
            {cells.slice(week * 7, week * 7 + 7).map(({ date, key, count }) => {
              const label = `${date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}: ${count} ${count === 1 ? "memory" : "memories"}`;
              return (
                <Link
                  key={key}
                  href={`/calendar?day=${key}`}
                  aria-label={label}
                  tabIndex={
                    cells.findIndex((cell) => cell.key === key) === tabStop
                      ? 0
                      : -1
                  }
                  onKeyDown={(event) => {
                    const index = cells.findIndex((cell) => cell.key === key);
                    const delta: Record<string, number> = {
                      ArrowLeft: -7,
                      ArrowRight: 7,
                      ArrowUp: -1,
                      ArrowDown: 1,
                    };
                    if (
                      !(event.key in delta) &&
                      !["Home", "End"].includes(event.key)
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 83
                          : Math.min(83, Math.max(0, index + delta[event.key]));
                    setTabStop(next);
                    grid.current
                      ?.querySelectorAll<HTMLAnchorElement>("a")
                      [next]?.focus();
                  }}
                  title={label}
                  onFocus={() => setFocused(label)}
                  onBlur={() => setFocused(null)}
                  onMouseEnter={() => setFocused(label)}
                  onMouseLeave={() => setFocused(null)}
                  className="block aspect-square min-h-3 rounded-[3px] transition hover:scale-110 focus-visible:scale-110"
                  style={{
                    backgroundColor:
                      count === 0
                        ? "var(--surface-soft)"
                        : count === 1
                          ? "#cad7c3"
                          : count === 2
                            ? "#91a887"
                            : "var(--accent)",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex min-h-8 items-start justify-between gap-3 text-[11px] text-[var(--muted)]">
        <span>{focused ?? "Small moments add up."}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5" aria-hidden>
          Less
          <span className="h-2 w-2 rounded-sm bg-[var(--surface-soft)]" />
          <span className="h-2 w-2 rounded-sm bg-[var(--accent)]" />
          More
        </span>
      </div>
    </div>
  );
}

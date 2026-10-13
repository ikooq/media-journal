"use client";
import { useSyncExternalStore } from "react";
import { formatRelativeDate } from "@/lib/utils";

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;
// Browser timezone is not known during SSR. Keep the hydration snapshot deterministic.
export function useClientReady() {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
export function LocalDate({
  value,
  relative = false,
  includeTime = false,
}: {
  value: string;
  relative?: boolean;
  includeTime?: boolean;
}) {
  const ready = useClientReady();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? value + "T12:00:00Z" : value);
  const label =
    ready && relative && !dateOnly
      ? formatRelativeDate(value)
      : new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          year: includeTime ? "numeric" : undefined,
          hour: includeTime ? "numeric" : undefined,
          minute: includeTime ? "2-digit" : undefined,
          timeZone: !ready || dateOnly ? "UTC" : undefined,
        }).format(date);
  return <time dateTime={value}>{label}</time>;
}

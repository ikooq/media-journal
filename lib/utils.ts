export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function formatRelativeDate(date: string) {
  const then = new Date(date).getTime();
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function normalizeUrl(raw: string) {
  const url = new URL(raw.trim());
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only http and https links are supported.");
  if (url.username || url.password)
    throw new Error("Links containing credentials are not supported.");
  url.hash = "";
  [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "si",
  ].forEach((key) => url.searchParams.delete(key));
  return url.toString().replace(/\/$/, "");
}

export function extractYouTubeId(raw: string) {
  try {
    const url = new URL(raw);
    if (url.hostname === "youtu.be")
      return url.pathname.slice(1).split("/")[0] || null;
    if (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com"))
      return (
        url.searchParams.get("v") ||
        url.pathname.match(/(?:shorts|embed)\/([^/]+)/)?.[1] ||
        null
      );
  } catch {
    return null;
  }
  return null;
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateStreak(
  dates: string[],
  today = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  const keys = new Set(
    dates.map((date) => (date.length === 10 ? date : dayKey(new Date(date)))),
  );
  let streak = 0;
  const cursor = new Date(`${dayKey(today)}T12:00:00Z`);
  if (!keys.has(cursor.toISOString().slice(0, 10)))
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (keys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function progressFromSeconds(seconds: number, duration?: number) {
  if (!duration) return 0;
  return Math.min(100, Math.max(0, Math.round((seconds / duration) * 100)));
}

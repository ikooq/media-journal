export function safeNext(value: string | null | undefined, fallback = "/") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\r\n]/.test(value)
  )
    return fallback;
  const path = new URL(value, "https://local.invalid").pathname;
  return ["/login", "/signup"].includes(path) ? fallback : value;
}

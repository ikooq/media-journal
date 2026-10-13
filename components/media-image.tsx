"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
const optimizedHosts = new Set([
  "images.unsplash.com",
  "i.ytimg.com",
  "img.youtube.com",
  "image.tmdb.org",
]);
export function MediaImage({
  src,
  alt = "",
  className = "",
  width = 1200,
  height = 900,
  priority = false,
  sizes = "(max-width: 767px) 45vw, (max-width: 1024px) 30vw, 22vw",
}: {
  src?: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  let safe = false;
  let optimized = false;
  try {
    const u = new URL(src ?? "");
    safe = ["https:", "http:"].includes(u.protocol);
    optimized = u.protocol === "https:" && optimizedHosts.has(u.hostname);
  } catch {
    /* Missing images use a local illustration. */
  }
  if (!safe || failed)
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={!alt || undefined}
        className={`${className} artwork-fallback`}
      />
    );
  // Arbitrary OG images and private signed storage URLs stay browser-fetched. Never proxy
  // untrusted URLs through Next's optimizer (which would introduce a second SSRF surface).
  return (
    <Image
      src={src!}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      unoptimized={!optimized}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

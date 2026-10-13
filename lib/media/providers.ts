import { extractYouTubeId, normalizeUrl } from "@/lib/utils";
import type { MediaMetadata, MediaMetadataProvider } from "@/lib/media/types";
import { fetchHtmlSafely } from "./safe-fetch";
const hostIs = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

const fallbackImage =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85";

const youtubeProvider: MediaMetadataProvider = {
  name: "youtube",
  canHandle: (url) =>
    url.hostname === "youtu.be" || hostIs(url.hostname, "youtube.com"),
  normalizeUrl: (url) => {
    const id = extractYouTubeId(url.toString());
    return id
      ? `https://www.youtube.com/watch?v=${id}`
      : normalizeUrl(url.toString());
  },
  fetchMetadata: async (url) => {
    const id = extractYouTubeId(url.toString());
    if (!id) throw new Error("That YouTube link does not contain a video ID.");
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    if (apiKey) {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(id)}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(8000), cache: "no-store" },
      );
      if (response.ok) {
        const data = (await response.json()) as {
          items?: Array<{
            snippet?: {
              title?: string;
              description?: string;
              channelTitle?: string;
              publishedAt?: string;
              thumbnails?: { maxres?: { url: string }; high?: { url: string } };
            };
            contentDetails?: { duration?: string };
          }>;
        };
        const entry = data.items?.[0];
        if (entry?.snippet)
          return {
            title: entry.snippet.title ?? "YouTube video",
            description: entry.snippet.description,
            type: "video",
            sourceProvider: "youtube",
            canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
            thumbnailUrl:
              entry.snippet.thumbnails?.maxres?.url ??
              entry.snippet.thumbnails?.high?.url ??
              `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
            channelName: entry.snippet.channelTitle,
            publishedAt: entry.snippet.publishedAt,
            durationSeconds: parseIsoDuration(entry.contentDetails?.duration),
          };
      }
    }
    return {
      title: "YouTube video",
      subtitle: "Add a title before saving",
      type: "video",
      sourceProvider: "youtube",
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  },
};

const movieProvider: MediaMetadataProvider = {
  name: "tmdb",
  canHandle: (url) =>
    hostIs(url.hostname, "themoviedb.org") || hostIs(url.hostname, "imdb.com"),
  normalizeUrl: (url) => normalizeUrl(url.toString()),
  fetchMetadata: async (url) => ({
    title: "Movie from link",
    type: "movie",
    sourceProvider: "movie",
    canonicalUrl: normalizeUrl(url.toString()),
    thumbnailUrl: fallbackImage,
  }),
};
const bookProvider: MediaMetadataProvider = {
  name: "books",
  canHandle: (url) =>
    hostIs(url.hostname, "goodreads.com") ||
    hostIs(url.hostname, "books.google.com"),
  normalizeUrl: (url) => normalizeUrl(url.toString()),
  fetchMetadata: async (url) => ({
    title: "Book from link",
    type: "book",
    sourceProvider: "books",
    canonicalUrl: normalizeUrl(url.toString()),
    thumbnailUrl: fallbackImage,
  }),
};

export const metadataProviders: MediaMetadataProvider[] = [
  youtubeProvider,
  movieProvider,
  bookProvider,
];

export function selectProvider(url: URL) {
  return metadataProviders.find((provider) => provider.canHandle(url));
}

export async function fetchSafeMetadata(
  rawUrl: string,
): Promise<MediaMetadata> {
  const url = new URL(normalizeUrl(rawUrl));
  const provider = selectProvider(url);
  if (provider) return provider.fetchMetadata(url);
  const { html: limited, url: resolved } = await fetchHtmlSafely(url);
  const getMeta = (property: string) =>
    limited.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
    )?.[1] ??
    limited.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
        "i",
      ),
    )?.[1];
  const title =
    getMeta("og:title") ??
    limited.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
    url.hostname;
  const description = getMeta("og:description") ?? getMeta("description");
  let image = fallbackImage;
  try {
    const candidate = new URL(getMeta("og:image") ?? "", resolved);
    if (["http:", "https:"].includes(candidate.protocol) && getMeta("og:image"))
      image = candidate.toString();
  } catch {
    /* Use the existing fallback for malformed images. */
  }
  return {
    title: decodeEntities(title),
    description: description ? decodeEntities(description) : undefined,
    type: "article",
    sourceProvider: "web",
    canonicalUrl: normalizeUrl(url.toString()),
    thumbnailUrl: image,
  };
}

function parseIsoDuration(value?: string) {
  if (!value) return undefined;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}
function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

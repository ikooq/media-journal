import type { MediaType } from "@/types/domain";

export type MediaMetadata = {
  title: string;
  subtitle?: string;
  description?: string;
  type: MediaType;
  sourceProvider: string;
  canonicalUrl: string;
  thumbnailUrl: string;
  authorName?: string;
  channelName?: string;
  durationSeconds?: number;
  publishedAt?: string;
  year?: number;
};

export type MediaMetadataProvider = {
  name: string;
  canHandle: (url: URL) => boolean;
  normalizeUrl: (url: URL) => string;
  fetchMetadata: (url: URL) => Promise<MediaMetadata>;
};

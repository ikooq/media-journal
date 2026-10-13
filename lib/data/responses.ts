import { z } from "zod";
import { mediaTypes } from "@/types/domain";
export const collectionResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  coverUrl: z.string(),
  itemIds: z.array(z.string()),
  itemCount: z.number().optional(),
});
export const viewingSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  participantIds: z.array(z.string()),
  completed: z.boolean(),
  progressSeconds: z.number().optional(),
  progressPercent: z.number().optional(),
});
const replySchema = z.object({
  id: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
const noteSchema = replySchema.extend({
  isPinned: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  replies: z.array(replySchema),
});
export const mediaResponseSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(mediaTypes),
  sourceProvider: z.string(),
  sourceUrl: z.string(),
  canonicalUrl: z.string(),
  externalId: z.string().optional(),
  thumbnailUrl: z.string(),
  backdropUrl: z.string().optional(),
  authorName: z.string().optional(),
  channelName: z.string().optional(),
  durationSeconds: z.number().optional(),
  publishedAt: z.string().optional(),
  year: z.number().optional(),
  status: z.enum(["watched", "watching", "watch_later"]),
  contentIntent: z.enum(["useful", "entertainment", "both"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  ratingByUser: z.record(z.string(), z.number()),
  usefulnessByUser: z.record(z.string(), z.number()),
  favoriteByUser: z.record(z.string(), z.boolean()),
  watchlistByUser: z.record(z.string(), z.enum(["mine", "together"])),
  sessions: z.array(viewingSchema),
  notes: z.array(noteSchema),
});
export const pageResponseSchema = z.object({
  items: z.array(mediaResponseSchema),
  total: z.number(),
});
export const statsResponseSchema = z.object({
  totalItems: z.number(),
  watchedThisMonth: z.number(),
  secondsThisMonth: z.number(),
  notesThisMonth: z.number(),
  streak: z.number(),
  sharedMoments: z.number(),
  lovedByBoth: z.number(),
  categories: z.array(z.object({ name: z.string(), count: z.number() })),
  byUser: z.array(z.object({ userId: z.string(), sessions: z.number() })),
  heatmap: z.array(z.object({ day: z.string(), count: z.number() })),
});
export const calendarResponseSchema = z.object({
  total: z.number(),
  days: z.array(
    z.object({ day: z.string(), count: z.number(), seconds: z.number() }),
  ),
  entries: z.array(
    z.object({ item: mediaResponseSchema, session: viewingSchema }),
  ),
});

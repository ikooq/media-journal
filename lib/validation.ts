import { z } from "zod";
import { mediaTypes } from "@/types/domain";
export const idSchema = z.uuid();
export const safeUrl = z
  .url()
  .max(2048)
  .refine((v) => {
    try {
      const url = new URL(v);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use an http or https URL");
export const imageUrl = z.union([safeUrl, z.literal("")]);
export const ratingSchema = z.number().min(0).max(10);
export const sessionSchema = z.object({
  id: idSchema.optional(),
  occurredAt: z.iso.datetime({ offset: true }),
  participantIds: z.array(idSchema).min(1).max(50),
  completed: z.boolean(),
  progressSeconds: z.number().int().min(0).max(31536000).optional(),
  progressPercent: z.number().min(0).max(100).optional(),
});
const classification = {
  title: z.string().trim().min(1).max(500),
  type: z.enum(mediaTypes),
  contentIntent: z.enum(["useful", "entertainment", "both"]),
  status: z.enum(["watched", "watching", "watch_later"]),
  categories: z.array(z.string().trim().min(1).max(60)).max(30),
  tags: z.array(z.string().trim().min(1).max(40)).max(40),
};
export const createMediaSchema = z.object({
  ...classification,
  sourceProvider: z.string().max(80),
  sourceUrl: safeUrl,
  canonicalUrl: safeUrl,
  externalId: z.string().max(200).optional(),
  subtitle: z.string().max(1000).optional(),
  description: z.string().max(20000).optional(),
  thumbnailUrl: imageUrl,
  backdropUrl: imageUrl.optional(),
  authorName: z.string().max(300).optional(),
  channelName: z.string().max(300).optional(),
  durationSeconds: z.number().int().min(0).max(31536000).optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
  year: z.number().int().min(1800).max(2500).optional(),
  session: sessionSchema.optional(),
  favorite: z.boolean().optional(),
  rating: ratingSchema.optional(),
  watchlistIntent: z.enum(["mine", "together"]).optional(),
  collectionId: idSchema.optional(),
});
export type CreateMediaInput = z.infer<typeof createMediaSchema>;
const body = z.string().trim().min(1).max(20000);
const mid = { mediaId: idSchema };
export const commandSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("createMedia"), data: createMediaSchema }),
  z.object({
    op: z.literal("updateMedia"),
    ...mid,
    data: z.object({
      ...classification,
      description: z.string().max(20000).optional(),
    }),
  }),
  z.object({ op: z.literal("archiveMedia"), ...mid }),
  z.object({ op: z.literal("saveSession"), ...mid, data: sessionSchema }),
  z.object({ op: z.literal("createNote"), ...mid, data: z.object({ body }) }),
  z.object({
    op: z.literal("updateNote"),
    ...mid,
    data: z.object({
      id: idSchema,
      body,
      isPinned: z.boolean(),
      isImportant: z.boolean(),
    }),
  }),
  z.object({
    op: z.literal("deleteNote"),
    ...mid,
    data: z.object({ id: idSchema }),
  }),
  z.object({
    op: z.literal("createReply"),
    ...mid,
    data: z.object({ noteId: idSchema, body: body.max(10000) }),
  }),
  z.object({
    op: z.literal("updateReply"),
    ...mid,
    data: z.object({ id: idSchema, body: body.max(10000) }),
  }),
  z.object({
    op: z.literal("deleteReply"),
    ...mid,
    data: z.object({ id: idSchema }),
  }),
  z.object({
    op: z.literal("rating"),
    ...mid,
    data: z.object({ value: ratingSchema }),
  }),
  z.object({
    op: z.literal("usefulness"),
    ...mid,
    data: z.object({ value: z.number().int().min(1).max(5) }),
  }),
  z.object({
    op: z.literal("favorite"),
    ...mid,
    data: z.object({ value: z.boolean() }),
  }),
  z.object({
    op: z.literal("watchlist"),
    ...mid,
    data: z.object({ intent: z.enum(["mine", "together"]).nullable() }),
  }),
  z.object({
    op: z.literal("saveCollection"),
    data: z.object({
      id: idSchema.optional(),
      title: z.string().trim().min(1).max(120),
      description: z.string().max(5000),
      coverUrl: imageUrl.optional(),
    }),
  }),
  z.object({
    op: z.literal("deleteCollection"),
    data: z.object({ id: idSchema }),
  }),
  z.object({
    op: z.literal("collectionAdd"),
    ...mid,
    data: z.object({ id: idSchema }),
  }),
  z.object({
    op: z.literal("collectionRemove"),
    ...mid,
    data: z.object({ id: idSchema }),
  }),
  z.object({
    op: z.literal("collectionOrder"),
    data: z.object({ id: idSchema, itemIds: z.array(idSchema).max(10000) }),
  }),
  z.object({
    op: z.literal("notificationRead"),
    data: z.object({ id: idSchema.optional() }),
  }),
  z.object({
    op: z.literal("saveSpace"),
    data: z.object({
      name: z.string().trim().min(1).max(80),
      startedAt: z.iso.date().nullable(),
    }),
  }),
  z.object({
    op: z.literal("saveCategory"),
    data: z.object({ name: z.string().trim().min(1).max(60) }),
  }),
  z.object({
    op: z.literal("deleteCategory"),
    data: z.object({ id: idSchema }),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export const libraryOptionsSchema = z.object({
  query: z.string().trim().max(200).default(""),
  filter: z
    .enum([
      "all",
      "watching",
      "watch_later",
      "favorites",
      "loved",
      "recently_watched",
      "together",
      "useful",
      "entertainment",
    ])
    .default("all"),
  type: z.enum([...mediaTypes, "all"]).default("all"),
  sort: z.enum(["recent", "oldest", "title"]).default("recent"),
  limit: z.number().int().min(1).max(48).default(24),
  offset: z.number().int().min(0).max(1000000).default(0),
  canonicalUrl: safeUrl.optional(),
  collectionId: idSchema.optional(),
});
export type LibraryOptions = z.input<typeof libraryOptionsSchema>;
export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

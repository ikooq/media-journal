export const mediaTypes = [
  "video",
  "movie",
  "series",
  "episode",
  "book",
  "article",
  "website",
  "course",
  "podcast",
  "reel",
  "tiktok",
  "other",
] as const;
export type MediaType = (typeof mediaTypes)[number];
export type MediaStatus = "watched" | "watching" | "watch_later";
export type ContentIntent = "useful" | "entertainment" | "both";

export type Person = {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar?: string;
  avatarPath?: string;
  role?: "owner" | "member";
};

export type Note = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  isPinned?: boolean;
  isImportant?: boolean;
  replies: {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
  }[];
};

export type ViewingSession = {
  id: string;
  occurredAt: string;
  participantIds: string[];
  completed: boolean;
  progressPercent?: number;
  progressSeconds?: number;
};

export type MediaItem = {
  id: string;
  spaceId: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: MediaType;
  sourceProvider: string;
  sourceUrl: string;
  canonicalUrl: string;
  externalId?: string;
  thumbnailUrl: string;
  backdropUrl?: string;
  authorName?: string;
  channelName?: string;
  durationSeconds?: number;
  publishedAt?: string;
  year?: number;
  status: MediaStatus;
  contentIntent: ContentIntent;
  categories: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  ratingByUser: Record<string, number>;
  usefulnessByUser: Record<string, number>;
  favoriteByUser: Record<string, boolean>;
  watchlistByUser: Record<string, "mine" | "together">;
  sessions: ViewingSession[];
  notes: Note[];
};

export type Collection = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  itemIds: string[];
  itemCount?: number;
};

export type Notification = {
  id: string;
  type: "watchlist" | "note" | "favorite" | "reply" | "session";
  title: string;
  text: string;
  createdAt: string;
  read: boolean;
  mediaId?: string;
};

export type WorkspaceState = {
  currentUserId: string;
  people: Person[];
  media: MediaItem[];
  collections: Collection[];
  notifications: Notification[];
};

export type Space = {
  id: string;
  name: string;
  coverPath: string | null;
  coverUrl?: string;
  startedAt: string | null;
  role: "owner" | "member";
};
export type Taxonomy = { id: string; name: string };
export type Bootstrap = {
  currentUserId: string;
  email: string;
  people: Person[];
  spaces: Space[];
  activeSpace: Space | null;
  categories: Taxonomy[];
  tags: Taxonomy[];
};
export type MediaPage = { items: MediaItem[]; total: number };
export type Statistics = {
  totalItems: number;
  watchedThisMonth: number;
  secondsThisMonth: number;
  notesThisMonth: number;
  streak: number;
  sharedMoments: number;
  lovedByBoth: number;
  categories: { name: string; count: number }[];
  byUser: { userId: string; sessions: number }[];
  heatmap: { day: string; count: number }[];
};
export type CalendarPage = {
  total: number;
  days: { day: string; count: number; seconds: number }[];
  entries: { item: MediaItem; session: ViewingSession }[];
};

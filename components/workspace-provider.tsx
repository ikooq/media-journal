"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { getBootstrap, getWorkspaceSnapshot, mutate } from "@/lib/data/client";
import { createClient } from "@/lib/supabase/client";
import { coalesceRefresh } from "@/lib/refresh-queue";
import { Onboarding } from "./onboarding";
import type {
  Bootstrap,
  Collection,
  MediaItem,
  Notification,
  Statistics,
  ViewingSession,
} from "@/types/domain";
import type { Command, CreateMediaInput } from "@/lib/validation";

type MutationData = { id?: string | null; duplicate?: boolean };
type WorkspaceContextValue = Bootstrap & {
  media: MediaItem[];
  collections: Collection[];
  notifications: Notification[];
  unread: number;
  statistics: Statistics;
  hydrated: boolean;
  loading: boolean;
  error: string;
  revision: number;
  refresh: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  execute: (command: Command) => Promise<MutationData | null>;
  addMedia: (item: CreateMediaInput) => Promise<MutationData | null>;
  addNote: (mediaId: string, body: string) => Promise<boolean>;
  replyToNote: (
    mediaId: string,
    noteId: string,
    body: string,
  ) => Promise<boolean>;
  saveSession: (mediaId: string, session: ViewingSession) => Promise<boolean>;
  toggleFavorite: (id: string, current?: boolean) => Promise<boolean>;
  setRating: (id: string, rating: number) => Promise<void>;
  markRead: (id?: string) => Promise<void>;
};
const emptyStats: Statistics = {
  totalItems: 0,
  watchedThisMonth: 0,
  secondsThisMonth: 0,
  notesThisMonth: 0,
  streak: 0,
  sharedMoments: 0,
  lovedByBoth: 0,
  categories: [],
  byUser: [],
  heatmap: [],
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: Bootstrap;
  children: React.ReactNode;
}) {
  const [base, setBase] = useState(initial);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [statistics, setStatistics] = useState(emptyStats);
  const [loading, setLoading] = useState(Boolean(initial.activeSpace));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const path = usePathname();
  const activeSpaceId = base.activeSpace?.id;
  const scopeKey = `${activeSpaceId ?? ""}:${path}`;
  const scope = useRef(scopeKey);
  const router = useRouter();
  const requestId = useRef(Symbol());
  const invalidateRequest = useCallback(() => {
    requestId.current = Symbol();
  }, []);
  const lock = useRef(new Set<string>());
  useEffect(() => setBase(initial), [initial]);
  const refreshBootstrap = useCallback(async () => {
    const r = await getBootstrap();
    if (r.ok) setBase(r.data);
    else setError(r.error);
  }, []);
  const refreshData = useCallback(async () => {
    if (!activeSpaceId || scope.current !== scopeKey) return;
    const seq = Symbol();
    requestId.current = seq;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const snapshot = await getWorkspaceSnapshot(path, timezone);
    if (seq !== requestId.current) return;
    if (!snapshot.ok) {
      setError(snapshot.error);
      setLoading(false);
      return;
    }
    const { stats, cols, alerts, lists, detail } = snapshot.data;
    if (stats.ok) setStatistics(stats.data);
    else setError(stats.error);
    if (cols.ok) setCollections(cols.data);
    else setError(cols.error);
    if (alerts.ok) {
      setNotifications(alerts.data.items);
      setUnread(alerts.data.unread);
    } else setError(alerts.error);
    if (lists) {
      const items = new Map<string, MediaItem>();
      for (const r of lists) {
        if (r.ok) r.data.items.forEach((i) => items.set(i.id, i));
        else setError(r.error);
      }
      setMedia([...items.values()]);
    } else if (detail) {
      if (detail.ok) setMedia(detail.data ? [detail.data] : []);
      else setError(detail.error);
    }
    if (seq === requestId.current) setLoading(false);
  }, [activeSpaceId, path, scopeKey]);
  const refresh = useMemo(() => coalesceRefresh(refreshData), [refreshData]);
  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
  }, [refresh]);
  useEffect(() => {
    scope.current = scopeKey;
    setLoading(Boolean(activeSpaceId));
    setError("");
    setMedia([]);
    void refresh();
    return invalidateRequest;
  }, [refresh, activeSpaceId, invalidateRequest, scopeKey]);
  useEffect(() => {
    if (!activeSpaceId) return;
    const db = createClient();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setRevision((r) => r + 1);
        void latestRefresh.current();
      }, 200);
    };
    const channel = db
      .channel(
        `workspace:${activeSpaceId}:${base.currentUserId}:${crypto.randomUUID()}`,
        {
          config: { postgres_changes_options: { wait: true } },
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${base.currentUserId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "media_items",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "media_items",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        invalidate,
      );
    // Restored cookie sessions initialize asynchronously. Never join as anon
    // and hope a later token update repairs a failed Postgres subscription.
    void db.realtime
      .setAuth()
      .then(() => {
        if (disposed) return;
        channel.subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") invalidate();
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
            setError(
              "Live updates are unavailable. Please check your connection.",
            );
        });
      })
      .catch(() => {
        if (!disposed)
          setError("Could not authorize live updates. Please sign in again.");
      });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setMedia([]);
        router.replace("/login");
        router.refresh();
      }
    });
    const onFocus = () => {
      invalidate();
      void refreshBootstrap();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      clearTimeout(timer);
      void db.removeChannel(channel);
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [activeSpaceId, base.currentUserId, refreshBootstrap, router]);
  const execute = useCallback(
    async (command: Command) => {
      setError("");
      const r = await mutate(command);
      if (!r.ok) {
        setError(r.error);
        if (r.code === "UNAUTHENTICATED") {
          router.replace("/login");
          router.refresh();
        }
        return null;
      }
      setRevision((v) => v + 1);
      await refresh();
      return r.data;
    },
    [refresh, router],
  );
  const toggleFavorite = useCallback(
    async (id: string, current?: boolean) => {
      if (lock.current.has(id)) return false;
      lock.current.add(id);
      const existing = media.find((i) => i.id === id);
      const before =
        current ?? Boolean(existing?.favoriteByUser[base.currentUserId]);
      setMedia((items) =>
        items.map((i) =>
          i.id === id
            ? {
                ...i,
                favoriteByUser: {
                  ...i.favoriteByUser,
                  [base.currentUserId]: !before,
                },
              }
            : i,
        ),
      );
      const r = await mutate({
        op: "favorite",
        mediaId: id,
        data: { value: !before },
      });
      if (!r.ok) {
        setMedia((items) =>
          items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  favoriteByUser: {
                    ...i.favoriteByUser,
                    [base.currentUserId]: before,
                  },
                }
              : i,
          ),
        );
        setError(r.error);
      } else {
        setRevision((v) => v + 1);
        await refresh();
      }
      lock.current.delete(id);
      return r.ok;
    },
    [media, base.currentUserId, refresh],
  );
  const markRead = useCallback(
    async (id?: string) => {
      const previous = notifications;
      const previousUnread = unread;
      setNotifications((items) =>
        items.map((n) => (!id || n.id === id ? { ...n, read: true } : n)),
      );
      setUnread(
        id
          ? Math.max(
              0,
              unread - (notifications.find((n) => n.id === id)?.read ? 0 : 1),
            )
          : 0,
      );
      const r = await mutate({ op: "notificationRead", data: { id } });
      if (!r.ok) {
        setNotifications(previous);
        setUnread(previousUnread);
        setError(r.error);
      } else await refresh();
    },
    [notifications, unread, refresh],
  );
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...base,
      media,
      collections,
      notifications,
      unread,
      statistics,
      hydrated: !loading,
      loading,
      error,
      revision,
      refresh,
      refreshBootstrap,
      execute,
      toggleFavorite,
      markRead,
      addMedia: (item) => execute({ op: "createMedia", data: item }),
      addNote: async (mediaId, body) =>
        Boolean(await execute({ op: "createNote", mediaId, data: { body } })),
      replyToNote: async (mediaId, noteId, body) =>
        Boolean(
          await execute({ op: "createReply", mediaId, data: { noteId, body } }),
        ),
      saveSession: async (mediaId, session) =>
        Boolean(await execute({ op: "saveSession", mediaId, data: session })),
      setRating: async (mediaId, value) => {
        await execute({ op: "rating", mediaId, data: { value } });
      },
    }),
    [
      base,
      media,
      collections,
      notifications,
      unread,
      statistics,
      loading,
      error,
      revision,
      refresh,
      refreshBootstrap,
      execute,
      toggleFavorite,
      markRead,
    ],
  );
  return (
    <WorkspaceContext.Provider value={value}>
      {!base.activeSpace && !path.startsWith("/join/") ? (
        <Onboarding
          name={
            base.people.find((p) => p.id === base.currentUserId)?.name ?? ""
          }
        />
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="mx-auto my-3 flex max-w-5xl items-center justify-between gap-4 rounded-2xl bg-[#fbe8e2] p-4 text-sm text-[#a74f3a]"
            >
              {error}
              <button
                onClick={() => {
                  setError("");
                  void refresh();
                }}
                className="font-bold underline"
              >
                Retry
              </button>
            </div>
          )}
          {children}
        </>
      )}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider is missing");
  return context;
}

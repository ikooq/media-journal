// Schema representation maintained with migrations. Regenerate using npm run db:types
// against local Supabase after applying every migration.
import type { MediaType, MediaStatus, ContentIntent } from "./domain";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Table<R> = {
  Row: R;
  Insert: Partial<R>;
  Update: Partial<R>;
  Relationships: [];
};
type Timestamps = { created_at: string; updated_at: string };
type SpaceOwned = Timestamps & {
  id: string;
  space_id: string;
  created_by: string;
};
export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Timestamps & {
          id: string;
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          avatar_url: string | null;
        }
      >;
      spaces: Table<
        Timestamps & {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          cover_path: string | null;
          relationship_started_at: string | null;
        }
      >;
      space_members: Table<{
        space_id: string;
        user_id: string;
        role: "owner" | "member";
        joined_at: string;
      }>;
      media_items: Table<
        SpaceOwned & {
          type: MediaType;
          source_provider: string;
          source_url: string;
          canonical_url: string;
          external_id: string | null;
          title: string;
          subtitle: string | null;
          description: string | null;
          thumbnail_url: string | null;
          poster_url: string | null;
          backdrop_url: string | null;
          author_name: string | null;
          channel_name: string | null;
          duration_seconds: number | null;
          published_at: string | null;
          release_date: string | null;
          year: number | null;
          season_number: number | null;
          episode_number: number | null;
          parent_media_id: string | null;
          status: MediaStatus;
          content_intent: ContentIntent;
          archived_at: string | null;
        }
      >;
      viewing_sessions: Table<
        SpaceOwned & {
          media_item_id: string;
          occurred_at: string;
          started_at: string | null;
          completed_at: string | null;
          progress_seconds: number | null;
          progress_percent: number | null;
          completed: boolean;
        }
      >;
      viewing_session_participants: Table<{
        viewing_session_id: string;
        user_id: string;
      }>;
      notes: Table<
        Timestamps & {
          id: string;
          space_id: string;
          media_item_id: string;
          author_id: string;
          body: string;
          learned: string | null;
          apply_in_life: string | null;
          is_pinned: boolean;
          is_important: boolean;
        }
      >;
      note_replies: Table<
        Timestamps & {
          id: string;
          note_id: string;
          author_id: string;
          body: string;
        }
      >;
      ratings: Table<
        Timestamps & { media_item_id: string; user_id: string; rating: number }
      >;
      usefulness_ratings: Table<
        Timestamps & {
          media_item_id: string;
          user_id: string;
          usefulness: number;
        }
      >;
      favorites: Table<{
        media_item_id: string;
        user_id: string;
        created_at: string;
      }>;
      watchlist: Table<{
        media_item_id: string;
        user_id: string;
        intent: "mine" | "together";
        created_at: string;
      }>;
      categories: Table<{
        id: string;
        space_id: string;
        name: string;
        created_by: string;
        created_at: string;
      }>;
      tags: Table<{
        id: string;
        space_id: string;
        name: string;
        created_by: string;
        created_at: string;
      }>;
      media_categories: Table<{ media_item_id: string; category_id: string }>;
      media_tags: Table<{ media_item_id: string; tag_id: string }>;
      collections: Table<
        SpaceOwned & {
          title: string;
          description: string;
          cover_path: string | null;
          collection_type: string;
        }
      >;
      collection_items: Table<{
        collection_id: string;
        media_item_id: string;
        position: number;
        added_by: string;
        added_at: string;
      }>;
      notifications: Table<{
        id: string;
        user_id: string;
        space_id: string;
        type: "watchlist" | "note" | "reply" | "favorite" | "session";
        actor_id: string | null;
        media_item_id: string | null;
        payload: Json;
        read_at: string | null;
        created_at: string;
      }>;
      space_invites: Table<{
        id: string;
        space_id: string;
        token_hash: string;
        created_by: string;
        expires_at: string;
        revoked_at: string | null;
        accepted_by: string | null;
        accepted_at: string | null;
        created_at: string;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      collection_document: { Args: { cid: string }; Returns: Json };
      query_collections: { Args: { s: string }; Returns: Json };
      create_shared_space: { Args: { space_name: string }; Returns: string };
      create_space_invite: { Args: { s: string }; Returns: string };
      accept_space_invite: { Args: { token: string }; Returns: string };
      consume_metadata_limit: { Args: Record<string, never>; Returns: boolean };
      mutate_workspace: { Args: { s: string; command: Json }; Returns: Json };
      media_document: {
        Args: { mid: string; detail?: boolean };
        Returns: Json;
      };
      query_library: { Args: { s: string; options?: Json }; Returns: Json };
      space_statistics: { Args: { s: string; tz?: string }; Returns: Json };
      calendar_activity: {
        Args: {
          s: string;
          from_day: string;
          to_day: string;
          tz?: string;
          page_offset?: number;
        };
        Returns: Json;
      };
    };
    Enums: {
      media_type: MediaType;
      media_status: MediaStatus;
      content_intent: ContentIntent;
      space_role: "owner" | "member";
      watchlist_intent: "mine" | "together";
      notification_type:
        "watchlist" | "note" | "reply" | "favorite" | "session";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

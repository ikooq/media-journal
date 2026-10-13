-- our shelf: private shared media journal schema.
-- Every space-owned table is protected by is_space_member(). Do not weaken these policies.
create extension if not exists "pgcrypto";

create type public.space_role as enum ('owner', 'member');
create type public.media_type as enum ('video', 'movie', 'series', 'episode', 'book', 'article', 'website', 'course', 'podcast', 'reel', 'tiktok', 'other');
create type public.media_status as enum ('watched', 'watching', 'watch_later');
create type public.content_intent as enum ('useful', 'entertainment', 'both');
create type public.watchlist_intent as enum ('mine', 'together');
create type public.notification_type as enum ('watchlist', 'note', 'reply', 'favorite', 'session');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  username text unique,
  avatar_path text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  cover_path text,
  relationship_started_at date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.space_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create or replace function public.is_space_member(target_space_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.space_members where space_id = target_space_id and user_id = auth.uid()); $$;

create or replace function public.is_space_owner(target_space_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.space_members where space_id = target_space_id and user_id = auth.uid() and role = 'owner'); $$;

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  type public.media_type not null default 'other',
  source_provider text not null default 'manual',
  source_url text not null check (source_url ~* '^https?://'),
  canonical_url text not null check (canonical_url ~* '^https?://'),
  external_id text,
  title text not null check (char_length(title) between 1 and 500),
  subtitle text,
  description text,
  thumbnail_url text,
  poster_url text,
  backdrop_url text,
  author_name text,
  channel_name text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  published_at timestamptz,
  release_date date,
  year integer check (year is null or year between 1800 and 2500),
  season_number integer check (season_number is null or season_number >= 1),
  episode_number integer check (episode_number is null or episode_number >= 1),
  parent_media_id uuid references public.media_items(id) on delete set null,
  status public.media_status not null default 'watch_later',
  content_intent public.content_intent not null default 'both',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, canonical_url)
);

create table public.viewing_sessions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  progress_seconds integer check (progress_seconds is null or progress_seconds >= 0),
  progress_percent numeric(5,2) check (progress_percent is null or progress_percent between 0 and 100),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.viewing_session_participants (
  viewing_session_id uuid not null references public.viewing_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (viewing_session_id, user_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 20000),
  learned text,
  apply_in_life text,
  is_pinned boolean not null default false,
  is_important boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_replies (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ratings (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating numeric(4,2) not null check (rating between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (media_item_id, user_id)
);

create table public.usefulness_ratings (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  usefulness smallint not null check (usefulness between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (media_item_id, user_id)
);

create table public.favorites (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_item_id, user_id)
);

create table public.watchlist (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  intent public.watchlist_intent not null default 'mine',
  created_at timestamptz not null default now(),
  primary key (media_item_id, user_id, intent)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (space_id, name)
);

create table public.media_categories (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (media_item_id, category_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (space_id, name)
);

create table public.media_tags (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (media_item_id, tag_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  cover_path text,
  collection_type text not null default 'playlist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  added_by uuid not null references public.profiles(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (collection_id, media_item_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  media_item_id uuid references public.media_items(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index media_items_space_updated_idx on public.media_items(space_id, updated_at desc) where archived_at is null;
create index media_items_space_status_idx on public.media_items(space_id, status);
create index media_items_search_idx on public.media_items using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
create index viewing_sessions_space_occurred_idx on public.viewing_sessions(space_id, occurred_at desc);
create index notes_media_created_idx on public.notes(media_item_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
do $$ declare target text; begin foreach target in array array['profiles','spaces','media_items','viewing_sessions','notes','note_replies','ratings','usefulness_ratings','collections'] loop execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', target, target); end loop; end $$;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.media_items enable row level security;
alter table public.viewing_sessions enable row level security;
alter table public.viewing_session_participants enable row level security;
alter table public.notes enable row level security;
alter table public.note_replies enable row level security;
alter table public.ratings enable row level security;
alter table public.usefulness_ratings enable row level security;
alter table public.favorites enable row level security;
alter table public.watchlist enable row level security;
alter table public.categories enable row level security;
alter table public.media_categories enable row level security;
alter table public.tags enable row level security;
alter table public.media_tags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.notifications enable row level security;

create policy profiles_read_members on public.profiles for select using (id = auth.uid() or exists (select 1 from public.space_members sm where sm.user_id = profiles.id and public.is_space_member(sm.space_id)));
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid());
create policy spaces_members_read on public.spaces for select using (public.is_space_member(id));
create policy spaces_owner_update on public.spaces for update using (public.is_space_owner(id)) with check (public.is_space_owner(id));
create policy spaces_member_insert on public.spaces for insert with check (created_by = auth.uid());
create policy members_read_same_space on public.space_members for select using (public.is_space_member(space_id));
create policy members_manage_owner on public.space_members for all using (public.is_space_owner(space_id)) with check (public.is_space_owner(space_id));

-- Space-owned resources all use the same membership predicate, preventing ID-guessing leaks.
create policy media_member_all on public.media_items for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy sessions_member_all on public.viewing_sessions for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy participants_member_all on public.viewing_session_participants for all using (exists (select 1 from public.viewing_sessions s where s.id = viewing_session_id and public.is_space_member(s.space_id))) with check (exists (select 1 from public.viewing_sessions s where s.id = viewing_session_id and public.is_space_member(s.space_id)));
create policy notes_member_all on public.notes for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy replies_member_all on public.note_replies for all using (exists (select 1 from public.notes n where n.id = note_id and public.is_space_member(n.space_id))) with check (exists (select 1 from public.notes n where n.id = note_id and public.is_space_member(n.space_id)) and author_id = auth.uid());
create policy ratings_member_all on public.ratings for all using (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id))) with check (user_id = auth.uid() and exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id)));
create policy usefulness_member_all on public.usefulness_ratings for all using (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id))) with check (user_id = auth.uid() and exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id)));
create policy favorites_member_all on public.favorites for all using (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id))) with check (user_id = auth.uid() and exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id)));
create policy watchlist_member_all on public.watchlist for all using (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id))) with check (user_id = auth.uid() and exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id)));
create policy categories_member_all on public.categories for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy media_categories_member_all on public.media_categories for all using (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id))) with check (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id)));
create policy tags_member_all on public.tags for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy media_tags_member_all on public.media_tags for all using (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id))) with check (exists (select 1 from public.media_items m where m.id = media_item_id and public.is_space_member(m.space_id)));
create policy collections_member_all on public.collections for all using (public.is_space_member(space_id)) with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy collection_items_member_all on public.collection_items for all using (exists (select 1 from public.collections c where c.id = collection_id and public.is_space_member(c.space_id))) with check (exists (select 1 from public.collections c where c.id = collection_id and public.is_space_member(c.space_id)));
create policy notifications_private on public.notifications for all using (user_id = auth.uid() and public.is_space_member(space_id)) with check (user_id = auth.uid() and public.is_space_member(space_id));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', '')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false) on conflict (id) do nothing;
create policy avatar_read_own on storage.objects for select using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_write_own on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_update_own on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_delete_own on storage.objects for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

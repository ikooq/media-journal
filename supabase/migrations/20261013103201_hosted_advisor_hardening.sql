-- Hosted advisors found one mutable function search_path and uncovered FK paths.
-- Preserve the deployed schema and existing migrations; harden forward only.
alter function public.set_updated_at() set search_path = '';
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Cover both application joins and the FK checks performed on parent changes.
create index categories_creator_idx on public.categories(created_by);
create index collection_items_added_by_idx on public.collection_items(added_by);
create index collections_creator_idx on public.collections(created_by);
create index collections_space_updated_idx on public.collections(space_id, updated_at desc);
create index media_items_creator_idx on public.media_items(created_by);
create index media_items_parent_space_idx on public.media_items(parent_media_id, space_id);
create index note_replies_author_idx on public.note_replies(author_id);
create index notes_media_space_idx on public.notes(media_item_id, space_id);
create index notes_author_idx on public.notes(author_id);
create index notes_space_created_idx on public.notes(space_id, created_at desc);
create index notifications_media_space_idx on public.notifications(media_item_id, space_id);
create index notifications_actor_idx on public.notifications(actor_id);
create index notifications_space_created_idx on public.notifications(space_id, created_at desc);
create index ratings_user_idx on public.ratings(user_id, media_item_id);
create index space_invites_accepted_by_idx on public.space_invites(accepted_by);
create index space_invites_creator_idx on public.space_invites(created_by);
create index space_invites_space_created_idx on public.space_invites(space_id, created_at desc);
create index spaces_creator_idx on public.spaces(created_by);
create index tags_creator_idx on public.tags(created_by);
create index usefulness_ratings_user_idx on public.usefulness_ratings(user_id, media_item_id);
create index viewing_sessions_media_space_idx on public.viewing_sessions(media_item_id, space_id);
create index viewing_sessions_creator_idx on public.viewing_sessions(created_by);
create index watchlist_user_idx on public.watchlist(user_id, media_item_id);

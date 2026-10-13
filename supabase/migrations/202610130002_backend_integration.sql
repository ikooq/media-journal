-- Forward-only upgrade. The first migration may already be deployed.
create schema if not exists shelf_private;
-- Also initialize users that predate installation of the original auth trigger.
insert into public.profiles(id,display_name) select id,left(coalesce(raw_user_meta_data->>'display_name','Member'),80) from auth.users on conflict(id) do nothing;
revoke all on schema shelf_private from public, anon;
grant usage on schema shelf_private to authenticated;

-- Non-exposed membership helpers prevent recursive RLS on space_members.
create function shelf_private.member(s uuid) returns boolean language sql stable security definer
set search_path = '' as $$ select auth.uid() is not null and exists(select 1 from public.space_members where space_id=s and user_id=auth.uid()); $$;
create function shelf_private.owner(s uuid) returns boolean language sql stable security definer
set search_path = '' as $$ select auth.uid() is not null and exists(select 1 from public.space_members where space_id=s and user_id=auth.uid() and role='owner'); $$;
create function shelf_private.shares_profile(u uuid) returns boolean language sql stable security definer
set search_path = '' as $$ select auth.uid() is not null and (u=auth.uid() or exists(select 1 from public.space_members a join public.space_members b on a.space_id=b.space_id where a.user_id=auth.uid() and b.user_id=u)); $$;
revoke all on function shelf_private.member(uuid), shelf_private.owner(uuid), shelf_private.shares_profile(uuid) from public;
grant execute on function shelf_private.member(uuid), shelf_private.owner(uuid), shelf_private.shares_profile(uuid) to authenticated;
revoke all on function public.is_space_member(uuid), public.is_space_owner(uuid), public.handle_new_user() from public, anon, authenticated;

-- Remove the permissive FOR ALL policies, including their overly broad DELETE paths.
do $$ declare p record; begin
  for p in select tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['profiles','spaces','space_members','media_items','viewing_sessions','viewing_session_participants','notes','note_replies','ratings','usefulness_ratings','favorites','watchlist','categories','media_categories','tags','media_tags','collections','collection_items','notifications']) loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;
create policy profile_read on public.profiles for select to authenticated using(shelf_private.shares_profile(id));
create policy profile_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy space_read on public.spaces for select to authenticated using(shelf_private.member(id));
create policy space_update on public.spaces for update to authenticated using(shelf_private.member(id)) with check(shelf_private.member(id));
create policy membership_read on public.space_members for select to authenticated using(shelf_private.member(space_id));
-- Membership writes are available only through guarded create/join functions below.
do $$ declare t text; begin
  foreach t in array array['media_items','viewing_sessions','categories','tags','collections'] loop
    execute format('create policy read_members on public.%I for select to authenticated using(shelf_private.member(space_id))',t);
    execute format('create policy insert_members on public.%I for insert to authenticated with check(shelf_private.member(space_id) and created_by=(select auth.uid()))',t);
    execute format('create policy update_members on public.%I for update to authenticated using(shelf_private.member(space_id)) with check(shelf_private.member(space_id))',t);
    if t <> 'media_items' then execute format('create policy delete_members on public.%I for delete to authenticated using(shelf_private.member(space_id))',t); end if;
  end loop;
end $$;
create policy notes_read on public.notes for select to authenticated using(shelf_private.member(space_id));
create policy notes_insert on public.notes for insert to authenticated with check(shelf_private.member(space_id) and author_id=(select auth.uid()));
create policy notes_update on public.notes for update to authenticated using(shelf_private.member(space_id) and author_id=(select auth.uid())) with check(shelf_private.member(space_id) and author_id=(select auth.uid()));
create policy notes_delete on public.notes for delete to authenticated using(shelf_private.member(space_id) and author_id=(select auth.uid()));
create policy replies_read on public.note_replies for select to authenticated using(exists(select 1 from public.notes n where n.id=note_id));
create policy replies_insert on public.note_replies for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.notes n where n.id=note_id));
create policy replies_update on public.note_replies for update to authenticated using(author_id=(select auth.uid()) and exists(select 1 from public.notes n where n.id=note_id)) with check(author_id=(select auth.uid()) and exists(select 1 from public.notes n where n.id=note_id));
create policy replies_delete on public.note_replies for delete to authenticated using(author_id=(select auth.uid()) and exists(select 1 from public.notes n where n.id=note_id));
do $$ declare t text; begin
  foreach t in array array['ratings','usefulness_ratings','favorites','watchlist'] loop
    execute format('create policy read_members on public.%I for select to authenticated using(exists(select 1 from public.media_items m where m.id=media_item_id))',t);
    execute format('create policy insert_self on public.%I for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.media_items m where m.id=media_item_id))',t);
    execute format('create policy update_self on public.%I for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.media_items m where m.id=media_item_id)) with check(user_id=(select auth.uid()) and exists(select 1 from public.media_items m where m.id=media_item_id))',t);
    execute format('create policy delete_self on public.%I for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.media_items m where m.id=media_item_id))',t);
  end loop;
end $$;
create policy participants_read on public.viewing_session_participants for select to authenticated using(exists(select 1 from public.viewing_sessions s where s.id=viewing_session_id));
create policy participants_insert on public.viewing_session_participants for insert to authenticated with check(exists(select 1 from public.viewing_sessions s join public.space_members sm on sm.space_id=s.space_id and sm.user_id=viewing_session_participants.user_id where s.id=viewing_session_id));
create policy participants_delete on public.viewing_session_participants for delete to authenticated using(exists(select 1 from public.viewing_sessions s where s.id=viewing_session_id));
create policy media_categories_members on public.media_categories for all to authenticated using(exists(select 1 from public.media_items m join public.categories c on c.space_id=m.space_id where m.id=media_item_id and c.id=category_id)) with check(exists(select 1 from public.media_items m join public.categories c on c.space_id=m.space_id where m.id=media_item_id and c.id=category_id));
create policy media_tags_members on public.media_tags for all to authenticated using(exists(select 1 from public.media_items m join public.tags t on t.space_id=m.space_id where m.id=media_item_id and t.id=tag_id)) with check(exists(select 1 from public.media_items m join public.tags t on t.space_id=m.space_id where m.id=media_item_id and t.id=tag_id));
create policy collection_items_read on public.collection_items for select to authenticated using(exists(select 1 from public.media_items m join public.collections c on c.space_id=m.space_id where m.id=media_item_id and c.id=collection_id));
create policy collection_items_insert on public.collection_items for insert to authenticated with check(exists(select 1 from public.media_items m join public.collections c on c.space_id=m.space_id where m.id=media_item_id and c.id=collection_id) and added_by=(select auth.uid()));
create policy collection_items_update on public.collection_items for update to authenticated using(exists(select 1 from public.media_items m join public.collections c on c.space_id=m.space_id where m.id=media_item_id and c.id=collection_id)) with check(exists(select 1 from public.media_items m join public.collections c on c.space_id=m.space_id where m.id=media_item_id and c.id=collection_id));
create policy collection_items_delete on public.collection_items for delete to authenticated using(exists(select 1 from public.media_items m join public.collections c on c.space_id=m.space_id where m.id=media_item_id and c.id=collection_id));
create policy notification_read on public.notifications for select to authenticated using(user_id=(select auth.uid()) and shelf_private.member(space_id));
create policy notification_update on public.notifications for update to authenticated using(user_id=(select auth.uid()) and shelf_private.member(space_id)) with check(user_id=(select auth.uid()) and shelf_private.member(space_id));

-- Identity/scope columns cannot be reassigned by an UPDATE, even by a collaborator.
create function shelf_private.immutable_scope() returns trigger language plpgsql set search_path='' as $$
declare col text; begin
  foreach col in array tg_argv loop
    if to_jsonb(new)->col is distinct from to_jsonb(old)->col then raise exception 'Immutable ownership or scope' using errcode='23514'; end if;
  end loop; return new;
end $$;
create trigger immutable_space before update on public.spaces for each row execute function shelf_private.immutable_scope('id','created_by');
create trigger immutable_profile before update on public.profiles for each row execute function shelf_private.immutable_scope('id');
do $$ declare t text; begin
  foreach t in array array['media_items','viewing_sessions','collections','categories','tags'] loop
    execute format('create trigger immutable_scope before update on public.%I for each row execute function shelf_private.immutable_scope(''id'',''space_id'',''created_by'')',t);
  end loop;
end $$;
create trigger immutable_note before update on public.notes for each row execute function shelf_private.immutable_scope('id','space_id','media_item_id','author_id');
create trigger immutable_reply before update on public.note_replies for each row execute function shelf_private.immutable_scope('id','note_id','author_id');
do $$ declare t text; begin
  foreach t in array array['ratings','usefulness_ratings','favorites','watchlist'] loop
    execute format('create trigger immutable_personal before update on public.%I for each row execute function shelf_private.immutable_scope(''media_item_id'',''user_id'')',t);
  end loop;
end $$;
create trigger immutable_session_media before update on public.viewing_sessions for each row execute function shelf_private.immutable_scope('media_item_id');
create trigger immutable_notification before update on public.notifications for each row execute function shelf_private.immutable_scope('id','user_id','space_id','type','actor_id','media_item_id','payload','created_at');
create trigger immutable_collection_item before update on public.collection_items for each row execute function shelf_private.immutable_scope('collection_id','media_item_id','added_by','added_at');

-- Compound foreign keys enforce space equality even for non-UI writes.
alter table public.media_items add constraint media_id_space_unique unique(id,space_id);
alter table public.viewing_sessions add constraint session_media_space_fk foreign key(media_item_id,space_id) references public.media_items(id,space_id) on delete cascade;
alter table public.notes add constraint note_media_space_fk foreign key(media_item_id,space_id) references public.media_items(id,space_id) on delete cascade;
alter table public.media_items add constraint parent_media_space_fk foreign key(parent_media_id,space_id) references public.media_items(id,space_id);
alter table public.notifications add constraint notification_media_space_fk foreign key(media_item_id,space_id) references public.media_items(id,space_id) on delete cascade;

-- Normalize existing taxonomy before enforcing case/whitespace uniqueness.
do $$ declare t text; link_table text; fk text; r record; begin
  foreach t in array array['categories','tags'] loop
    link_table := case when t='categories' then 'media_categories' else 'media_tags' end;
    fk := case when t='categories' then 'category_id' else 'tag_id' end;
    for r in execute format('select id, first_value(id) over(partition by space_id,lower(btrim(name)) order by created_at,id) as keeper from public.%I',t) loop
      if r.id<>r.keeper then
        execute format('insert into public.%I(media_item_id,%I) select media_item_id,$1 from public.%I where %I=$2 on conflict do nothing',link_table,fk,link_table,fk) using r.keeper,r.id;
        execute format('delete from public.%I where id=$1',t) using r.id;
      end if;
    end loop;
    execute format('update public.%I set name=btrim(name)',t);
    execute format('create unique index %I on public.%I(space_id,lower(btrim(name)))',t||'_normalized_unique',t);
  end loop;
end $$;
-- One current watchlist intent per person/item; prefer together when merging legacy rows.
delete from public.watchlist w using public.watchlist t where w.media_item_id=t.media_item_id and w.user_id=t.user_id and w.intent='mine' and t.intent='together';
alter table public.watchlist drop constraint watchlist_pkey;
alter table public.watchlist add primary key(media_item_id,user_id);
create index space_members_user_idx on public.space_members(user_id,space_id);
create index sessions_media_idx on public.viewing_sessions(media_item_id,occurred_at desc);
create index participants_user_idx on public.viewing_session_participants(user_id,viewing_session_id);
create index replies_note_idx on public.note_replies(note_id,created_at);
create index categories_media_idx on public.media_categories(category_id,media_item_id);
create index tags_media_idx on public.media_tags(tag_id,media_item_id);
create index collection_items_media_idx on public.collection_items(media_item_id);
create index favorites_user_idx on public.favorites(user_id,media_item_id);
create index notes_search_idx on public.notes using gin(to_tsvector('simple',body));

-- Invitations store only a SHA-256 digest of a random 256-bit capability token.
create table public.space_invites(
  id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces(id) on delete cascade,
  token_hash text unique not null, created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz,
  accepted_by uuid references public.profiles(id), accepted_at timestamptz, created_at timestamptz not null default now()
);
alter table public.space_invites enable row level security;
create policy invites_owner_read on public.space_invites for select to authenticated using(shelf_private.owner(space_id));
create policy invites_owner_revoke on public.space_invites for update to authenticated using(shelf_private.owner(space_id)) with check(shelf_private.owner(space_id));
create trigger immutable_invite before update on public.space_invites for each row execute function shelf_private.immutable_scope('id','space_id','token_hash','created_by','expires_at','created_at');

create function shelf_private.create_shared_space(space_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare s uuid; actor uuid:=auth.uid(); begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if char_length(btrim(space_name)) not between 1 and 80 then raise exception 'Invalid space name' using errcode='22023'; end if;
  if (select count(*) from public.space_members where user_id=actor)>=20 then raise exception 'Space limit reached'; end if;
  insert into public.profiles(id,display_name) values(actor,'Your name') on conflict do nothing;
  insert into public.spaces(name,slug,created_by) values(btrim(space_name),gen_random_uuid()::text,actor) returning id into s;
  insert into public.space_members(space_id,user_id,role) values(s,actor,'owner');
  insert into public.categories(space_id,name,created_by) select s,n,actor from unnest(array['Movies','Self-development','Relationships','Sport','Study','Money','Food','Creativity','Travel','Entertainment','New Things','Routine']) n;
  return s;
end $$;
create function public.create_shared_space(space_name text) returns uuid language sql security invoker set search_path='' as $$ select shelf_private.create_shared_space(space_name); $$;
create function shelf_private.create_space_invite(s uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); begin
  if not shelf_private.owner(s) then raise exception 'Owner required' using errcode='42501'; end if;
  if (select count(*) from public.space_invites where space_id=s and created_at>now()-interval '1 hour')>=20 then raise exception 'Invite limit reached'; end if;
  insert into public.space_invites(space_id,token_hash,created_by) values(s,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid()); return token;
end $$;
create function public.create_space_invite(s uuid) returns text language sql security invoker set search_path='' as $$ select shelf_private.create_space_invite(s); $$;
create function shelf_private.accept_space_invite(token text) returns uuid language plpgsql security definer set search_path='' as $$
declare invite public.space_invites; begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into invite from public.space_invites where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
  if invite.id is null or invite.revoked_at is not null or invite.expires_at<=now() or invite.accepted_at is not null then raise exception 'Invitation expired, revoked, or already used' using errcode='22023'; end if;
  insert into public.space_members(space_id,user_id) values(invite.space_id,auth.uid()) on conflict do nothing;
  update public.space_invites set accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
  return invite.space_id;
end $$;
create function public.accept_space_invite(token text) returns uuid language sql security invoker set search_path='' as $$ select shelf_private.accept_space_invite(token); $$;
revoke all on function shelf_private.create_shared_space(text),shelf_private.create_space_invite(uuid),shelf_private.accept_space_invite(text),public.create_shared_space(text),public.create_space_invite(uuid),public.accept_space_invite(text) from public,anon;
grant execute on function shelf_private.create_shared_space(text),shelf_private.create_space_invite(uuid),shelf_private.accept_space_invite(text),public.create_shared_space(text),public.create_space_invite(uuid),public.accept_space_invite(text) to authenticated;

-- A distributed, database-backed limiter for authenticated metadata requests.
create table shelf_private.rate_limits(user_id uuid not null, bucket text not null, window_start timestamptz not null, hits integer not null, primary key(user_id,bucket));
create function shelf_private.consume_metadata_limit() returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; begin
  if auth.uid() is null then return false; end if;
  insert into shelf_private.rate_limits values(auth.uid(),'metadata',now(),1) on conflict(user_id,bucket) do update set
    hits=case when shelf_private.rate_limits.window_start<now()-interval '1 minute' then 1 else shelf_private.rate_limits.hits+1 end,
    window_start=case when shelf_private.rate_limits.window_start<now()-interval '1 minute' then now() else shelf_private.rate_limits.window_start end returning hits into n;
  return n<=20;
end $$;
create function public.consume_metadata_limit() returns boolean language sql security invoker set search_path='' as $$ select shelf_private.consume_metadata_limit(); $$;
revoke all on function shelf_private.consume_metadata_limit(),public.consume_metadata_limit() from public,anon;
grant execute on function shelf_private.consume_metadata_limit(),public.consume_metadata_limit() to authenticated;

-- Reliable fan-out in the same transaction as the originating write. Browsers never insert notifications.
create function shelf_private.notify_members() returns trigger language plpgsql security definer set search_path='' as $$
declare s uuid; mid uuid; actor uuid; kind public.notification_type; target uuid; begin
  actor:=auth.uid(); if actor is null then return new; end if;
  if tg_table_name='media_items' then s:=new.space_id; mid:=new.id; kind:='session';
  elsif tg_table_name='notes' then s:=new.space_id; mid:=new.media_item_id; kind:='note';
  elsif tg_table_name='note_replies' then select space_id,media_item_id,author_id into s,mid,target from public.notes where id=new.note_id; kind:='reply';
  elsif tg_table_name='watchlist' then
    if new.intent<>'together' or (tg_op='UPDATE' and old.intent=new.intent) then return new; end if;
    select space_id into s from public.media_items where id=new.media_item_id; mid:=new.media_item_id; kind:='watchlist';
  end if;
  insert into public.notifications(user_id,space_id,type,actor_id,media_item_id,payload)
  select sm.user_id,s,kind,actor,mid,jsonb_build_object('event',tg_table_name,'source_id',coalesce(to_jsonb(new)->>'id',mid::text),'title',(select title from public.media_items where id=mid))
  from public.space_members sm where sm.space_id=s and sm.user_id<>actor and (target is null or sm.user_id=target);
  return new;
end $$;
create trigger notify_media after insert on public.media_items for each row execute function shelf_private.notify_members();
create trigger notify_note after insert on public.notes for each row execute function shelf_private.notify_members();
create trigger notify_reply after insert on public.note_replies for each row execute function shelf_private.notify_members();
create trigger notify_watchlist after insert or update on public.watchlist for each row execute function shelf_private.notify_members();
revoke all on function shelf_private.notify_members(),shelf_private.immutable_scope() from public,anon,authenticated;

-- Private assets: owners write avatars, space members read shared avatars/covers.
drop policy avatar_read_own on storage.objects;
drop policy avatar_write_own on storage.objects;
drop policy avatar_update_own on storage.objects;
drop policy avatar_delete_own on storage.objects;
update storage.buckets set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='avatars';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('space-assets','space-assets',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy avatar_read_members on storage.objects for select to authenticated using(bucket_id='avatars' and shelf_private.shares_profile(((storage.foldername(name))[1])::uuid));
create policy avatar_insert_self on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_update_self on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_delete_self on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy cover_read_members on storage.objects for select to authenticated using(bucket_id='space-assets' and shelf_private.member(((storage.foldername(name))[1])::uuid));
create policy cover_insert_members on storage.objects for insert to authenticated with check(bucket_id='space-assets' and shelf_private.member(((storage.foldername(name))[1])::uuid));
create policy cover_update_members on storage.objects for update to authenticated using(bucket_id='space-assets' and shelf_private.member(((storage.foldername(name))[1])::uuid)) with check(bucket_id='space-assets' and shelf_private.member(((storage.foldername(name))[1])::uuid));
create policy cover_delete_members on storage.objects for delete to authenticated using(bucket_id='space-assets' and shelf_private.member(((storage.foldername(name))[1])::uuid));

do $$ declare t text; begin
  foreach t in array array['profiles','spaces','space_members','media_items','viewing_sessions','viewing_session_participants','notes','note_replies','ratings','usefulness_ratings','favorites','watchlist','categories','media_categories','tags','media_tags','collections','collection_items','notifications','space_invites'] loop
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('revoke all on public.%I from anon',t);
  end loop;
end $$;
-- Notifications may only be acknowledged, not forged or retargeted.
revoke insert,delete,update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
revoke insert,update,delete on public.space_members,public.space_invites from authenticated;
grant update(revoked_at) on public.space_invites to authenticated;

-- Scoped realtime: notification recipient and active-space media invalidation only.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='media_items') then alter publication supabase_realtime add table public.media_items; end if;
  end if;
end $$;

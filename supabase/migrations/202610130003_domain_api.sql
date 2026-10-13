-- Invoker RPCs retain RLS. Each command is atomic, including taxonomy/session/participants.
create function public.save_viewing_session(s uuid, mid uuid, data jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid:=coalesce((data->>'id')::uuid,gen_random_uuid()); person uuid; begin
  if not shelf_private.member(s) or not exists(select 1 from public.media_items where id=mid and space_id=s) then raise exception 'Inaccessible media' using errcode='42501'; end if;
  if jsonb_array_length(coalesce(data->'participantIds','[]'))=0 then raise exception 'Choose at least one participant' using errcode='22023'; end if;
  insert into public.viewing_sessions(id,space_id,media_item_id,created_by,occurred_at,completed,progress_seconds,progress_percent,completed_at)
  values(sid,s,mid,auth.uid(),(data->>'occurredAt')::timestamptz,coalesce((data->>'completed')::boolean,false),(data->>'progressSeconds')::integer,(data->>'progressPercent')::numeric,
    case when (data->>'completed')::boolean then (data->>'occurredAt')::timestamptz end)
  on conflict(id) do update set occurred_at=excluded.occurred_at,completed=excluded.completed,progress_seconds=excluded.progress_seconds,progress_percent=excluded.progress_percent,completed_at=excluded.completed_at;
  if not exists(select 1 from public.viewing_sessions where id=sid and space_id=s and media_item_id=mid) then raise exception 'Inaccessible session' using errcode='42501'; end if;
  delete from public.viewing_session_participants where viewing_session_id=sid;
  for person in select distinct value::uuid from jsonb_array_elements_text(data->'participantIds') loop
    if not exists(select 1 from public.space_members where space_id=s and user_id=person) then raise exception 'Participant is not a member' using errcode='23514'; end if;
    insert into public.viewing_session_participants values(sid,person);
  end loop;
  update public.media_items set status=case when (data->>'completed')::boolean then 'watched'::public.media_status else 'watching'::public.media_status end where id=mid;
  return sid;
end $$;

create function public.set_media_taxonomy(s uuid,mid uuid,category_names jsonb,tag_names jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare v_name text; tid uuid; begin
  if not exists(select 1 from public.media_items where id=mid and space_id=s) then raise exception 'Inaccessible media' using errcode='42501'; end if;
  delete from public.media_categories where media_item_id=mid;
  delete from public.media_tags where media_item_id=mid;
  for v_name in select distinct btrim(value) from jsonb_array_elements_text(coalesce(category_names,'[]')) where btrim(value)<>'' loop
    insert into public.categories(space_id,name,created_by) values(s,v_name,auth.uid()) on conflict(space_id,(lower(btrim(name)))) do nothing;
    select id into tid from public.categories where space_id=s and lower(btrim(categories.name))=lower(v_name);
    insert into public.media_categories values(mid,tid) on conflict do nothing;
  end loop;
  for v_name in select distinct btrim(value) from jsonb_array_elements_text(coalesce(tag_names,'[]')) where btrim(value)<>'' loop
    insert into public.tags(space_id,name,created_by) values(s,v_name,auth.uid()) on conflict(space_id,(lower(btrim(name)))) do nothing;
    select id into tid from public.tags where space_id=s and lower(btrim(tags.name))=lower(v_name);
    insert into public.media_tags values(mid,tid) on conflict do nothing;
  end loop;
end $$;

create function public.mutate_workspace(s uuid,command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare op text:=command->>'op'; d jsonb:=command->'data'; mid uuid:=(command->>'mediaId')::uuid; rid uuid; cid uuid; affected integer; begin
  if auth.uid() is null or not shelf_private.member(s) then raise exception 'Membership required' using errcode='42501'; end if;
  if mid is not null and not exists(select 1 from public.media_items where id=mid and space_id=s) then raise exception 'Inaccessible media' using errcode='42501'; end if;
  if op='createMedia' then
    insert into public.media_items(space_id,created_by,type,source_provider,source_url,canonical_url,external_id,title,subtitle,description,thumbnail_url,backdrop_url,author_name,channel_name,duration_seconds,published_at,year,status,content_intent)
    values(s,auth.uid(),(d->>'type')::public.media_type,d->>'sourceProvider',d->>'sourceUrl',d->>'canonicalUrl',d->>'externalId',d->>'title',d->>'subtitle',d->>'description',d->>'thumbnailUrl',d->>'backdropUrl',d->>'authorName',d->>'channelName',(d->>'durationSeconds')::integer,(d->>'publishedAt')::timestamptz,(d->>'year')::integer,(d->>'status')::public.media_status,(d->>'contentIntent')::public.content_intent)
    on conflict(space_id,canonical_url) do nothing returning id into mid;
    if mid is null then select id into mid from public.media_items where space_id=s and canonical_url=d->>'canonicalUrl'; return jsonb_build_object('id',mid,'duplicate',true); end if;
    perform public.set_media_taxonomy(s,mid,d->'categories',d->'tags');
    if d->'session' is not null and d->'session'<>'null'::jsonb then perform public.save_viewing_session(s,mid,d->'session'); end if;
    if d->>'watchlistIntent' is not null then insert into public.watchlist values(mid,auth.uid(),(d->>'watchlistIntent')::public.watchlist_intent,now()); end if;
    if (d->>'favorite')::boolean then insert into public.favorites values(mid,auth.uid(),now()); end if;
    if d->>'rating' is not null then insert into public.ratings(media_item_id,user_id,rating) values(mid,auth.uid(),(d->>'rating')::numeric); end if;
    if d->>'collectionId' is not null then
      cid:=(d->>'collectionId')::uuid;
      perform 1 from public.collections where id=cid and space_id=s for update;
      if not found then raise exception 'Inaccessible collection' using errcode='42501'; end if;
      insert into public.collection_items(collection_id,media_item_id,position,added_by) select cid,mid,coalesce(max(position)+1,0),auth.uid() from public.collection_items where collection_id=cid;
    end if;
    return jsonb_build_object('id',mid,'duplicate',false);
  elsif op='updateMedia' then
    update public.media_items set title=d->>'title',description=d->>'description',type=(d->>'type')::public.media_type,content_intent=(d->>'contentIntent')::public.content_intent,status=(d->>'status')::public.media_status where id=mid;
    perform public.set_media_taxonomy(s,mid,d->'categories',d->'tags');
  elsif op='archiveMedia' then update public.media_items set archived_at=now() where id=mid;
  elsif op='saveSession' then rid:=public.save_viewing_session(s,mid,d);
  elsif op='createNote' then
    insert into public.notes(space_id,media_item_id,author_id,body) values(s,mid,auth.uid(),d->>'body') returning id into rid;
  elsif op in ('updateNote','deleteNote') then
    rid:=(d->>'id')::uuid;
    if op='updateNote' then update public.notes set body=d->>'body',is_pinned=coalesce((d->>'isPinned')::boolean,false),is_important=coalesce((d->>'isImportant')::boolean,false) where id=rid and media_item_id=mid and author_id=auth.uid();
    else delete from public.notes where id=rid and media_item_id=mid and author_id=auth.uid(); end if;
    get diagnostics affected=row_count; if affected<>1 then raise exception 'You can only change your own note' using errcode='42501'; end if;
  elsif op='createReply' then
    if not exists(select 1 from public.notes where id=(d->>'noteId')::uuid and media_item_id=mid) then raise exception 'Inaccessible note' using errcode='42501'; end if;
    insert into public.note_replies(note_id,author_id,body) values((d->>'noteId')::uuid,auth.uid(),d->>'body') returning id into rid;
  elsif op in ('updateReply','deleteReply') then
    rid:=(d->>'id')::uuid;
    if op='updateReply' then update public.note_replies set body=d->>'body' where id=rid and author_id=auth.uid() and exists(select 1 from public.notes n where n.id=note_id and n.media_item_id=mid);
    else delete from public.note_replies where id=rid and author_id=auth.uid() and exists(select 1 from public.notes n where n.id=note_id and n.media_item_id=mid); end if;
    get diagnostics affected=row_count; if affected<>1 then raise exception 'You can only change your own reply' using errcode='42501'; end if;
  elsif op='rating' then
    insert into public.ratings(media_item_id,user_id,rating) values(mid,auth.uid(),(d->>'value')::numeric) on conflict(media_item_id,user_id) do update set rating=excluded.rating;
  elsif op='usefulness' then
    if not exists(select 1 from public.media_items where id=mid and content_intent in ('useful','both')) then raise exception 'Usefulness requires useful content'; end if;
    insert into public.usefulness_ratings(media_item_id,user_id,usefulness) values(mid,auth.uid(),(d->>'value')::smallint) on conflict(media_item_id,user_id) do update set usefulness=excluded.usefulness;
  elsif op='favorite' then
    if (d->>'value')::boolean then insert into public.favorites values(mid,auth.uid(),now()) on conflict do nothing;
    else delete from public.favorites where media_item_id=mid and user_id=auth.uid(); end if;
  elsif op='watchlist' then
    if d->>'intent' is null then delete from public.watchlist where media_item_id=mid and user_id=auth.uid();
    else insert into public.watchlist values(mid,auth.uid(),(d->>'intent')::public.watchlist_intent,now()) on conflict(media_item_id,user_id) do update set intent=excluded.intent; end if;
  elsif op='saveCollection' then
    cid:=coalesce((d->>'id')::uuid,gen_random_uuid());
    insert into public.collections(id,space_id,created_by,title,description,cover_path) values(cid,s,auth.uid(),d->>'title',coalesce(d->>'description',''),d->>'coverUrl') on conflict(id) do update set title=excluded.title,description=excluded.description,cover_path=excluded.cover_path where collections.space_id=s;
    rid:=cid;
  elsif op='deleteCollection' then delete from public.collections where id=(d->>'id')::uuid and space_id=s;
  elsif op in ('collectionAdd','collectionRemove','collectionOrder') then
    cid:=(d->>'id')::uuid; perform 1 from public.collections where id=cid and space_id=s for update;
    if not found then raise exception 'Inaccessible collection' using errcode='42501'; end if;
    if op='collectionAdd' then insert into public.collection_items(collection_id,media_item_id,position,added_by) select cid,mid,coalesce(max(position)+1,0),auth.uid() from public.collection_items where collection_id=cid on conflict do nothing;
    elsif op='collectionRemove' then delete from public.collection_items where collection_id=cid and media_item_id=mid;
    else
      if (select count(*) from public.collection_items where collection_id=cid)<>jsonb_array_length(d->'itemIds') or (select count(distinct value) from jsonb_array_elements_text(d->'itemIds'))<>jsonb_array_length(d->'itemIds') or exists(select 1 from jsonb_array_elements_text(d->'itemIds') v where not exists(select 1 from public.collection_items where collection_id=cid and media_item_id=v.value::uuid)) then raise exception 'Ordering must contain every item exactly once' using errcode='22023'; end if;
      update public.collection_items ci set position=o.ordinality-1 from jsonb_array_elements_text(d->'itemIds') with ordinality o where ci.collection_id=cid and ci.media_item_id=o.value::uuid;
    end if;
    update public.collections set updated_at=now() where id=cid;
  elsif op='notificationRead' then update public.notifications set read_at=now() where user_id=auth.uid() and space_id=s and (d->>'id' is null or id=(d->>'id')::uuid);
  elsif op='saveSpace' then update public.spaces set name=d->>'name',relationship_started_at=(d->>'startedAt')::date where id=s;
  elsif op='deleteCategory' then delete from public.categories where id=(d->>'id')::uuid and space_id=s;
  elsif op='saveCategory' then insert into public.categories(space_id,name,created_by) values(s,btrim(d->>'name'),auth.uid()) on conflict(space_id,(lower(btrim(name)))) do nothing;
  else raise exception 'Unknown operation' using errcode='22023'; end if;
  if mid is not null then update public.media_items set updated_at=now() where id=mid; end if;
  return jsonb_build_object('id',coalesce(rid,mid));
end $$;

-- Changes to notes/ratings/etc invalidate a single space-scoped media subscription.
create function shelf_private.touch_media() returns trigger language plpgsql security invoker set search_path='' as $$
declare mid uuid; begin
  if tg_table_name='note_replies' then select media_item_id into mid from public.notes where id=coalesce(new.note_id,old.note_id);
  else mid:=coalesce(new.media_item_id,old.media_item_id); end if;
  update public.media_items set updated_at=now() where id=mid;
  return coalesce(new,old);
end $$;
do $$ declare t text; begin foreach t in array array['notes','note_replies','ratings','usefulness_ratings','favorites','watchlist','viewing_sessions'] loop
  execute format('create trigger touch_media after insert or update or delete on public.%I for each row execute function shelf_private.touch_media()',t);
end loop; end $$;

-- Bounded card/detail projection; SQL joins use FK indexes and do not make network N+1 calls.
create function public.media_document(mid uuid,detail boolean default false) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_strip_nulls(jsonb_build_object(
  'id',m.id,'spaceId',m.space_id,'title',m.title,'subtitle',m.subtitle,'description',m.description,'type',m.type,'sourceProvider',m.source_provider,'sourceUrl',m.source_url,'canonicalUrl',m.canonical_url,'externalId',m.external_id,
  'thumbnailUrl',coalesce(m.thumbnail_url,''),'backdropUrl',m.backdrop_url,'authorName',m.author_name,'channelName',m.channel_name,'durationSeconds',m.duration_seconds,'publishedAt',m.published_at,'year',m.year,'status',m.status,'contentIntent',m.content_intent,'createdAt',m.created_at,'updatedAt',m.updated_at,'archivedAt',m.archived_at,
  'categories',coalesce((select jsonb_agg(c.name order by c.name) from public.media_categories mc join public.categories c on c.id=mc.category_id where mc.media_item_id=m.id),'[]'),
  'tags',coalesce((select jsonb_agg(t.name order by t.name) from public.media_tags mt join public.tags t on t.id=mt.tag_id where mt.media_item_id=m.id),'[]'),
  'ratingByUser',coalesce((select jsonb_object_agg(user_id,rating) from public.ratings where media_item_id=m.id),'{}'),
  'usefulnessByUser',coalesce((select jsonb_object_agg(user_id,usefulness) from public.usefulness_ratings where media_item_id=m.id),'{}'),
  'favoriteByUser',coalesce((select jsonb_object_agg(user_id,true) from public.favorites where media_item_id=m.id),'{}'),
  'watchlistByUser',coalesce((select jsonb_object_agg(user_id,intent) from public.watchlist where media_item_id=m.id),'{}'),
  'sessions',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',v.id,'occurredAt',v.occurred_at,'completed',v.completed,'progressSeconds',v.progress_seconds,'progressPercent',v.progress_percent,'participantIds',coalesce((select jsonb_agg(user_id) from public.viewing_session_participants where viewing_session_id=v.id),'[]'))) order by v.occurred_at) from (select * from public.viewing_sessions where media_item_id=m.id order by occurred_at desc limit case when detail then 100 else 1 end) v),'[]'),
  'notes',case when detail then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'authorId',n.author_id,'body',n.body,'createdAt',n.created_at,'updatedAt',n.updated_at,'isPinned',n.is_pinned,'isImportant',n.is_important,'replies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'authorId',r.author_id,'body',r.body,'createdAt',r.created_at,'updatedAt',r.updated_at) order by r.created_at) from (select * from public.note_replies where note_id=n.id order by created_at desc limit 100) r),'[]')) order by n.is_pinned desc,n.created_at desc) from (select * from public.notes where media_item_id=m.id order by is_pinned desc,created_at desc limit 200) n),'[]') else '[]'::jsonb end
)) from public.media_items m where m.id=mid;
$$;

create function public.query_library(s uuid,options jsonb default '{}') returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as (
select m.* from public.media_items m where m.space_id=s and m.archived_at is null and shelf_private.member(s)
and (coalesce(options->>'type','all')='all' or m.type::text=options->>'type')
and (coalesce(options->>'canonicalUrl','')='' or m.canonical_url=options->>'canonicalUrl')
and (coalesce(options->>'collectionId','')='' or exists(select 1 from public.collection_items where collection_id=(options->>'collectionId')::uuid and media_item_id=m.id))
and (coalesce(options->>'filter','all')='all'
 or (options->>'filter' in ('watching','watch_later') and m.status::text=options->>'filter')
 or (options->>'filter'='watch_later' and exists(select 1 from public.watchlist where media_item_id=m.id and (user_id=auth.uid() or intent='together')))
 or (options->>'filter'='favorites' and exists(select 1 from public.favorites where media_item_id=m.id and user_id=auth.uid()))
 or (options->>'filter'='loved' and (select count(*) from public.favorites where media_item_id=m.id)>=2)
 or (options->>'filter'='recently_watched' and exists(select 1 from public.viewing_sessions where media_item_id=m.id))
 or (options->>'filter'='together' and exists(select 1 from public.viewing_sessions v where v.media_item_id=m.id and (select count(*) from public.viewing_session_participants where viewing_session_id=v.id)>1))
 or (options->>'filter'='useful' and m.content_intent in ('useful','both'))
 or (options->>'filter'='entertainment' and m.content_intent in ('entertainment','both')))
and (coalesce(btrim(options->>'query'),'')='' or
 to_tsvector('simple',m.title||' '||coalesce(m.description,'')||' '||coalesce(m.author_name,'')||' '||coalesce(m.channel_name,'')) @@ plainto_tsquery('simple',options->>'query')
 or position(lower(options->>'query') in lower(m.title))>0
 or exists(select 1 from public.notes n where n.media_item_id=m.id and to_tsvector('simple',n.body) @@ plainto_tsquery('simple',options->>'query'))
 or exists(select 1 from public.media_categories mc join public.categories c on c.id=mc.category_id where mc.media_item_id=m.id and position(lower(options->>'query') in lower(c.name))>0)
 or exists(select 1 from public.media_tags mt join public.tags t on t.id=mt.tag_id where mt.media_item_id=m.id and position(lower(options->>'query') in lower(t.name))>0))
), paged as (select id from filtered order by
case when coalesce(options->>'collectionId','')<>'' then (select ci.position from public.collection_items ci where ci.collection_id=(options->>'collectionId')::uuid and ci.media_item_id=filtered.id) end,
case when options->>'sort'='title' then lower(title) end,
case when options->>'sort'='oldest' then created_at end asc,
case when coalesce(options->>'sort','recent') not in ('oldest','title') then updated_at end desc,id
limit least(greatest(coalesce((options->>'limit')::integer,24),1),48) offset greatest(coalesce((options->>'offset')::integer,0),0))
select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(public.media_document(id,false)) from paged),'[]'));
$$;

create function public.space_statistics(s uuid,tz text default 'UTC') returns jsonb language sql stable security invoker set search_path='' as $$
with events as (
 select v.id,v.media_item_id,v.occurred_at,(v.occurred_at at time zone tz)::date as day,v.completed,
 coalesce(v.progress_seconds,case when v.completed then m.duration_seconds else 0 end,0) as seconds,
 (select count(*) from public.viewing_session_participants where viewing_session_id=v.id) as participants
 from public.viewing_sessions v join public.media_items m on m.id=v.media_item_id where v.space_id=s and shelf_private.member(s)
), days as (select distinct day from events), streak_days as (
 select day,day+(row_number() over(order by day desc))::integer as grp from days where day<=(now() at time zone tz)::date
), latest as (select max(day) as day from days)
select jsonb_build_object(
 'totalItems',(select count(*) from public.media_items where space_id=s and archived_at is null),
 'watchedThisMonth',(select count(*) from events where completed and day>=date_trunc('month',now() at time zone tz)::date),
 'secondsThisMonth',(select coalesce(sum(seconds),0) from events where day>=date_trunc('month',now() at time zone tz)::date),
 'notesThisMonth',(select count(*) from public.notes where space_id=s and (created_at at time zone tz)::date>=date_trunc('month',now() at time zone tz)::date),
 'streak',case when (select day from latest)>=(now() at time zone tz)::date-1 then (select count(*) from streak_days where grp=(select grp from streak_days order by day desc limit 1)) else 0 end,
 'sharedMoments',(select count(*) from events where participants>1),
 'lovedByBoth',(select count(*) from public.media_items m where m.space_id=s and m.archived_at is null and (select count(*) from public.favorites where media_item_id=m.id)>=2),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',n)) from (select c.name,count(*) n from public.categories c join public.media_categories mc on mc.category_id=c.id where c.space_id=s group by c.id order by n desc limit 12) x),'[]'),
 'byUser',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'sessions',n)) from (select p.user_id,count(*) n from public.viewing_session_participants p join events e on e.id=p.viewing_session_id group by p.user_id) x),'[]'),
 'heatmap',coalesce((select jsonb_agg(jsonb_build_object('day',day,'count',n) order by day) from (select day,count(*) n from events where day>=(now() at time zone tz)::date-83 group by day) x),'[]')
);
$$;

create function public.calendar_activity(s uuid,from_day date,to_day date,tz text default 'UTC',page_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$
with activity as (select v.*,public.media_document(v.media_item_id,false) as media,
 (v.occurred_at at time zone tz)::date as day from public.viewing_sessions v
 where v.space_id=s and shelf_private.member(s) and v.occurred_at >= (from_day::timestamp at time zone tz) and v.occurred_at < (to_day::timestamp at time zone tz)),
 page as (select * from activity order by occurred_at desc,id limit 100 offset greatest(page_offset,0))
select jsonb_build_object('total',(select count(*) from activity),'days',coalesce((select jsonb_agg(jsonb_build_object('day',day,'count',n,'seconds',seconds)) from (select a.day,count(*) n,sum(coalesce(a.progress_seconds,case when a.completed then (a.media->>'durationSeconds')::integer else 0 end,0)) seconds from activity a group by a.day) x),'[]'),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('item',media,'session',jsonb_strip_nulls(jsonb_build_object('id',id,'occurredAt',occurred_at,'completed',completed,'progressPercent',progress_percent,'progressSeconds',progress_seconds,'participantIds',coalesce((select jsonb_agg(user_id) from public.viewing_session_participants where viewing_session_id=page.id),'[]'))))) from page),'[]'));
$$;

revoke all on function public.save_viewing_session(uuid,uuid,jsonb),public.set_media_taxonomy(uuid,uuid,jsonb,jsonb),public.mutate_workspace(uuid,jsonb),public.media_document(uuid,boolean),public.query_library(uuid,jsonb),public.space_statistics(uuid,text),public.calendar_activity(uuid,date,date,text,integer) from public,anon;
grant execute on function public.save_viewing_session(uuid,uuid,jsonb),public.set_media_taxonomy(uuid,uuid,jsonb,jsonb),public.mutate_workspace(uuid,jsonb),public.media_document(uuid,boolean),public.query_library(uuid,jsonb),public.space_statistics(uuid,text),public.calendar_activity(uuid,date,date,text,integer) to authenticated;

create function public.collection_document(cid uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'coverUrl',coalesce(c.cover_path,''),
 'itemIds',coalesce((select jsonb_agg(media_item_id order by position,media_item_id) from public.collection_items where collection_id=c.id),'[]'))
 from public.collections c where c.id=cid;
$$;
create function public.query_collections(s uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,
 'coverUrl',coalesce(nullif(c.cover_path,''),(select m.thumbnail_url from public.collection_items ci join public.media_items m on m.id=ci.media_item_id where ci.collection_id=c.id order by ci.position limit 1),''),
 'itemIds','[]'::jsonb,'itemCount',(select count(*) from public.collection_items where collection_id=c.id))),'[]')
 from (select * from public.collections where space_id=s and shelf_private.member(s) order by updated_at desc,id limit 100) c;
$$;
revoke all on function public.collection_document(uuid),public.query_collections(uuid) from public,anon;
grant execute on function public.collection_document(uuid),public.query_collections(uuid) to authenticated;

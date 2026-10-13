-- Hosted PostgreSQL regression smoke test, NOT real Auth/JWT/browser acceptance.
-- Run only against the dedicated MediaJournal project after all migrations.
-- All users, content and mutations are rolled back; no fixture survives.
begin;
do $verification$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  s uuid; mid uuid; note_a uuid; note_b uuid; reply_b uuid; cid uuid;
  token text; revoked text; expired text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  document jsonb; result jsonb; row_total bigint; affected bigint; q record;
begin
  insert into auth.users(id,raw_user_meta_data) values
    (a,'{"display_name":"Hosted SQL A"}'),
    (b,'{"display_name":"Hosted SQL B"}'),
    (c,'{"display_name":"Hosted SQL C"}');
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('role','authenticated',true);
  s := public.create_shared_space('Rollback-only hosted verification');
  token := public.create_space_invite(s);
  revoked := public.create_space_invite(s);
  update public.space_invites set revoked_at=now()
    where space_id=s and token_hash=encode(sha256(convert_to(revoked,'UTF8')),'hex');
  perform set_config('role','postgres',true);
  insert into public.space_invites(space_id,token_hash,created_by,expires_at)
    values(s,encode(sha256(convert_to(expired,'UTF8')),'hex'),a,now()-interval '1 day');
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('role','authenticated',true);
  foreach token in array array[revoked,expired,repeat('0',64)] loop
    begin
      perform public.accept_space_invite(token);
      raise exception 'FAIL: invalid/revoked/expired invitation accepted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub',a::text,true);
  token := public.create_space_invite(s);
  perform set_config('request.jwt.claim.sub',b::text,true);
  if public.accept_space_invite(token)<>s then raise exception 'FAIL: wrong invitation scope'; end if;
  begin
    perform public.accept_space_invite(token);
    raise exception 'FAIL: reused invitation accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_space_invite(s);
    raise exception 'FAIL: nonowner created invitation';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',a::text,true);
  select public.mutate_workspace(s,jsonb_build_object('op','createMedia','data',jsonb_build_object(
    'title','Orbitquartz film','description','Velvetsun description','sourceProvider','manual',
    'sourceUrl','https://manual.our-shelf.invalid/'||s,'canonicalUrl','https://manual.our-shelf.invalid/'||s,
    'type','movie','status','watched','contentIntent','both','durationSeconds',3600,
    'categories',jsonb_build_array('Movies'),'tags',jsonb_build_array('Celestine'),
    'session',jsonb_build_object('occurredAt','2026-10-12T20:30:00Z','participantIds',jsonb_build_array(a,b),'completed',true,'progressPercent',100)
  ))) into result;
  mid := (result->>'id')::uuid;
  select public.mutate_workspace(s,jsonb_build_object('op','createMedia','data',jsonb_build_object(
    'title','Duplicate','sourceProvider','manual','sourceUrl','https://manual.our-shelf.invalid/'||s,
    'canonicalUrl','https://manual.our-shelf.invalid/'||s,'type','movie','status','watched','contentIntent','both'
  ))) into result;
  if not (result->>'duplicate')::boolean or (result->>'id')::uuid<>mid then raise exception 'FAIL: duplicate detection'; end if;
  select public.mutate_workspace(s,jsonb_build_object('op','createNote','mediaId',mid,'data',jsonb_build_object('body','Luminousmemory reflection'))) into result;
  note_a := (result->>'id')::uuid;
  perform public.mutate_workspace(s,jsonb_build_object('op','rating','mediaId',mid,'data',jsonb_build_object('value',9.1)));
  perform public.mutate_workspace(s,jsonb_build_object('op','favorite','mediaId',mid,'data',jsonb_build_object('value',true)));
  perform public.mutate_workspace(s,jsonb_build_object('op','watchlist','mediaId',mid,'data',jsonb_build_object('intent','together')));
  select public.mutate_workspace(s,jsonb_build_object('op','saveCollection','data',jsonb_build_object('title','Collaborative collection'))) into result;
  cid := (result->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',b::text,true);
  document := public.media_document(mid,true);
  if document->>'title'<>'Orbitquartz film' or jsonb_array_length(document->'notes')<>1 then raise exception 'FAIL: member projection'; end if;
  select public.mutate_workspace(s,jsonb_build_object('op','createReply','mediaId',mid,'data',jsonb_build_object('noteId',note_a,'body','Partner reply'))) into result;
  reply_b := (result->>'id')::uuid;
  select public.mutate_workspace(s,jsonb_build_object('op','createNote','mediaId',mid,'data',jsonb_build_object('body','Partner reflection'))) into result;
  note_b := (result->>'id')::uuid;
  perform public.mutate_workspace(s,jsonb_build_object('op','rating','mediaId',mid,'data',jsonb_build_object('value',7.2)));
  perform public.mutate_workspace(s,jsonb_build_object('op','usefulness','mediaId',mid,'data',jsonb_build_object('value',4)));
  perform public.mutate_workspace(s,jsonb_build_object('op','favorite','mediaId',mid,'data',jsonb_build_object('value',true)));
  perform public.mutate_workspace(s,jsonb_build_object('op','collectionAdd','mediaId',mid,'data',jsonb_build_object('id',cid)));
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform public.mutate_workspace(s,jsonb_build_object('op','collectionOrder','data',jsonb_build_object('id',cid,'itemIds',jsonb_build_array(mid))));
  if (select added_by from public.collection_items where collection_id=cid and media_item_id=mid)<>b then raise exception 'FAIL: collection contributor changed'; end if;
  if (select count(*) from public.notifications where user_id=a and space_id=s and type='reply')<>1 then raise exception 'FAIL: reply notification'; end if;
  document := public.media_document(mid,true);
  if (document->'ratingByUser'->>a::text)::numeric<>9.1 or (document->'ratingByUser'->>b::text)::numeric<>7.2 then raise exception 'FAIL: independent ratings'; end if;
  if document->'watchlistByUser'->>a::text<>'together' then raise exception 'FAIL: watch-together persistence'; end if;
  if jsonb_array_length(document->'sessions'->0->'participantIds')<>2 then raise exception 'FAIL: session participants'; end if;
  result := public.space_statistics(s,'Asia/Qyzylorda');
  if (result->>'totalItems')::int<>1 or (result->>'lovedByBoth')::int<>1 or (result->>'sharedMoments')::int<>1 or jsonb_array_length(result->'byUser')<>2 then raise exception 'FAIL: database statistics'; end if;
  result := public.calendar_activity(s,'2026-10-13','2026-10-14','Asia/Qyzylorda',0);
  if (result->>'total')::int<>1 or result->'days'->0->>'day'<>'2026-10-13' then raise exception 'FAIL: timezone local date'; end if;
  result := public.calendar_activity(s,'2026-10-12','2026-10-13','UTC',0);
  if (result->>'total')::int<>1 or result->'days'->0->>'day'<>'2026-10-12' then raise exception 'FAIL: timezone UTC date'; end if;
  for q in select term from (values('Orbitquartz'),('Velvetsun'),('Celestine'),('Movies'),('Luminousmemory')) v(term) loop
    result := public.query_library(s,jsonb_build_object('query',q.term));
    if (result->>'total')::int<>1 then raise exception 'FAIL: hosted search %',q.term; end if;
  end loop;

  -- Author-only writes: a member can read, but cannot mutate B's personal rows.
  for q in select sql from (values
    (format('update public.notes set body=''forbidden'' where id=%L',note_b)),
    (format('delete from public.notes where id=%L',note_b)),
    (format('update public.note_replies set body=''forbidden'' where id=%L',reply_b)),
    (format('delete from public.note_replies where id=%L',reply_b)),
    (format('update public.ratings set rating=1 where media_item_id=%L and user_id=%L',mid,b)),
    (format('delete from public.ratings where media_item_id=%L and user_id=%L',mid,b)),
    (format('delete from public.favorites where media_item_id=%L and user_id=%L',mid,b))
  ) v(sql) loop
    execute q.sql;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'FAIL: another author changed: %',q.sql; end if;
  end loop;
  begin
    update public.space_invites set space_id=gen_random_uuid() where space_id=s;
    raise exception 'FAIL: invitation retargeted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.notifications set payload='{}' where space_id=s;
    raise exception 'FAIL: notification payload changed';
  exception when insufficient_privilege then null;
  end;

  -- Third caller: target known IDs rather than relying on UI filtering.
  perform set_config('request.jwt.claim.sub',c::text,true);
  for q in select label,sql from (values
    ('media',format('select count(*) from public.media_items where id=%L',mid)),
    ('notes',format('select count(*) from public.notes where media_item_id=%L',mid)),
    ('replies',format('select count(*) from public.note_replies where id=%L',reply_b)),
    ('sessions',format('select count(*) from public.viewing_sessions where media_item_id=%L',mid)),
    ('participants',format('select count(*) from public.viewing_session_participants where user_id=%L',a)),
    ('collections',format('select count(*) from public.collections where id=%L',cid)),
    ('collection_items',format('select count(*) from public.collection_items where collection_id=%L',cid)),
    ('ratings',format('select count(*) from public.ratings where media_item_id=%L',mid)),
    ('usefulness',format('select count(*) from public.usefulness_ratings where media_item_id=%L',mid)),
    ('favorites',format('select count(*) from public.favorites where media_item_id=%L',mid)),
    ('watchlist',format('select count(*) from public.watchlist where media_item_id=%L',mid)),
    ('notifications',format('select count(*) from public.notifications where space_id=%L',s)),
    ('space',format('select count(*) from public.spaces where id=%L',s)),
    ('memberships',format('select count(*) from public.space_members where space_id=%L',s)),
    ('invites',format('select count(*) from public.space_invites where space_id=%L',s)),
    ('profiles',format('select count(*) from public.profiles where id in (%L,%L)',a,b)),
    ('categories',format('select count(*) from public.categories where space_id=%L',s)),
    ('tags',format('select count(*) from public.tags where space_id=%L',s)),
    ('media_categories',format('select count(*) from public.media_categories where media_item_id=%L',mid)),
    ('media_tags',format('select count(*) from public.media_tags where media_item_id=%L',mid))
  ) v(label,sql) loop
    execute q.sql into row_total;
    if row_total<>0 then raise exception 'FAIL: outsider read %',q.label; end if;
  end loop;
  if public.media_document(mid,true) is not null then raise exception 'FAIL: outsider RPC projection'; end if;
  for q in select sql from (values
    (format('insert into public.notes(space_id,media_item_id,author_id,body) values(%L,%L,%L,''forbidden'')',s,mid,c)),
    (format('insert into public.note_replies(note_id,author_id,body) values(%L,%L,''forbidden'')',note_a,c)),
    (format('insert into public.viewing_sessions(space_id,media_item_id,created_by) values(%L,%L,%L)',s,mid,c)),
    (format('insert into public.ratings(media_item_id,user_id,rating) values(%L,%L,1)',mid,c)),
    (format('insert into public.usefulness_ratings(media_item_id,user_id,usefulness) values(%L,%L,1)',mid,c)),
    (format('insert into public.favorites(media_item_id,user_id) values(%L,%L)',mid,c)),
    (format('insert into public.watchlist(media_item_id,user_id) values(%L,%L)',mid,c)),
    (format('insert into public.collections(space_id,created_by,title) values(%L,%L,''forbidden'')',s,c)),
    (format('insert into public.space_members(space_id,user_id) values(%L,%L)',s,c)),
    (format('insert into public.notifications(user_id,space_id,type) values(%L,%L,''note'')',c,s))
  ) v(sql) loop
    begin
      execute q.sql;
      raise exception 'FAIL: outsider insert allowed: %',q.sql;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    perform public.mutate_workspace(s,jsonb_build_object('op','createNote','mediaId',mid,'data',jsonb_build_object('body','forbidden')));
    raise exception 'FAIL: outsider mutation RPC';
  exception when insufficient_privilege then null;
  end;
  for q in select sql from (values
    (format('update public.media_items set title=''forbidden'' where id=%L',mid)),
    (format('delete from public.media_items where id=%L',mid)),
    (format('update public.notes set body=''forbidden'' where id=%L',note_a)),
    (format('delete from public.notes where id=%L',note_a)),
    (format('update public.collections set title=''forbidden'' where id=%L',cid)),
    (format('delete from public.collections where id=%L',cid)),
    (format('update public.ratings set rating=1 where media_item_id=%L',mid)),
    (format('delete from public.ratings where media_item_id=%L',mid)),
    (format('delete from public.favorites where media_item_id=%L',mid))
  ) v(sql) loop
    execute q.sql;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'FAIL: outsider mutation allowed: %',q.sql; end if;
  end loop;
  perform set_config('role','postgres',true);
end;
$verification$;
rollback;
select 'PASS: hosted transactional SQL verification; fixtures rolled back; Auth/Storage/Realtime/browser acceptance NOT tested' as result;

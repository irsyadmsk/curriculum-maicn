-- Local candidate. Apply only with explicit release approval. No photo enters event snapshots.
begin;
alter table private.curriculum_clinic_requests add column location text check(location is null or location in ('Kelas X-1','Kelas X-2','Kelas X-3','Lantai 1','Kelas lantai 2 Gedung Maiyoma Chaidir')),add column location_revision integer;
create table private.curriculum_request_details(
 kind text not null check(kind in ('clinic','school')),request_id uuid not null,
 requester_kind text not null check(requester_kind in ('teacher','student')),
 requester_id text not null,requester_name text not null,requester_class text,
 location text not null default '' check(location in ('','Kelas X-1','Kelas X-2','Kelas X-3','Lantai 1','Kelas lantai 2 Gedung Maiyoma Chaidir')),
 identity_verified boolean not null default false,verified_by uuid references auth.users(id),verified_at timestamptz,
 photo bytea,photo_hash text,photo_mime text check(photo_mime in ('image/jpeg','image/png','image/webp')),
 photo_deleted_at timestamptz,revision integer not null default 1,
 created_at timestamptz not null default now(),primary key(kind,request_id),check(photo is null or octet_length(photo)<=180000)
);
alter table private.curriculum_request_details enable row level security;
revoke all on private.curriculum_request_details from public,anon,authenticated,service_role;
create table private.curriculum_announcements(id uuid primary key,institution text not null default 'MA Insan Cendekia Nusantara',title text not null check(length(title) between 1 and 160),body text not null default '' check(length(body)<=2000),attachment text not null default '' check(length(attachment)<=1000),date_from date not null,date_to date not null,status text not null check(status in ('draft','published','archived')),important boolean not null default false,revision integer not null default 1,updated_by uuid references auth.users(id),updated_at timestamptz not null default now(),check(date_to>=date_from));
alter table private.curriculum_announcements enable row level security;
revoke all on private.curriculum_announcements from public,anon,authenticated,service_role;
create index curriculum_announcements_active on private.curriculum_announcements(date_from,date_to) where status='published';
create table private.curriculum_workdays(date date primary key,is_workday boolean not null,note text not null default '' check(length(note)<=200));
alter table private.curriculum_workdays enable row level security;
revoke all on private.curriculum_workdays from public,anon,authenticated,service_role;
create table private.curriculum_operations_outbox(id uuid primary key default gen_random_uuid(),event_key text not null,kind text not null,recipient text not null,snapshot jsonb not null,state text not null default 'queued' check(state in ('queued','leased','provider_accepted','needs_review','superseded')),lease uuid,leased_at timestamptz,first_attempt_at timestamptz,attempts integer not null default 0,provider_id text,created_at timestamptz not null default now(),unique(event_key,recipient));
alter table private.curriculum_operations_outbox enable row level security;
revoke all on private.curriculum_operations_outbox from public,anon,authenticated,service_role;
create index curriculum_operations_pending on private.curriculum_operations_outbox(created_at) where state in ('queued','leased');
create table private.curriculum_operations_receipts(token uuid primary key,actor uuid not null,intent jsonb not null,result jsonb not null);
alter table private.curriculum_operations_receipts enable row level security;
revoke all on private.curriculum_operations_receipts from public,anon,authenticated,service_role;

create function private.curriculum_review_day(p_date date) returns date language plpgsql stable security definer set search_path='' as $$
declare d date:=p_date;working boolean;
begin
 for i in 1..370 loop
  select is_workday into working from private.curriculum_workdays where date=d;
  if coalesce(working,extract(isodow from d)<6) then return d;end if;d:=d+1;
 end loop;raise exception 'invalid_work_calendar';
end $$;
revoke all on function private.curriculum_review_day(date) from public,anon,authenticated,service_role;

create function private.curriculum_attach_identity(p_kind text,p_id uuid,p_data jsonb) returns void language plpgsql volatile security definer set search_path='' as $$
declare who text:=p_data->>'requester_kind';ident text:=p_data->>'requester_id';nm text;cls text;pic bytea;mime text;existing private.curriculum_request_details;loc text:=coalesce(p_data->>'location','');
begin
 if who='student' then
  select nama,classroom into nm,cls from private.curriculum_clinic_roster where id=ident and institution='MA Insan Cendekia Nusantara' and year='2026/2027';
  if nm is null or cls is null or cls is distinct from p_data->>'requester_class' then raise exception 'invalid_requester';end if;
  if coalesce(length(p_data->>'identity_photo'),0)>240000 then raise exception 'invalid_photo';end if;
  begin pic:=decode(p_data->>'identity_photo','base64');exception when others then raise exception 'invalid_photo';end;
  mime:=p_data->>'photo_mime';
  if pic is null or octet_length(pic)<20 or octet_length(pic)>180000 or mime is null or mime not in ('image/jpeg','image/png','image/webp') then raise exception 'invalid_photo';end if;
  if mime='image/jpeg' and substring(encode(pic,'hex') from 1 for 6)<>'ffd8ff' or mime='image/png' and substring(encode(pic,'hex') from 1 for 16)<>'89504e470d0a1a0a' or mime='image/webp' and (substring(encode(pic,'hex') from 1 for 8)<>'52494646' or substring(encode(pic,'hex') from 17 for 8)<>'57454250') then raise exception 'invalid_photo';end if;
 elsif who='teacher' then
  select nama into nm from public.curriculum_teachers where kode=ident;
  if nm is null then raise exception 'invalid_requester';end if;
  if coalesce(p_data->>'contact_email','') !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' or coalesce(p_data->>'evidence','') !~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]{10,200}/(view|preview)$' then raise exception 'invalid_teacher_contact';end if;
 else raise exception 'invalid_requester';end if;
 select * into existing from private.curriculum_request_details where kind=p_kind and request_id=p_id;
 if found then
  if existing.requester_kind<>who or existing.requester_id<>ident or existing.photo_hash is distinct from md5(pic) then raise exception 'token_mismatch';end if;return;
 end if;
 insert into private.curriculum_request_details(kind,request_id,requester_kind,requester_id,requester_name,requester_class,location,photo,photo_hash,photo_mime) values(p_kind,p_id,who,ident,nm,cls,loc,pic,md5(pic),mime);
 -- No photos or email addresses are included in administrative notification content.
 insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('new/'||p_kind||'/'||p_id,'new','irsyad.msk@gmail.com',jsonb_build_object('subject','[Curriculum] Ajuan baru dari '||nm,'text','Ajuan '||p_kind||' dari '||nm||coalesce(' ('||cls||')','')||E' masuk.\nPeriksa identitas, bukti, jadwal, dan penempatan di ruang Curriculum.\nNomor ajuan: '||p_id)) on conflict do nothing;
 if who='teacher' then
  insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('receipt/'||p_kind||'/'||p_id,'receipt',p_data->>'contact_email',jsonb_build_object('subject','[Curriculum] Ajuan diterima sistem','text','Nomor ajuan: '||p_id||E'\nStatus: menunggu pemeriksaan kurikulum sesuai antrean hari kerja sekolah.')) on conflict do nothing;
 end if;
end $$;
revoke all on function private.curriculum_attach_identity(text,uuid,jsonb) from public,anon,authenticated,service_role;

alter function public.curriculum_clinic_intake(text,text,uuid,uuid,text,jsonb) rename to curriculum_clinic_intake_before_experience;
revoke all on function public.curriculum_clinic_intake_before_experience(text,text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.curriculum_clinic_intake(p_institution text,p_year text,p_id uuid,p_token uuid,p_fingerprint text,p_data jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;clean jsonb:=p_data-array['identity_photo','photo_mime'];
begin
 if p_data->>'requester_kind'='student' and p_data->>'request_kind'<>'guest' or p_data->>'requester_kind'='teacher' and (p_data->>'request_kind'<>'teacher' or p_data->>'requester_id' is distinct from p_data->>'teacher_code') then raise exception 'invalid_requester';end if;
 clean:=clean||jsonb_build_object('identity_fingerprint',md5(coalesce(p_data->>'identity_photo','')));
 result:=public.curriculum_clinic_intake_before_experience(p_institution,p_year,p_id,p_token,p_fingerprint,clean);
 perform private.curriculum_attach_identity('clinic',p_id,p_data);
 if p_data->>'requester_kind'='teacher' then
  insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('receipt/clinic/'||p_id,'receipt',p_data->>'contact_email',jsonb_build_object('subject','[Curriculum] Ajuan klinik diterima sistem','text','Nomor ajuan: '||p_id||E'\nStatus: menunggu pemeriksaan kurikulum.\nPemeriksaan berdasarkan antrean pada hari kerja sekolah.')) on conflict do nothing;
 end if;return result;
end $$;
revoke all on function public.curriculum_clinic_intake(text,text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.curriculum_clinic_intake(text,text,uuid,uuid,text,jsonb) to service_role;

do $alter$ declare definition text;begin
 definition:=pg_get_functiondef('private.school_insert(uuid,text,uuid,jsonb,uuid,text)'::regprocedure);
 if position('if code is null and not private.clinic_can_review(r.institution) and p_kind in' in definition)=0 then raise exception 'school_writer_changed';end if;
 definition:=replace(definition,'if code is null and not private.clinic_can_review(r.institution) and p_kind in','if code is null and coalesce(p_data->>''requester_kind'',''teacher'')<>''student'' and not private.clinic_can_review(r.institution) and p_kind in');
 execute definition;
end $alter$;
-- School guests and signed-in users use the same identity checks; SSO is still optional.
alter function public.curriculum_school_guest(text,uuid,jsonb,uuid,text) rename to curriculum_school_guest_before_experience;
revoke all on function public.curriculum_school_guest_before_experience(text,uuid,jsonb,uuid,text) from public,anon,authenticated,service_role;
create function public.curriculum_school_guest(p_kind text,p_id uuid,p_data jsonb,p_token uuid,p_fingerprint text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.curriculum_school_guest_before_experience(p_kind,p_id,(p_data-array['identity_photo','photo_mime'])||jsonb_build_object('identity_fingerprint',md5(coalesce(p_data->>'identity_photo',''))),p_token,p_fingerprint);
 perform private.curriculum_attach_identity('school',p_id,p_data);return result;
end $$;
revoke all on function public.curriculum_school_guest(text,uuid,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.curriculum_school_guest(text,uuid,jsonb,uuid,text) to service_role;
alter function public.curriculum_school_submit(text,uuid,jsonb,uuid) rename to curriculum_school_submit_before_experience;
revoke all on function public.curriculum_school_submit_before_experience(text,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.curriculum_school_submit(p_kind text,p_id uuid,p_data jsonb,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.school_ready(auth.uid()) then raise exception 'forbidden';end if;
 result:=public.curriculum_school_submit_before_experience(p_kind,p_id,(p_data-array['identity_photo','photo_mime'])||jsonb_build_object('identity_fingerprint',md5(coalesce(p_data->>'identity_photo',''))),p_token);
 perform private.curriculum_attach_identity('school',p_id,p_data);return result;
end $$;
revoke all on function public.curriculum_school_submit(text,uuid,jsonb,uuid) from public,anon;
grant execute on function public.curriculum_school_submit(text,uuid,jsonb,uuid) to authenticated;

alter function public.curriculum_clinic_read(text,text,text) rename to curriculum_clinic_read_before_experience;
revoke all on function public.curriculum_clinic_read_before_experience(text,text,text) from public,anon,authenticated,service_role;
create function public.curriculum_clinic_read(p_institution text,p_year text,p_mode text default 'public') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;rows jsonb;
begin
 result:=public.curriculum_clinic_read_before_experience(p_institution,p_year,p_mode);
 select coalesce(jsonb_agg(x.row||jsonb_build_object('location',coalesce(nullif(d.location,''),r.location,''),'location_revision',coalesce(r.location_revision,0)) order by x.ord),'[]') into rows from jsonb_array_elements(result->'rows') with ordinality x(row,ord) left join private.curriculum_request_details d on d.kind='clinic' and d.request_id=(x.row->>'id')::uuid left join private.curriculum_clinic_requests r on r.id=(x.row->>'id')::uuid;
 return result||jsonb_build_object('rows',rows);
end $$;
revoke all on function public.curriculum_clinic_read(text,text,text) from public;grant execute on function public.curriculum_clinic_read(text,text,text) to anon,authenticated;

create or replace function private.school_queue_email() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare d private.curriculum_request_details;
begin
 select * into d from private.curriculum_request_details where kind='school' and request_id=new.id;
 if coalesce(new.contact_email,'')<>'' and (d.requester_kind='teacher' or d.requester_kind is null and new.teacher_code is not null and not private.school_student(new.owner_id)) and new.status in ('approved','rejected') and new.status is distinct from old.status then
  insert into private.curriculum_school_email_outbox(request_id,revision,snapshot) values(new.id,new.revision,to_jsonb(new)||jsonb_build_object('teacher',coalesce(nullif(new.teacher,''),d.requester_name,''),'activity_kind',new.kind,'request_kind','teacher','subjects',jsonb_build_array(new.subject),'approved_subject',new.subject,'start',to_char(new.start,'HH24:MI'),'end',to_char(new."end",'HH24:MI'))) on conflict do nothing;
 end if;return new;
end $$;
revoke all on function private.school_queue_email() from public,anon,authenticated,service_role;

create function private.curriculum_identity_guard() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare d private.curriculum_request_details;k text:=case when tg_table_name='curriculum_clinic_requests' then 'clinic' else 'school' end;
begin
 if new.status='approved' and old.status is distinct from new.status then
  select * into d from private.curriculum_request_details where kind=k and request_id=new.id;
  if not found or not d.identity_verified or k='clinic' and d.location='' then raise exception 'identity_or_location_required';end if;
 end if;
 if new.status in ('approved','rejected','cancelled') and old.status is distinct from new.status then
  update private.curriculum_request_details set photo=null,photo_deleted_at=case when photo is not null then now() else photo_deleted_at end where kind=k and request_id=new.id;
 end if;return new;
end $$;
revoke all on function private.curriculum_identity_guard() from public,anon,authenticated,service_role;
create trigger clinic_identity_guard before update on private.curriculum_clinic_requests for each row execute function private.curriculum_identity_guard();
create trigger school_identity_guard before update on private.curriculum_school_requests for each row execute function private.curriculum_identity_guard();

create function private.curriculum_details_json(d private.curriculum_request_details) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('request_id',d.request_id,'kind',d.kind,'requester_kind',d.requester_kind,'requester_id',d.requester_id,'requester_name',d.requester_name,'requester_class',d.requester_class,'location',d.location,'identity_verified',d.identity_verified,'verified_at',d.verified_at,'has_photo',d.photo is not null,'photo_deleted_at',d.photo_deleted_at,'revision',d.revision,'review_on',private.curriculum_review_day((d.created_at at time zone 'Asia/Jakarta')::date))
$$;
revoke all on function private.curriculum_details_json(private.curriculum_request_details) from public,anon,authenticated,service_role;
create function private.curriculum_digest_snapshot(p_date date) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('date',p_date,'clinic',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('start',to_char(r.start,'HH24:MI'),'end',to_char(r."end",'HH24:MI'),'location',coalesce(nullif(d.location,''),r.location,'')) order by r.start,r.id),'[]') from private.curriculum_clinic_requests r left join private.curriculum_request_details d on d.kind='clinic' and d.request_id=r.id where r.institution='MA Insan Cendekia Nusantara' and r.year='2026/2027' and r.status='approved' and r.date between p_date and p_date+case when extract(isodow from p_date)=1 then 1 else 0 end),
 'roster',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama,'kelas',classroom) order by classroom,nama),'[]') from private.curriculum_clinic_roster where institution='MA Insan Cendekia Nusantara' and year='2026/2027'),
 'news',(select coalesce(jsonb_agg(to_jsonb(a)-'updated_by' order by important desc,updated_at desc),'[]') from private.curriculum_announcements a where a.institution='MA Insan Cendekia Nusantara' and status='published' and date_from<=p_date and date_to>=p_date),
 'school',public.curriculum_school_read('public',p_date,null,null),
 'monday',(select to_jsonb(b) from private.curriculum_monday_blocks b where b.institution='MA Insan Cendekia Nusantara' and b.year='2026/2027' and b.date=p_date limit 1))
$$;
revoke all on function private.curriculum_digest_snapshot(date) from public,anon,authenticated,service_role;

create function public.curriculum_clinic_receipt(p_id uuid,p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('found',true,'id',r.id,'status',r.status,'revision',r.revision,'decision_note',r.decision_note,'approved_subject',r.approved_subject,'teacher',r.teacher,'location',coalesce(nullif(d.location,''),r.location,'')) from private.curriculum_clinic_requests r left join private.curriculum_request_details d on d.kind='clinic' and d.request_id=r.id where r.id=p_id and r.institution='MA Insan Cendekia Nusantara' and r.year='2026/2027' and exists(select 1 from private.curriculum_clinic_events e where e.request_id=r.id and e.token=p_token and e.action='submit')),jsonb_build_object('found',false))
$$;
revoke all on function public.curriculum_clinic_receipt(uuid,uuid) from public,anon,authenticated;grant execute on function public.curriculum_clinic_receipt(uuid,uuid) to service_role;

create function public.curriculum_operations_notifications() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;total integer;
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') then raise exception 'forbidden';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by created_at),'[]') into result from (select 'clinic' as kind,id,subjects[1] as title,date,created_at from private.curriculum_clinic_requests where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and status='pending' union all select 'school',id,title,date,created_at from private.curriculum_school_requests where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and status='pending' and (private.is_admin() or kind='switch') order by created_at limit 20)q;
 select (select count(*) from private.curriculum_clinic_requests where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and status='pending')+(select count(*) from private.curriculum_school_requests where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and status='pending' and (private.is_admin() or kind='switch')) into total;
 return jsonb_build_object('count',total,'rows',result);
end $$;
revoke all on function public.curriculum_operations_notifications() from public,anon;grant execute on function public.curriculum_operations_notifications() to authenticated;

create function public.curriculum_operations_read(p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') then raise exception 'forbidden';end if;
 result:=private.curriculum_digest_snapshot(p_date);
 return result||jsonb_build_object('version',1,'details',(select coalesce(jsonb_agg(private.curriculum_details_json(d) order by d.created_at),'[]') from private.curriculum_request_details d where d.kind='clinic' or private.is_admin() or exists(select 1 from private.curriculum_school_requests r where r.id=d.request_id and r.kind='switch')),
 'clinic_review',public.curriculum_clinic_review_v2('MA Insan Cendekia Nusantara','2026/2027','review'),
 'school',public.curriculum_school_read('review',null,null,null),
 'news_all',(select coalesce(jsonb_agg(to_jsonb(a) order by updated_at desc),'[]') from private.curriculum_announcements a where institution='MA Insan Cendekia Nusantara'),
 'workdays',(select coalesce(jsonb_agg(to_jsonb(w) order by date),'[]') from private.curriculum_workdays w),
 'email',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'state',o.state,'created_at',o.created_at) order by created_at desc),'[]') from (select * from private.curriculum_operations_outbox order by created_at desc limit 50)o));
end $$;
revoke all on function public.curriculum_operations_read(date) from public,anon;grant execute on function public.curriculum_operations_read(date) to authenticated;

create function public.curriculum_operations_photo(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') then raise exception 'forbidden';end if;
 return (select jsonb_build_object('mime',photo_mime,'data',encode(photo,'base64')) from private.curriculum_request_details where kind=p_kind and request_id=p_id and photo is not null and (p_kind='clinic' or private.is_admin() or exists(select 1 from private.curriculum_school_requests r where r.id=p_id and r.kind='switch')));
end $$;
revoke all on function public.curriculum_operations_photo(text,uuid) from public,anon;grant execute on function public.curriculum_operations_photo(text,uuid) to authenticated;

create function public.curriculum_operations_write(p_action text,p_data jsonb,p_expected integer,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid();receipt private.curriculum_operations_receipts;result jsonb;ident uuid;intent jsonb:=jsonb_build_object('action',p_action,'data',p_data,'expected',p_expected);d private.curriculum_request_details;a private.curriculum_announcements;
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') or actor is null or p_token is null then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:MA Insan Cendekia Nusantara',0));
 select * into receipt from private.curriculum_operations_receipts where token=p_token;if found then if receipt.actor<>actor or receipt.intent<>intent then raise exception 'token_mismatch';end if;return receipt.result;end if;
 if p_action='identity' then
  select * into d from private.curriculum_request_details where kind=p_data->>'kind' and request_id=(p_data->>'id')::uuid for update;
  if not found or d.revision<>p_expected then raise exception 'stale_revision';end if;
  if d.kind='school' and not private.is_admin() and not exists(select 1 from private.curriculum_school_requests r where r.id=d.request_id and r.kind='switch') then raise exception 'forbidden';end if;
  if p_data->>'confirmed' is distinct from 'true' or d.requester_kind='student' and d.photo is null and not d.identity_verified then raise exception 'identity_required';end if;
  update private.curriculum_request_details set identity_verified=true,verified_at=now(),verified_by=actor,location=coalesce(p_data->>'location',location),revision=revision+1 where kind=d.kind and request_id=d.request_id returning * into d;
  result:=private.curriculum_details_json(d);
 elsif p_action='location' then
  ident:=(p_data->>'id')::uuid;
  if not exists(select 1 from private.curriculum_clinic_requests where id=ident and institution='MA Insan Cendekia Nusantara' and year='2026/2027' and status='approved' and coalesce(location_revision,0)=p_expected) then raise exception 'stale_revision';end if;
  update private.curriculum_clinic_requests set location=p_data->>'location',location_revision=coalesce(location_revision,0)+1 where id=ident;
  update private.curriculum_request_details set location=p_data->>'location',revision=revision+1 where kind='clinic' and request_id=ident;
  result:=jsonb_build_object('id',ident,'location',p_data->>'location','revision',p_expected+1);
 elsif p_action='announcement' then
  ident:=(p_data->>'id')::uuid;select * into a from private.curriculum_announcements where id=ident for update;
  if coalesce(a.revision,0)<>p_expected then raise exception 'stale_revision';end if;
  if coalesce(p_data->>'attachment','')<>'' and p_data->>'attachment' !~ '^https://[^[:space:]<>]+$' then raise exception 'invalid_attachment';end if;
  insert into private.curriculum_announcements(id,title,body,attachment,date_from,date_to,status,important,updated_by) values(ident,btrim(p_data->>'title'),coalesce(p_data->>'body',''),coalesce(p_data->>'attachment',''),(p_data->>'date_from')::date,(p_data->>'date_to')::date,p_data->>'status',coalesce((p_data->>'important')::boolean,false),actor)
  on conflict(id) do update set title=excluded.title,body=excluded.body,attachment=excluded.attachment,date_from=excluded.date_from,date_to=excluded.date_to,status=excluded.status,important=excluded.important,revision=curriculum_announcements.revision+1,updated_by=actor,updated_at=now() returning to_jsonb(curriculum_announcements.*) into result;
 elsif p_action='workday' then
  insert into private.curriculum_workdays(date,is_workday,note) values((p_data->>'date')::date,(p_data->>'is_workday')::boolean,coalesce(p_data->>'note','')) on conflict(date) do update set is_workday=excluded.is_workday,note=excluded.note;
  result:=jsonb_build_object('saved',true);
 else raise exception 'invalid_action';end if;
 insert into private.curriculum_operations_receipts values(p_token,actor,intent,result);return result;
end $$;
revoke all on function public.curriculum_operations_write(text,jsonb,integer,uuid) from public,anon;grant execute on function public.curriculum_operations_write(text,jsonb,integer,uuid) to authenticated;

-- Public output is a curated projection: no roster, participant names, proofs or email.
create function public.curriculum_today(p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare clinics jsonb;mon date:=p_date+((8-extract(isodow from p_date)::integer)%7);
begin
 select coalesce(jsonb_agg(x.row||jsonb_build_object('location',coalesce(nullif(d.location,''),x.row->>'location','')) order by x.row->>'date',x.row->>'start'),'[]') into clinics from jsonb_array_elements(public.curriculum_clinic_read('MA Insan Cendekia Nusantara','2026/2027','public')->'rows') as x(row) left join private.curriculum_request_details d on d.kind='clinic' and d.request_id=(x.row->>'id')::uuid where (x.row->>'date')::date between p_date and p_date+7;
 return jsonb_build_object('version',1,'date',p_date,'read_at',now(),'clinic',clinics,'school',public.curriculum_school_read('public',p_date,null,null),
 'news',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'body',body,'attachment',attachment,'important',important) order by important desc,updated_at desc),'[]') from private.curriculum_announcements where institution='MA Insan Cendekia Nusantara' and status='published' and date_from<=p_date and date_to>=p_date),
 'monday',(select to_jsonb(b)-'updated_by' from private.curriculum_monday_blocks b where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and date=mon));
end $$;
revoke all on function public.curriculum_today(date) from public;grant execute on function public.curriculum_today(date) to anon,authenticated;

create function public.curriculum_operations_enqueue(p_at timestamptz) returns void language plpgsql volatile security definer set search_path='' as $$
declare local_clock timestamp:=p_at at time zone 'Asia/Jakarta';day date:=local_clock::date;r record;nm text;mail text;
begin
 -- Called every five minutes: unique event keys protect overlapping runs and delayed cron delivery.
 if extract(isodow from day) in (1,2) and local_clock::time>='07:00' then
  insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('digest/'||day,'digest','irsyad.msk@gmail.com',private.curriculum_digest_snapshot(day)) on conflict do nothing;
 end if;
 if private.curriculum_review_day(day)<>day then return;end if;
 for r in select 'clinic' as kind,id,created_at,contact_email from private.curriculum_clinic_requests where status='pending' and institution='MA Insan Cendekia Nusantara' and year='2026/2027' union all select 'school',id,created_at,contact_email from private.curriculum_school_requests where status='pending' and institution='MA Insan Cendekia Nusantara' and year='2026/2027' loop
  if private.curriculum_review_day((r.created_at at time zone 'Asia/Jakarta')::date)<day then
   insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('overdue/'||r.kind||'/'||r.id||'/'||day,'overdue','irsyad.msk@gmail.com',jsonb_build_object('subject','[Curriculum] Antrean perlu ditinjau','text','Ajuan '||r.kind||' nomor '||r.id||' masih menunggu pemeriksaan. Tinjau sesuai urutan masuk pada hari kerja sekolah.')) on conflict do nothing;
   select requester_kind into nm from private.curriculum_request_details where kind=r.kind and request_id=r.id;
   if nm='teacher' and coalesce(r.contact_email,'')<>'' then
    insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('waiting/'||r.kind||'/'||r.id||'/'||day,'waiting',r.contact_email,jsonb_build_object('subject','[Curriculum] Ajuan masih menunggu pemeriksaan','text','Nomor ajuan: '||r.id||E'\nStatus: menunggu pemeriksaan kurikulum sesuai antrean hari kerja sekolah.\nBelum ada keputusan diterima atau ditolak.')) on conflict do nothing;
   end if;
  end if;
 end loop;
end $$;
revoke all on function public.curriculum_operations_enqueue(timestamptz) from public,anon,authenticated;grant execute on function public.curriculum_operations_enqueue(timestamptz) to service_role;
create function public.curriculum_operations_email_claim() returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 update private.curriculum_operations_outbox set state='superseded' where state in ('queued','leased') and kind='digest' and (snapshot->>'date')::date<(now() at time zone 'Asia/Jakarta')::date;
 update private.curriculum_operations_outbox o set state='superseded' where o.state in ('queued','leased') and o.kind='waiting' and (split_part(event_key,'/',2)='clinic' and exists(select 1 from private.curriculum_clinic_requests r where r.id::text=split_part(event_key,'/',3) and r.status<>'pending') or split_part(event_key,'/',2)='school' and exists(select 1 from private.curriculum_school_requests r where r.id::text=split_part(event_key,'/',3) and r.status<>'pending'));
 update private.curriculum_operations_outbox set state='needs_review' where state in ('queued','leased') and (attempts>=5 or first_attempt_at<now()-interval '23 hours');
 with jobs as(select id from private.curriculum_operations_outbox where state='queued' or state='leased' and leased_at<now()-interval '5 minutes' order by created_at limit 10 for update skip locked),claimed as(update private.curriculum_operations_outbox o set state='leased',lease=gen_random_uuid(),leased_at=now(),attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) from jobs where o.id=jobs.id returning o.id,o.lease,o.kind,o.recipient,o.snapshot) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;return result;
end $$;
revoke all on function public.curriculum_operations_email_claim() from public,anon,authenticated;grant execute on function public.curriculum_operations_email_claim() to service_role;
create function public.curriculum_operations_email_complete(p_id uuid,p_lease uuid,p_provider_id text) returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if coalesce(length(p_provider_id),0) not between 1 and 200 then raise exception 'invalid_receipt';end if;
 update private.curriculum_operations_outbox set state='provider_accepted',provider_id=p_provider_id where id=p_id and lease=p_lease and state='leased';if not found then raise exception 'stale_lease';end if;
end $$;
revoke all on function public.curriculum_operations_email_complete(uuid,uuid,text) from public,anon,authenticated;grant execute on function public.curriculum_operations_email_complete(uuid,uuid,text) to service_role;

-- Admin and assigned Curriculum staff manage Monday JP 1 here, without Studio access.
create or replace function public.curriculum_monday_write(p_institution text,p_year text,p_expected integer,p_data jsonb,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if not private.clinic_can_review(p_institution) then raise exception 'forbidden';end if;
 return public.curriculum_monday_write_internal(p_institution,p_year,p_expected,p_data,p_token);
end $$;
notify pgrst,'reload schema';
commit;

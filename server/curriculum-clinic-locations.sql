begin;
create table private.curriculum_clinic_locations(id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name)) between 1 and 100 and name !~ '[[:cntrl:]]'),active boolean not null default true,created_by uuid references auth.users(id),created_at timestamptz not null default now());
create unique index curriculum_clinic_locations_name on private.curriculum_clinic_locations(lower(btrim(name)));
alter table private.curriculum_clinic_locations enable row level security;
revoke all on private.curriculum_clinic_locations from public,anon,authenticated,service_role;
insert into private.curriculum_clinic_locations(name) values('Kelas X-1'),('Kelas X-2'),('Kelas X-3'),('Lantai 1'),('Kelas lantai 2 Gedung Maiyoma Chaidir');
alter table private.curriculum_clinic_requests drop constraint curriculum_clinic_requests_location_check;
alter table private.curriculum_request_details drop constraint curriculum_request_details_location_check;
alter table private.curriculum_clinic_requests add constraint curriculum_clinic_location_length check(location is null or length(location)<=100);
alter table private.curriculum_request_details add constraint curriculum_detail_location_length check(length(location)<=100);
create function private.curriculum_clinic_room_guard() returns trigger language plpgsql volatile security definer set search_path='' as $room_guard$
declare current_request private.curriculum_clinic_requests;room text;self uuid;canonical text;
begin
 if tg_table_name='curriculum_request_details' then
  if new.kind<>'clinic' then return new;end if;
  if tg_op='UPDATE' then if new.location is not distinct from old.location then return new;end if;end if;
  room:=new.location;self:=new.request_id;
  select * into current_request from private.curriculum_clinic_requests where id=self;
 else
  if tg_op='UPDATE' then
   if row(new.status,new.location,new.date,new.start,new."end") is not distinct from row(old.status,old.location,old.date,old.start,old."end") then return new;end if;
  end if;
  current_request:=new;self:=new.id;
  if tg_op='UPDATE' then
   if new.location is distinct from old.location then room:=new.location;
   else select location into room from private.curriculum_request_details where kind='clinic' and request_id=self;room:=coalesce(nullif(room,''),new.location,'');end if;
  else room:=coalesce(new.location,'');end if;
 end if;
 if coalesce(btrim(room),'')='' then
  if current_request.status='approved' then raise exception 'identity_or_location_required';end if;
  return new;
 end if;
 select name into canonical from private.curriculum_clinic_locations where active and lower(name)=lower(btrim(room));
 if not found then raise exception 'invalid_location';end if;
 new.location:=canonical;
 if current_request.status='approved' then
  perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||current_request.institution,0));
  if exists(select 1 from private.curriculum_clinic_requests q left join private.curriculum_request_details d on d.kind='clinic' and d.request_id=q.id where q.id<>self and q.institution=current_request.institution and q.status='approved' and q.date=current_request.date and q.start<current_request."end" and q."end">current_request.start and lower(coalesce(nullif(d.location,''),q.location,''))=lower(canonical)) then raise exception 'clinic_location_conflict';end if;
  if tg_table_name='curriculum_request_details' then
   update private.curriculum_clinic_requests set location=canonical,location_revision=coalesce(location_revision,0)+1 where id=self and location is distinct from canonical;
  end if;
 end if;
 return new;
end $room_guard$;
revoke all on function private.curriculum_clinic_room_guard() from public,anon,authenticated,service_role;
create trigger clinic_room_guard before insert or update on private.curriculum_clinic_requests for each row execute function private.curriculum_clinic_room_guard();
create trigger clinic_detail_room_guard before insert or update on private.curriculum_request_details for each row execute function private.curriculum_clinic_room_guard();
CREATE OR REPLACE FUNCTION public.curriculum_clinic_catalog(p_institution text, p_year text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare students jsonb; teachers jsonb;
begin
 if p_institution is distinct from 'MA Insan Cendekia Nusantara' or p_year is distinct from '2026/2027' then raise exception 'invalid_scope';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama,'kelas',classroom) order by classroom,nama),'[]') into students from private.curriculum_clinic_roster where institution=p_institution and year=p_year;
 select coalesce(jsonb_agg(jsonb_build_object('kode',kode,'nama',nama,'mapel',mapel) order by nama),'[]') into teachers from public.curriculum_teachers where coalesce(mapel,'')<>'';
 return jsonb_build_object('version',2,'year',p_year,'students',students,'teachers',teachers,'locations',(select coalesce(jsonb_agg(name order by created_at,name),'[]') from private.curriculum_clinic_locations where active));
end $function$;

CREATE OR REPLACE FUNCTION public.curriculum_operations_read(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') then raise exception 'forbidden';end if;
 result:=private.curriculum_digest_snapshot(p_date);
 return result||jsonb_build_object('locations',(select coalesce(jsonb_agg(name order by created_at,name),'[]') from private.curriculum_clinic_locations where active),'version',1,'details',(select coalesce(jsonb_agg(private.curriculum_details_json(d) order by d.created_at),'[]') from private.curriculum_request_details d where d.kind='clinic' or private.is_admin() or exists(select 1 from private.curriculum_school_requests r where r.id=d.request_id and r.kind='switch')),
 'clinic_review',public.curriculum_clinic_review_v2('MA Insan Cendekia Nusantara','2026/2027','review'),
 'school',public.curriculum_school_read('review',null,null,null),
 'news_all',(select coalesce(jsonb_agg(to_jsonb(a) order by updated_at desc),'[]') from private.curriculum_announcements a where institution='MA Insan Cendekia Nusantara'),
 'workdays',(select coalesce(jsonb_agg(to_jsonb(w) order by date),'[]') from private.curriculum_workdays w),
 'email',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'state',o.state,'created_at',o.created_at) order by created_at desc),'[]') from (select * from private.curriculum_operations_outbox order by created_at desc limit 50)o));
end $function$;

CREATE OR REPLACE FUNCTION public.curriculum_operations_write(p_action text, p_data jsonb, p_expected integer, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid();receipt private.curriculum_operations_receipts;result jsonb;ident uuid;intent jsonb:=jsonb_build_object('action',p_action,'data',p_data,'expected',p_expected);d private.curriculum_request_details;a private.curriculum_announcements;
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') or actor is null or p_token is null then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:MA Insan Cendekia Nusantara',0));
 select * into receipt from private.curriculum_operations_receipts where token=p_token;if found then if receipt.actor<>actor or receipt.intent<>intent then raise exception 'token_mismatch';end if;return receipt.result;end if;
 if p_action='identity' then
  select * into d from private.curriculum_request_details where kind=p_data->>'kind' and request_id=(p_data->>'id')::uuid for update;
  if not found or d.revision<>p_expected then raise exception 'stale_revision';end if;
  if d.kind='school' and not private.is_admin() and not exists(select 1 from private.curriculum_school_requests r where r.id=d.request_id and r.kind='switch') then raise exception 'forbidden';end if;
  if p_data->>'confirmed' is distinct from 'true' then raise exception 'identity_required';end if;
  update private.curriculum_request_details set identity_verified=true,verified_at=now(),verified_by=actor,location=coalesce(p_data->>'location',location),revision=revision+1 where kind=d.kind and request_id=d.request_id returning * into d;
  result:=private.curriculum_details_json(d);
 elsif p_action='location_add' then
  if not private.is_admin() then raise exception 'forbidden';end if;
  if length(btrim(coalesce(p_data->>'name',''))) not between 1 and 100 or p_data->>'name' ~ '[[:cntrl:]]' then raise exception 'invalid_location';end if;
  select id into ident from private.curriculum_clinic_locations where lower(name)=lower(btrim(p_data->>'name'));
  if not found then
   insert into private.curriculum_clinic_locations(name,created_by) values(btrim(p_data->>'name'),actor) returning id into ident;
  else update private.curriculum_clinic_locations set active=true where id=ident;end if;
  select jsonb_build_object('name',name,'locations',(select coalesce(jsonb_agg(name order by created_at,name),'[]') from private.curriculum_clinic_locations where active)) into result from private.curriculum_clinic_locations where id=ident;
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
end $function$;

CREATE OR REPLACE FUNCTION public.curriculum_clinic_read(p_institution text, p_year text, p_mode text DEFAULT 'public'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;rows jsonb;
begin
 result:=public.curriculum_clinic_read_before_experience(p_institution,p_year,p_mode);
 select coalesce(jsonb_agg(x.row||jsonb_build_object('location',coalesce(nullif(d.location,''),r.location,''),'location_revision',coalesce(r.location_revision,0),'target_mode',r.target_mode,'participant_count',cardinality(coalesce(r.approved_participant_ids,r.participant_ids)),'exception_count',jsonb_array_length(r.participant_exceptions)) order by x.ord),'[]') into rows from jsonb_array_elements(result->'rows') with ordinality x(row,ord) left join private.curriculum_request_details d on d.kind='clinic' and d.request_id=(x.row->>'id')::uuid left join private.curriculum_clinic_requests r on r.id=(x.row->>'id')::uuid;
 return result||jsonb_build_object('rows',rows);
end $function$;
notify pgrst,'reload schema';
commit;

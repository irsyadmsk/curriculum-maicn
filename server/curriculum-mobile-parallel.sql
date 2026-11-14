begin;
CREATE OR REPLACE FUNCTION public.curriculum_clinic_allocate(p_institution text, p_year text, p_action text, p_id uuid, p_expected integer, p_data jsonb, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.curriculum_clinic_requests; q private.curriculum_clinic_requests; prior private.curriculum_clinic_requests;
 e private.curriculum_clinic_events; assignments jsonb; peers jsonb; expected_peers jsonb; conflicts text[]; sid text; winner text;
 accepted text[]; removed text[]; exclusions jsonb:='[]'; intent jsonb; receipt jsonb;peer_receipt jsonb;
begin
 if not private.clinic_can_review(p_institution) then raise exception 'forbidden';end if;
 if p_action is distinct from 'approve' or p_token is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||p_institution,0));
 intent:=jsonb_build_object('allocation',true,'institution',p_institution,'year',p_year,'id',p_id,'expected',p_expected,'data',p_data);
 select * into e from private.curriculum_clinic_events where token=p_token;
 if found then if e.actor_id is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;return e.receipt;end if;
 select * into r from private.curriculum_clinic_requests where id=p_id and institution=p_institution and year=p_year for update;
 if r.id is null or r.revision is distinct from p_expected then raise exception 'stale_revision_reload';end if;
 if r.intake_version<>2 or r.status<>'pending' then raise exception 'invalid_transition';end if;
 if ((r.date+r."end") at time zone 'Asia/Jakarta')<=now() then raise exception 'archived_schedule_locked';end if;
 if length(btrim(coalesce(p_data->>'note','')))>2000 then raise exception 'decision_note_required';end if;
 if not coalesce((p_data->>'subject')=any(r.subjects),false) then raise exception 'choose_one_proposed_subject';end if;
 assignments:=p_data->'assignments';expected_peers:=p_data->'peer_revisions';
 if jsonb_typeof(assignments) is distinct from 'object' or jsonb_typeof(expected_peers) is distinct from 'object' then raise exception 'allocation_choice_required';end if;
 select coalesce(jsonb_object_agg(t.id::text,to_jsonb(t.revision)),'{}') into peers from private.curriculum_clinic_requests t
 where t.id<>r.id and t.institution=r.institution and t.status='approved' and t.date=r.date and t.start<r."end" and t."end">r.start
 and (coalesce(t.approved_participant_ids,t.participant_ids)&&r.participant_ids or exists(select 1 from jsonb_array_elements(t.participant_exceptions) ex where ex->>'student_id'=any(r.participant_ids)));
 if peers is distinct from expected_peers then raise exception 'stale_revision_peers_reload';end if;
 select coalesce(array_agg(distinct members.student_id order by members.student_id),'{}') into conflicts from private.curriculum_clinic_requests t,
 unnest(coalesce(t.approved_participant_ids,t.participant_ids)) as members(student_id) where peers ? t.id::text and members.student_id=any(r.participant_ids);
 if (select coalesce(array_agg(key order by key),'{}') from jsonb_object_keys(assignments) key) is distinct from conflicts then raise exception 'allocation_choice_required';end if;
 accepted:=r.participant_ids;
 foreach sid in array conflicts loop
  winner:=assignments->>sid;
  if winner is distinct from r.id::text and not exists(select 1 from private.curriculum_clinic_requests t where peers ? t.id::text and t.id::text=winner and sid=any(coalesce(t.approved_participant_ids,t.participant_ids))) then raise exception 'invalid_allocation';end if;
  if winner<>r.id::text then
   accepted:=array_remove(accepted,sid);
   exclusions:=exclusions||jsonb_build_array(jsonb_build_object('student_id',sid,'destination_id',winner,'reason',p_data->>'note'));
  end if;
 end loop;
 if cardinality(accepted)=0 then raise exception 'clinic_empty_selection';end if;
 -- Remove selected pupils from their previous clinic before accepting the incoming clinic.
 for q in select t.* from private.curriculum_clinic_requests t where peers ? t.id::text order by t.id for update loop
  select coalesce(array_agg(id order by id),'{}') into removed from unnest(coalesce(q.approved_participant_ids,q.participant_ids)) id where assignments->>id=r.id::text;
  prior:=q;
  -- Redirect previous exception notes as well, so A -> B -> C never leaves a stale B destination.
  select coalesce(jsonb_agg(case when assignments ? (ex->>'student_id') and ex->>'destination_id' is distinct from assignments->>(ex->>'student_id') then ex||jsonb_build_object('destination_id',assignments->>(ex->>'student_id'),'reason',p_data->>'note') else ex end),'[]') into q.participant_exceptions from jsonb_array_elements(q.participant_exceptions) ex;
  if cardinality(removed)=0 and q.participant_exceptions=prior.participant_exceptions then continue;end if;
  if exists(select 1 from private.curriculum_clinic_enrichment where request_id=q.id) then raise exception 'enrichment_finalized';end if;
  select coalesce(array_agg(id order by id),'{}') into q.approved_participant_ids from unnest(coalesce(q.approved_participant_ids,q.participant_ids)) id where not(id=any(removed));
  if cardinality(q.approved_participant_ids)=0 then raise exception 'clinic_empty_selection';end if;
  foreach sid in array removed loop
   q.participant_exceptions:=q.participant_exceptions||jsonb_build_array(jsonb_build_object('student_id',sid,'destination_id',r.id,'reason',p_data->>'note'));
  end loop;
  q.revision:=q.revision+1;q.decided_by:=auth.uid();q.decided_at:=clock_timestamp();q.updated_at:=q.decided_at;
  q.decision_note:='Penyesuaian peserta: '||btrim(p_data->>'note');
  update private.curriculum_clinic_requests set approved_participant_ids=q.approved_participant_ids,participant_exceptions=q.participant_exceptions,
   revision=q.revision,decided_by=q.decided_by,decided_at=q.decided_at,updated_at=q.updated_at,decision_note=q.decision_note where id=q.id returning * into q;
  peer_receipt:=jsonb_build_object('id',q.id,'revision',q.revision,'status',q.status,'updated_at',q.updated_at);
  insert into private.curriculum_clinic_events(request_id,actor_id,action,revision,snapshot,token,intent,receipt)
  values(q.id,auth.uid(),'allocate',q.revision,to_jsonb(q),gen_random_uuid(),intent||jsonb_build_object('source_token',p_token),peer_receipt);
 end loop;
 r.revision:=r.revision+1;r.decided_at:=clock_timestamp();
 update private.curriculum_clinic_requests set status='approved',approved_subject=p_data->>'subject',approved_participant_ids=accepted,participant_exceptions=exclusions,
  decision_note=btrim(p_data->>'note'),decided_by=auth.uid(),decided_at=r.decided_at,updated_at=r.decided_at,revision=r.revision where id=r.id returning * into r;
 receipt:=jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'updated_at',r.updated_at,'token',p_token);
 insert into private.curriculum_clinic_events(request_id,actor_id,action,revision,snapshot,token,intent,receipt)
 values(r.id,auth.uid(),'approve',r.revision,to_jsonb(r),p_token,intent,receipt);
 return receipt;
end $function$;
CREATE OR REPLACE FUNCTION public.curriculum_clinic_write(p_institution text, p_year text, p_action text, p_id uuid, p_expected integer, p_data jsonb, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.curriculum_clinic_requests; old private.curriculum_clinic_requests; reviewer boolean; picked text; uid uuid := auth.uid(); end_at timestamptz; teacher_name text; event_row private.curriculum_clinic_events; intent jsonb; receipt jsonb;
begin
  if uid is null or not private.clinic_can_teach(p_institution) then raise exception 'forbidden'; end if;
  if p_institution is distinct from 'MA Insan Cendekia Nusantara' or p_year is null or p_year !~ '^[0-9]{4}/[0-9]{4}$' or right(p_year,4)::int<>left(p_year,4)::int+1 or p_action is null or p_action not in ('submit','edit','approve','reject','cancel','report') or p_token is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'invalid_scope'; end if;
  -- All approval checks serialize across this institution, including overlapping school years.
  perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||p_institution,0));
  intent:=jsonb_build_object('institution',p_institution,'year',p_year,'action',p_action,'id',p_id,'expected',p_expected,'data',p_data);
  select * into event_row from private.curriculum_clinic_events where token=p_token;
  if found then
    if event_row.actor_id is distinct from uid or event_row.intent<>intent then raise exception 'token_mismatch'; end if;
    return event_row.receipt;
  end if;
  reviewer := private.clinic_can_review(p_institution);
  if p_action='submit' then
    -- Client-generated request id makes retries safe without duplicate submission.
    if p_id is null or p_expected is distinct from 0 then raise exception 'invalid_revision'; end if;
    select * into old from private.curriculum_clinic_requests where id=p_id;
    if found then raise exception 'already_exists_reload'; end if;
    r.id:=p_id; r.owner_id:=uid; r.institution:=p_institution; r.year:=p_year; r.revision:=1; r.created_at:=now(); r.status:='pending';r.request_kind:='teacher';r.requester_label:='';
  else
    select * into r from private.curriculum_clinic_requests where id=p_id and institution=p_institution and year=p_year for update;
    if not found or not reviewer and r.owner_id is distinct from uid and not (p_action='report' and private.clinic_assigned_teacher(r.teacher_code,r.institution)) then raise exception 'forbidden'; end if;
    if r.revision is distinct from p_expected then raise exception 'stale_revision_reload'; end if;
    old:=r; r.revision:=r.revision+1;
  end if;
  if p_action in ('approve','reject','cancel','edit') and not reviewer then
    if p_action not in ('edit','cancel') or r.owner_id is distinct from uid or r.status<>'pending' then raise exception 'forbidden'; end if;
  end if;
  if p_action in ('submit','edit') then
    if p_action='edit' and ((old.date+old."end") at time zone 'Asia/Jakarta')<=now() then raise exception 'archived_schedule_locked'; end if;
    r.date:=(p_data->>'date')::date; r.start:=(p_data->>'start')::time; r."end":=(p_data->>'end')::time; r.classroom:=p_data->>'classroom'; r.teacher_code:=p_data->>'teacher_code';
    select nama into teacher_name from public.curriculum_teachers where kode=r.teacher_code;
    if teacher_name is null then raise exception 'invalid_teacher'; end if;
    r.teacher:=teacher_name;
    if jsonb_typeof(p_data->'subjects') is distinct from 'array' or exists(select 1 from jsonb_array_elements(p_data->'subjects') x where jsonb_typeof(x)<>'string') then raise exception 'invalid_subjects'; end if;
    select array_agg(btrim(x)) into r.subjects from jsonb_array_elements_text(p_data->'subjects') x;
    if cardinality(r.subjects) not between 1 and 3 or exists(select 1 from unnest(r.subjects) x where length(x) not between 1 and 120) or (select count(distinct lower(x)) from unnest(r.subjects) x)<>cardinality(r.subjects) then raise exception 'invalid_subjects'; end if;
    r.topic:=coalesce(p_data->>'topic',''); r.evidence:=coalesce(p_data->>'evidence',''); r.status:='pending'; r.approved_subject:=null; r.decided_by:=null; r.decided_at:=null; r.decision_note:='';
  end if;
  end_at:=(r.date+r."end") at time zone 'Asia/Jakarta';
  if p_action<>'report' and end_at<=now() then raise exception 'archived_schedule_locked'; end if;
  if p_action in ('approve','reject','cancel') then
    if p_action in ('approve','reject') and r.status<>'pending' or p_action='cancel' and r.status='cancelled' then raise exception 'invalid_transition'; end if;
    r.decision_note:=btrim(coalesce(p_data->>'note',''));
    if p_action<>'approve' and length(r.decision_note)=0 then raise exception 'decision_note_required'; end if;
    r.status:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'cancelled' end;
    r.approved_subject:=null; r.decided_by:=uid; r.decided_at:=now();
    if p_action='approve' then
      picked:=p_data->>'subject'; if picked is null or not picked=any(r.subjects) then raise exception 'choose_one_proposed_subject'; end if;
      if exists(select 1 from private.curriculum_clinic_requests q where q.id<>r.id and q.institution=r.institution and q.status='approved' and
        (q.date=r.date and q.start<r."end" and q."end">r.start and ((r.intake_version=1 or q.intake_version=1) and q.classroom=r.classroom or q.teacher_code=r.teacher_code)
        or r.intake_version=1 and q.classroom=r.classroom and date_trunc('week',q.date)=date_trunc('week',r.date) and lower(q.approved_subject)=lower(picked))) then raise exception 'clinic_conflict'; end if;
      r.approved_subject:=picked;
    end if;
  end if;
  if p_action='report' then r.topic:=coalesce(p_data->>'topic',''); r.evidence:=coalesce(p_data->>'evidence',''); end if;
  if r.evidence<>'' and (r.evidence !~ '^https?://' or r.evidence ~ '[[:cntrl:]]' or r.evidence ~ '^https?://[^/]*@') then raise exception 'invalid_evidence'; end if;
  r.updated_at:=now();
  if p_action='submit' then insert into private.curriculum_clinic_requests select r.*;
  else update private.curriculum_clinic_requests set date=r.date,start=r.start,"end"=r."end",classroom=r.classroom,teacher_code=r.teacher_code,teacher=r.teacher,subjects=r.subjects,topic=r.topic,evidence=r.evidence,status=r.status,approved_subject=r.approved_subject,decision_note=r.decision_note,decided_by=r.decided_by,decided_at=r.decided_at,revision=r.revision,updated_at=r.updated_at where id=r.id; end if;
  receipt:=jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'updated_at',r.updated_at,'token',p_token);
  insert into private.curriculum_clinic_events(request_id,actor_id,action,revision,snapshot,token,intent,receipt) values(r.id,uid,p_action,r.revision,to_jsonb(r),p_token,intent,receipt);
  return receipt;
end $function$;
CREATE OR REPLACE FUNCTION public.curriculum_school_decide_internal(p_id uuid, p_expected integer, p_action text, p_data jsonb, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.curriculum_school_requests;intent jsonb;e private.curriculum_school_events;a private.curriculum_school_lessons;b private.curriculum_school_lessons;wk date;teacher_name text;teacher_subject text;
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:MA Insan Cendekia Nusantara',0));
 intent:=jsonb_build_object('id',p_id,'expected',p_expected,'action',p_action,'data',p_data);
 select * into e from private.curriculum_school_events where token=p_token;if found then if e.actor_id is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;return e.receipt;end if;
 select * into r from private.curriculum_school_requests where id=p_id for update;if r.id is null or r.revision is distinct from p_expected then raise exception 'stale_revision';end if;
 if p_action not in ('approve','reject','cancel') or p_action in ('approve','reject') and r.status<>'pending' or p_action='cancel' and r.status='cancelled' then raise exception 'invalid_transition';end if;
 if (p_action<>'approve' and length(btrim(coalesce(p_data->>'note','')))=0) or length(btrim(coalesce(p_data->>'note','')))>2000 then raise exception 'decision_note_required';end if;
 if p_action='approve' then
  if r.kind='switch' then
   wk:=(r.body->>'week')::date;select * into a from private.curriculum_school_lessons where id=r.body->>'from_id';select * into b from private.curriculum_school_lessons where id=r.body->>'to_id';
   if a.classroom<>b.classroom or a.jp<>b.jp or a.source_hash is distinct from r.body->'from'->>'source_hash' or b.source_hash is distinct from r.body->'to'->>'source_hash' then raise exception 'source_changed';end if;
   if ((wk+a.day-1+a."end") at time zone 'Asia/Jakarta')<=now() or ((wk+b.day-1+b."end") at time zone 'Asia/Jakarta')<=now() then raise exception 'archived_schedule_locked';end if;
   if exists(select 1 from private.curriculum_school_switch_slots where institution=r.institution and year=r.year and week=wk and lesson_id in (a.id,b.id)) then raise exception 'switch_slot_used';end if;
   if exists(select 1 from private.school_effective_lessons(r.institution,r.year,wk) q where q.id not in (a.id,b.id) and (q.date=wk+a.day-1 and q.start<a."end" and q."end">a.start and q.teacher_code=b.teacher_code or q.date=wk+b.day-1 and q.start<b."end" and q."end">b.start and q.teacher_code=a.teacher_code)) then raise exception 'teacher_conflict';end if;
   insert into private.curriculum_school_switch_slots values(r.institution,r.year,wk,a.id,r.id),(r.institution,r.year,wk,b.id,r.id);
  elsif r.kind='collaboration' then
   if not exists(select 1 from private.curriculum_school_requests q where q.id=r.parent_id and q.kind='project' and q.status='approved') then raise exception 'invalid_project';end if;
   if exists(select 1 from private.curriculum_school_requests q where q.parent_id=r.parent_id and q.status='approved' and q.subject=r.subject) then raise exception 'collaboration_exists';end if;
  elsif r.kind='remedial' then
   if r.teacher_code is null then r.teacher_code:=p_data->>'teacher_code';select nama,mapel into r.teacher,r.subject from public.curriculum_teachers where kode=r.teacher_code and mapel=r.subject;end if;
   if r.teacher_code is null or r.teacher is null then raise exception 'assign_teacher';end if;
   if exists(select 1 from private.curriculum_clinic_requests q where q.status='approved' and q.date=r.date and q.start<r."end" and q."end">r.start and (q.teacher_code=r.teacher_code or coalesce(q.approved_participant_ids,q.participant_ids)&&r.student_ids)) or exists(select 1 from private.curriculum_school_requests q where q.id<>r.id and q.kind='remedial' and q.status='approved' and q.date=r.date and q.start<r."end" and q."end">r.start and (q.teacher_code=r.teacher_code or q.student_ids&&r.student_ids)) or exists(select 1 from private.school_effective_lessons(r.institution,r.year,date_trunc('week',r.date)::date) q where q.date=r.date and q.start<r."end" and q."end">r.start and q.teacher_code=r.teacher_code) then raise exception 'schedule_conflict';end if;
  end if;
  if r.kind<>'switch' and coalesce((r.body->>'end_date')::date,r.date)<(now() at time zone 'Asia/Jakarta')::date then raise exception 'archived_schedule_locked';end if;
 end if;
 if p_action='cancel' and r.kind='project' and exists(select 1 from private.curriculum_school_requests where parent_id=r.id and status='approved') then raise exception 'active_collaborations';end if;
 if p_action='cancel' and r.kind='switch' then delete from private.curriculum_school_switch_slots where request_id=r.id;end if;
 r.status:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'cancelled' end;r.decision_note:=btrim(p_data->>'note');r.decided_by:=auth.uid();r.decided_at:=now();r.updated_at:=now();r.revision:=r.revision+1;
 update private.curriculum_school_requests set status=r.status,teacher_code=r.teacher_code,teacher=r.teacher,subject=r.subject,decision_note=r.decision_note,decided_by=r.decided_by,decided_at=r.decided_at,updated_at=r.updated_at,revision=r.revision where id=r.id;
 e.receipt:=jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'token',p_token);
 insert into private.curriculum_school_events(token,request_id,actor_id,action,revision,intent,snapshot,receipt) values(p_token,r.id,auth.uid(),p_action,r.revision,intent,to_jsonb(r),e.receipt);return e.receipt;
end $function$;
notify pgrst,'reload schema';
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

begin;
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
    if p_action='cancel' and length(r.decision_note)=0 then raise exception 'decision_note_required'; end if;
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
 if (p_action='cancel' and length(btrim(coalesce(p_data->>'note','')))=0) or length(btrim(coalesce(p_data->>'note','')))>2000 then raise exception 'decision_note_required';end if;
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
commit;

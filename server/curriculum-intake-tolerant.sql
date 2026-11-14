begin;
CREATE OR REPLACE FUNCTION private.clinic_v2_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; assigned text; canonical text[];
begin
 new.intake_version:=coalesce(new.intake_version,1);new.contact_email:=coalesce(new.contact_email,'');
 new.scope_classrooms:=coalesce(new.scope_classrooms,'{}');new.participant_exceptions:=coalesce(new.participant_exceptions,'[]');
 if new.intake_version<>2 then
  if tg_op='INSERT' or new.status='approved' and old.status<>'approved' then raise exception 'invalid_participants';end if;
  return new;
 end if;
 if extract(second from new.start)<>0 or extract(second from new."end")<>0 then raise exception 'invalid_time';end if;
 if new.status in ('pending','approved') and (tg_op='INSERT' or old.intake_version=1 or new.status is distinct from old.status or new.date is distinct from old.date or new.start is distinct from old.start or new."end" is distinct from old."end")
 and ((new.date+new."end") at time zone 'Asia/Jakarta')<=now() then raise exception 'archived_schedule_locked';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||new.institution,0));
 if tg_op='UPDATE' and old.status='approved' and new.status<>'approved' and exists(
  select 1 from private.curriculum_clinic_enrichment e join private.curriculum_clinic_requests q on q.id=e.request_id
  join private.curriculum_clinic_roster s on s.institution=old.institution and s.year=old.year and s.id=any(coalesce(old.approved_participant_ids,old.participant_ids))
  where q.id<>old.id and q.institution=old.institution and q.date=old.date and q.start<old."end" and q."end">old.start and s.classroom=any(q.scope_classrooms)
 ) then raise exception 'enrichment_finalized';end if;
 if tg_op='UPDATE' and old.status='approved' and
 row(new.date,new.start,new."end",new.status,new.teacher_code,new.subjects) is distinct from row(old.date,old.start,old."end",old.status,old.teacher_code,old.subjects)
 and exists(select 1 from private.curriculum_clinic_requests q,jsonb_array_elements(q.participant_exceptions) x where q.institution=new.institution and q.status='approved' and x->>'destination_id'=new.id::text)
 then raise exception 'clinic_allocation_locked';end if;
 if tg_op='UPDATE' and exists(select 1 from private.curriculum_clinic_enrichment where request_id=new.id) then
  if row(new.date,new.start,new."end",new.classroom,new.participant_ids,new.approved_participant_ids,new.teacher_code,new.subjects,new.status)
     is distinct from row(old.date,old.start,old."end",old.classroom,old.participant_ids,old.approved_participant_ids,old.teacher_code,old.subjects,old.status)
  then raise exception 'enrichment_finalized';end if;
 end if;
 if new.target_mode is null or new.target_mode not in ('class','students') or coalesce(cardinality(new.participant_ids),0)=0
 or exists(select 1 from unnest(new.participant_ids) id where id is null)
 or (select count(distinct id) from unnest(new.participant_ids) id)<>cardinality(new.participant_ids) then raise exception 'invalid_participants';end if;
 if new.target_mode='students' then new.classroom:=null;end if;
 if new.target_mode='class' and new.classroom is null then raise exception 'invalid_participants';end if;
 select count(*) into n from private.curriculum_clinic_roster s where s.institution=new.institution and s.year=new.year and (new.target_mode='students' or s.classroom=new.classroom) and s.id=any(new.participant_ids);
 if n<>cardinality(new.participant_ids) then raise exception 'invalid_participants';end if;
 if new.target_mode='class' then
  select array_agg(id order by id) into canonical from private.curriculum_clinic_roster where institution=new.institution and year=new.year and classroom=new.classroom;
  if canonical is distinct from (select array_agg(id order by id) from unnest(new.participant_ids) id) then raise exception 'invalid_participants';end if;
 end if;
 select coalesce(array_agg(distinct s.classroom order by s.classroom) filter(where s.classroom is not null),'{}') into new.scope_classrooms from private.curriculum_clinic_roster s where s.institution=new.institution and s.year=new.year and s.id=any(new.participant_ids);
 if new.status='pending' then new.approved_participant_ids:=null;new.participant_exceptions:='[]';end if;
 if new.status='approved' then
  new.approved_participant_ids:=coalesce(new.approved_participant_ids,new.participant_ids);
  if cardinality(new.approved_participant_ids)=0 or not(new.approved_participant_ids <@ new.participant_ids)
   or (select count(distinct id) from unnest(new.approved_participant_ids) id)<>cardinality(new.approved_participant_ids) then raise exception 'clinic_empty_selection';end if;
  if exists(select 1 from private.curriculum_clinic_enrichment e join private.curriculum_clinic_requests q on q.id=e.request_id where q.institution=new.institution and q.date=new.date and q.start<new."end" and q."end">new.start and e.participant_ids && new.approved_participant_ids) then raise exception 'enrichment_finalized';end if;
 end if;
 if cardinality(new.subjects)<>1 then raise exception 'invalid_subjects';end if;
 if new.status='approved' and not exists(select 1 from public.curriculum_teachers where kode=new.teacher_code and mapel=new.subjects[1]) then raise exception 'invalid_subjects';end if;
 if new.request_kind='teacher' then
  select mapel into assigned from public.curriculum_teachers where kode=new.teacher_code;
  if assigned is null or new.subjects[1]<>assigned then raise exception 'invalid_subjects';end if;
  if length(new.contact_email)>254 or new.contact_email<>'' and new.contact_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
   or new.evidence<>'' and new.evidence !~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]{10,200}/(view|preview)$' then raise exception 'invalid_teacher_contact';end if;
 else
  new.contact_email:='';new.evidence:='';
  if not exists(select 1 from public.curriculum_teachers where mapel=new.subjects[1]) then raise exception 'invalid_subjects';end if;
 end if;
 -- Pending duplicates are allowed, including pupils already allocated elsewhere.
 if new.status='approved' and exists(
  select 1 from private.curriculum_clinic_requests q where q.id<>new.id and q.institution=new.institution and q.status='approved'
  and q.date=new.date and q.start<new."end" and q."end">new.start
  and (coalesce(q.approved_participant_ids,q.participant_ids) && new.approved_participant_ids or q.intake_version=1 and (q.classroom=new.classroom or q.classroom=any(new.scope_classrooms)))
 ) then raise exception 'clinic_participant_conflict';end if;
 if new.status='approved' and exists(
  select 1 from private.curriculum_clinic_requests q where q.id<>new.id and q.institution=new.institution and q.status='approved'
  and q.date=new.date and q.start<new."end" and q."end">new.start and q.teacher_code=new.teacher_code
 ) then raise exception 'clinic_conflict';end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.curriculum_attach_identity(p_kind text, p_id uuid, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare who text:=p_data->>'requester_kind';ident text:=p_data->>'requester_id';nm text;cls text;pic bytea;mime text;existing private.curriculum_request_details;loc text:=coalesce(p_data->>'location','');
begin
 if who='student' then
  select nama,classroom into nm,cls from private.curriculum_clinic_roster where id=ident and institution='MA Insan Cendekia Nusantara' and year='2026/2027';
  if nm is null or cls is null or cls is distinct from p_data->>'requester_class' then raise exception 'invalid_requester';end if;
  if coalesce(p_data->>'identity_photo','')<>'' then
  if coalesce(length(p_data->>'identity_photo'),0)>240000 then raise exception 'invalid_photo';end if;
  begin pic:=decode(p_data->>'identity_photo','base64');exception when others then raise exception 'invalid_photo';end;
  mime:=p_data->>'photo_mime';
  if pic is null or octet_length(pic)<20 or octet_length(pic)>180000 or mime is null or mime not in ('image/jpeg','image/png','image/webp') then raise exception 'invalid_photo';end if;
  if mime='image/jpeg' and substring(encode(pic,'hex') from 1 for 6)<>'ffd8ff' or mime='image/png' and substring(encode(pic,'hex') from 1 for 16)<>'89504e470d0a1a0a' or mime='image/webp' and (substring(encode(pic,'hex') from 1 for 8)<>'52494646' or substring(encode(pic,'hex') from 17 for 8)<>'57454250') then raise exception 'invalid_photo';end if;
  end if;
 elsif who='teacher' then
  select nama into nm from public.curriculum_teachers where kode=ident;
  if nm is null then raise exception 'invalid_requester';end if;
 else raise exception 'invalid_requester';end if;
 select * into existing from private.curriculum_request_details where kind=p_kind and request_id=p_id;
 if found then
  if existing.requester_kind<>who or existing.requester_id<>ident or existing.photo_hash is distinct from md5(pic) then raise exception 'token_mismatch';end if;return;
 end if;
 insert into private.curriculum_request_details(kind,request_id,requester_kind,requester_id,requester_name,requester_class,location,photo,photo_hash,photo_mime) values(p_kind,p_id,who,ident,nm,cls,loc,pic,md5(pic),mime);
 -- No photos or email addresses are included in administrative notification content.
 insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('new/'||p_kind||'/'||p_id,'new','irsyad.msk@gmail.com',jsonb_build_object('subject','[Curriculum] Ajuan baru dari '||nm,'text','Ajuan '||p_kind||' dari '||nm||coalesce(' ('||cls||')','')||E' masuk.\nPeriksa identitas, bukti, jadwal, dan penempatan di ruang Curriculum.\nNomor ajuan: '||p_id)) on conflict do nothing;
 if who='teacher' and coalesce(p_data->>'contact_email','') ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
  insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('receipt/'||p_kind||'/'||p_id,'receipt',p_data->>'contact_email',jsonb_build_object('subject','[Curriculum] Ajuan diterima sistem','text','Nomor ajuan: '||p_id||E'\nStatus: menunggu pemeriksaan kurikulum sesuai antrean hari kerja sekolah.')) on conflict do nothing;
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.curriculum_clinic_intake(p_institution text, p_year text, p_id uuid, p_token uuid, p_fingerprint text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;clean jsonb:=p_data-array['identity_photo','photo_mime'];
begin
 if nullif(p_data->>'requester_kind','') is null and p_data->>'request_kind'='teacher' then
  p_data:=p_data||jsonb_build_object('requester_kind','teacher','requester_id',p_data->>'teacher_code');
 end if;
 clean:=p_data-array['identity_photo','photo_mime'];
 if p_data->>'requester_kind'='student' and p_data->>'request_kind'<>'guest' or p_data->>'requester_kind'='teacher' and (p_data->>'request_kind'<>'teacher' or p_data->>'requester_id' is distinct from p_data->>'teacher_code') then raise exception 'invalid_requester';end if;
 clean:=clean||jsonb_build_object('identity_fingerprint',md5(coalesce(p_data->>'identity_photo','')));
 result:=public.curriculum_clinic_intake_before_experience(p_institution,p_year,p_id,p_token,p_fingerprint,clean);
 perform private.curriculum_attach_identity('clinic',p_id,p_data);
 if p_data->>'requester_kind'='teacher' and coalesce(p_data->>'contact_email','') ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
  insert into private.curriculum_operations_outbox(event_key,kind,recipient,snapshot) values('receipt/clinic/'||p_id,'receipt',p_data->>'contact_email',jsonb_build_object('subject','[Curriculum] Ajuan klinik diterima sistem','text','Nomor ajuan: '||p_id||E'\nStatus: menunggu pemeriksaan kurikulum.\nPemeriksaan berdasarkan antrean pada hari kerja sekolah.')) on conflict do nothing;
 end if;return result;
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

CREATE OR REPLACE FUNCTION private.clinic_queue_decision_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.contact_email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' and new.intake_version=2 and new.request_kind='teacher' and new.status in ('approved','rejected') and
 (old.status is distinct from new.status or new.status='approved' and (new.approved_participant_ids is distinct from old.approved_participant_ids or new.participant_exceptions is distinct from old.participant_exceptions)) then
  insert into private.curriculum_clinic_email_outbox(request_id,revision,snapshot)
  values(new.id,new.revision,private.clinic_email_snapshot(new)||jsonb_build_object('allocation_update',old.status='approved')) on conflict do nothing;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.school_insert(p_actor uuid, p_kind text, p_id uuid, p_data jsonb, p_token uuid, p_fingerprint text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.curriculum_school_requests;a private.curriculum_school_lessons;b private.curriculum_school_lessons;parent private.curriculum_school_requests;intent jsonb;e private.curriculum_school_events;code text;linked text;n integer;week_date date;
begin
 if p_id is null or p_token is null or p_kind not in ('switch','project','collaboration','remedial','absence') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:MA Insan Cendekia Nusantara',0));
 intent:=jsonb_build_object('kind',p_kind,'actor',p_actor,'id',p_id,'data',p_data,'fingerprint',p_fingerprint);
 select * into e from private.curriculum_school_events where token=p_token;if found then if e.intent is distinct from intent then raise exception 'token_mismatch';end if;return e.receipt;end if;
 r.id:=p_id;r.institution:='MA Insan Cendekia Nusantara';r.year:='2026/2027';r.kind:=p_kind;r.owner_id:=p_actor;r.title:=btrim(p_data->>'title');r.date:=(p_data->>'date')::date;r.start:=(p_data->>'start')::time;r."end":=(p_data->>'end')::time;r.tp:=btrim(coalesce(p_data->>'tp',''));r.reason:=btrim(coalesce(p_data->>'reason',''));r.evidence:=coalesce(p_data->>'evidence','');r.contact_email:=btrim(coalesce(p_data->>'contact_email',''));r.body:=coalesce(p_data->'body','{}');r.parent_id:=nullif(r.body->>'parent_id','')::uuid;r.classroom:=nullif(p_data->>'classroom','');r.student_ids:='{}';r.status:='pending';r.revision:=1;r.decision_note:='';r.created_at:=now();r.updated_at:=now();
 if r.date<(now() at time zone 'Asia/Jakarta')::date or r.start is null or r."end" is null or r.start>=r."end" then raise exception 'invalid_date_time';end if;
 if p_actor is not null and not private.school_ready(p_actor) then raise exception 'forbidden';end if;
 code:=private.school_teacher(p_actor,r.institution);
 r.teacher_code:=coalesce(code,nullif(p_data->>'teacher_code',''));select nama,mapel into r.teacher,r.subject from public.curriculum_teachers where kode=r.teacher_code;r.teacher:=coalesce(r.teacher,'');r.subject:=coalesce(r.subject,'');
 if p_kind='remedial' and code is null and not private.school_student(p_actor) and not private.clinic_can_review(r.institution) then raise exception 'login_required';end if;
 if jsonb_typeof(p_data->'student_ids')='array' then select coalesce(array_agg(value order by value),'{}') into r.student_ids from jsonb_array_elements_text(p_data->'student_ids');end if;
 if p_kind='remedial' and private.school_student(p_actor) then
  select student_id into linked from private.curriculum_school_students where user_id=p_actor and institution=r.institution and year=r.year;
  if linked is null then raise exception 'student_link_required';end if;r.student_ids:=array[linked];r.teacher_code:=null;r.teacher:='';r.subject:=p_data->>'subject';
  if not exists(select 1 from public.curriculum_teachers where mapel=r.subject) then raise exception 'invalid_subject';end if;
 end if;
 if p_kind in ('absence','remedial') then
  if cardinality(r.student_ids)=0 or (select count(distinct id) from unnest(r.student_ids) id)<>cardinality(r.student_ids) or exists(select 1 from unnest(r.student_ids) id where not exists(select 1 from private.curriculum_clinic_roster s where s.id=id and s.institution=r.institution and s.year=r.year)) then raise exception 'invalid_participants';end if;
 end if;
 if p_kind in ('switch','project','collaboration') and r.teacher_code is null then raise exception 'invalid_teacher';end if;
 if r.contact_email<>'' and r.contact_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then raise exception 'teacher_contact_required';end if;
 if r.evidence<>'' and r.evidence !~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]{10,200}/(view|preview)$' then raise exception 'invalid_evidence';end if;
 if p_kind in ('project','collaboration') and length(r.tp)=0 then raise exception 'tp_required';end if;
 if p_kind='project' then r.body:=r.body||jsonb_build_object('end_date',coalesce(nullif(r.body->>'end_date',''),'')::text);if r.body->>'end_date'='' then r.body:=r.body||jsonb_build_object('end_date',r.date);end if;end if;
 if p_kind='project' and ((r.body->>'end_date')::date<r.date or (r.body->>'end_date')::date>make_date(right(r.year,4)::int,6,30)) then raise exception 'invalid_date_time';end if;
 if p_kind='collaboration' then
  select * into parent from private.curriculum_school_requests where id=r.parent_id and institution=r.institution and year=r.year and kind='project' and status='approved';
  if parent.id is null or parent.subject=r.subject then raise exception 'invalid_project';end if;r.date:=parent.date;r.start:=parent.start;r."end":=parent."end";
 end if;
 if p_kind='switch' then
  week_date:=(r.body->>'week')::date;select * into a from private.curriculum_school_lessons where id=r.body->>'from_id' and institution=r.institution and year=r.year;select * into b from private.curriculum_school_lessons where id=r.body->>'to_id' and institution=r.institution and year=r.year;
  if week_date is null or extract(isodow from week_date)<>1 or a.id is null or b.id is null or a.id=b.id or a.classroom<>b.classroom or a.jp<>b.jp or a.teacher_code=b.teacher_code or a.teacher_code<>r.teacher_code then raise exception 'invalid_switch';end if;
  if not(week_date+a.day-1 between make_date(left(r.year,4)::int,7,1) and make_date(right(r.year,4)::int,6,30)) or not(week_date+b.day-1 between make_date(left(r.year,4)::int,7,1) and make_date(right(r.year,4)::int,6,30)) then raise exception 'invalid_switch';end if;
  r.classroom:=a.classroom;r.date:=week_date+a.day-1;r.start:=a.start;r."end":=a."end";r.body:=jsonb_build_object('week',week_date,'from_id',a.id,'to_id',b.id,'from_date',week_date+a.day-1,'to_date',week_date+b.day-1,'from',to_jsonb(a)||jsonb_build_object('start',to_char(a.start,'HH24:MI'),'end',to_char(a."end",'HH24:MI')),'to',to_jsonb(b)||jsonb_build_object('start',to_char(b.start,'HH24:MI'),'end',to_char(b."end",'HH24:MI')));
 end if;
 if p_actor is null then
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'verification_required';end if;
  insert into private.curriculum_school_guest_limits values(p_fingerprint,(now() at time zone 'Asia/Jakarta')::date,1) on conflict(fingerprint,day) do update set requests=curriculum_school_guest_limits.requests+1 returning requests into n;if n>30 then raise exception 'request_limit';end if;
 end if;
 insert into private.curriculum_school_requests select r.*;
 e.receipt:=jsonb_build_object('id',r.id,'revision',1,'status','pending','token',p_token);
 insert into private.curriculum_school_events(token,request_id,actor_id,action,revision,intent,snapshot,receipt) values(p_token,r.id,p_actor,'submit',1,intent,to_jsonb(r),e.receipt);return e.receipt;
end $function$;
notify pgrst,'reload schema';
commit;

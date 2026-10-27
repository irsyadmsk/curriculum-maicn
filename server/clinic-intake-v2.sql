-- LOCAL CANDIDATE. Apply only with a reviewed private roster seed and explicit release authorization.
-- Requires the existing 20261026130151_curriculum_clinic_access.sql.
begin;
create table private.curriculum_clinic_roster (
 institution text not null, year text not null, id text not null, nama text not null,
 classroom text check(classroom in ('X-1','X-2','X-3')), source_hash text not null,
 primary key(institution,year,id)
);
alter table private.curriculum_clinic_roster enable row level security;
revoke all on private.curriculum_clinic_roster from public,anon,authenticated;
alter table private.curriculum_clinic_requests
 add column intake_version integer not null default 1,
 add column target_mode text check(target_mode in ('class','students')),
 add column participant_ids text[],
 add column approved_participant_ids text[],
 add column participant_exceptions jsonb not null default '[]',
 add column scope_classrooms text[] not null default '{}',
 add column contact_email text not null default '';
alter table private.curriculum_clinic_requests alter column classroom drop not null;
do $$
declare name text;n integer:=0;
begin
 for name in select conname from pg_constraint where conrelid='private.curriculum_clinic_requests'::regclass and contype='c' and lower(pg_get_constraintdef(oid)) like '%isodow%' loop
  execute format('alter table private.curriculum_clinic_requests drop constraint %I',name);n:=n+1;
 end loop;
 if n<>1 then raise exception 'clinic_session_constraint_changed_review_required';end if;
end $$;
alter table private.curriculum_clinic_requests add constraint clinic_intake_version check(intake_version in (1,2)),
 add constraint clinic_intake_session check(
 (intake_version=1 and ((extract(isodow from date)=1 and start='20:30' and "end"='21:30') or (extract(isodow from date)=2 and start='16:15' and "end"='17:00')))
 or (intake_version=2 and start<"end" and ((extract(isodow from date)=1 and start>='20:30' and "end"<='21:30') or (extract(isodow from date)=2 and start>='16:15' and "end"<='17:00'))));
create table private.curriculum_clinic_enrichment (
 request_id uuid primary key references private.curriculum_clinic_requests(id),
 request_revision integer not null, participant_ids text[] not null,
 finalized_by uuid not null references auth.users(id),finalized_at timestamptz not null default now()
);
alter table private.curriculum_clinic_enrichment enable row level security;
revoke all on private.curriculum_clinic_enrichment from public,anon,authenticated;
create table private.curriculum_clinic_email_outbox (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references private.curriculum_clinic_requests(id),
 revision integer not null,snapshot jsonb not null,created_at timestamptz not null default now(),
 state text not null default 'queued' check(state in ('queued','leased','provider_accepted','needs_review','superseded')),
 lease uuid,leased_at timestamptz,first_attempt_at timestamptz,attempts integer not null default 0,provider_id text,
 unique(request_id,revision)
);
alter table private.curriculum_clinic_email_outbox enable row level security;
revoke all on private.curriculum_clinic_email_outbox from public,anon,authenticated;
create index clinic_email_pending on private.curriculum_clinic_email_outbox(created_at) where state in ('queued','leased');
create index clinic_participant_ids on private.curriculum_clinic_requests using gin(participant_ids) where intake_version=2 and status in ('pending','approved');

create function private.clinic_public_classrooms(r private.curriculum_clinic_requests) returns text[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(distinct s.classroom order by s.classroom) filter(where s.classroom is not null),'{}')
 from private.curriculum_clinic_roster s where s.institution=r.institution and s.year=r.year and s.id=any(coalesce(r.approved_participant_ids,r.participant_ids));
$$;
revoke all on function private.clinic_public_classrooms(private.curriculum_clinic_requests) from public,anon,authenticated;

-- Retain legacy full-class conflict rules. V2 groups in one class may run in parallel
-- when participants and teachers differ; the trigger above protects participant overlap.
do $$
declare definition text; old_clause text:='q.classroom=r.classroom or q.teacher_code=r.teacher_code'; old_week text:='or q.classroom=r.classroom and date_trunc(''week'',q.date)=date_trunc(''week'',r.date) and lower(q.approved_subject)=lower(picked)';
begin
 select pg_get_functiondef('public.curriculum_clinic_write(text,text,text,uuid,integer,jsonb,uuid)'::regprocedure) into definition;
 if strpos(definition,old_clause)=0 or strpos(definition,old_week)=0 then raise exception 'clinic_writer_source_changed_review_required';end if;
 definition:=replace(definition,old_clause,'(r.intake_version=1 or q.intake_version=1) and q.classroom=r.classroom or q.teacher_code=r.teacher_code');
 definition:=replace(definition,old_week,'or r.intake_version=1 and q.classroom=r.classroom and date_trunc(''week'',q.date)=date_trunc(''week'',r.date) and lower(q.approved_subject)=lower(picked)');
 execute definition;
 select pg_get_functiondef('public.curriculum_clinic_read(text,text,text)'::regprocedure) into definition;
 if strpos(definition,'''classroom'',r.classroom')=0 then raise exception 'clinic_reader_source_changed_review_required';end if;
 execute replace(definition,'''classroom'',r.classroom','''classroom'',r.classroom,''classrooms'',private.clinic_public_classrooms(r),''intake_version'',r.intake_version');
end $$;

create function private.clinic_v2_guard() returns trigger
language plpgsql security definer set search_path='' as $$
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
  if length(new.contact_email)>254 or new.contact_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
   or new.evidence !~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]{10,200}/(view|preview)$' then raise exception 'invalid_teacher_contact';end if;
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
end $$;
revoke all on function private.clinic_v2_guard() from public,anon,authenticated;
create trigger clinic_v2_guard before insert or update on private.curriculum_clinic_requests for each row execute function private.clinic_v2_guard();

create function public.curriculum_clinic_catalog(p_institution text,p_year text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare students jsonb; teachers jsonb;
begin
 if p_institution is distinct from 'MA Insan Cendekia Nusantara' or p_year is distinct from '2026/2027' then raise exception 'invalid_scope';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama,'kelas',classroom) order by classroom,nama),'[]') into students from private.curriculum_clinic_roster where institution=p_institution and year=p_year;
 select coalesce(jsonb_agg(jsonb_build_object('kode',kode,'nama',nama,'mapel',mapel) order by nama),'[]') into teachers from public.curriculum_teachers where coalesce(mapel,'')<>'';
 return jsonb_build_object('version',2,'year',p_year,'students',students,'teachers',teachers);
end $$;
revoke all on function public.curriculum_clinic_catalog(text,text) from public,anon,authenticated;
grant execute on function public.curriculum_clinic_catalog(text,text) to service_role;

create function public.curriculum_clinic_intake(p_institution text,p_year text,p_id uuid,p_token uuid,p_fingerprint text,p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare receipt jsonb; e private.curriculum_clinic_events; participants text[]; tc text; sub text;teacher_name text:='';r private.curriculum_clinic_requests;n integer;
begin
 if p_institution is distinct from 'MA Insan Cendekia Nusantara' or p_year is distinct from '2026/2027' or p_id is null or p_token is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||p_institution,0));
 select * into e from private.curriculum_clinic_events where token=p_token;
 if found then
  if e.intent is distinct from jsonb_build_object('v',2,'institution',p_institution,'year',p_year,'id',p_id,'fingerprint',p_fingerprint,'data',p_data) then raise exception 'token_mismatch';end if;
  return e.receipt;
 end if;
 if p_data->>'request_kind' is null or p_data->>'request_kind' not in ('teacher','guest') or p_data->>'target_mode' is null or p_data->>'target_mode' not in ('class','students') then raise exception 'invalid_participants';end if;
 if p_data->>'target_mode'='class' then
  select array_agg(id order by id) into participants from private.curriculum_clinic_roster where institution=p_institution and year=p_year and classroom=p_data->>'classroom';
 else
  if jsonb_typeof(p_data->'participant_ids') is distinct from 'array' or exists(select 1 from jsonb_array_elements(p_data->'participant_ids') x where jsonb_typeof(x)<>'string') then raise exception 'invalid_participants';end if;
  select array_agg(value order by value) into participants from jsonb_array_elements_text(p_data->'participant_ids');
 end if;
 tc:=case when p_data->>'request_kind'='teacher' then p_data->>'teacher_code' else null end;
 if tc is not null then
  select mapel,nama into sub,teacher_name from public.curriculum_teachers where kode=tc;
  if sub is null then raise exception 'invalid_subjects';end if;
 else
  if jsonb_typeof(p_data->'subjects') is distinct from 'array' or jsonb_array_length(p_data->'subjects')<>1 then raise exception 'invalid_subjects';end if;
  sub:=p_data->'subjects'->>0;
 end if;
 insert into private.curriculum_clinic_guest_limits values(p_fingerprint,(now() at time zone 'Asia/Jakarta')::date,1)
 on conflict(fingerprint,day) do update set requests=curriculum_clinic_guest_limits.requests+1 returning requests into n;
 if n>5 then raise exception 'request_limit';end if;
 insert into private.curriculum_clinic_requests(id,institution,year,date,start,"end",classroom,teacher_code,teacher,subjects,topic,evidence,request_kind,intake_version,target_mode,participant_ids,contact_email)
 values(p_id,p_institution,p_year,(p_data->>'date')::date,(p_data->>'start')::time,(p_data->>'end')::time,case when p_data->>'target_mode'='class' then p_data->>'classroom' else null end,tc,coalesce(teacher_name,''),array[sub],coalesce(p_data->>'topic',''),
 case when p_data->>'request_kind'='teacher' then coalesce(p_data->>'evidence','') else '' end,p_data->>'request_kind',2,p_data->>'target_mode',participants,btrim(coalesce(p_data->>'contact_email',''))) returning * into r;
 receipt:=jsonb_build_object('id',r.id,'status','pending','revision',1,'token',p_token);
 insert into private.curriculum_clinic_events(request_id,actor_id,action,revision,snapshot,token,intent,receipt) values(p_id,null,'submit',1,to_jsonb(r),p_token,
 jsonb_build_object('v',2,'institution',p_institution,'year',p_year,'id',p_id,'fingerprint',p_fingerprint,'data',p_data),receipt);
 return receipt;
end $$;
revoke all on function public.curriculum_clinic_intake(text,text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.curriculum_clinic_intake(text,text,uuid,uuid,text,jsonb) to service_role;

create function public.curriculum_clinic_review_v2(p_institution text,p_year text,p_mode text default 'review') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.clinic_can_review(p_institution) or p_mode<>'review' then raise exception 'forbidden';end if;
 return public.curriculum_clinic_read(p_institution,p_year,'review')||jsonb_build_object('roster',(public.curriculum_clinic_catalog(p_institution,p_year))->'students',
 'enrichment',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from private.curriculum_clinic_enrichment e join private.curriculum_clinic_requests r on r.id=e.request_id where r.institution=p_institution and r.year=p_year),
 'email_outbox',(select coalesce(jsonb_agg(jsonb_build_object('request_id',o.request_id,'revision',o.revision,'state',o.state)),'[]') from private.curriculum_clinic_email_outbox o join private.curriculum_clinic_requests r on r.id=o.request_id where r.institution=p_institution and r.year=p_year));
end $$;
revoke all on function public.curriculum_clinic_review_v2(text,text,text) from public,anon;
grant execute on function public.curriculum_clinic_review_v2(text,text,text) to authenticated;

create function public.curriculum_clinic_write_v2(p_institution text,p_year text,p_action text,p_id uuid,p_expected integer,p_data jsonb,p_token uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare receipt jsonb; r private.curriculum_clinic_requests;
begin
 if not private.clinic_can_review(p_institution) then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||p_institution,0));
 select * into r from private.curriculum_clinic_requests where id=p_id and institution=p_institution and year=p_year;
 if r.id is null then raise exception 'forbidden';end if;
 -- Delegate retries first: original writer verifies actor, token, intent and revision.
 if exists(select 1 from private.curriculum_clinic_events where token=p_token) then
  return public.curriculum_clinic_write(p_institution,p_year,p_action,p_id,p_expected,p_data,p_token);
 end if;
 if r.revision is distinct from p_expected then raise exception 'stale_revision_reload';end if;
 if p_action='edit' and r.intake_version=2 then
  -- Class and participants are immutable here; select a new proposal to change audience.
  if p_data->>'classroom' is distinct from r.classroom or p_data->'participant_ids' is not null and p_data->'participant_ids' is distinct from to_jsonb(r.participant_ids) then raise exception 'invalid_participants';end if;
 end if;
 receipt:=public.curriculum_clinic_write(p_institution,p_year,p_action,p_id,p_expected,p_data,p_token);
 return receipt;
end $$;
revoke all on function public.curriculum_clinic_write_v2(text,text,text,uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.curriculum_clinic_write_v2(text,text,text,uuid,integer,jsonb,uuid) to authenticated;

create function public.curriculum_clinic_enrichment(p_institution text,p_year text,p_id uuid,p_expected integer,p_action text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r private.curriculum_clinic_requests; ids text[];
begin
 if not private.clinic_can_review(p_institution) then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||p_institution,0));
 select * into r from private.curriculum_clinic_requests where id=p_id and institution=p_institution and year=p_year for update;
 if r.id is null or r.revision is distinct from p_expected then raise exception 'stale_revision_reload';end if;
 if p_action='reopen' then delete from private.curriculum_clinic_enrichment where request_id=p_id;return jsonb_build_object('id',p_id,'finalized',false);end if;
 if p_action is distinct from 'finalize' or r.status<>'approved' or r.intake_version<>2 then raise exception 'invalid_transition';end if;
 select coalesce(array_agg(s.id order by s.id),'{}') into ids from private.curriculum_clinic_roster s where s.institution=p_institution and s.year=p_year and s.classroom=any(r.scope_classrooms)
 and not(s.id=any(coalesce(r.approved_participant_ids,r.participant_ids)))
 and not exists(select 1 from private.curriculum_clinic_requests q where q.id<>r.id and q.institution=r.institution and q.status='approved' and q.date=r.date and q.start<r."end" and q."end">r.start and s.id=any(coalesce(q.approved_participant_ids,q.participant_ids)));
 insert into private.curriculum_clinic_enrichment(request_id,request_revision,participant_ids,finalized_by) values(p_id,r.revision,ids,auth.uid()) on conflict(request_id) do nothing;
 return jsonb_build_object('id',p_id,'finalized',true,'participant_ids',ids);
end $$;
revoke all on function public.curriculum_clinic_enrichment(text,text,uuid,integer,text) from public,anon;
grant execute on function public.curriculum_clinic_enrichment(text,text,uuid,integer,text) to authenticated;

create function private.clinic_queue_decision_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.intake_version=2 and new.request_kind='teacher' and new.status in ('approved','rejected') and old.status is distinct from new.status then
  insert into private.curriculum_clinic_email_outbox(request_id,revision,snapshot) values(new.id,new.revision,to_jsonb(new)||jsonb_build_object('start',to_char(new.start,'HH24:MI'),'end',to_char(new."end",'HH24:MI'))) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.clinic_queue_decision_email() from public,anon,authenticated;
create trigger clinic_queue_decision_email after update on private.curriculum_clinic_requests for each row execute function private.clinic_queue_decision_email();

create function public.curriculum_clinic_email_claim() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 update private.curriculum_clinic_email_outbox o set state='superseded'
 from private.curriculum_clinic_requests r where r.id=o.request_id and o.state in ('queued','leased')
 and (r.status is distinct from o.snapshot->>'status' or r.decided_at is distinct from (o.snapshot->>'decided_at')::timestamptz);
 update private.curriculum_clinic_email_outbox set state='needs_review' where state in ('queued','leased') and (attempts>=5 or first_attempt_at<now()-interval '23 hours');
 with jobs as(select id from private.curriculum_clinic_email_outbox where state='queued' or state='leased' and leased_at<now()-interval '5 minutes' order by created_at limit 10 for update skip locked),
 claimed as(update private.curriculum_clinic_email_outbox o set state='leased',lease=gen_random_uuid(),leased_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 from jobs where o.id=jobs.id returning o.id,o.lease,o.snapshot)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;
 return result;
end $$;
create function public.curriculum_clinic_email_complete(p_id uuid,p_lease uuid,p_provider_id text) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if p_provider_id is null or length(p_provider_id) not between 1 and 200 then raise exception 'invalid_receipt';end if;
 update private.curriculum_clinic_email_outbox set state='provider_accepted',provider_id=p_provider_id where id=p_id and lease=p_lease and state='leased';
 if not found then raise exception 'stale_lease';end if;
end $$;
revoke all on function public.curriculum_clinic_email_claim(),public.curriculum_clinic_email_complete(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.curriculum_clinic_email_claim(),public.curriculum_clinic_email_complete(uuid,uuid,text) to service_role;
commit;

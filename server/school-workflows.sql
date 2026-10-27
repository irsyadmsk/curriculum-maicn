-- LOCAL CANDIDATE after Clinic v2/allocation. No automatic production execution.
begin;
create table private.curriculum_school_lessons(id text primary key,institution text not null,year text not null,day integer not null check(day between 1 and 5),classroom text not null check(classroom in ('X-1','X-2','X-3')),start time not null,"end" time not null,jp integer not null check(jp>0),teacher_code text not null references public.curriculum_teachers(kode),teacher text not null,subject text not null,source_hash text not null,check(start<"end"));
create table private.curriculum_school_duties(institution text not null,year text not null,day integer not null check(day between 1 and 5),teacher_code text not null references public.curriculum_teachers(kode),primary key(institution,year,day,teacher_code));
create table private.curriculum_school_students(institution text not null,year text not null,user_id uuid not null references auth.users(id),student_id text not null,revision integer not null default 1,primary key(institution,year,user_id),unique(institution,year,student_id),foreign key(institution,year,student_id) references private.curriculum_clinic_roster(institution,year,id));
create table private.curriculum_school_class_roles(id uuid primary key,institution text not null,year text not null,classroom text not null check(classroom in ('X-1','X-2','X-3')),role text not null check(role in ('homeroom','leader')),user_id uuid not null references auth.users(id),date_from date not null,date_to date not null,active boolean not null default true,revision integer not null default 1,check(date_from<=date_to));
create table private.curriculum_school_requests(id uuid primary key,institution text not null,year text not null,kind text not null check(kind in ('switch','project','collaboration','remedial','absence')),owner_id uuid references auth.users(id),teacher_code text references public.curriculum_teachers(kode),teacher text not null default '',subject text not null default '',student_ids text[] not null default '{}',classroom text,date date not null,start time not null,"end" time not null,title text not null check(length(title) between 1 and 200),tp text not null default '' check(length(tp)<=4000),reason text not null default '' check(length(reason)<=4000),evidence text not null default '' check(length(evidence)<=1000),contact_email text not null default '' check(length(contact_email)<=254),body jsonb not null default '{}',parent_id uuid references private.curriculum_school_requests(id),status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),revision integer not null default 1,decision_note text not null default '' check(length(decision_note)<=2000),decided_by uuid references auth.users(id),decided_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(start<"end"),check(date>=make_date(left(year,4)::integer,7,1) and date<=make_date(right(year,4)::integer,6,30)));
create index school_requests_scope on private.curriculum_school_requests(institution,year,status,date);
create index school_requests_parent on private.curriculum_school_requests(parent_id) where status='approved';
create table private.curriculum_school_switch_slots(institution text not null,year text not null,week date not null,lesson_id text not null references private.curriculum_school_lessons(id),request_id uuid not null references private.curriculum_school_requests(id),primary key(institution,year,week,lesson_id));
create table private.curriculum_school_events(token uuid primary key,request_id uuid not null,actor_id uuid,action text not null,revision integer not null,intent jsonb not null,snapshot jsonb not null,receipt jsonb not null,created_at timestamptz not null default now(),unique(request_id,revision));
create table private.curriculum_school_journals(id uuid primary key,institution text not null,year text not null,kind text not null check(kind in ('duty','class')),date date not null,classroom text not null default '',content jsonb not null,author_id uuid not null references auth.users(id),updated_by uuid not null references auth.users(id),revision integer not null default 1,updated_at timestamptz not null default now(),unique(institution,year,kind,date,classroom),check(kind='duty' and classroom='' or kind='class' and classroom in ('X-1','X-2','X-3')));
create table private.curriculum_school_journal_events(token uuid primary key,journal_id uuid not null references private.curriculum_school_journals(id),actor_id uuid not null,intent jsonb not null,snapshot jsonb not null,created_at timestamptz not null default now());
create table private.curriculum_school_guest_limits(fingerprint text not null,day date not null,requests integer not null,primary key(fingerprint,day));
do $$ declare t text;begin foreach t in array array['curriculum_school_lessons','curriculum_school_duties','curriculum_school_students','curriculum_school_class_roles','curriculum_school_requests','curriculum_school_switch_slots','curriculum_school_events','curriculum_school_journals','curriculum_school_journal_events','curriculum_school_guest_limits'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);end loop;end $$;

create function private.school_teacher(p_user uuid,p_institution text) returns text language sql stable security definer set search_path='' as $$select a.teacher_code from private.curriculum_teacher_access a join public.user_accounts u on u.user_id=a.user_id where a.user_id=p_user and a.institution=p_institution and a.active and u.status='active' and not u.must_change_password$$;
create function private.school_ready(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.user_accounts where user_id=p_user and status='active' and not must_change_password)$$;
create function private.school_student(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select private.school_ready(p_user) and exists(select 1 from public.user_roles where user_id=p_user and role_id='student')$$;
revoke all on function private.school_teacher(uuid,text),private.school_ready(uuid),private.school_student(uuid) from public,anon,authenticated;

create function public.curriculum_school_context(p_institution text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare role_name text;code text;name text;student text;class_name text;
begin
 if p_institution is distinct from 'MA Insan Cendekia Nusantara' then raise exception 'invalid_scope';end if;
 code:=private.school_teacher(auth.uid(),p_institution);select nama into name from public.curriculum_teachers where kode=code;
 role_name:=case when auth.uid() is null then 'guest' when not private.school_ready(auth.uid()) then 'member' when private.is_admin() then 'admin' when private.clinic_can_review(p_institution) then 'curriculum' when code is not null then 'teacher' when private.school_student(auth.uid()) then 'student' else 'member' end;
 select s.student_id,r.classroom into student,class_name from private.curriculum_school_students s join private.curriculum_clinic_roster r on r.institution=s.institution and r.year=s.year and r.id=s.student_id where s.user_id=auth.uid() and s.institution=p_institution and s.year='2026/2027';
 return jsonb_build_object('version',1,'institution',p_institution,'role',role_name,'user_id',auth.uid(),'teacher_code',code,'teacher',coalesce(name,''),'student_id',student,'classroom',class_name);
end $$;
revoke all on function public.curriculum_school_context(text) from public;grant execute on function public.curriculum_school_context(text) to anon,authenticated;

create function private.school_effective_lessons(p_institution text,p_year text,p_week date) returns table(id text,date date,classroom text,start time,"end" time,jp integer,teacher_code text,teacher text,subject text) language sql stable security definer set search_path='' as $$
 select l.id,p_week+l.day-1,l.classroom,l.start,l."end",l.jp,coalesce(other.teacher_code,l.teacher_code),coalesce(other.teacher,l.teacher),coalesce(other.subject,l.subject)
 from private.curriculum_school_lessons l left join private.curriculum_school_switch_slots ss on ss.lesson_id=l.id and ss.week=p_week and ss.institution=p_institution and ss.year=p_year
 left join private.curriculum_school_requests r on r.id=ss.request_id and r.status='approved'
 left join private.curriculum_school_lessons other on other.id=case when r.body->>'from_id'=l.id then r.body->>'to_id' else r.body->>'from_id' end
 where l.institution=p_institution and l.year=p_year;
$$;
revoke all on function private.school_effective_lessons(text,text,date) from public,anon,authenticated;

create function private.school_insert(p_actor uuid,p_kind text,p_id uuid,p_data jsonb,p_token uuid,p_fingerprint text default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
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
 if code is null and not private.clinic_can_review(r.institution) and p_kind in ('switch','project','collaboration') and (r.contact_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' or r.evidence !~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]{10,200}/(view|preview)$') then raise exception 'teacher_contact_required';end if;
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
end $$;
revoke all on function private.school_insert(uuid,text,uuid,jsonb,uuid,text) from public,anon,authenticated;
create function public.curriculum_school_guest(p_kind text,p_id uuid,p_data jsonb,p_token uuid,p_fingerprint text) returns jsonb language sql volatile security definer set search_path='' as $$select private.school_insert(null,p_kind,p_id,p_data,p_token,p_fingerprint)$$;
revoke all on function public.curriculum_school_guest(text,uuid,jsonb,uuid,text) from public,anon,authenticated;grant execute on function public.curriculum_school_guest(text,uuid,jsonb,uuid,text) to service_role;
create function public.curriculum_school_submit(p_kind text,p_id uuid,p_data jsonb,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$begin if not private.school_ready(auth.uid()) then raise exception 'forbidden';end if;return private.school_insert(auth.uid(),p_kind,p_id,p_data,p_token);end $$;
revoke all on function public.curriculum_school_submit(text,uuid,jsonb,uuid) from public,anon;grant execute on function public.curriculum_school_submit(text,uuid,jsonb,uuid) to authenticated;

create function public.curriculum_school_decide(p_id uuid,p_expected integer,p_action text,p_data jsonb,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r private.curriculum_school_requests;intent jsonb;e private.curriculum_school_events;a private.curriculum_school_lessons;b private.curriculum_school_lessons;wk date;teacher_name text;teacher_subject text;
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:MA Insan Cendekia Nusantara',0));
 intent:=jsonb_build_object('id',p_id,'expected',p_expected,'action',p_action,'data',p_data);
 select * into e from private.curriculum_school_events where token=p_token;if found then if e.actor_id is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;return e.receipt;end if;
 select * into r from private.curriculum_school_requests where id=p_id for update;if r.id is null or r.revision is distinct from p_expected then raise exception 'stale_revision';end if;
 if p_action not in ('approve','reject','cancel') or p_action in ('approve','reject') and r.status<>'pending' or p_action='cancel' and r.status='cancelled' then raise exception 'invalid_transition';end if;
 if length(btrim(coalesce(p_data->>'note',''))) not between 1 and 2000 then raise exception 'decision_note_required';end if;
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
end $$;
revoke all on function public.curriculum_school_decide(uuid,integer,text,jsonb,uuid) from public,anon;grant execute on function public.curriculum_school_decide(uuid,integer,text,jsonb,uuid) to authenticated;

create function public.curriculum_school_read(p_mode text default 'public',p_date date default null,p_from date default null,p_to date default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;day_date date:=coalesce(p_date,(now() at time zone 'Asia/Jakarta')::date);reviewer boolean:=private.clinic_can_review('MA Insan Cendekia Nusantara');linked text;n integer;
begin
 if p_mode not in ('public','mine','review') then raise exception 'invalid_scope';end if;
 if p_mode='review' and not reviewer or p_mode='mine' and not private.school_ready(auth.uid()) then raise exception 'forbidden';end if;
 select student_id into linked from private.curriculum_school_students where user_id=auth.uid() and institution='MA Insan Cendekia Nusantara' and year='2026/2027';
 select count(*) into n from private.curriculum_school_requests r where (p_mode='review' or p_mode='mine' and (r.owner_id=auth.uid() or linked=any(r.student_ids)) or p_mode='public' and r.status='approved' and (r.kind='switch' and (r.body->>'week')::date=date_trunc('week',day_date)::date or (r.kind='absence' and r.date=day_date or r.kind='remedial' and r.date between day_date and day_date+30) or r.kind='project' and coalesce((r.body->>'end_date')::date,r.date)>=day_date)) and (p_from is null or r.date>=p_from) and (p_to is null or r.date<=p_to);
 if n>5000 then raise exception 'scope_too_large';end if;
 select coalesce(jsonb_agg(case when p_mode='public' then jsonb_build_object('id',r.id,'kind',r.kind,'date',r.date,'start',to_char(r.start,'HH24:MI'),'end',to_char(r."end",'HH24:MI'),'title',case when r.kind='absence' then 'Dispensasi / izin KBM' when r.kind='remedial' then 'Remedial '||r.subject when r.kind='switch' then 'Perubahan jadwal sementara' else r.title end,'teacher',r.teacher,'subject',r.subject,'classroom',r.classroom,'status',r.status,'revision',r.revision,
 'body',case when r.kind='switch' then r.body when r.kind='project' then jsonb_build_object('end_date',r.body->>'end_date') else '{}' end,
 'students',case when r.kind='absence' then (select coalesce(jsonb_agg(jsonb_build_object('nama',s.nama,'kelas',s.classroom) order by s.nama),'[]') from private.curriculum_clinic_roster s where s.institution=r.institution and s.year=r.year and s.id=any(r.student_ids)) else '[]' end,
 'collaborators',case when r.kind='project' then (select coalesce(jsonb_agg(jsonb_build_object('subject',c.subject,'teacher',c.teacher) order by c.subject),'[]') from private.curriculum_school_requests c where c.parent_id=r.id and c.status='approved') else '[]' end)
 else to_jsonb(r)||jsonb_build_object('start',to_char(r.start,'HH24:MI'),'end',to_char(r."end",'HH24:MI')) end order by r.date desc,r.created_at),'[]') into rows from private.curriculum_school_requests r where (p_mode='review' or p_mode='mine' and (r.owner_id=auth.uid() or linked=any(r.student_ids)) or p_mode='public' and r.status='approved' and (r.kind='switch' and (r.body->>'week')::date=date_trunc('week',day_date)::date or (r.kind='absence' and r.date=day_date or r.kind='remedial' and r.date between day_date and day_date+30) or r.kind='project' and coalesce((r.body->>'end_date')::date,r.date)>=day_date)) and (p_from is null or r.date>=p_from) and (p_to is null or r.date<=p_to);
 return jsonb_build_object('version',1,'date',day_date,'rows',rows,'count',n,'can_review',reviewer and p_mode<>'public','read_at',now(),
 'context',case when p_mode='public' then null else public.curriculum_school_context('MA Insan Cendekia Nusantara') end,
 'teachers',case when p_mode='public' then '[]' else (select coalesce(jsonb_agg(jsonb_build_object('kode',kode,'nama',nama,'mapel',mapel) order by nama),'[]') from public.curriculum_teachers) end,
 'students',case when p_mode='public' then '[]' else (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama,'kelas',classroom) order by nama),'[]') from private.curriculum_clinic_roster where institution='MA Insan Cendekia Nusantara' and year='2026/2027') end,
 'duties',(select coalesce(jsonb_agg(jsonb_build_object('kode',t.kode,'nama',t.nama,'mapel',t.mapel) order by t.nama),'[]') from private.curriculum_school_duties d join public.curriculum_teachers t on t.kode=d.teacher_code where d.institution='MA Insan Cendekia Nusantara' and d.year='2026/2027' and d.day=extract(isodow from day_date)));
end $$;
revoke all on function public.curriculum_school_read(text,date,date,date) from public;grant execute on function public.curriculum_school_read(text,date,date,date) to anon,authenticated;

create function public.curriculum_school_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select public.curriculum_clinic_catalog('MA Insan Cendekia Nusantara','2026/2027')||jsonb_build_object('lessons',(select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('start',to_char(l.start,'HH24:MI'),'end',to_char(l."end",'HH24:MI')) order by day,start,classroom),'[]') from private.curriculum_school_lessons l where institution='MA Insan Cendekia Nusantara' and year='2026/2027'),
 'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'subject',r.subject,'date',r.date,'start',to_char(r.start,'HH24:MI'),'end',to_char(r."end",'HH24:MI'),'end_date',r.body->>'end_date')),'[]') from private.curriculum_school_requests r where r.kind='project' and r.status='approved' and coalesce((r.body->>'end_date')::date,r.date)>=(now() at time zone 'Asia/Jakarta')::date));
$$;
revoke all on function public.curriculum_school_catalog() from public,anon,authenticated;grant execute on function public.curriculum_school_catalog() to service_role;

create function private.school_can_journal(p_kind text,p_date date,p_classroom text) returns boolean language sql stable security definer set search_path='' as $$
 select private.school_ready(auth.uid()) and p_date<=(now() at time zone 'Asia/Jakarta')::date and p_date between date '2026-07-01' and date '2027-06-30' and
 (p_kind='duty' and (private.is_admin() or exists(select 1 from private.curriculum_school_duties where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and day=extract(isodow from p_date) and teacher_code=private.school_teacher(auth.uid(),'MA Insan Cendekia Nusantara')))
 or p_kind='class' and exists(select 1 from private.curriculum_school_class_roles where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and classroom=p_classroom and user_id=auth.uid() and active and p_date between date_from and date_to and (role='homeroom' and private.school_teacher(auth.uid(),'MA Insan Cendekia Nusantara') is not null or role='leader' and private.school_student(auth.uid()))));
$$;
revoke all on function private.school_can_journal(text,date,text) from public,anon,authenticated;
create function public.curriculum_school_journal_read(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;n integer;
begin
 if not private.school_ready(auth.uid()) or p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'forbidden';end if;
 select count(*) into n from private.curriculum_school_journals j where date between p_from and p_to and (private.clinic_can_review(j.institution) or private.school_can_journal(j.kind,j.date,j.classroom));if n>5000 then raise exception 'scope_too_large';end if;
 select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('author',(select full_name from public.profiles where id=j.author_id)) order by date desc,kind,classroom),'[]') into rows from private.curriculum_school_journals j where date between p_from and p_to and (private.clinic_can_review(j.institution) or private.school_can_journal(j.kind,j.date,j.classroom));
 return jsonb_build_object('version',1,'rows',rows,'count',n,'read_at',now(),'context',public.curriculum_school_context('MA Insan Cendekia Nusantara'),
 'roles',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from private.curriculum_school_class_roles c where active and (c.user_id=auth.uid() or private.is_admin())),
 'duty_days',(select coalesce(jsonb_agg(day),'[]') from private.curriculum_school_duties where teacher_code=private.school_teacher(auth.uid(),'MA Insan Cendekia Nusantara')));
end $$;
revoke all on function public.curriculum_school_journal_read(date,date) from public,anon;grant execute on function public.curriculum_school_journal_read(date,date) to authenticated;
create function public.curriculum_school_journal_write(p_id uuid,p_expected integer,p_kind text,p_date date,p_classroom text,p_content jsonb,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j private.curriculum_school_journals;e private.curriculum_school_journal_events;intent jsonb;class_name text:=case when p_kind='duty' then '' else p_classroom end;
begin
 if not private.school_can_journal(p_kind,p_date,class_name) then raise exception 'forbidden';end if;
 if jsonb_typeof(p_content) is distinct from 'object' or length(p_content::text)>16000 or length(btrim(coalesce(p_content->>'activities','')))=0 or length(btrim(coalesce(p_content->>'follow_up','')))=0 then raise exception 'journal_incomplete';end if;
 perform pg_advisory_xact_lock(hashtextextended('school-journal:'||p_kind||p_date||class_name,0));
 intent:=jsonb_build_object('id',p_id,'expected',p_expected,'kind',p_kind,'date',p_date,'classroom',class_name,'content',p_content);
 select * into e from private.curriculum_school_journal_events where token=p_token;if found then if e.actor_id is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;return jsonb_build_object('id',e.journal_id,'revision',(e.snapshot->>'revision')::integer,'token',p_token);end if;
 select * into j from private.curriculum_school_journals where institution='MA Insan Cendekia Nusantara' and year='2026/2027' and kind=p_kind and date=p_date and classroom=class_name for update;
 if j.id is null then
  if p_expected is distinct from 0 then raise exception 'stale_revision';end if;
  insert into private.curriculum_school_journals(id,institution,year,kind,date,classroom,content,author_id,updated_by) values(p_id,'MA Insan Cendekia Nusantara','2026/2027',p_kind,p_date,class_name,p_content,auth.uid(),auth.uid()) returning * into j;
 else
  if j.id<>p_id or j.revision is distinct from p_expected then raise exception 'stale_revision';end if;
  update private.curriculum_school_journals set content=p_content,updated_by=auth.uid(),revision=revision+1,updated_at=now() where id=j.id returning * into j;
 end if;
 insert into private.curriculum_school_journal_events values(p_token,j.id,auth.uid(),intent,to_jsonb(j),now());return jsonb_build_object('id',j.id,'revision',j.revision,'token',p_token);
end $$;
revoke all on function public.curriculum_school_journal_write(uuid,integer,text,date,text,jsonb,uuid) from public,anon;grant execute on function public.curriculum_school_journal_write(uuid,integer,text,date,text,jsonb,uuid) to authenticated;

create function public.curriculum_school_settings() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.clinic_account_ready() or not private.is_admin() then raise exception 'forbidden';end if;
 return jsonb_build_object('accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',u.user_id,'name',coalesce(p.full_name,u.login_email),'email',u.login_email,'teacher_code',a.teacher_code,'student',exists(select 1 from public.user_roles where user_id=u.user_id and role_id='student')) order by p.full_name),'[]') from public.user_accounts u left join public.profiles p on p.id=u.user_id left join private.curriculum_teacher_access a on a.user_id=u.user_id and a.institution='MA Insan Cendekia Nusantara' and a.active where u.status='active' and (a.user_id is not null or exists(select 1 from public.user_roles where user_id=u.user_id and role_id='student'))),
 'students',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama,'kelas',classroom)),'[]') from private.curriculum_clinic_roster where institution='MA Insan Cendekia Nusantara' and year='2026/2027'),'bindings',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from private.curriculum_school_students s),'roles',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from private.curriculum_school_class_roles c));
end $$;
revoke all on function public.curriculum_school_settings() from public,anon;grant execute on function public.curriculum_school_settings() to authenticated;
create function public.curriculum_school_assign(p_id uuid,p_expected integer,p_kind text,p_data jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c private.curriculum_school_class_roles;u uuid:=(p_data->>'user_id')::uuid;student text:=p_data->>'student_id';n integer;
begin
 if not private.clinic_account_ready() or not private.is_admin() then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('school-roles',0));
 if p_kind='binding' then
  if not private.school_student(u) or not exists(select 1 from private.curriculum_clinic_roster where id=student and institution='MA Insan Cendekia Nusantara' and year='2026/2027') then raise exception 'invalid_assignment';end if;
  select revision into n from private.curriculum_school_students where user_id=u and institution='MA Insan Cendekia Nusantara' and year='2026/2027';if coalesce(n,0) is distinct from p_expected then raise exception 'stale_revision';end if;
  if n is not null and exists(select 1 from private.curriculum_school_class_roles where user_id=u and role='leader' and active) then raise exception 'active_class_role';end if;
  insert into private.curriculum_school_students values('MA Insan Cendekia Nusantara','2026/2027',u,student,1) on conflict(institution,year,user_id) do update set student_id=excluded.student_id,revision=curriculum_school_students.revision+1 returning revision into n;return jsonb_build_object('id',u,'revision',n);
 end if;
 if p_kind is null or p_kind not in ('leader','homeroom') then raise exception 'invalid_assignment';end if;
 if coalesce((p_data->>'active')::boolean,true) and (not private.school_ready(u) or p_kind='homeroom' and private.school_teacher(u,'MA Insan Cendekia Nusantara') is null or p_kind='leader' and not exists(select 1 from private.curriculum_school_students s join private.curriculum_clinic_roster r on r.id=s.student_id and r.institution=s.institution and r.year=s.year where s.user_id=u and r.classroom=p_data->>'classroom')) then raise exception 'invalid_assignment';end if;
 select * into c from private.curriculum_school_class_roles where id=p_id;
 if c.id is not null and (c.role<>p_kind or c.classroom is distinct from p_data->>'classroom') then raise exception 'invalid_assignment';end if;
 if coalesce(c.revision,0) is distinct from p_expected then raise exception 'stale_revision';end if;
 if exists(select 1 from private.curriculum_school_class_roles where id<>p_id and active and role=p_kind and classroom=p_data->>'classroom' and daterange(date_from,date_to,'[]') && daterange((p_data->>'date_from')::date,(p_data->>'date_to')::date,'[]')) then raise exception 'assignment_overlap';end if;
 insert into private.curriculum_school_class_roles values(p_id,'MA Insan Cendekia Nusantara','2026/2027',p_data->>'classroom',p_kind,u,(p_data->>'date_from')::date,(p_data->>'date_to')::date,coalesce((p_data->>'active')::boolean,true),1) on conflict(id) do update set user_id=excluded.user_id,date_from=excluded.date_from,date_to=excluded.date_to,active=excluded.active,revision=curriculum_school_class_roles.revision+1 returning * into c;
 return jsonb_build_object('id',c.id,'revision',c.revision);
end $$;
revoke all on function public.curriculum_school_assign(uuid,integer,text,jsonb) from public,anon;grant execute on function public.curriculum_school_assign(uuid,integer,text,jsonb) to authenticated;
commit;

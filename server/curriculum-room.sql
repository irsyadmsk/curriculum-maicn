-- KANDIDAT LOKAL, 14 November 2026. Tidak dijalankan otomatis ke produksi.
-- Ruang guru dan ruang admin Curriculum: catatan harian guru, supervisi akademik
-- format AKG (empat kompetensi guru), dan ringkasan analisis admin.
-- Prasyarat: school-workflows.sql (private.school_ready, private.school_teacher,
-- private.curriculum_admin) sudah terpasang. Hanya menambah objek baru; tidak
-- mengubah tabel, fungsi, atau data yang sudah ada.
begin;

create table private.curriculum_teacher_notes(
 id uuid primary key,
 institution text not null,
 year text not null,
 date date not null,
 teacher_code text not null references public.curriculum_teachers(kode),
 teacher text not null,
 subject text not null default '',
 content jsonb not null,
 author_id uuid not null references auth.users(id),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(institution,year,date,teacher_code),
 check(date between date '2026-07-01' and date '2027-06-30'));
create table private.curriculum_teacher_note_events(
 token uuid primary key,
 note_id uuid not null references private.curriculum_teacher_notes(id),
 actor_id uuid not null,
 intent jsonb not null,
 snapshot jsonb not null,
 created_at timestamptz not null default now());

create table private.curriculum_supervisions(
 id uuid primary key,
 institution text not null,
 year text not null,
 teacher_code text not null references public.curriculum_teachers(kode),
 teacher text not null,
 subject text not null default '',
 classroom text not null default '' check(classroom in ('','X-1','X-2','X-3')),
 date date not null check(date between date '2026-07-01' and date '2027-06-30'),
 start time,
 focus text not null default '' check(length(focus)<=500),
 supervisor text not null check(length(supervisor) between 1 and 200),
 status text not null default 'planned' check(status in ('planned','done','cancelled')),
 instrument text not null default 'akg-1',
 scores jsonb not null default '{}',
 notes jsonb not null default '{}',
 score numeric(5,2) check(score between 0 and 100),
 acknowledged_at timestamptz,
 acknowledged_note text not null default '' check(length(acknowledged_note)<=1000),
 revision integer not null default 1,
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status<>'done' or score is not null));
create index curriculum_supervisions_teacher on private.curriculum_supervisions(institution,year,teacher_code,date);
create table private.curriculum_supervision_events(
 token uuid primary key,
 supervision_id uuid not null references private.curriculum_supervisions(id),
 actor_id uuid not null,
 intent jsonb not null,
 receipt jsonb not null,
 created_at timestamptz not null default now());

alter table private.curriculum_teacher_notes enable row level security;
alter table private.curriculum_teacher_note_events enable row level security;
alter table private.curriculum_supervisions enable row level security;
alter table private.curriculum_supervision_events enable row level security;
revoke all on private.curriculum_teacher_notes,private.curriculum_teacher_note_events,private.curriculum_supervisions,private.curriculum_supervision_events from public,anon,authenticated;

-- Butir instrumen AKG versi 1. Harus sama dengan AKG_ITEMS pada assets/room-core.mjs.
create function private.curriculum_akg_items() returns text[] language sql immutable set search_path='' as $$
 select array['p1','p2','p3','p4','p5','p6','k1','k2','k3','k4','s1','s2','s3','f1','f2','f3','f4','f5']
$$;
revoke all on function private.curriculum_akg_items() from public,anon,authenticated;

create function public.curriculum_teacher_note_read(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare school constant text:='MA Insan Cendekia Nusantara';admin boolean;code text;rows jsonb;n integer;
begin
 if auth.uid() is null or not private.school_ready(auth.uid()) then raise exception 'forbidden';end if;
 admin:=private.curriculum_admin();code:=private.school_teacher(auth.uid(),school);
 if not admin and code is null then raise exception 'forbidden';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'room_scope';end if;
 select count(*),coalesce(jsonb_agg(jsonb_build_object('id',t.id,'date',t.date,'teacher_code',t.teacher_code,'teacher',t.teacher,'subject',t.subject,'content',t.content,'revision',t.revision,'updated_at',t.updated_at) order by t.date desc,t.teacher),'[]')
  into n,rows from private.curriculum_teacher_notes t
  where t.institution=school and t.year='2026/2027' and t.date between p_from and p_to and (admin or t.teacher_code=code);
 if n>5000 then raise exception 'room_scope';end if;
 return jsonb_build_object('version',1,'from',p_from,'to',p_to,'rows',rows,'count',n,'read_at',now(),
  'context',jsonb_build_object('user_id',auth.uid(),'teacher_code',code,'admin',admin),
  'teachers',case when admin then (select coalesce(jsonb_agg(jsonb_build_object('kode',kode,'nama',nama,'mapel',mapel) order by nama),'[]') from public.curriculum_teachers) else '[]'::jsonb end);
end $$;

create function public.curriculum_teacher_note_write(p_id uuid,p_expected integer,p_date date,p_content jsonb,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare school constant text:='MA Insan Cendekia Nusantara';code text;today date:=(now() at time zone 'Asia/Jakarta')::date;
 t private.curriculum_teacher_notes;e private.curriculum_teacher_note_events;intent jsonb;name text;mapel_name text;
begin
 if auth.uid() is null or not private.school_ready(auth.uid()) then raise exception 'forbidden';end if;
 code:=private.school_teacher(auth.uid(),school);if code is null then raise exception 'forbidden';end if;
 if p_id is null or p_token is null or p_date is null or p_date>today or p_date<today-14 or p_date not between date '2026-07-01' and date '2027-06-30' then raise exception 'note_window';end if;
 if jsonb_typeof(p_content) is distinct from 'object' or length(p_content::text)>8000
  or length(btrim(coalesce(p_content->>'activities','')))=0 or length(btrim(coalesce(p_content->>'follow_up','')))=0 then raise exception 'journal_incomplete';end if;
 perform pg_advisory_xact_lock(hashtextextended('teacher-note:'||code||p_date,0));
 intent:=jsonb_build_object('id',p_id,'expected',p_expected,'date',p_date,'content',p_content);
 select * into e from private.curriculum_teacher_note_events where token=p_token;
 if found then
  if e.actor_id is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;
  return jsonb_build_object('id',e.note_id,'revision',(e.snapshot->>'revision')::integer,'token',p_token);
 end if;
 select nama,mapel into name,mapel_name from public.curriculum_teachers where kode=code;
 select * into t from private.curriculum_teacher_notes where institution=school and year='2026/2027' and date=p_date and teacher_code=code for update;
 if t.id is null then
  if p_expected is distinct from 0 then raise exception 'stale_revision';end if;
  insert into private.curriculum_teacher_notes(id,institution,year,date,teacher_code,teacher,subject,content,author_id)
   values(p_id,school,'2026/2027',p_date,code,coalesce(name,''),coalesce(mapel_name,''),p_content,auth.uid()) returning * into t;
 else
  if t.id<>p_id or t.revision is distinct from p_expected then raise exception 'stale_revision';end if;
  update private.curriculum_teacher_notes set content=p_content,revision=revision+1,updated_at=now() where id=t.id returning * into t;
 end if;
 insert into private.curriculum_teacher_note_events values(p_token,t.id,auth.uid(),intent,to_jsonb(t),now());
 return jsonb_build_object('id',t.id,'revision',t.revision,'token',p_token);
end $$;

create function public.curriculum_supervision_read(p_mode text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare school constant text:='MA Insan Cendekia Nusantara';admin boolean;code text;rows jsonb;n integer;
begin
 if auth.uid() is null or not private.school_ready(auth.uid()) then raise exception 'forbidden';end if;
 admin:=private.curriculum_admin();code:=private.school_teacher(auth.uid(),school);
 if p_mode='admin' and not admin or p_mode='mine' and code is null or p_mode not in ('admin','mine') then raise exception 'forbidden';end if;
 select count(*),coalesce(jsonb_agg((to_jsonb(s)-array['institution','year','created_by','updated_by'])||jsonb_build_object('start',to_char(s.start,'HH24:MI')) order by s.date desc,s.teacher),'[]')
  into n,rows from private.curriculum_supervisions s
  where s.institution=school and s.year='2026/2027' and (p_mode='admin' or s.teacher_code=code and s.status<>'cancelled');
 if n>5000 then raise exception 'room_scope';end if;
 return jsonb_build_object('version',1,'mode',p_mode,'rows',rows,'count',n,'read_at',now(),
  'context',jsonb_build_object('user_id',auth.uid(),'teacher_code',code,'admin',admin),
  'teachers',case when p_mode='admin' then (select coalesce(jsonb_agg(jsonb_build_object('kode',kode,'nama',nama,'mapel',mapel) order by nama),'[]') from public.curriculum_teachers) else '[]'::jsonb end);
end $$;

create function public.curriculum_supervision_write(p_id uuid,p_expected integer,p_action text,p_data jsonb,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare school constant text:='MA Insan Cendekia Nusantara';admin boolean;code text;s private.curriculum_supervisions;
 e private.curriculum_supervision_events;intent jsonb;receipt jsonb;items text[]:=private.curriculum_akg_items();total numeric;name text;mapel_name text;
begin
 if auth.uid() is null or not private.school_ready(auth.uid()) then raise exception 'forbidden';end if;
 if p_id is null or p_token is null or jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>12000 or p_action not in ('plan','record','cancel','acknowledge') then raise exception 'invalid_supervision';end if;
 admin:=private.curriculum_admin();code:=private.school_teacher(auth.uid(),school);
 if p_action<>'acknowledge' and not admin then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended('supervision:'||p_id,0));
 intent:=jsonb_build_object('id',p_id,'expected',p_expected,'action',p_action,'data',p_data);
 select * into e from private.curriculum_supervision_events where token=p_token;
 if found then
  if e.actor_id is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;
  return e.receipt;
 end if;
 select * into s from private.curriculum_supervisions where id=p_id for update;
 if coalesce(s.revision,0) is distinct from p_expected then raise exception 'stale_revision';end if;
 if p_action='plan' then
  if s.id is not null and s.status<>'planned' then raise exception 'invalid_supervision';end if;
  select nama,mapel into name,mapel_name from public.curriculum_teachers where kode=p_data->>'teacher_code';
  if name is null or length(btrim(coalesce(p_data->>'supervisor','')))=0 or (p_data->>'date') is null then raise exception 'invalid_supervision';end if;
  if s.id is null then
   insert into private.curriculum_supervisions(id,institution,year,teacher_code,teacher,subject,classroom,date,start,focus,supervisor,created_by,updated_by)
    values(p_id,school,'2026/2027',p_data->>'teacher_code',name,coalesce(mapel_name,''),coalesce(p_data->>'classroom',''),(p_data->>'date')::date,nullif(p_data->>'start','')::time,btrim(coalesce(p_data->>'focus','')),btrim(p_data->>'supervisor'),auth.uid(),auth.uid()) returning * into s;
  else
   update private.curriculum_supervisions set teacher_code=p_data->>'teacher_code',teacher=name,subject=coalesce(mapel_name,''),classroom=coalesce(p_data->>'classroom',''),date=(p_data->>'date')::date,start=nullif(p_data->>'start','')::time,focus=btrim(coalesce(p_data->>'focus','')),supervisor=btrim(p_data->>'supervisor'),revision=revision+1,updated_by=auth.uid(),updated_at=now() where id=p_id returning * into s;
  end if;
 elsif s.id is null then raise exception 'invalid_supervision';
 elsif p_action='record' then
  if s.status='cancelled' or jsonb_typeof(p_data->'scores') is distinct from 'object' or jsonb_typeof(p_data->'notes') is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p_data->'scores'))<>cardinality(items)
   or exists(select 1 from unnest(items) k where coalesce(p_data->'scores'->>k,'') not in ('1','2','3','4'))
   or length(btrim(coalesce(p_data->'notes'->>'follow_up','')))=0 then raise exception 'invalid_supervision';end if;
  select sum((p_data->'scores'->>k)::numeric) into total from unnest(items) k;
  update private.curriculum_supervisions set status='done',scores=p_data->'scores',
   notes=jsonb_build_object('strengths',btrim(coalesce(p_data->'notes'->>'strengths','')),'improvements',btrim(coalesce(p_data->'notes'->>'improvements','')),'follow_up',btrim(p_data->'notes'->>'follow_up')),
   score=round(total/(cardinality(items)*4)*100,2),acknowledged_at=null,acknowledged_note='',revision=revision+1,updated_by=auth.uid(),updated_at=now() where id=p_id returning * into s;
 elsif p_action='cancel' then
  if s.status<>'planned' then raise exception 'invalid_supervision';end if;
  update private.curriculum_supervisions set status='cancelled',revision=revision+1,updated_by=auth.uid(),updated_at=now() where id=p_id returning * into s;
 else
  if code is null or s.teacher_code<>code or s.status<>'done' or s.acknowledged_at is not null then raise exception 'forbidden';end if;
  update private.curriculum_supervisions set acknowledged_at=now(),acknowledged_note=left(btrim(coalesce(p_data->>'note','')),1000),revision=revision+1,updated_at=now() where id=p_id returning * into s;
 end if;
 receipt:=jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'score',s.score,'token',p_token);
 insert into private.curriculum_supervision_events values(p_token,s.id,auth.uid(),intent,receipt,now());
 return receipt;
end $$;

create function public.curriculum_room_summary(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare school constant text:='MA Insan Cendekia Nusantara';
begin
 if auth.uid() is null or not private.school_ready(auth.uid()) or not private.curriculum_admin() then raise exception 'forbidden';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'room_scope';end if;
 return jsonb_build_object('version',1,'from',p_from,'to',p_to,'read_at',now(),
  'requests',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'status',status,'n',n)),'[]') from (select kind,status,count(*) n from private.curriculum_school_requests where institution=school and date between p_from and p_to group by 1,2) q),
  'absence',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'n',n,'students',students)),'[]') from (select coalesce(nullif(body->>'category',''),'dispensasi') category,count(*) n,sum(cardinality(student_ids)) students from private.curriculum_school_requests where institution=school and kind='absence' and status in ('pending','approved') and date between p_from and p_to group by 1) q),
  'clinic',(select coalesce(jsonb_agg(jsonb_build_object('status',status,'n',n)),'[]') from (select status,count(*) n from private.curriculum_clinic_requests where institution=school and date between p_from and p_to group by 1) q),
  'journals',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'n',n)),'[]') from (select kind,count(*) n from private.curriculum_school_journals where institution=school and date between p_from and p_to group by 1) q),
  'pending',jsonb_build_object(
   'school',(select count(*) from private.curriculum_school_requests where institution=school and status='pending' and date>=(now() at time zone 'Asia/Jakarta')::date),
   'clinic',(select count(*) from private.curriculum_clinic_requests where institution=school and status='pending' and date>=(now() at time zone 'Asia/Jakarta')::date),
   'expired',(select count(*) from private.curriculum_school_requests where institution=school and status='pending' and date<(now() at time zone 'Asia/Jakarta')::date)
    +(select count(*) from private.curriculum_clinic_requests where institution=school and status='pending' and date<(now() at time zone 'Asia/Jakarta')::date)),
  'notes',(select coalesce(jsonb_agg(jsonb_build_object('teacher_code',t.kode,'teacher',t.nama,'subject',t.mapel,'n',coalesce(q.n,0),'last',q.last) order by coalesce(q.n,0) desc,t.nama),'[]') from public.curriculum_teachers t left join (select teacher_code,count(*) n,max(date) last from private.curriculum_teacher_notes where institution=school and date between p_from and p_to group by 1) q on q.teacher_code=t.kode),
  'supervision',(select jsonb_build_object('planned',count(*) filter(where status='planned'),'done',count(*) filter(where status='done'),'cancelled',count(*) filter(where status='cancelled'),'acknowledged',count(*) filter(where status='done' and acknowledged_at is not null),'average',round(avg(score) filter(where status='done'),2)) from private.curriculum_supervisions where institution=school and date between p_from and p_to),
  'weekly',(select coalesce(jsonb_agg(jsonb_build_object('week',w::date,
    'requests',(select count(*) from private.curriculum_school_requests r where r.institution=school and r.date>=w::date and r.date<w::date+7),
    'clinic',(select count(*) from private.curriculum_clinic_requests c where c.institution=school and c.date>=w::date and c.date<w::date+7),
    'notes',(select count(*) from private.curriculum_teacher_notes t where t.institution=school and t.date>=w::date and t.date<w::date+7)) order by w),'[]')
   from generate_series(date_trunc('week',p_from::timestamp),date_trunc('week',p_to::timestamp),interval '7 days') w));
end $$;

revoke all on function public.curriculum_teacher_note_read(date,date),public.curriculum_teacher_note_write(uuid,integer,date,jsonb,uuid),public.curriculum_supervision_read(text),public.curriculum_supervision_write(uuid,integer,text,jsonb,uuid),public.curriculum_room_summary(date,date) from public,anon;
grant execute on function public.curriculum_teacher_note_read(date,date),public.curriculum_teacher_note_write(uuid,integer,date,jsonb,uuid),public.curriculum_supervision_read(text),public.curriculum_supervision_write(uuid,integer,text,jsonb,uuid),public.curriculum_room_summary(date,date) to authenticated;
commit;

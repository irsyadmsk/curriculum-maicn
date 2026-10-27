-- Explicit administrator matching of existing accounts, never fuzzy identity matching.
begin;
alter table private.curriculum_teacher_access add column revision integer not null default 1;
create or replace function public.curriculum_school_settings() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.clinic_account_ready() or not private.is_admin() then raise exception 'forbidden';end if;
 return jsonb_build_object('accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',u.user_id,'name',coalesce(p.full_name,u.login_email),'email',u.login_email,'teacher_code',a.teacher_code,'teacher_eligible',exists(select 1 from public.user_roles where user_id=u.user_id and role_id in ('teacher','admin','super_admin')),'teacher_revision',coalesce((select revision from private.curriculum_teacher_access where user_id=u.user_id and institution='MA Insan Cendekia Nusantara'),0),'student',exists(select 1 from public.user_roles where user_id=u.user_id and role_id='student')) order by p.full_name),'[]') from public.user_accounts u left join public.profiles p on p.id=u.user_id left join private.curriculum_teacher_access a on a.user_id=u.user_id and a.institution='MA Insan Cendekia Nusantara' and a.active where u.status='active' and (a.user_id is not null or exists(select 1 from public.user_roles where user_id=u.user_id and role_id in ('student','teacher','admin','super_admin')))),
 'teachers',(select coalesce(jsonb_agg(jsonb_build_object('code',kode,'name',nama,'subject',mapel) order by nama),'[]') from public.curriculum_teachers),'students',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama,'kelas',classroom)),'[]') from private.curriculum_clinic_roster where institution='MA Insan Cendekia Nusantara' and year='2026/2027'),'bindings',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from private.curriculum_school_students s),'roles',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from private.curriculum_school_class_roles c));
end $$;
revoke all on function public.curriculum_school_settings() from public,anon;grant execute on function public.curriculum_school_settings() to authenticated;
create or replace function public.curriculum_school_assign(p_id uuid,p_expected integer,p_kind text,p_data jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
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
 if p_kind='teacher' then
  if not private.school_ready(u) or not exists(select 1 from public.user_roles where user_id=u and role_id in ('teacher','admin','super_admin')) or not exists(select 1 from public.curriculum_teachers where kode=p_data->>'teacher_code') or p_data->>'identity_confirmed' is distinct from 'true' then raise exception 'invalid_assignment';end if;
  select revision into n from private.curriculum_teacher_access where user_id=u and institution='MA Insan Cendekia Nusantara';if coalesce(n,0) is distinct from p_expected then raise exception 'stale_revision';end if;
  if exists(select 1 from private.curriculum_teacher_access where user_id<>u and institution='MA Insan Cendekia Nusantara' and teacher_code=p_data->>'teacher_code' and active) then raise exception 'invalid_assignment';end if;
  insert into private.curriculum_teacher_access(user_id,institution,teacher_code,active,revision) values(u,'MA Insan Cendekia Nusantara',p_data->>'teacher_code',true,1) on conflict(user_id,institution) do update set teacher_code=excluded.teacher_code,active=true,revision=curriculum_teacher_access.revision+1 returning revision into n;
  return jsonb_build_object('id',u,'revision',n);
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

notify pgrst,'reload schema';
commit;

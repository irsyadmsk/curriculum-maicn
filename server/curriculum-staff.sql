-- Scoped Curriculum reviewers: Clinic and weekly switches, without platform administration.
begin;
create function public.studio_workspace_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or exists(select 1 from public.user_roles where user_id=auth.uid() and role_id='assistant')) and exists(select 1 from public.user_accounts where user_id=auth.uid() and status='active' and not must_change_password)
$$;
revoke all on function public.studio_workspace_access() from public,anon;grant execute on function public.studio_workspace_access() to authenticated;
alter function public.curriculum_school_context(text) rename to curriculum_school_context_internal;
revoke all on function public.curriculum_school_context_internal(text) from public,anon,authenticated,service_role;
create function public.curriculum_school_context(p_institution text) returns jsonb language sql stable security definer set search_path='' as $$
 select public.curriculum_school_context_internal(p_institution)||jsonb_build_object('studio_allowed',public.studio_workspace_access())
$$;
revoke all on function public.curriculum_school_context(text) from public;grant execute on function public.curriculum_school_context(text) to anon,authenticated;

alter function public.curriculum_school_decide(uuid,integer,text,jsonb,uuid) rename to curriculum_school_decide_internal;
revoke all on function public.curriculum_school_decide_internal(uuid,integer,text,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.curriculum_school_decide(p_id uuid,p_expected integer,p_action text,p_data jsonb,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if not private.clinic_can_review('MA Insan Cendekia Nusantara') or not private.is_admin() and not exists(select 1 from private.curriculum_school_requests where id=p_id and kind='switch') then raise exception 'forbidden';end if;
 return public.curriculum_school_decide_internal(p_id,p_expected,p_action,p_data,p_token);
end $$;
revoke all on function public.curriculum_school_decide(uuid,integer,text,jsonb,uuid) from public,anon;grant execute on function public.curriculum_school_decide(uuid,integer,text,jsonb,uuid) to authenticated;

alter function public.curriculum_school_read(text,date,date,date) rename to curriculum_school_read_internal;
revoke all on function public.curriculum_school_read_internal(text,date,date,date) from public,anon,authenticated,service_role;
create function public.curriculum_school_read(p_mode text default 'public',p_date date default null,p_from date default null,p_to date default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;rows jsonb;
begin
 result:=public.curriculum_school_read_internal(p_mode,p_date,p_from,p_to);
 if p_mode='review' and not private.is_admin() then
  select coalesce(jsonb_agg(r order by ord),'[]') into rows from jsonb_array_elements(result->'rows') with ordinality as x(r,ord) where r->>'kind'='switch';
  result:=result||jsonb_build_object('rows',rows,'count',jsonb_array_length(rows));
 end if;
 return result;
end $$;
revoke all on function public.curriculum_school_read(text,date,date,date) from public;grant execute on function public.curriculum_school_read(text,date,date,date) to anon,authenticated;

alter function public.curriculum_school_journal_read(date,date) rename to curriculum_school_journal_read_internal;
revoke all on function public.curriculum_school_journal_read_internal(date,date) from public,anon,authenticated,service_role;
create function public.curriculum_school_journal_read(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;rows jsonb;
begin
 result:=public.curriculum_school_journal_read_internal(p_from,p_to);
 if not private.is_admin() then
  select coalesce(jsonb_agg(r order by ord),'[]') into rows from jsonb_array_elements(result->'rows') with ordinality as x(r,ord) where private.school_can_journal(r->>'kind',(r->>'date')::date,r->>'classroom');
  result:=result||jsonb_build_object('rows',rows,'count',jsonb_array_length(rows));
 end if;
 return result;
end $$;
revoke all on function public.curriculum_school_journal_read(date,date) from public,anon;grant execute on function public.curriculum_school_journal_read(date,date) to authenticated;

alter function public.curriculum_monday_write(text,text,integer,jsonb,uuid) rename to curriculum_monday_write_internal;
revoke all on function public.curriculum_monday_write_internal(text,text,integer,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.curriculum_monday_write(p_institution text,p_year text,p_expected integer,p_data jsonb,p_token uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if not private.clinic_account_ready() or not private.is_admin() then raise exception 'forbidden';end if;
 return public.curriculum_monday_write_internal(p_institution,p_year,p_expected,p_data,p_token);
end $$;
revoke all on function public.curriculum_monday_write(text,text,integer,jsonb,uuid) from public,anon;grant execute on function public.curriculum_monday_write(text,text,integer,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

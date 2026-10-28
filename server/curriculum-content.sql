-- Local candidate. Apply only with owner authorization. Owner content is seeded separately.
begin;
create table private.curriculum_content (
 id text primary key, kind text not null check(kind in ('book','program','confirmation')),
 source jsonb not null, content jsonb not null check(jsonb_typeof(content)='object'),
 revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table private.curriculum_content_history (
 id bigint generated always as identity primary key, record_id text not null references private.curriculum_content(id),
 revision integer not null, content jsonb not null, actor uuid not null references auth.users(id), changed_at timestamptz not null default now(),
 unique(record_id,revision)
);
alter table private.curriculum_content enable row level security;
alter table private.curriculum_content_history enable row level security;
revoke all on private.curriculum_content,private.curriculum_content_history from public,anon,authenticated;
-- Private records require guarded functions; no table grants to API clients.
create function public.curriculum_content_read() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.clinic_account_ready() or not private.is_admin() then raise exception 'forbidden';end if;
 return jsonb_build_object('version',1,'rows',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from private.curriculum_content c));
end $$;
create function public.curriculum_content_write(p_id text,p_expected integer,p_content jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.curriculum_content; allowed text[];
begin
 if auth.uid() is null or not private.clinic_account_ready() or not private.is_admin() then raise exception 'forbidden';end if;
 if p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>18000 then raise exception 'invalid_content';end if;
 select * into r from private.curriculum_content where id=p_id for update;
 if r.id is null then raise exception 'invalid_content';end if;
 if p_expected is null or r.revision<>p_expected then raise exception 'stale_revision';end if;
 allowed:=case r.kind when 'book' then array['text'] when 'program' then array['name','description','indicator','when','status','note','checked'] else array['nama','status','waktu','rujukan'] end;
 if (select array_agg(k order by k) from jsonb_object_keys(p_content) k) is distinct from (select array_agg(k order by k) from unnest(allowed) k) then raise exception 'invalid_content';end if;
 if exists(select 1 from jsonb_each(p_content) e where e.key<>'checked' and (jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>12000)) then raise exception 'invalid_content';end if;
 if r.kind='book' and length(btrim(p_content->>'text'))=0 or r.kind='program' and (jsonb_typeof(p_content->'checked')<>'boolean' or length(btrim(p_content->>'name'))=0) then raise exception 'invalid_content';end if;
 insert into private.curriculum_content_history(record_id,revision,content,actor) values(r.id,r.revision,r.content,auth.uid());
 update private.curriculum_content set content=p_content,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.curriculum_content_read(),public.curriculum_content_write(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.curriculum_content_read(),public.curriculum_content_write(text,integer,jsonb) to authenticated;
commit;

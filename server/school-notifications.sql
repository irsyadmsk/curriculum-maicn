-- LOCAL CANDIDATE after school-workflows.sql. Delivery stays separately disabled.
begin;
create table private.curriculum_school_email_outbox(id uuid primary key default gen_random_uuid(),request_id uuid not null references private.curriculum_school_requests(id),revision integer not null,snapshot jsonb not null,state text not null default 'queued' check(state in ('queued','leased','provider_accepted','needs_review','superseded')),lease uuid,leased_at timestamptz,first_attempt_at timestamptz,attempts integer not null default 0,provider_id text,created_at timestamptz not null default now(),unique(request_id,revision));
alter table private.curriculum_school_email_outbox enable row level security;
revoke all on private.curriculum_school_email_outbox from public,anon,authenticated;
create function private.school_queue_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.teacher_code is not null and new.contact_email<>'' and not private.school_student(new.owner_id) and new.status in ('approved','rejected') and new.status is distinct from old.status then
  insert into private.curriculum_school_email_outbox(request_id,revision,snapshot) values(new.id,new.revision,to_jsonb(new)||jsonb_build_object('activity_kind',new.kind,'request_kind','teacher','subjects',jsonb_build_array(new.subject),'approved_subject',new.subject,'start',to_char(new.start,'HH24:MI'),'end',to_char(new."end",'HH24:MI')));
 end if;return new;
end $$;
revoke all on function private.school_queue_email() from public,anon,authenticated;
create trigger school_decision_email after update on private.curriculum_school_requests for each row execute function private.school_queue_email();
create function public.curriculum_school_email_claim() returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;begin
 update private.curriculum_school_email_outbox o set state='superseded' from private.curriculum_school_requests r where r.id=o.request_id and o.state in ('queued','leased') and (r.status is distinct from o.snapshot->>'status' or r.decided_at is distinct from (o.snapshot->>'decided_at')::timestamptz);
 update private.curriculum_school_email_outbox set state='needs_review' where state in ('queued','leased') and (attempts>=5 or first_attempt_at<now()-interval '23 hours');
 with jobs as(select id from private.curriculum_school_email_outbox where state='queued' or state='leased' and leased_at<now()-interval '5 minutes' order by created_at limit 10 for update skip locked),claimed as(update private.curriculum_school_email_outbox o set state='leased',lease=gen_random_uuid(),leased_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 from jobs where o.id=jobs.id returning o.id,o.lease,o.snapshot) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;return result;
end $$;
create function public.curriculum_school_email_complete(p_id uuid,p_lease uuid,p_provider_id text) returns void language plpgsql volatile security definer set search_path='' as $$
begin if p_provider_id is null or length(p_provider_id) not between 1 and 200 then raise exception 'invalid_receipt';end if;update private.curriculum_school_email_outbox set state='provider_accepted',provider_id=p_provider_id where id=p_id and lease=p_lease and state='leased';if not found then raise exception 'stale_lease';end if;end $$;
revoke all on function public.curriculum_school_email_claim(),public.curriculum_school_email_complete(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.curriculum_school_email_claim(),public.curriculum_school_email_complete(uuid,uuid,text) to service_role;
create function private.school_clinic_conflict() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' then
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||new.institution,0));
 if exists(select 1 from private.curriculum_school_requests r where r.kind='remedial' and r.status='approved' and r.date=new.date and r.start<new."end" and r."end">new.start and (r.teacher_code=new.teacher_code or r.student_ids&&coalesce(new.approved_participant_ids,new.participant_ids))) then raise exception 'clinic_participant_conflict';end if;end if;return new;
end $$;
revoke all on function private.school_clinic_conflict() from public,anon,authenticated;
create trigger clinic_school_conflict before insert or update on private.curriculum_clinic_requests for each row execute function private.school_clinic_conflict();
create function public.curriculum_school_receipt(p_id uuid,p_token uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 select jsonb_build_object('found',true,'id',r.id,'status',r.status,'revision',r.revision,'decision_note',r.decision_note) into result
 from private.curriculum_school_events e join private.curriculum_school_requests r on r.id=e.request_id where e.token=p_token and e.request_id=p_id and e.action='submit';
 return coalesce(result,jsonb_build_object('found',false));
end $$;
revoke all on function public.curriculum_school_receipt(uuid,uuid) from public,anon,authenticated;grant execute on function public.curriculum_school_receipt(uuid,uuid) to service_role;
commit;

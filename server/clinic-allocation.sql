-- LOCAL CANDIDATE, after clinic-intake-v2.sql. No production execution implied.
begin;
create function public.curriculum_clinic_allocate(p_institution text,p_year text,p_action text,p_id uuid,p_expected integer,p_data jsonb,p_token uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
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
 if length(btrim(coalesce(p_data->>'note',''))) not between 1 and 2000 then raise exception 'decision_note_required';end if;
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
end $$;
revoke all on function public.curriculum_clinic_allocate(text,text,text,uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.curriculum_clinic_allocate(text,text,text,uuid,integer,jsonb,uuid) to authenticated;

create function private.clinic_email_snapshot(r private.curriculum_clinic_requests) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(r)||jsonb_build_object('start',to_char(r.start,'HH24:MI'),'end',to_char(r."end",'HH24:MI'),
 'participants',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nama',s.nama,'kelas',s.classroom) order by s.classroom,s.nama),'[]') from private.curriculum_clinic_roster s where s.institution=r.institution and s.year=r.year and s.id=any(case when r.status='approved' then coalesce(r.approved_participant_ids,r.participant_ids) else r.participant_ids end)),
 'exceptions',(select coalesce(jsonb_agg(jsonb_build_object('student_id',s.id,'nama',s.nama,'kelas',s.classroom,'destination_id',q.id,'subject',coalesce(q.approved_subject,q.subjects[1]),'teacher',q.teacher,'reason',x->>'reason') order by s.nama),'[]')
 from jsonb_array_elements(r.participant_exceptions) x join private.curriculum_clinic_roster s on s.id=x->>'student_id' and s.institution=r.institution and s.year=r.year
 join private.curriculum_clinic_requests q on q.id::text=x->>'destination_id' and q.institution=r.institution));
$$;
revoke all on function private.clinic_email_snapshot(private.curriculum_clinic_requests) from public,anon,authenticated;
create or replace function private.clinic_queue_decision_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.intake_version=2 and new.request_kind='teacher' and new.status in ('approved','rejected') and
 (old.status is distinct from new.status or new.status='approved' and (new.approved_participant_ids is distinct from old.approved_participant_ids or new.participant_exceptions is distinct from old.participant_exceptions)) then
  insert into private.curriculum_clinic_email_outbox(request_id,revision,snapshot)
  values(new.id,new.revision,private.clinic_email_snapshot(new)||jsonb_build_object('allocation_update',old.status='approved')) on conflict do nothing;
 end if;
 return new;
end $$;
commit;

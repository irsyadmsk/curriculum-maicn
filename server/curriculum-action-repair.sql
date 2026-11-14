-- Candidate: reviewer-only audience moves and explicit completion of legacy identities.
begin;
create function public.curriculum_clinic_retarget(p_institution text,p_year text,p_action text,p_id uuid,p_expected integer,p_data jsonb,p_token uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r private.curriculum_clinic_requests;e private.curriculum_clinic_events;ids text[];result jsonb;intent jsonb;
begin
 if auth.uid() is null or not private.clinic_can_review(p_institution) then raise exception 'forbidden';end if;
 if p_institution is distinct from 'MA Insan Cendekia Nusantara' or p_year is distinct from '2026/2027' or p_action is distinct from 'retarget' or p_token is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:'||p_institution,0));
 intent:=jsonb_build_object('action','retarget','institution',p_institution,'year',p_year,'id',p_id,'expected',p_expected,'data',p_data);
 select * into e from private.curriculum_clinic_events where token=p_token;
 if found then if e.actor_id is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;return e.receipt;end if;
 select * into r from private.curriculum_clinic_requests where id=p_id and institution=p_institution and year=p_year for update;
 if not found or r.revision is distinct from p_expected then raise exception 'stale_revision';end if;
 if r.intake_version<>2 or r.status not in ('pending','approved') then raise exception 'invalid_transition';end if;
 if ((r.date+r."end") at time zone 'Asia/Jakarta')<=now() then raise exception 'archived_schedule_locked';end if;
 if length(btrim(coalesce(p_data->>'note',''))) not between 1 and 2000 then raise exception 'decision_note_required';end if;
 if p_data->>'target_mode'='class' then
  select array_agg(id order by id) into ids from private.curriculum_clinic_roster where institution=p_institution and year=p_year and classroom=p_data->>'classroom';
 elsif p_data->>'target_mode'='students' and jsonb_typeof(p_data->'participant_ids')='array' then
  select array_agg(value order by value) into ids from jsonb_array_elements_text(p_data->'participant_ids');
 else raise exception 'invalid_participants';end if;
 if coalesce(cardinality(ids),0)=0 then raise exception 'invalid_participants';end if;
 update private.curriculum_clinic_requests set target_mode=p_data->>'target_mode',classroom=case when p_data->>'target_mode'='class' then p_data->>'classroom' else null end,participant_ids=ids,
 approved_participant_ids=null,participant_exceptions='[]',status='pending',approved_subject=null,decided_by=null,decided_at=null,decision_note=btrim(p_data->>'note'),revision=revision+1,updated_at=clock_timestamp()
 where id=r.id returning * into r;
 result:=jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'updated_at',r.updated_at,'token',p_token);
 insert into private.curriculum_clinic_events(request_id,actor_id,action,revision,snapshot,token,intent,receipt) values(r.id,auth.uid(),'retarget',r.revision,to_jsonb(r),p_token,intent,result);
 return result;
end $$;
revoke all on function public.curriculum_clinic_retarget(text,text,text,uuid,integer,jsonb,uuid) from public,anon,service_role;
grant execute on function public.curriculum_clinic_retarget(text,text,text,uuid,integer,jsonb,uuid) to authenticated;

create function public.curriculum_clinic_verify_legacy(p_id uuid,p_expected integer,p_data jsonb,p_token uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r private.curriculum_clinic_requests;d private.curriculum_request_details;e private.curriculum_operations_receipts;intent jsonb;result jsonb;input jsonb;
begin
 if auth.uid() is null or not private.clinic_can_review('MA Insan Cendekia Nusantara') then raise exception 'forbidden';end if;
 if p_token is null or jsonb_typeof(p_data) is distinct from 'object' or p_data->>'confirmed' is distinct from 'true' then raise exception 'identity_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('curriculum-clinic:MA Insan Cendekia Nusantara',0));
 intent:=jsonb_build_object('action','legacy_identity','id',p_id,'expected',p_expected,'data',(p_data-array['identity_photo','photo_mime'])||jsonb_build_object('photo_fingerprint',md5(coalesce(p_data->>'identity_photo',''))));
 select * into e from private.curriculum_operations_receipts where token=p_token;
 if found then if e.actor is distinct from auth.uid() or e.intent is distinct from intent then raise exception 'token_mismatch';end if;return e.result;end if;
 select * into r from private.curriculum_clinic_requests where id=p_id and institution='MA Insan Cendekia Nusantara' and year='2026/2027' for update;
 if not found or r.revision is distinct from p_expected or exists(select 1 from private.curriculum_request_details where kind='clinic' and request_id=p_id) then raise exception 'stale_revision';end if;
 if r.status<>'pending' then raise exception 'invalid_transition';end if;
 if r.request_kind='teacher' and (p_data->>'requester_kind' is distinct from 'teacher' or p_data->>'requester_id' is distinct from r.teacher_code) or r.request_kind='guest' and p_data->>'requester_kind' is distinct from 'student' then raise exception 'invalid_requester';end if;
 if coalesce(p_data->>'location','')='' then raise exception 'identity_or_location_required';end if;
 input:=p_data||jsonb_build_object('contact_email',r.contact_email,'evidence',r.evidence);
 perform private.curriculum_attach_identity('clinic',p_id,input);
 update private.curriculum_request_details set identity_verified=true,verified_by=auth.uid(),verified_at=now(),revision=revision+1 where kind='clinic' and request_id=p_id returning * into d;
 result:=private.curriculum_details_json(d);
 insert into private.curriculum_operations_receipts values(p_token,auth.uid(),intent,result);
 return result;
end $$;
revoke all on function public.curriculum_clinic_verify_legacy(uuid,integer,jsonb,uuid) from public,anon,service_role;
grant execute on function public.curriculum_clinic_verify_legacy(uuid,integer,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

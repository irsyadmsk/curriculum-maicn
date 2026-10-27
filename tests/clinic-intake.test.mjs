import test from 'node:test';
import assert from 'node:assert/strict';
import {driveEvidence,validateIntake,participantConflicts,enrichmentCandidates} from '../assets/clinic-intake-core.mjs';
import {decisionEmail,sendDecisionEmail} from '../server/clinic-email.mjs';
import {createWorker} from '../server/worker.mjs';
const catalog={version:2,year:'2026/2027',students:[{id:'a',nama:'Murid A',kelas:'X-1'},{id:'b',nama:'Murid B',kelas:'X-1'},{id:'c',nama:'Murid C',kelas:'X-2'},{id:'d',nama:'Belum kelas',kelas:null}],teachers:[{kode:'AA',nama:'Guru A',mapel:'Fisika'},{kode:'BB',nama:'Guru B',mapel:'Kimia'}]};
const base={request_kind:'guest',target_mode:'students',classroom:'X-1',participant_ids:['a'],subjects:['Fisika']};
test('roster-only participants; one catalog subject; canonical teacher subject, mandatory email and Drive evidence',()=>{
 assert.deepEqual(validateIntake(base,catalog).participant_ids,['a']);
 for(const participant_ids of [[],['forged'],['a','a']])assert.throws(()=>validateIntake({...base,participant_ids},catalog));
 assert.deepEqual(validateIntake({...base,participant_ids:['a','c','d']},catalog).participant_ids,['a','c','d']);
 assert.equal(validateIntake({...base,participant_ids:['a','c']},catalog).classroom,null);
 assert.deepEqual(validateIntake({...base,target_mode:'class',participant_ids:['forged']},catalog).participant_ids,['a','b']);
 assert.throws(()=>validateIntake({...base,subjects:['Fisika','Kimia']},catalog));assert.throws(()=>validateIntake({...base,subjects:['Mapel bebas']},catalog));
 const teacher={...base,request_kind:'teacher',teacher_code:'BB',contact_email:'guru@example.test',evidence:'https://drive.google.com/file/d/abcdefghijklmno/view'};
 assert.deepEqual(validateIntake(teacher,catalog).subjects,['Kimia']);
 assert.throws(()=>validateIntake({...teacher,contact_email:''},catalog));assert.throws(()=>validateIntake({...teacher,evidence:''},catalog));
 assert.equal(validateIntake({...base,contact_email:'ignore@example.test',evidence:'bad'},catalog).contact_email,'');
});
test('Drive embeds use only approved HTTPS host and file paths',()=>{
 for(const v of ['javascript:alert(1)','https://drive.google.com.evil.test/file/d/abcdefghijklmno/view','http://drive.google.com/file/d/abcdefghijklmno/view','https://drive.google.com@evil.test/file/d/abcdefghijklmno/view','https://docs.google.com/document/d/abcdefghijklmno/edit','https://drive.google.com/drive/folders/abcdefghijklmno'])assert.equal(driveEvidence(v),null,v);
 assert.equal(driveEvidence('https://drive.google.com/file/d/abcdefghijklmno/view?usp=sharing').embed,'https://drive.google.com/file/d/abcdefghijklmno/preview');
});
test('only overlapping approved participants block; enrichment is per clinic and class',()=>{
 const clinic={...base,id:'one',date:'2026-12-07',start:'20:30',end:'21:00',status:'approved'},other={...clinic,id:'two',subjects:['Kimia']};
 assert.equal(participantConflicts([other],clinic).length,1);
 assert.equal(participantConflicts([{...other,start:'21:00',end:'21:30'}],clinic).length,0);
 assert.equal(participantConflicts([{...other,status:'pending'}],clinic).length,0);
 assert.equal(participantConflicts([{...other,participant_ids:['b']}],clinic).length,0);
 assert.deepEqual(enrichmentCandidates(catalog.students,clinic).map(s=>s.id),['b']);
});
test('accept/reject templates are teacher-only, escape supplied content and use stable provider idempotency',async()=>{
 const event={...base,id:'request',revision:2,request_kind:'teacher',status:'approved',contact_email:'guru@example.test',teacher:'Guru <img src=x>',approved_subject:'Fisika',classroom:'X-1',date:'2026-12-07',start:'20:30',end:'21:30',decision_note:'Tinjauan <script>bad</script>'};
 const message=decisionEmail(event);assert.equal(message.from,'Curriculum Irsyads <noreply@irsyads.com>');assert.match(message.subject,/diterima/);assert.ok(!message.html.includes('<script>'));assert.match(decisionEmail({...event,status:'rejected'}).subject,/ditolak/);
 assert.equal(decisionEmail({...event,request_kind:'guest'}),null);
 const calls=[];const result=await sendDecisionEmail(event,{apiKey:'fixture',fetcher:async(url,options)=>{calls.push({url,options});return Response.json({id:'mock-provider-id'})}});
 assert.equal(result.provider_id,'mock-provider-id');assert.equal(calls[0].options.headers['Idempotency-Key'],'clinic/request/2');
 await assert.rejects(()=>sendDecisionEmail(event,{apiKey:'fixture',fetcher:async()=>new Response('',{status:503})}));
});
test('approval email lists the effective names and exceptions with their destination clinic',()=>{
 const event={...base,id:'class',revision:3,target_mode:'class',request_kind:'teacher',status:'approved',contact_email:'guru@example.test',teacher:'Guru Kimia',approved_subject:'Kimia',classroom:'X-1',date:'2026-12-07',start:'20:30',end:'21:00',allocation_update:true,participants:[{nama:'Murid B',kelas:'X-1'}],exceptions:[{nama:'Murid A',kelas:'X-1',subject:'Fisika',teacher:'Guru Fisika',reason:'Bukti asesmen lebih kuat'}]};
 const email=decisionEmail(event);assert.match(email.subject,/Penyesuaian/);assert.match(email.text,/Murid B \(X-1\)/);assert.match(email.text,/kecuali/);assert.match(email.text,/Murid A \(X-1\) masuk klinik Fisika/);assert.match(email.html,/<br>/);
});
test('scheduled email delivery is gated and acknowledges only the provider receipt for a server outbox job',async()=>{
 const calls=[],event={...base,id:'request',revision:2,request_kind:'teacher',status:'rejected',contact_email:'guru@example.test',teacher:'Guru Contoh',date:'2026-12-07',start:'20:30',end:'21:00',decision_note:'Lengkapi bukti'};
 const worker=createWorker({fetcher:async(url,options)=>{calls.push({url,options});
  if(url.endsWith('/curriculum_clinic_email_claim'))return Response.json([{id:'job',lease:'lease',snapshot:event}]);
  if(url==='https://api.resend.com/emails')return Response.json({id:'provider-receipt'});
  if(url.endsWith('/curriculum_clinic_email_complete'))return Response.json(null);
  throw Error('Unexpected outbound call');
 }}),env={CLINIC_EMAIL_ENABLED:'false',RESEND_API_KEY:'fixture-provider',CLINIC_SERVICE_KEY:'fixture-service',SUPABASE_URL:'https://fixture.invalid'};
 await worker.scheduled({},env);assert.equal(calls.length,0);
 await worker.scheduled({},{...env,CLINIC_EMAIL_ENABLED:'true'});assert.equal(calls.length,3);
 assert.deepEqual(JSON.parse(calls[2].options.body),{p_id:'job',p_lease:'lease',p_provider_id:'provider-receipt'});
 assert.deepEqual(JSON.parse(calls[1].options.body).to,['guru@example.test']);
});

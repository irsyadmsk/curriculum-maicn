import test from 'node:test';import assert from 'node:assert/strict';
import {whatsappText,participantTable,nextReviewDay} from '../assets/curriculum-operations-core.mjs';
import {operationsEmail,sendOperationsEmail} from '../server/curriculum-digest.mjs';
import {requestJSON} from '../assets/curriculum-api.mjs';
import {createWorker} from '../server/worker.mjs';
const roster=[{id:'a',nama:'Murid A',kelas:'X-1'},{id:'b',nama:'Murid B',kelas:'X-1'},{id:'c',nama:'Murid C',kelas:'X-2'}],row={id:'one',date:'2026-12-07',start:'20:30',end:'21:00',status:'approved',subjects:['Fisika'],approved_subject:'Fisika',teacher:'Guru A',target_mode:'students',participant_ids:['a','b'],approved_participant_ids:['a'],scope_classrooms:['X-1'],location:'Kelas X-1'};
test('WhatsApp uses only approved effective participants, names remaining students and keeps approved school information',()=>{
 const text=whatsappText({date:'2026-12-07',clinic:[row,{...row,id:'pending',status:'pending',approved_subject:'Rahasia pending'}],roster,news:[{title:'Info',body:'Belajar',status:'published',date_from:'2026-12-07',date_to:'2026-12-08'}],school:{rows:[{kind:'switch',status:'approved',title:'Switch contoh',classroom:'X-1',start:'07:00',end:'08:20',body:{from_date:'2026-12-07',to_date:'2026-12-08'}}]}});
 assert.match(text,/Fisika/);assert.match(text,/Murid A \(X-1\)/);assert.match(text,/Murid X-1 yang belum terjadwal: Murid B/);assert.match(text,/kelas X-2: belum terjadwal \(1 murid\)/);assert.match(text,/Lokasi: Kelas X-1/);assert.match(text,/Switch contoh/);assert.doesNotMatch(text,/Rahasia pending/);
});
test('participant table distinguishes no clinic, sequential clinics, and true overlaps',()=>{
 const rows=[row,{...row,id:'two',start:'21:00',end:'21:30'}];let table=participantTable(rows,roster);assert.equal(table.find(p=>p.id==='a').conflict,false);assert.equal(table.find(p=>p.id==='a').multiple,true);assert.equal(table.find(p=>p.id==='c').status,'Belum terjadwal');rows[1].start='20:45';table=participantTable(rows,roster);assert.equal(table[0].conflict,true);
});
test('school working day calendar moves weekend and school holidays without an automatic decision',()=>{
 assert.equal(nextReviewDay('2026-12-05'),'2026-12-07');assert.equal(nextReviewDay('2026-12-05',[{date:'2026-12-07',is_workday:false}]),'2026-12-08');assert.equal(nextReviewDay('2026-12-05',[{date:'2026-12-05',is_workday:true}]),'2026-12-05');
});
test('email contains a copyable summary and participant table; retry shares provider key',async()=>{
 const job={id:'fixture-job',recipient:'admin@example.test',kind:'digest',snapshot:{date:'2026-12-07',clinic:[row,{...row,id:'two',start:'21:00',end:'21:30'}],roster}};const message=operationsEmail(job);assert.match(message.html,/<table/);assert.match(message.text,/Fisika/);let keys=[];const fetcher=async(url,options)=>{keys.push(options.headers['Idempotency-Key']);return Response.json({id:'fixture-provider'})};await sendOperationsEmail(job,{apiKey:'fixture',fetcher});await sendOperationsEmail(job,{apiKey:'fixture',fetcher});assert.deepEqual(keys,['curriculum-ops/fixture-job','curriculum-ops/fixture-job']);assert.throws(()=>operationsEmail({...job,recipient:'bad\r\n@example.test'}));
});
test('API preserves a private photo object rather than mistaking data for a transport envelope',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({mime:'image/jpeg',data:'fixture'});try{assert.deepEqual(await requestJSON('/fixture'),{mime:'image/jpeg',data:'fixture'})}finally{globalThis.fetch=old}
});
test('new endpoints reject anonymous administration, cross-origin writes and photo uploads before activation',async()=>{
 let calls=0;const worker=createWorker({fetcher:async()=>{calls++;throw Error('Unexpected remote call')}}),env={ACCESS_ENABLED:'true',CLINIC_ENABLED:'true',CLINIC_V2_ENABLED:'true',SCHOOL_ENABLED:'true',CURRICULUM_OPERATIONS_ENABLED:'true',CLINIC_SERVICE_KEY:'fixture',TURNSTILE_SECRET:'fixture',REQUEST_HASH_SECRET:'fixture'};
 assert.equal((await worker.fetch(new Request('https://curriculum.test/api/curriculum/notifications'),env)).status,403);assert.equal(calls,0);
 assert.equal((await worker.fetch(new Request('https://curriculum.test/api/curriculum/operations',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:'{}'}),env)).status,403);assert.equal(calls,0);
 const request=new Request('https://curriculum.test/api/clinic/request',{method:'POST',headers:{Origin:'https://curriculum.test','Content-Type':'application/json'},body:JSON.stringify({data:{requester_kind:'student',identity_photo:'fixture'}})});
 assert.equal((await worker.fetch(request,{...env,CURRICULUM_OPERATIONS_ENABLED:'false'})).status,503);assert.equal(calls,0);
});
test('audience moves and legacy verification require reviewer access and use the native scoped RPC',async()=>{
 const calls=[],id='10000000-0000-4000-8000-000000000001',token='20000000-0000-4000-8000-000000000001';
 const worker=createWorker({fetcher:async(url,options)=>{calls.push({url,body:options.body?JSON.parse(options.body):null});if(url.endsWith('/auth/v1/user'))return Response.json({id});if(url.endsWith('/curriculum_school_context'))return Response.json({version:1,institution:'MA Insan Cendekia Nusantara',role:'curriculum',user_id:id});if(url.endsWith('/curriculum_clinic_retarget'))return Response.json({id,token,status:'pending',revision:2});if(url.endsWith('/curriculum_clinic_verify_legacy'))return Response.json({identity_verified:true});throw Error('Unexpected request') }});
 const env={ACCESS_ENABLED:'true',CLINIC_ENABLED:'true',SCHOOL_ENABLED:'true',CURRICULUM_OPERATIONS_ENABLED:'true',SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
 const request=(path,body,signed)=>new Request('https://curriculum.test'+path,{method:'POST',headers:{Origin:'https://curriculum.test','Content-Type':'application/json',...(signed?{Cookie:'maicn_session_v1=fixture'}:{})},body:JSON.stringify(body)});
 const move={name:'curriculum_clinic_retarget',args:{p_institution:'MA Insan Cendekia Nusantara',p_year:'2026/2027',p_action:'retarget',p_id:id,p_expected:1,p_data:{target_mode:'class',classroom:'X-2',note:'Kebutuhan X-2'},p_token:token}};
 assert.equal((await worker.fetch(request('/api/clinic/rpc',move,false),env)).status,403);assert.equal(calls.length,0);
 assert.equal((await worker.fetch(request('/api/clinic/rpc',move,true),env)).status,200);assert.deepEqual(calls.at(-1).body,move.args);
 const identity={action:'legacy_identity',expected:1,token,data:{id,confirmed:true,requester_kind:'student',requester_id:'fixture-student',identity_photo:'synthetic'.repeat(6000)}};
 assert.equal((await worker.fetch(request('/api/curriculum/operations',identity,false),env)).status,403);
 assert.equal((await worker.fetch(request('/api/curriculum/operations',identity,true),env)).status,200);assert.ok(calls.at(-1).url.endsWith('/curriculum_clinic_verify_legacy'));assert.equal(calls.at(-1).body.p_expected,1);
});

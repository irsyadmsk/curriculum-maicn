import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {CLINIC_REMOTE_ENABLED,validateProposal,validateRequest,validateBlock,nextMonday,archived,monday,todayWIB,legacyRecords,approvedAgenda,safeURL} from '../assets/clinic-core.mjs';
import {clinicClient,parseSnapshot,parseBlockSnapshot} from '../assets/clinic-client.mjs';
const now=Date.parse('2026-10-26T00:00:00Z'),owner='account-example',institution='MA Insan Cendekia Nusantara',year='2026/2027';
const row={id:'request-example',institution,year,date:'2026-10-26',start:'20:30',end:'21:30',classroom:'X-1',teacher_code:'GU',teacher:'Guru Uji',subjects:['Astronomi','Sosiologi'],topic:'Kebutuhan belajar',evidence:'',status:'pending',approved_subject:null,revision:1};
const snapshot=(rows=[row],overrides={})=>({version:1,institution,year,can_review:false,rows,count:rows.length,teachers:[{kode:'GU',nama:'Guru Uji',mapel:'Fisika'}],read_at:new Date(now).toISOString(),...overrides});
test('WIB calendar follows actual week across UTC, month, and year boundaries',()=>{
 assert.equal(todayWIB(Date.parse('2026-12-31T17:00Z')),'2027-01-01');assert.equal(monday('2027-01-03'),'2026-12-28');
 assert.equal(archived(row,Date.parse('2026-10-26T14:29:59Z')),false);assert.equal(archived(row,Date.parse('2026-10-26T14:30Z')),true);
});
test('any subject may be proposed, with at most three distinct choices and valid future slots',()=>{
 assert.deepEqual(validateProposal(row,now).subjects,['Astronomi','Sosiologi']);
 for(const value of [{...row,subjects:[]},{...row,subjects:['Fisika','fisika']},{...row,date:'2026-10-28'},{...row,end:'23:00'},{...row,date:'2027-07-05'},{...row,evidence:'javascript:alert(1)'}])assert.throws(()=>validateProposal(value,now));
 assert.throws(()=>validateProposal(row,Date.parse('2026-10-26T14:30Z')));assert.equal(safeURL('https://user:pass@example.org'),null);
});
test('legacy Approved labels remain historical records and never become server approvals',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),context);const source=context.MASTER_DATA||context.window.MASTER_DATA;
 const slots=source.klinik_pembelajaran.jadwal_booking||[{tanggal:'2026-08-03',slot_kelas:{'X-1':{guru:'Guru Contoh',mapel:'Astronomi',status:'Approved'}}}],raw=JSON.stringify(slots),legacy=legacyRecords(slots);
 assert.ok(legacy.length);assert.ok(legacy.some(r=>archived(r,now)));assert.ok(legacy.every(r=>r.status==='legacy'&&r.approved_subject===null));assert.equal(JSON.stringify(slots),raw);assert.throws(()=>approvedAgenda(legacy,now));
});

test('public requests need no teacher identity and cannot carry a report or an approval',()=>{
 const input={...row,teacher_code:null,teacher:'',requester_label:'Contoh tamu',status:'approved',evidence:'https://example.test/private-report'};
 const request=validateRequest(input,now);
 assert.equal(request.teacher_code,null);assert.equal(request.teacher,'');assert.equal(request.requester_label,'Contoh tamu');assert.equal(request.evidence,'');assert.equal(request.status,undefined);
 assert.throws(()=>validateProposal(input,now));
 for(const invalid of [{...input,requester_label:'x'.repeat(101)},{...input,date:'2026-10-28'},{...input,subjects:['Fisika','fisika']},{...input,teacher_code:'unverified'}])assert.throws(()=>validateRequest(invalid,now));
});
test('only complete approved server snapshots may populate the home agenda',()=>{
 const approved={...row,status:'approved',approved_subject:'Astronomi',decided_at:'2026-10-25T10:00Z'};
 assert.equal(approvedAgenda([approved],now).length,1);assert.equal(approvedAgenda([approved],Date.parse('2026-10-26T14:30Z')).length,0);
 assert.throws(()=>approvedAgenda([row],now));assert.throws(()=>parseSnapshot(snapshot([row],{count:2}),'review'));assert.throws(()=>parseSnapshot(snapshot([{...row,year:'2025/2026'}]),'review'));assert.throws(()=>parseSnapshot(snapshot([approved],{teachers:[{kode:'GU',nama:'A'},{kode:'GU',nama:'B'}]}),'review'));
 assert.throws(()=>parseSnapshot(snapshot([{...approved,approved_subject:'Tidak diusulkan'}]),'review'));
});
test('held integration never calls auth or RPC, and exported modules match canonical sources',async()=>{
 let calls=0;const api=clinicClient({auth:{getSession(){calls++}},rpc(){calls++}},false);
 await assert.rejects(()=>api.read());await assert.rejects(()=>api.write({owner,action:'approve',id:row.id,revision:1,data:{},token:'token'}));assert.equal(calls,0);
 const canonical=process.env.CURRICULUM_CANONICAL_ROOT||'../irsyads';
 for(const name of ['clinic-core.mjs','clinic-client.mjs','access-core.mjs'])assert.equal(fs.readFileSync('assets/'+name,'utf8'),fs.readFileSync(canonical+'/packages/curriculum-clinic/'+name,'utf8'));
});
test('client checks identity before and after each request, rejects partial reads and uncertain receipts',async()=>{
 let identity=owner,calls=0,response=snapshot();const client={auth:{async getSession(){return {data:{session:{user:{id:identity}}},error:null}}},rpc(){calls++;return {async abortSignal(){return {data:response,error:null}}}}};
 const api=clinicClient(client,true);assert.equal((await api.read({mode:'mine',owner})).rows[0].id,row.id);
 identity='other';await assert.rejects(()=>api.read({mode:'mine',owner}),/Akun berubah/);assert.equal(calls,1);
 identity=owner;client.rpc=()=>({async abortSignal(){identity='other';return {data:response,error:null}}});await assert.rejects(()=>api.read({mode:'mine',owner}),/Akun berubah/);
 identity=owner;client.rpc=()=>({async abortSignal(){return {data:{id:row.id,revision:99,status:'approved',token:'token'},error:null}}});await assert.rejects(()=>api.write({owner,action:'approve',id:row.id,revision:1,data:{},token:'token'}),/Hasil simpan/);
});
test('public clinic has no browser approval control and print report preserves status provenance',()=>{
 const html=fs.readFileSync('klinik.html','utf8'),page=fs.readFileSync('assets/clinic-page.mjs','utf8');
 assert.ok(!html.includes('openKurasiAdminModal'));assert.ok(!page.includes("setItem('maicn_klinik_bookings'"));assert.ok(page.includes("e.submitter?.id==='clinic-send'"));assert.ok(page.includes("state.pendingToken"));assert.ok(html.includes('clinic-print-report'));assert.ok(page.includes('Status tersimpan:'));assert.ok(page.includes('window.print()'));assert.ok(html.includes('type="date"'));assert.ok(page.includes('studio.irsyads.com/?clinic=review#kurikulum'));
});
test('Monday JP1 stays dated and scoped, with no assumed activity or browser-admin write',()=>{
 assert.equal(nextMonday('2026-10-26'),'2026-10-26');assert.equal(nextMonday('2026-10-27'),'2026-11-02');
 const block={date:'2026-10-26',activity:'KTI',note:'',reason:'Rencana pekan ini'};assert.equal(validateBlock(block).activity,'KTI');assert.throws(()=>validateBlock({...block,date:'2026-10-27'}));assert.throws(()=>validateBlock({...block,reason:''}));
 const source={version:1,institution,year,can_review:false,read_at:new Date(now).toISOString(),count:1,rows:[{...block,institution,year,revision:1,updated_at:new Date(now).toISOString()}]};assert.equal(parseBlockSnapshot(source).rows[0].activity,'KTI');assert.throws(()=>parseBlockSnapshot({...source,count:2}));
 const home=fs.readFileSync('index.html','utf8');assert.ok(home.indexOf('id="clinic-home-title"')<home.indexOf('id="monday-title"'));assert.ok(home.indexOf('id="monday-title"')<home.indexOf('id="ui-schedule-title"'));
 assert.ok(fs.readFileSync('jadwal.html','utf8').includes('window.openMondayBlock()'));assert.ok(fs.readFileSync('assets/curriculum-ui.js','utf8').includes('Dikembangkan oleh'));
});

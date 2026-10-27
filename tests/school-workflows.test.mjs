import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {lessonCatalog,validateSwitch,effectiveLessons,effectiveHomeSource,dutiesToday,validateRequest} from '../assets/school-workflow-core.mjs';
import {capabilities,routeAccess,parseAccess} from '../assets/access-core.mjs';import {journalDocx,journalXlsx} from '../assets/school-journal-export.mjs';
import {decisionEmail} from '../server/clinic-email.mjs';
const data=JSON.parse(fs.readFileSync('master-data.json','utf8'));
test('daily duties have exactly two teachers on every school weekday without odd/even rotation',()=>{
 for(const date of ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'])assert.equal(dutiesToday(data,date).length,2);
 assert.equal(dutiesToday(data,'2026-10-31').length,0);assert.ok(data.jadwal_kbm_v2.guru_piket.every(r=>!/Ganjil|Genap/.test(r.tim)));
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),sandbox);assert.deepEqual(JSON.parse(JSON.stringify((sandbox.MASTER_DATA||sandbox.window.MASTER_DATA).jadwal_kbm_v2.guru_piket)),data.jadwal_kbm_v2.guru_piket);
});
test('switch uses existing blocks with identical class and JP, and expires at the next week',()=>{
 const lessons=[{id:'a',day:2,classroom:'X-2',start:'07:00',end:'08:20',jp:2,teacher_code:'SO',teacher:'Guru Sosiologi',subject:'Sosiologi'},{id:'b',day:4,classroom:'X-2',start:'07:00',end:'08:20',jp:2,teacher_code:'CH',teacher:'Guru Kimia',subject:'Kimia'}];
 const plan={week:'2026-12-07',from_id:'a',to_id:'b'},result=validateSwitch(plan,lessons);assert.equal(result.from_date,'2026-12-08');assert.equal(result.to_date,'2026-12-10');
 for(const changes of [{classroom:'X-1'},{jp:3},{teacher_code:'SO'}])assert.throws(()=>validateSwitch(plan,[lessons[0],{...lessons[1],...changes}]));assert.throws(()=>validateSwitch({...plan,week:'2026-12-08'},lessons));
 const r={id:'switch',kind:'switch',status:'approved',body:plan};assert.equal(effectiveLessons(lessons,[r],'2026-12-07')[0].teacher_code,'CH');assert.equal(effectiveLessons(lessons,[r],'2026-12-14')[0].teacher_code,'SO');assert.equal(lessons[0].teacher_code,'SO');
 assert.equal(effectiveLessons(lessons,[{...r,status:'pending'}],'2026-12-07')[0].teacher_code,'SO');assert.ok(lessonCatalog(data).every(r=>r.jp>0&&r.start<r.end));
});
test('home schedule projection swaps teachers only in the approved week without changing the base source',()=>{
 const source={jadwal_kbm_v2:{jadwal_mingguan:{selasa:[{mulai:'07.00',selesai:'07.40',is_break:false,kelas:{'X-2':{mapel:'Sosiologi',guru_nama:'Guru A',guru_kode:'SO'}}}]}}},before=JSON.stringify(source),change={kind:'switch',status:'approved',body:{week:'2026-12-07',from:{day:2,classroom:'X-2',start:'07:00',end:'08:20',subject:'Sosiologi',teacher:'Guru A',teacher_code:'SO'},to:{day:4,classroom:'X-2',start:'07:00',end:'08:20',subject:'Kimia',teacher:'Guru B',teacher_code:'CH'}}};
 assert.equal(effectiveHomeSource(source,'selasa',[change],'2026-12-08').jadwal_kbm_v2.jadwal_mingguan.selasa[0].kelas['X-2'].mapel,'Kimia');assert.equal(effectiveHomeSource(source,'selasa',[change],'2026-12-15').jadwal_kbm_v2.jadwal_mingguan.selasa[0].kelas['X-2'].mapel,'Sosiologi');assert.equal(JSON.stringify(source),before);
});
test('SSO students can enter journals but cannot access teacher grade or reviewer surfaces',()=>{
 const student=parseAccess({version:1,institution:'MA Insan Cendekia Nusantara',user_id:'student',role:'student',student_id:'a',classroom:'X-2'});assert.equal(student.capabilities.school,true);assert.equal(student.capabilities.teacher,false);assert.equal(capabilities('member').school,false);assert.equal(routeAccess('jurnal.html'),'school');assert.equal(routeAccess('rapor.html'),'teacher');assert.equal(routeAccess('admin.html'),'reviewer');
 const value={date:'2026-12-08',title:'Remedial',start:'15:00',end:'15:40',student_ids:['a']},catalog={students:[{id:'a'}]};assert.throws(()=>validateRequest('remedial',value,catalog,{role:'guest'}));assert.equal(validateRequest('remedial',value,catalog,{role:'student'}).title,'Remedial');
});
test('Office exports are native ZIP packages, preserve literal text and reject incomplete or excessive snapshots',()=>{
 const snapshot={read_at:'2026-10-27T09:00:00Z',count:1,rows:[{kind:'duty',date:'2026-10-27',classroom:'',author:'Guru Contoh',revision:1,content:{activities:'=SUM(1,2) <b>teks</b>',follow_up:'Tindak lanjut'}}]};for(const format of [journalDocx,journalXlsx]){const bytes=format(snapshot);assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);const text=new TextDecoder().decode(bytes);assert.ok(text.includes('SUM(1,2)'));assert.ok(text.includes('&lt;b&gt;'));assert.throws(()=>format({...snapshot,count:2}));assert.throws(()=>format({...snapshot,count:101,rows:Array(101).fill(snapshot.rows[0])}))}
 assert.ok(new TextDecoder().decode(journalXlsx(snapshot)).includes('paperSize="9"'));assert.ok(new TextDecoder().decode(journalDocx(snapshot)).includes('w:w="11906"'));
});
test('school decision emails describe the week-limited switch and use the same noreply sender',()=>{
 const event={id:'example',revision:2,activity_kind:'switch',request_kind:'teacher',status:'approved',contact_email:'guru@example.test',teacher:'Guru Sosiologi',subject:'Sosiologi',title:'Switch Sosiologi',date:'2026-12-08',start:'07:00',end:'08:20',decision_note:'Disepakati',body:{week:'2026-12-07',from:{subject:'Sosiologi'},to:{subject:'Kimia'},from_date:'2026-12-08',to_date:'2026-12-10'}};
 const email=decisionEmail(event);assert.match(email.from,/noreply@irsyads.com/);assert.match(email.subject,/switch jadwal diterima/);assert.match(email.text,/pekan berikutnya kembali/);assert.match(decisionEmail({...event,status:'rejected'}).subject,/ditolak/);
});
test('legacy handlers send users to reviewed services instead of approving browser records',()=>{
 const source=fs.readFileSync('jadwal.html','utf8');for(const name of ['submitFormSwitch','submitFormIzin','submitCatatanPiket']){const start=source.indexOf('window.'+name+' = function'),end=source.indexOf('};',start),body=source.slice(start,end);assert.ok(!body.includes("status: 'Disetujui'"));assert.ok(body.includes('location.href='))}
 assert.ok(fs.readFileSync('index.html','utf8').includes('id="school-home"'));assert.ok(fs.readFileSync('assets/school-admin.mjs','utf8').includes('Konfirmasi keputusan'));assert.ok(fs.readFileSync('assets/school-journals.mjs','utf8').includes('Word A4'));
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {assignedSubjects,accountTeacher} from '../assets/teacher-subjects.mjs';
import {calendarMonths,calendarDocument} from '../assets/calendar-print.mjs';
const source=JSON.parse(await fs.readFile('master-data.json','utf8'));
test('teacher mapel follows verified teacher name even where source codes collide',()=>{
 const teachers=source.jadwal_kbm_v2.matriks_guru;
 const teacher=accountTeacher({teacher:'Muhammad Irsyad Sirojul Khoeir, S.Sos., M.Sos.'},teachers);
 assert.deepEqual(assignedSubjects(teacher,teachers),['Sosiologi']);
 assert.deepEqual(assignedSubjects({nama:'Muhammad Syahrul Bakhtiar, Lc.'},teachers),["Al-Qur'an Hadis"]);
 assert.deepEqual(assignedSubjects({nama:'Tidak tercatat'},teachers),[]);
 assert.equal(accountTeacher({teacher:'Guru tidak tercatat'},teachers),null);
});
test('calendar groups adjacent equal agendas without losing day coverage across leap days',()=>{
 const data={kalender_harian:{'2028-02-28':{c:'a',l:'Agenda A'},'2028-02-29':{c:'a',l:'Agenda A'},'2028-03-01':{c:'b',l:'Agenda B'}}};
 const months=calendarMonths(data);assert.equal(months[0].count,29);assert.deepEqual(months[0].events.map(e=>[e.from,e.to]),[[28,29]]);assert.equal(months[1].events[0].from,1);
 for(const month of calendarMonths(source)){const covered=month.events.reduce((n,e)=>n+e.to-e.from+1,0);assert.equal(covered,Object.entries(source.kalender_harian).filter(([date,v])=>date.startsWith(month.prefix)&&v.l).length)}
});
test('A4 document has seven day columns and bounded agenda pagination, escapes authored text',()=>{
 const html=calendarDocument(source);assert.match(html,/size:A4 landscape/);assert.match(html,/width:277mm/);assert.match(html,/<th>Minggu<\/th><th>Senin<\/th>/);assert.doesNotMatch(html,/900px/);
 assert.equal((html.match(/class="sheet"/g)||[]).length,calendarMonths(source).reduce((n,m)=>n+Math.max(1,Math.ceil(m.events.length/18)),0));
 const malicious=calendarDocument({meta:{},kalender_harian:{'2026-07-01':{l:'<script>bad</script>'}}});assert.ok(!malicious.includes('<script>bad'));assert.ok(malicious.includes('&lt;script&gt;'));
});
test('published program, assessment and workbook pages do not manufacture program readiness or staff',async()=>{
 const programs=await fs.readFile('unggulan.html','utf8'),assessment=await fs.readFile('asesmen.html','utf8'),books=await fs.readFile('buku-kerja.html','utf8');
 assert.match(programs,/Belum ada program unggulan/);assert.doesNotMatch(programs,/Pembimbing Utama|Target Tahfidz|30 Juz|TOEFL minimal/);
 assert.match(assessment,/const ASESMEN_DATA = \[\]/);assert.doesNotMatch(assessment,/Irsyad Fahmi|Dani Ramdani|22 Naskah|berhasil disimpan ke antrean/);
 assert.match(books,/jadwal_kbm_v2\?\.matriks_guru/);assert.doesNotMatch(books,/Irsyad Fahmi|22 Folder Mapel Terverifikasi|✓ Siap/);
});

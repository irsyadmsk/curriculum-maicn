import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {assignedSubjects,accountTeacher,proposalSubjects} from '../assets/teacher-subjects.mjs';
import {calendarMonths,calendarDocument} from '../assets/calendar-print.mjs';
import {calendarHighlights} from '../assets/calendar-year.mjs';
const source=JSON.parse(await fs.readFile('master-data.json','utf8'));
test('teacher proposals carry one subject even when old secondary fields contain values',()=>{
 assert.deepEqual(proposalSubjects(true,['Sosiologi','Fisika','Kimia']),['Sosiologi']);
 assert.deepEqual(proposalSubjects(false,['Sosiologi','Fisika','']),['Sosiologi','Fisika']);
 assert.deepEqual(proposalSubjects(true,['','Fisika','Kimia']),[]);
});
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
test('annual A4 defaults to one sheet and preserves all 13 months, dates and category marks',()=>{
 const before=JSON.stringify(source),model=calendarMonths(source),html=calendarDocument(source);assert.match(html,/size:A4 portrait/);assert.match(html,/width:194mm/);assert.equal((html.match(/class="sheet"/g)||[]).length,1);assert.equal((html.match(/data-month=/g)||[]).length,13);
 assert.equal((html.match(/data-date=/g)||[]).length,model.reduce((n,m)=>n+m.count,0));
 for(const [date,day] of Object.entries(source.kalender_harian))assert.ok(html.includes(`data-date="${date}" data-category="${day.c}"`),date);
 assert.match(html,/<th>SEN<\/th><th>SEL<\/th>/);assert.match(html,/Hari Santri/);assert.doesNotMatch(html,/Hari Murid/);assert.equal(JSON.stringify(source),before);
});
test('annual highlights retain every non-routine event range while grouping repeated labels',()=>{
 for(const month of calendarMonths(source)){const expected=month.events.filter(e=>!['pembelajaran','libur_mingguan'].includes(e.category)),highlights=calendarHighlights(month);assert.equal(highlights.reduce((n,e)=>n+e.ranges.length,0),expected.length);for(const e of expected)assert.ok(highlights.some(h=>h.label===e.label&&h.category===e.category&&h.ranges.includes(e.from===e.to?String(e.from):e.from+'–'+e.to)))}
 const html=calendarDocument({meta:{},kalender_harian:{'2028-02-29':{c:'custom',l:'<script>bad</script>'}},warna_kategori:{custom:{bg:'red;display:none',label:'<b>custom</b>'}}});assert.ok(html.includes('data-date="2028-02-29"'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad'));assert.ok(!html.includes('red;display:none'));
});
test('oversized annual ranges require detail instead of silently omitting months',()=>{
 const days=Object.fromEntries(Array.from({length:17},(_,i)=>{const date=new Date(Date.UTC(2026,i,1)).toISOString().slice(0,10);return [date,{c:'a',l:'Agenda'}]}));const data={meta:{},kalender_harian:days};assert.throws(()=>calendarDocument(data),/rincian bulanan/);assert.equal((calendarDocument(data,{layout:'monthly'}).match(/class="sheet"/g)||[]).length,17);
});
test('monthly detail retains seven day columns and bounded complete agenda pagination',()=>{
 const html=calendarDocument(source,{layout:'monthly'});assert.match(html,/size:A4 landscape/);assert.match(html,/width:277mm/);assert.match(html,/<th>Minggu<\/th><th>Senin<\/th>/);assert.doesNotMatch(html,/900px/);
 assert.equal((html.match(/class="sheet"/g)||[]).length,calendarMonths(source).reduce((n,m)=>n+Math.max(1,Math.ceil(m.events.length/18)),0));
 const malicious=calendarDocument({meta:{},kalender_harian:{'2026-07-01':{l:'<script>bad</script>'}}});assert.ok(!malicious.includes('<script>bad'));assert.ok(malicious.includes('&lt;script&gt;'));
});
test('published program, assessment and workbook pages do not manufacture program readiness or staff',async()=>{
 const programs=await fs.readFile('unggulan.html','utf8'),assessment=await fs.readFile('asesmen.html','utf8'),books=await fs.readFile('buku-kerja.html','utf8');
 assert.match(programs,/Belum ada program unggulan/);assert.doesNotMatch(programs,/Pembimbing Utama|Target Tahfidz|30 Juz|TOEFL minimal/);
 assert.match(assessment,/const ASESMEN_DATA = \[\]/);assert.doesNotMatch(assessment,/Irsyad Fahmi|Dani Ramdani|22 Naskah|berhasil disimpan ke antrean/);
 assert.match(books,/jadwal_kbm_v2\?\.matriks_guru/);assert.doesNotMatch(books,/Irsyad Fahmi|22 Folder Mapel Terverifikasi|✓ Siap/);
});

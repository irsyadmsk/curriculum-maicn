import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const values=new Map();
  const nodes=new Map();
  const context=vm.createContext({window:{},document:{readyState:'loading',addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'X-2'});return nodes.get(id);}},localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
  const input=fs.existsSync('assets/student-roster-data.js')?'assets/student-roster-data.js':'tests/fixtures/student-roster.js';
  for(const file of [input,'assets/student-roster.js','assets/report-roster.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  return {context,roster:context.window.StudentRoster,values,nodes};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('Inline scripts on the roster integration pages parse, including the protected attendance and current character pages',()=>{
  for(const page of ['jadwal.html','karakter.html','presensi.html','rapor.html','murid.html']){
    for(const match of fs.readFileSync(page,'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
      if(match[1].trim())assert.doesNotThrow(()=>new vm.Script(match[1]),page);
    }
  }
});

test('Owner workbook supplies 19 pupils per class and one explicitly unassigned, without invented NIS/NISN or scores',{skip:!fs.existsSync('assets/student-roster-data.js')},()=>{
  const {roster,context}=fixture();
  assert.deepEqual(['X-1','X-2','X-3'].map(name=>roster.forClass(name).length),[19,19,19]);
  assert.equal(roster.assigned().length,57);
  assert.equal(roster.all().length,58);
  assert.equal(new Set(roster.all().map(s=>s.id)).size,58);
  assert.equal(roster.unassigned().length,1);
  assert.equal(roster.unassigned()[0].kelas,null);
  assert.ok(roster.all().every(pupil=>typeof pupil.nama==='string'&&pupil.nama.trim()));
  for(const pupil of roster.all()){
    assert.equal(pupil.nis,null);assert.equal(pupil.nisn,null);
    assert.deepEqual(Object.keys(pupil).sort(),['id','kelas','nama','nis','nisn','nomor','source'].sort());
  }
  assert.equal(context.window.MAICN_STUDENT_ROSTER.source.sha256,'4aae60c0dd2e36161f7715ffbd57786656ab96a0d13a390adeaa765c917346da');
});

test('Missing grade input never becomes zero, a rank or a remedial decision; zero remains valid',()=>{
  const {roster,context,nodes}=fixture();
  for(const input of [null,undefined,'',' ',false,'invalid',-1,101])assert.equal(roster.parseScore(input),null);
  assert.equal(roster.parseScore('0'),0);
  assert.deepEqual(plain(context.calculateNA(0,0,0,0,0,0)),{avgF:0,na:0,complete:true});
  assert.equal(context.calculateNA(0,0,0,0,'',0).na,null);
  assert.equal(context.calculateNA(80,80,80,80,90,100).na,89);
  context.renderTable();context.renderLegerTable();
  assert.equal((nodes.get('rapor-tbody').innerHTML.match(/data-student-id=/g)||[]).length,19);
  assert.equal((nodes.get('rapor-tbody').innerHTML.match(/value=""/g)||[]).length,19*6);
  assert.equal((nodes.get('leger-tbody').innerHTML.match(/BELUM LENGKAP/g)||[]).length,19);
  assert.equal(nodes.get('stat-mean-val').textContent,'—');
  assert.equal(nodes.get('leger-tuntas-count').textContent,'0 / 19');
  assert.ok(!nodes.get('rapor-tbody').innerHTML.includes('data-refer-student='));
});

test('Old numeric demo score records stay untouched and cannot attach to the imported pupil IDs',()=>{
  const {roster,context,values}=fixture();
  const legacy='maicn_rapor_X-1_Sosiologi',original='{"1":{"f1":99,"f2":99}}';values.set(legacy,original);
  assert.deepEqual(plain(context.getScores('X-1','Sosiologi')),{});
  assert.equal(values.size,1);
  context.updateScore(1,'f1','40');assert.equal(values.size,1);
  const id=roster.forClass('X-1')[0].id;
  context.updateScore(id,'f1','0');
  const fresh=JSON.parse(values.get(roster.scoreStorageKey('X-1','Sosiologi')));
  assert.equal(fresh[id].f1,0);assert.equal(fresh[id].asts,null);
  context.updateScore(id,'f1','');
  assert.equal(context.getScores('X-1','Sosiologi')[id].f1,null);
  assert.equal(values.get(legacy),original);
  assert.notEqual(roster.scoreStorageKey('X-1','Sosiologi','ganjil'),roster.scoreStorageKey('X-1','Sosiologi','genap'));
  assert.notEqual(roster.scoreStorageKey('X-1','Sosiologi'),roster.scoreStorageKey('X-2','Sosiologi'));
});

test('Attendance uses stable pupil identities when the source contains no NISN and starts with no assumed attendance',()=>{
  const {roster,context,nodes}=fixture();
  const html=fs.readFileSync('jadwal.html','utf8');
  const load=html.match(/window\.loadStudentsForPresensi = function\(\) \{[\s\S]*?\n  \};/)[0];
  context.STUDENTS_DATA=Object.fromEntries(['X-1','X-2','X-3'].map(name=>[name,roster.forClass(name)]));
  vm.runInContext(load,context);context.window.loadStudentsForPresensi();
  const rendered=nodes.get('tbody-presensi-students').innerHTML;
  const ids=[...rendered.matchAll(/data-student-id="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,19);assert.equal(new Set(ids).size,19);
  assert.ok(rendered.includes(roster.escapeHTML(roster.forClass('X-2')[0].nama)));assert.ok(!rendered.includes(' checked'));
});

test('verified teachers use separate grade namespaces without adopting historical device grades',()=>{
 const {context,roster,values}=fixture();
 const legacy=roster.scoreStorageKey('X-1','Sosiologi');values.set(legacy,'{"source":"old-device-record"}');
 context.window.CurriculumAccess={has:permission=>permission==='teacher',context:{user_id:'teacher-a'}};
 const a=roster.scoreStorageKey('X-1','Sosiologi');
 context.window.CurriculumAccess.context.user_id='teacher-b';
 const b=roster.scoreStorageKey('X-1','Sosiologi');
 assert.notEqual(a,b);assert.notEqual(a,legacy);assert.notEqual(b,legacy);assert.equal(values.get(legacy),'{"source":"old-device-record"}');assert.equal(values.get(a),undefined);assert.equal(values.get(b),undefined);
});

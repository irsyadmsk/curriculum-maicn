import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {}, document: { readyState: 'loading', addEventListener() {} }, Intl, Date, getComputedStyle: element => element.computedStyle };
vm.runInNewContext(fs.readFileSync('assets/curriculum-ui.js', 'utf8'), context);
const ui = context.window.CurriculumUI;
const source = JSON.parse(fs.readFileSync('master-data.json', 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));

test('Home schedule preserves every source lesson for all five days and three classes', () => {
  for (const [day, slots] of Object.entries(source.jadwal_kbm_v2.jadwal_mingguan)) {
    for (const classroom of source.jadwal_kbm_v2.rombongan_belajar) {
      const expected = slots.filter(slot => !slot.is_break && slot.kelas?.[classroom]?.mapel);
      const projected = ui.scheduleFor(source, day, classroom);
      const expanded = projected.flatMap(item => item.jp.map(jp => ({ jp, subject: item.subject, teacher: item.teacher, code: item.code })));
      assert.deepEqual(plain(expanded), expected.map(slot => ({ jp: String(slot.jam_ke), subject: slot.kelas[classroom].mapel, teacher: slot.kelas[classroom].guru_nama || '', code: slot.kelas[classroom].guru_kode || '' })));
    }
  }
});

test('Consecutive periods do not merge across a break or a changed teacher identity', () => {
  const lesson = (start,end,code='A') => ({ mulai:start, selesai:end, jam_ke:'1', kelas:{X:{mapel:'Sosiologi',guru_nama:'Nama sama',guru_kode:code}} });
  const fixture = {jadwal_kbm_v2:{jadwal_mingguan:{senin:[lesson('07.00','07.40'),{is_break:true},lesson('07.40','08.20'),lesson('08.20','09.00','B')]}}};
  assert.equal(ui.scheduleFor(fixture,'senin','X').length,3);
  assert.equal(ui.scheduleFor(fixture,'sabtu','X').length,0);
  assert.equal(ui.scheduleFor(null,'senin','X').length,0);
});

test('Upcoming agenda retains a named weekend event while excluding routine lessons and past events', () => {
  const result = plain(ui.upcomingAgenda(source,'2026-10-26'));
  assert.ok(result.some(item => item.label === 'Puncak Bulan Bahasa' && item.start === '2026-10-31'));
  assert.ok(result.every(item => item.end >= '2026-10-26' && item.category !== 'pembelajaran'));
  assert.equal(ui.upcomingAgenda(source,'2030-01-01').length,0);
});

test('Home calendar uses the Jakarta date across a UTC midnight boundary', () => {
  assert.equal(ui.dateInJakarta(new Date('2026-10-25T18:00:00Z')),'2026-10-26');
  assert.equal(ui.dateInJakarta(new Date('2026-10-25T16:00:00Z')),'2026-10-25');
});

test('Transparent closed calendar overlays never lock navigation; explicit open/close states do', () => {
  const states = new Set();
  const modal = { hidden:false, classList:{contains:state=>states.has(state)}, computedStyle:{display:'flex',visibility:'visible',opacity:'0'} };
  assert.equal(ui.legacyDialogIsOpen(modal),false);
  states.add('active');
  assert.equal(ui.legacyDialogIsOpen(modal),true);
  states.clear();
  assert.equal(ui.legacyDialogIsOpen(modal),false);
  states.add('open');modal.computedStyle.display='none';
  assert.equal(ui.legacyDialogIsOpen(modal),false);
});

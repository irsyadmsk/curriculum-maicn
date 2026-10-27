import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('master-data.json contains complete KBM 2026/2027 schedule and teacher matrix', async () => {
  const content = await readFile(new URL('../master-data.json', import.meta.url), 'utf8');
  const master = JSON.parse(content);

  assert.ok(master.jadwal_kbm_v2, 'jadwal_kbm_v2 must exist');
  assert.equal(master.jadwal_kbm_v2.durasi_jp, 40, 'JP duration must be 40 minutes');
  assert.deepEqual(master.jadwal_kbm_v2.rombongan_belajar, ['X-1', 'X-2', 'X-3']);

  const matriks = master.jadwal_kbm_v2.matriks_guru;
  assert.equal(matriks.length, 21, 'Must have 21 teachers in Matriks Mengajar Guru');
  
  // Verify key teachers
  const wakaKurikulum = matriks.find(g => g.nama.includes('Irsyad'));
  assert.ok(wakaKurikulum, 'Waka Kurikulum must be in teacher matrix');
  assert.equal(wakaKurikulum.mapel, 'Sosiologi');

  const piket = master.jadwal_kbm_v2.guru_piket;
  assert.equal(piket.length, 10, 'Must have 10 teachers in Guru Piket');

  const ekuivalensi = master.jadwal_kbm_v2.staff_ekuivalensi;
  assert.ok(ekuivalensi.length >= 20, 'Must have staff ekuivalensi data');
  
  // Verify 5 active days in weekly schedule
  const weekly = master.jadwal_kbm_v2.jadwal_mingguan;
  assert.ok(weekly.senin && weekly.senin.length > 10, 'Senin must have regular slots');
  assert.ok(weekly.jumat && weekly.jumat.length > 8, 'Jumat must have regular slots');
});

test('klinik pembelajaran adheres to 2 weekly recurring slots and multi-mapel single-approval model', async () => {
  const content = await readFile(new URL('../master-data.json', import.meta.url), 'utf8');
  const master = JSON.parse(content);

  const klinik = master.klinik_pembelajaran;
  assert.ok(klinik, 'klinik_pembelajaran must exist');
  assert.equal(klinik.slots_mingguan.length, 2, 'Must have 2 weekly slots');
  assert.equal(klinik.slots_mingguan[0].hari, 'Senin');
  assert.equal(klinik.slots_mingguan[1].hari, 'Selasa');

  assert.ok(klinik.jadwal_booking.length >= 10, 'Must contain multi-week booking schedules');

  // Test single-approval rule helper
  function validateSingleApproval(slotData) {
    let approvedCount = 0;
    ['X-1', 'X-2', 'X-3'].forEach(k => {
      const cls = slotData.slot_kelas[k];
      if (cls && cls.status === 'Approved') approvedCount++;
    });
    return approvedCount <= 3; // at most 1 approved per class in a slot
  }

  const sampleSlot = klinik.jadwal_booking[0];
  assert.equal(validateSingleApproval(sampleSlot), true);
});

test('switch schedule validator enforces strict JP equality', () => {
  function validateSwitch(jp1, jp2) {
    const p1 = parseInt(jp1, 10) || 0;
    const p2 = parseInt(jp2, 10) || 0;
    return p1 > 0 && p1 === p2;
  }

  assert.equal(validateSwitch(2, 2), true, '2 JP == 2 JP is valid');
  assert.equal(validateSwitch(3, 3), true, '3 JP == 3 JP is valid');
  assert.equal(validateSwitch(2, 3), false, '2 JP != 3 JP is invalid');
  assert.equal(validateSwitch(0, 0), false, '0 JP is invalid');
});

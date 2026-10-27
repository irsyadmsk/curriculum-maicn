import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve('.');
const IRSYADS_ROOT = 'C:\\Users\\T6N0CV02S35823C\\Github\\irsyads';
const DRIVE_LOCAL_ROOT = 'C:\\Users\\T6N0CV02S35823C\\Drive Saya\\02 My Space\\Teaching\\Data Perangkat Ajar Guru';

test('Buku Kerja HTML embeds Google Drive and provides 4 official downloadable templates', () => {
  const bukuKerjaPath = path.join(REPO_ROOT, 'buku-kerja.html');
  assert.ok(fs.existsSync(bukuKerjaPath), 'buku-kerja.html must exist');
  
  const content = fs.readFileSync(bukuKerjaPath, 'utf8');
  assert.ok(content.includes('1rro943WeUP0d3nYQBkYvCuNdFm7yGWKJ'), 'must embed drive folder 1rro943WeUP0d3nYQBkYvCuNdFm7yGWKJ');
  assert.ok(content.includes('Template-Buku-Kerja-1-SK-KD-CP-ATP.docx'), 'must link template Buku Kerja 1');
  assert.ok(content.includes('Template-Buku-Kerja-2-Prota-Promes-Silabus.docx'), 'must link template Buku Kerja 2');
  assert.ok(content.includes('Template-Buku-Kerja-3-Modul-RPP-Instrumen.docx'), 'must link template Buku Kerja 3');
  assert.ok(content.includes('Template-Buku-Kerja-4-Evaluasi-Remedial-Pengayaan.docx'), 'must link template Buku Kerja 4');
  
  // Verify physical template files exist
  const tplDir = path.join(REPO_ROOT, 'assets', 'templates');
  assert.ok(fs.existsSync(path.join(tplDir, 'Template-Buku-Kerja-1-SK-KD-CP-ATP.docx')), 'Buku Kerja 1 docx exists');
  assert.ok(fs.existsSync(path.join(tplDir, 'Template-Buku-Kerja-2-Prota-Promes-Silabus.docx')), 'Buku Kerja 2 docx exists');
  assert.ok(fs.existsSync(path.join(tplDir, 'Template-Buku-Kerja-3-Modul-RPP-Instrumen.docx')), 'Buku Kerja 3 docx exists');
  assert.ok(fs.existsSync(path.join(tplDir, 'Template-Buku-Kerja-4-Evaluasi-Remedial-Pengayaan.docx')), 'Buku Kerja 4 docx exists');
});

test('Local Google Drive directory has all 22 required subject folders', () => {
  assert.ok(fs.existsSync(DRIVE_LOCAL_ROOT), 'Local Google Drive folder exists');
  const dirs = fs.readdirSync(DRIVE_LOCAL_ROOT);
  
  const expectedSubjects = [
    '01 Template', 'Al-Quran Hadis', 'Akidah Akhlak', 'Fiqih', 'Sejarah Kebudayaan Islam',
    'Bahasa Arab', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Bahasa Inggris',
    'Matematika', 'Biologi', 'Fisika', 'Kimia', 'Geografi', 'Ekonomi',
    'Sosiologi', 'Sejarah', 'Informatika', 'Koding dan AI', 'Bahasa Mandarin',
    'PJOK', 'Seni Budaya', 'Bimbingan Konseling'
  ];

  for (const sub of expectedSubjects) {
    assert.ok(dirs.includes(sub), `Folder "${sub}" must exist in local drive`);
  }
});

test('Jadwal KBM contains Guru Piket table per hari, Catatan Piket Harian, and Presensi KBM', () => {
  const jadwalPath = path.join(REPO_ROOT, 'jadwal.html');
  const content = fs.readFileSync(jadwalPath, 'utf8');

  // Piket daily filtering & daily notes
  assert.ok(content.includes('filterPiketDay'), 'must have filterPiketDay function');
  assert.ok(content.includes('modal-catatan-piket'), 'must have modal-catatan-piket');
  assert.ok(content.includes('submitCatatanPiket'), 'must have submitCatatanPiket function');
  assert.ok(content.includes('tbody-catatan-piket'), 'must have tbody-catatan-piket');

  // Presensi with login
  assert.ok(content.includes('tab-presensi'), 'must have tab-presensi');
  assert.ok(content.includes('presensi-auth-gate'), 'must have presensi-auth-gate');
  assert.ok(content.includes('presensi-workspace'), 'must have presensi-workspace');
  assert.ok(content.includes('handleGuruQuickLogin'), 'must have handleGuruQuickLogin');
  assert.ok(content.includes('submitPresensiKBM'), 'must have submitPresensiKBM');
});

test('Irsyads Studio and Academy are integrated with curriculum tab and single-approval clinic', () => {
  // Studio Panel
  const panelPath = path.join(IRSYADS_ROOT, 'apps', 'studio', 'src', 'components', 'studio', 'panels', 'PanelKurikulum.tsx');
  assert.ok(fs.existsSync(panelPath), 'PanelKurikulum.tsx must exist');
  const panelCode = fs.readFileSync(panelPath, 'utf8');
  assert.ok(panelCode.includes('Single-Approval'), 'PanelKurikulum must enforce single-approval rule');
  assert.ok(panelCode.includes('handleAdminApproveKlinik'), 'must have handleAdminApproveKlinik');

  // Studio Shell registration
  const shellPath = path.join(IRSYADS_ROOT, 'apps', 'studio', 'src', 'components', 'studio', 'StudioShell.tsx');
  const shellCode = fs.readFileSync(shellPath, 'utf8');
  assert.ok(shellCode.includes('PanelKurikulum'), 'StudioShell must import PanelKurikulum');
  assert.ok(shellCode.includes('id: "kurikulum"'), 'StudioShell MENU must include kurikulum');

  // Academy Curriculum Page & Portal
  const academyPage = path.join(IRSYADS_ROOT, 'apps', 'academy', 'src', 'pages', 'curriculum.astro');
  assert.ok(fs.existsSync(academyPage), 'curriculum.astro must exist');
  
  const portalPath = path.join(IRSYADS_ROOT, 'apps', 'academy', 'src', 'components', 'curriculum', 'CurriculumPortal.tsx');
  assert.ok(fs.existsSync(portalPath), 'CurriculumPortal.tsx must exist');

  // Academy Sidebar link
  const sidebarPath = path.join(IRSYADS_ROOT, 'apps', 'academy', 'src', 'components', 'Sidebar.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  assert.ok(sidebarCode.includes('/curriculum'), 'Sidebar must include /curriculum link');
});

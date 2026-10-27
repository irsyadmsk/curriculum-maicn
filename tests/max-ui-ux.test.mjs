import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('UI UX MAX: All 10 core curriculum pages exist with unified claymorphic navigation and collapse support', () => {
  const clayPages = [
    'index.html',
    'jadwal.html',
    'klinik.html',
    'kalender.html',
    'buku-kerja.html',
    'kokurikuler.html',
    'asesmen.html',
    'unggulan.html',
    'struktur.html'
  ];

  for (const page of clayPages) {
    const html = read(page);
    assert.ok(html.includes('class="clay-sidebar"'), `${page} must include clay-sidebar`);
    assert.ok(html.includes('clay-collapse-btn'), `${page} must include desktop sidebar collapse button`);
    assert.ok(html.includes('irsyads-service-nav'), `${page} must include Irsyads ecosystem service nav launcher`);
    assert.ok(html.includes('clay-mobile-bottom-nav'), `${page} must include sticky mobile bottom nav`);
    assert.ok(html.includes('kokurikuler.html'), `${page} must link to P5-PPRA module in navigation`);
    assert.ok(html.includes('asesmen.html'), `${page} must link to Asesmen & Bank Soal in navigation`);
    assert.ok(html.includes('unggulan.html'), `${page} must link to Program Unggulan in navigation`);
  }

  const adminHtml = read('admin.html');
  assert.ok(adminHtml.includes('kokurikuler.html'), 'admin.html must link to P5-PPRA');
  assert.ok(adminHtml.includes('asesmen.html'), 'admin.html must link to Asesmen');
  assert.ok(adminHtml.includes('unggulan.html'), 'admin.html must link to Unggulan');
  assert.ok(adminHtml.includes('irsyads-service-nav'), 'admin.html must have irsyads-service-nav');
});

test('UI UX MAX: Desktop Collapsible Sidebar & Mobile Navigation Architecture', () => {
  const js = read('assets/dashboard-clay.js');
  assert.ok(js.includes('toggleSidebarCollapse'), 'dashboard-clay.js must provide toggleSidebarCollapse');
  assert.ok(js.includes('maicn_sidebar_collapsed'), 'dashboard-clay.js must persist collapse state to localStorage');
  assert.ok(js.includes("e.key === '['"), 'dashboard-clay.js must support "[" shortcut to toggle sidebar collapse');
  assert.ok(js.includes('toggleClayDrawer'), 'dashboard-clay.js must provide mobile drawer toggle');
  assert.ok(js.includes('IrsyadsServiceNavigation.mount'), 'dashboard-clay.js must auto-mount Irsyads ecosystem navigation');

  const css = read('assets/dashboard-clay.css');
  assert.ok(css.includes('body.sidebar-collapsed .clay-sidebar'), 'dashboard-clay.css must define collapsed sidebar styles');
  assert.ok(css.includes('width: 76px'), 'collapsed sidebar must narrow to 76px icon-rail mode');
  assert.ok(css.includes('.clay-collapse-btn'), 'dashboard-clay.css must style collapse toggle button');
  assert.ok(css.includes('.clay-mobile-bottom-nav'), 'dashboard-clay.css must style sticky mobile bottom nav');
});

test('UI UX MAX: kokurikuler integrates the current profile and Panca Cinta without mandatory demo themes', () => {
  const html=read('kokurikuler.html');
  assert.ok(html.includes('KMA 1503 Tahun 2025'));
  assert.ok(html.includes('6077 Tahun 2025'));
  assert.ok(html.includes('Delapan dimensi profil lulusan') && html.includes('Panca Cinta'));
  assert.ok(html.includes('bukan daftar tema wajib nasional'));
  assert.ok(html.includes('karakter.html'));
});

test('UI UX MAX: Feature 2 — Asesmen & Bank Soal (ASTS, ASAS, KKTP 75, CBT)', () => {
  const html = read('asesmen.html');
  assert.ok(html.includes('KKTP 75'), 'asesmen.html must define KKTP = 75 threshold');
  assert.ok(html.includes('ASTS Ganjil'), 'asesmen.html must include ASTS schedule');
  assert.ok(html.includes('ASAS Ganjil'), 'asesmen.html must include ASAS schedule');
  assert.ok(html.includes('cbt.irsyads.com'), 'asesmen.html must link to Irsyads CBT platform');
  assert.ok(html.includes('40%') && html.includes('30%'), 'asesmen.html must describe the official grading weight formula');
  assert.ok(html.includes('for="as-mapel"'), 'asesmen.html modal must have accessible mapel label');
  assert.ok(html.includes('for="as-catatan"'), 'asesmen.html modal must have accessible catatan label');
});

test('UI UX MAX: Feature 3 — Program Unggulan Madrasah (4 Pilar Distingsi)', () => {
  const html = read('unggulan.html');
  assert.ok(html.includes('30 Juz'), 'unggulan.html must feature Tahfidz 30 Juz program');
  assert.ok(html.includes('KTI &amp; Riset') || html.includes('Karya Tulis Ilmiah'), 'unggulan.html must feature KTI/Riset Santri');
  assert.ok(html.includes('KSM &amp; OSN') || html.includes('Olimpiade Sains'), 'unggulan.html must feature Olimpiade Sains');
  assert.ok(html.includes('Bilingual') || html.includes('Language Zone'), 'unggulan.html must feature Bilingual Boarding Zone');
  assert.ok(html.includes('Pembimbing Utama'), 'unggulan.html must display roster pembimbing');
});

test('UI UX MAX: Feature 4 — Buku Kerja Cloud Explorer (Zero Broken Iframes)', () => {
  const html = read('buku-kerja.html');
  assert.ok(!html.includes('<iframe src="https://drive.google.com/embeddedfolderview'), 'buku-kerja.html must NOT have broken google drive iframe');
  assert.ok(html.includes('1rro943WeUP0d3nYQBkYvCuNdFm7yGWKJ'), 'buku-kerja.html must have official Google Drive Folder ID');
  assert.ok(html.includes('Buka Google Drive di Tab Baru'), 'buku-kerja.html must offer direct tab opener');
  assert.ok(html.includes('Salin Path Lokal'), 'buku-kerja.html must offer local drive path copy button');
  assert.ok(html.includes('live-folder-search'), 'buku-kerja.html must have live search input');
});

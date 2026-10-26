import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve('.');

function read(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

test('Fitur 1 — E-Rapor Madrasah & Leger Nilai Interaktif (KMA 450/2024)', () => {
  const raporPath = path.join(REPO_ROOT, 'rapor.html');
  assert.ok(fs.existsSync(raporPath), 'rapor.html must exist');

  const html = read('rapor.html');

  // Unified claymorphic design & navigation
  assert.ok(html.includes('class="clay-sidebar"'), 'rapor.html must have clay-sidebar');
  assert.ok(html.includes('clay-collapse-btn'), 'rapor.html must have clay-collapse-btn');
  assert.ok(html.includes('irsyads-service-nav'), 'rapor.html must have irsyads-service-nav');
  assert.ok(html.includes('clay-mobile-bottom-nav'), 'rapor.html must have clay-mobile-bottom-nav');
  assert.ok(html.includes('dashboard-clay.js'), 'rapor.html must load dashboard-clay.js');

  // KMA 450 / 2024 & Formula 40:30:30
  assert.ok(html.includes('40 : 30 : 30') || html.includes('40%'), 'rapor.html must specify 40% Formatif + 30% ASTS + 30% ASAS');
  assert.ok(html.includes('75.0') || html.includes('KKTP 75'), 'rapor.html must specify KKTP 75 threshold');

  // Input, Leger & LHB Tabs
  assert.ok(html.includes('id="rapor-tab-input"'), 'rapor.html must have input tab');
  assert.ok(html.includes('id="rapor-tab-leger"'), 'rapor.html must have leger tab');
  assert.ok(html.includes('id="rapor-tab-preview"'), 'rapor.html must have LHB preview tab');

  // Klinik Pembelajaran Referral integration
  assert.ok(read('assets/report-roster.js').includes('openRujukModal'), 'report module must provide openRujukModal');
  assert.ok(html.includes('klinik.html'), 'rapor.html must link to klinik.html for remedial referrals');

  // CSV Export & Persistence
  assert.ok(html.includes('exportLegerCSV'), 'rapor.html must have CSV export function');
  assert.ok(read('assets/report-roster.js').includes('localStorage'), 'report module must persist scores to localStorage');

  // Official LHB Report Sheet & Signatures
  assert.ok(html.includes('LAPORAN HASIL BELAJAR (LHB)'), 'rapor.html must render official LHB title');
  assert.ok(html.includes('Ahmad Ambari, S.Pd.I., M.Pd.'), 'rapor.html must have Kepala Madrasah signature');
  assert.ok(html.includes('id="lhb-sign-walikelas"'), 'rapor.html must retain Wali Kelas signature field without inventing an appointment');
});

test('Fitur 2 — Dokumen Kurikulum Operasional Madrasah (KOM) Interaktif (KMA 450/2024)', () => {
  const komPath = path.join(REPO_ROOT, 'kom.html');
  assert.ok(fs.existsSync(komPath), 'kom.html must exist');

  const html = read('kom.html');

  // Unified claymorphic design
  assert.ok(html.includes('class="clay-sidebar"'), 'kom.html must have clay-sidebar');
  assert.ok(html.includes('irsyads-service-nav'), 'kom.html must have irsyads-service-nav');
  assert.ok(html.includes('clay-mobile-bottom-nav'), 'kom.html must have clay-mobile-bottom-nav');

  // Document metadata & Definitive status
  assert.ok(html.includes('MA-ICN/KAL-AK/2026-2027/001'), 'kom.html must include official document number');
  assert.ok(html.includes('DEFINITIF'), 'kom.html must state definitive status');
  assert.ok(html.includes('Muhammad Irsyad Sirojul Khoeir, S.Sos., M.Sos.'), 'kom.html must mention Waka Kurikulum');
  assert.ok(html.includes('Ahmad Ambari, S.Pd.I., M.Pd.'), 'kom.html must mention Kepala Madrasah');

  // 5 Mandatory Chapters
  assert.ok(html.includes('kom-sec-bab1'), 'kom.html must contain Bab I: Karakteristik');
  assert.ok(html.includes('kom-sec-bab2'), 'kom.html must contain Bab II: Visi, Misi, dan Tujuan');
  assert.ok(html.includes('kom-sec-bab3'), 'kom.html must contain Bab III: Pengorganisasian Pembelajaran');
  assert.ok(html.includes('kom-sec-bab4'), 'kom.html must contain Bab IV: Perencanaan Pembelajaran');
  assert.ok(html.includes('kom-sec-bab5'), 'kom.html must contain Bab V: Pendampingan, Evaluasi, dan PKB');

  // Legal Endorsement (SK Pengesahan Kemenag)
  assert.ok(html.includes('SURAT KEPUTUSAN PENGESAHAN KOM'), 'kom.html must contain Surat Keputusan Pengesahan');
  assert.ok(html.includes('Kantor Kementerian Agama Kabupaten Purwakarta'), 'kom.html must cite Kemenag Purwakarta endorsement');
  assert.ok(html.includes('filterKomContent'), 'kom.html must support real-time search filtering');
});

test('Fitur 3 — Audit Beban Mengajar SIMPATIKA (24 JP Guru Kemenag) di struktur.html', () => {
  const html = read('struktur.html');

  assert.ok(html.includes('id="simpatika-audit"'), 'struktur.html must have SIMPATIKA audit section');
  assert.ok(html.includes('id="simpatika-table"'), 'struktur.html must have SIMPATIKA audit table');
  assert.ok(html.includes('renderSimpatikaTable'), 'struktur.html must provide renderSimpatikaTable function');
  assert.ok(html.includes('staff_ekuivalensi'), 'struktur.html must read staff_ekuivalensi from master data');
  assert.ok(html.includes('MEMENUHI (≥24 JP)'), 'struktur.html must validate 24 JP threshold');
});

test('Fitur 4 — catatan perkembangan dan pembiasaan memakai dimensi profil lulusan serta Panca Cinta', () => {
  const html = read('karakter.html'), code=read('assets/kokurikuler-records.js');
  for(const field of ['character-pupil','character-dimension','character-love','character-observation','character-followup'])assert.ok(html.includes('id="'+field+'"'));
  assert.ok(html.includes('Salat berjamaah') && html.includes('Tilawah'));
  assert.ok(html.includes('Kosong berarti tidak dicatat'));
  assert.ok(code.includes('maicn_p5_observasi_logs') && code.includes('maicn_mutabaah_logs'), 'legacy records remain readable without rewriting their keys');
  assert.ok(!code.includes("removeItem("));
});

test('Fitur 5 — Integrasi Navigasi Global Portal Kurikulum & Madrasah', () => {
  const clayPages = [
    'index.html',
    'jadwal.html',
    'klinik.html',
    'kalender.html',
    'buku-kerja.html',
    'kokurikuler.html',
    'asesmen.html',
    'unggulan.html',
    'struktur.html',
    'rapor.html',
    'kom.html'
  ];

  for (const page of clayPages) {
    const html = read(page);
    assert.ok(html.includes('href="rapor.html"'), `${page} must link to E-Rapor (rapor.html) in navigation`);
    assert.ok(html.includes('href="kom.html"'), `${page} must link to Kurikulum KOM (kom.html) in navigation`);
    assert.ok(html.includes('kokurikuler.html'), `${page} must link to Kokurikuler in navigation`);
    assert.ok(html.includes('asesmen.html'), `${page} must link to Asesmen in navigation`);
  }

  // Dashboard shortcuts in index.html
  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('E-Rapor &amp; Leger Nilai'), 'index.html quick grid must link to E-Rapor');
  assert.ok(indexHtml.includes('Dokumen Kurikulum (KOM)'), 'index.html quick grid must link to KOM');
});

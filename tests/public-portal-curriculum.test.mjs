import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve('.');

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

test('AG-CURR-03: Header and Ecosystem Doors to Irsyads, Academy, and Studio', () => {
  const pages = ['index.html', 'kalender.html', 'jadwal.html'];
  for (const p of pages) {
    const html = read(p);
    assert.ok(html.includes('class="irsyads-portal-doors"'), `${p} must include .irsyads-portal-doors`);
    assert.ok(html.includes('data-door="site"'), `${p} must have door to irsyads.com`);
    assert.ok(html.includes('https://irsyads.com/'), `${p} must link to https://irsyads.com/`);
    assert.ok(html.includes('data-door="academy"'), `${p} must have door to academy.irsyads.com`);
    assert.ok(html.includes('https://academy.irsyads.com/'), `${p} must link to https://academy.irsyads.com/`);
    assert.ok(html.includes('data-door="studio"'), `${p} must have door to studio.irsyads.com`);
    assert.ok(html.includes('https://studio.irsyads.com/?lang=id#kurikulum'), `${p} must link to studio kurikulum gateway`);
  }
});

test('AG-CURR-03: Dynamic Language Preservation for Visitor in dashboard-clay.js', () => {
  const js = read('assets/dashboard-clay.js');
  assert.ok(js.includes('updateEcosystemDoors'), 'dashboard-clay.js must provide updateEcosystemDoors');
  assert.ok(js.includes('resolveVisitorLanguage'), 'dashboard-clay.js must resolve visitor language preference');
  assert.ok(js.includes('irsyads-language-change'), 'dashboard-clay.js must listen for language change events');
  assert.ok(js.includes('#kurikulum'), 'dashboard-clay.js must route studio links with hash #kurikulum');
});

test('AG-CURR-03: Visual Identity, Palette Tokens and Typography Pairings', () => {
  const css = read('assets/dashboard-clay.css');
  assert.ok(css.includes('#F3EDE2'), 'CSS must define WarmIvory #F3EDE2');
  assert.ok(css.includes('#0B1D35'), 'CSS must define DeepNavy #0B1D35');
  assert.ok(css.includes('#376A9B'), 'CSS must define AcademicBlue #376A9B');
  assert.ok(css.includes('#D9CCB9'), 'CSS must define Beige #D9CCB9');
  assert.ok(css.includes('#586574'), 'CSS must define Slate #586574');

  assert.ok(css.includes("'Playfair Display'"), 'CSS must pair Playfair Display for headings');
  assert.ok(css.includes("'Plus Jakarta Sans'"), 'CSS must pair Plus Jakarta Sans for body');
  assert.ok(css.includes("'Libre Baskerville'"), 'CSS must pair Libre Baskerville for quotes');
  assert.ok(!css.includes("'DM Mono'"), 'CSS must not use DM Mono (owner mandate: Plus Jakarta Sans for labels)');
});

test('AG-CURR-03: Calendar Cross-January Range & Explicit 0 JP Handling', () => {
  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('id="section-calendar"'), 'index.html must have calendar section');
  assert.ok(indexHtml.includes('21 Des 2026 – 03 Jan 2027'), 'index.html must include cross-January date range');
  assert.ok(indexHtml.includes('0 JP · Non-KBM / Libur Semester'), 'index.html must explicitly badge 0 JP for non-KBM/holidays');
  assert.ok(indexHtml.includes('jp-badge-zero'), 'index.html must render jp-badge-zero');

  const kalenderHtml = read('kalender.html');
  assert.ok(kalenderHtml.includes('0 JP (Non-KBM)'), 'kalender.html modal must handle 0 JP for non-KBM days');
});

test('AG-CURR-03: Real 21 Teachers Directory with Search on Portal', () => {
  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('id="section-teachers"'), 'index.html must have teachers directory section');
  assert.ok(indexHtml.includes('id="portal-teacher-search"'), 'index.html must have live search input');
  assert.ok(indexHtml.includes('id="portal-teacher-list"'), 'index.html must have list container for teachers');
  assert.ok(read('assets/curriculum-ui.js').includes('renderPortalTeachers'), 'UI module must provide renderPortalTeachers');
  assert.ok(indexHtml.includes('filterPortalTeachers'), 'index.html must filter teachers dynamically');

  const master = JSON.parse(read('master-data.json'));
  assert.equal(master.jadwal_kbm_v2.matriks_guru.length, 21, 'Must have exactly 21 real teachers in master data');
});

test('AG-CURR-03: Honest Academic Workbooks & Valid Google Drive Link', () => {
  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('id="section-workbooks"'), 'index.html must have workbooks section');
  assert.ok(indexHtml.includes('1rro943WeUP0d3nYQBkYvCuNdFm7yGWKJ'), 'index.html must reference official Drive Folder ID');
  assert.ok(indexHtml.includes('Draf Rujukan Internal'), 'index.html must transparently label workbooks as draft');
});

test('AG-CURR-03: Ergonomics, Mobile 390px, Focus-Visible, Reduced Motion & RTL', () => {
  const css = read('assets/dashboard-clay.css');
  assert.ok(css.includes('@media (max-width: 390px)'), 'CSS must include mobile 390px responsive rules');
  assert.ok(css.includes('min-height: 44px') || css.includes('44px'), 'CSS must enforce 44px minimum touch targets');
  assert.ok(css.includes(':focus-visible'), 'CSS must define keyboard :focus-visible styles');
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'CSS must respect prefers-reduced-motion');
  assert.ok(css.includes('[dir="rtl"]'), 'CSS must provide RTL layout adjustments');
  assert.ok(css.includes('overflow-x: auto'), 'CSS must support controlled horizontal table scrolling');

  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('class="skip-link"'), 'index.html must have accessible skip link');
  assert.ok(indexHtml.includes('id="main-clay-content"'), 'index.html must have skip link target container');
});

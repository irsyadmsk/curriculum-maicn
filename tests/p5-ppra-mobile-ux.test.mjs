import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('public kokurikuler has eight profile dimensions and five Panca Cinta values, with protected teacher observations', () => {
  const html=fs.readFileSync('kokurikuler.html','utf8'), character=fs.readFileSync('karakter.html','utf8');
  for(const text of ['Keimanan dan ketakwaan terhadap Tuhan Yang Maha Esa','Kewargaan','Penalaran kritis','Kreativitas','Kolaborasi','Kemandirian','Kesehatan','Komunikasi','Cinta Allah dan Rasul-Nya','Cinta Ilmu','Cinta Lingkungan','Cinta Diri dan Sesama Manusia','Cinta Tanah Air'])assert.ok(html.includes(text),text);
  assert.ok(html.includes('Informasi untuk murid'));
  assert.ok(html.includes('tanpa akun'));
  assert.ok(character.includes('data-needs="teacher"'));
  for(const field of ['character-pupil','character-class','character-dimension','character-love','character-observation'])assert.ok(character.includes('for="'+field+'"'),field);
  assert.ok(fs.readFileSync('p5-ppra.html','utf8').includes('url=kokurikuler.html'), 'old bookmark remains a redirect');
});

test('Mobile UI responsiveness is complete across all curriculum pages', () => {
  const css = fs.readFileSync(path.resolve('assets/dashboard-clay.css'), 'utf-8');

  // Verify CSS responsive rules
  assert.ok(css.includes('.clay-mobile-menu-btn'), 'Must have mobile menu button class');
  assert.ok(css.includes('.clay-drawer-close-btn'), 'Must have drawer close button class');
  assert.ok(css.includes('.clay-drawer-backdrop'), 'Must have drawer backdrop class');
  assert.ok(css.includes('.clay-mobile-bottom-nav'), 'Must have mobile bottom nav class');
  assert.ok(css.includes('body.drawer-open .clay-sidebar'), 'Must have drawer open selector');
  assert.ok(css.includes('grid-template-columns: repeat(2, 1fr) !important'), 'Must have 2x2 grid for stats on small screens');

  // Verify core pages have mobile enhancements
  const pages = ['index.html', 'jadwal.html', 'klinik.html', 'kalender.html', 'buku-kerja.html', 'kokurikuler.html'];
  for (const page of pages) {
    const html = fs.readFileSync(path.resolve(page), 'utf-8');
    assert.ok(html.includes('clay-mobile-menu-btn'), `${page} must include mobile menu button`);
    assert.ok(html.includes('clay-drawer-close-btn'), `${page} must include drawer close button`);
    assert.ok(html.includes('clay-drawer-backdrop'), `${page} must include drawer backdrop`);
    assert.ok(html.includes('clay-mobile-bottom-nav'), `${page} must include sticky mobile bottom nav`);
    assert.ok(html.includes('kokurikuler.html'), `${page} must link to Kokurikuler in navigation`);
    assert.ok(html.includes('dashboard-clay.js'), `${page} must include dashboard-clay.js`);
  }
});

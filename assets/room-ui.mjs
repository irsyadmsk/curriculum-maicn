/** Komponen tampilan bersama ruang guru, ruang admin, dan peluncur layanan. */
import {AKG_DOMAINS, AKG_SCALE, akgDomainScores, akgPredicate} from './room-core.mjs';
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const paths = {
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  check: 'M4 12.5 9.5 18 20 6.5',
  clinic: 'M6 3v5a5 5 0 0 0 10 0V3M4 3h4m6 0h4M11 13v3a5 5 0 0 0 10 0v-2',
  swap: 'M7 4 3 8l4 4M3 8h14m0 12 4-4-4-4m4 4H7',
  remedial: 'M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0 0 4h13M9 8h6m-6 4h4',
  absence: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.600-7 10-7 10Zm0-12v5m-2.500-2.500h5',
  note: 'M5 3h11l3 3v15H5zM9 9h6m-6 4h6m-6 4h3',
  journal: 'M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zm4 0v16m4-11h4m-4 4h4',
  eye: 'M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  project: 'M20 3S6 1 4 10s8 15 13 7S20 3 20 3ZM4 21 15 9',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2',
  database: 'M4 6c0-1.700 3.600-3 8-3s8 1.300 8 3-3.600 3-8 3-8-1.300-8-3Zm0 0v12c0 1.700 3.600 3 8 3s8-1.300 8-3V6M4 12c0 1.700 3.600 3 8 3s8-1.300 8-3',
  book: 'M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16',
  shield: 'M12 3 4 6v6c0 5 3.400 8 8 9 4.600-1 8-4 8-9V6Z',
  refresh: 'M20 11a8 8 0 1 0-2.300 5.700M20 4v7h-7',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 19h16',
  print: 'M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  alert: 'M12 3 2 20h20Zm0 6v5m0 3v.500'
};
export const icon = name => `<svg class="room-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/></svg>`;

const dateFormat = new Intl.DateTimeFormat('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
const shortFormat = new Intl.DateTimeFormat('id-ID', {day: 'numeric', month: 'short', timeZone: 'UTC'});
export const longDate = iso => iso ? dateFormat.format(new Date(iso + 'T00:00:00Z')) : '';
export const shortDate = iso => iso ? shortFormat.format(new Date(iso + 'T00:00:00Z')) : '';

/** Tab ARIA dengan navigasi panah, hash, dan transisi panel. */
export function mountTabs(host, tabs, onShow, {hash = true, label = 'Bagian ruang'} = {}) {
  const list = document.createElement('div'), panel = document.createElement('div');
  list.className = 'room-tabs'; list.setAttribute('role', 'tablist'); list.setAttribute('aria-label', label);
  panel.className = 'room-panel'; panel.setAttribute('role', 'tabpanel'); panel.tabIndex = -1;
  list.innerHTML = tabs.map(t => `<button type="button" role="tab" id="room-tab-${t.id}" data-tab="${t.id}" aria-selected="false" tabindex="-1">${icon(t.icon)}<span>${esc(t.label)}</span><b class="room-badge" data-badge="${t.id}" hidden></b></button>`).join('');
  host.append(list, panel);
  let current = null;
  function show(id, focus = false) {
    const tab = tabs.find(t => t.id === id) || tabs[0];
    if (current === tab.id) return;
    current = tab.id;
    for (const button of list.children) { const active = button.dataset.tab === tab.id; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; if (active) { if (focus) button.focus(); button.scrollIntoView({block: 'nearest', inline: 'center'}); } }
    panel.setAttribute('aria-labelledby', 'room-tab-' + tab.id);
    panel.classList.remove('room-enter'); void panel.offsetWidth; panel.classList.add('room-enter');
    if (hash) history.replaceState(null, '', '#' + tab.id);
    onShow(tab.id, panel);
  }
  list.addEventListener('click', event => { const button = event.target.closest('[data-tab]'); if (button) show(button.dataset.tab); });
  list.addEventListener('keydown', event => {
    const index = tabs.findIndex(t => t.id === current), move = {ArrowRight: 1, ArrowLeft: -1}[event.key];
    if (move) { event.preventDefault(); show(tabs[(index + move + tabs.length) % tabs.length].id, true); }
    if (event.key === 'Home') { event.preventDefault(); show(tabs[0].id, true); }
    if (event.key === 'End') { event.preventDefault(); show(tabs.at(-1).id, true); }
  });
  if (hash) window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (tabs.some(t => t.id === id)) show(id); });
  return {show, panel, badge(id, value) { const b = list.querySelector(`[data-badge="${id}"]`); if (b) { b.hidden = !value; b.textContent = value || ''; } }, get current() { return current; }};
}

let toastHost = null;
export function toast(message, tone = 'ok') {
  if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'room-toasts'; toastHost.setAttribute('role', 'status'); toastHost.setAttribute('aria-live', 'polite'); document.body.append(toastHost); }
  const item = document.createElement('div'); item.className = 'room-toast'; item.dataset.tone = tone; item.innerHTML = icon(tone === 'ok' ? 'check' : 'alert') + '<span></span>'; item.querySelector('span').textContent = message;
  toastHost.append(item); setTimeout(() => { item.classList.add('leaving'); setTimeout(() => item.remove(), 260); }, tone === 'ok' ? 3200 : 6000);
}
export const empty = (title, text, name = 'note') => `<div class="room-empty">${icon(name)}<strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
export const notice = (text, tone = 'info') => `<p class="room-notice" data-tone="${tone}" role="${tone === 'error' ? 'alert' : 'status'}">${icon(tone === 'info' ? 'clock' : 'alert')}<span>${esc(text)}</span></p>`;
/** Menandai tombol sedang bekerja agar tidak ditekan dua kali. */
export async function busy(button, task) {
  if (button.disabled) return; button.disabled = true; button.setAttribute('aria-busy', 'true');
  try { return await task(); } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
export function download(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], {type})), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Semua layanan kurikulum dalam satu peluncur. `needs` hanya tampilan; Worker dan SQL yang memutuskan akses. */
export const SERVICES = Object.freeze([
  {group: 'Ajukan', id: 'switch', href: 'layanan.html?kind=switch#ajukan', icon: 'swap', title: 'Switch jadwal', text: 'Tukar blok mengajar pada kelas dan JP yang sama untuk satu pekan.'},
  {group: 'Ajukan', id: 'remedial', href: 'layanan.html?kind=remedial#ajukan', icon: 'remedial', title: 'Ajukan remedial', text: 'Guru atau murid mengajukan jadwal remedial dengan akun sekolah.'},
  {group: 'Ajukan', id: 'clinic', href: 'klinik.html', icon: 'clinic', title: 'Klinik pembelajaran', text: 'Pilih sesi klinik dan pengayaan per mata pelajaran.'},
  {group: 'Ajukan', id: 'absence', href: 'layanan.html?kind=absence#ajukan', icon: 'absence', title: 'Sakit, izin, dispensasi', text: 'Lapor murid sakit atau ajukan izin dan dispensasi KBM.'},
  {group: 'Ajukan', id: 'project', href: 'layanan.html?kind=project#ajukan', icon: 'project', title: 'Proyek kokurikuler', text: 'Usulkan proyek atau kolaborasi lintas mata pelajaran.'},
  {group: 'Catat', id: 'note', href: 'ruang-guru.html#catatan', icon: 'note', title: 'Catatan harian guru', text: 'Refleksi singkat pembelajaran dan tindak lanjut setiap hari.', needs: 'teacher'},
  {group: 'Catat', id: 'journal', href: 'jurnal.html', icon: 'journal', title: 'Jurnal kelas dan piket', text: 'Jurnal harian oleh wali kelas, ketua kelas, dan guru piket.', needs: 'school'},
  {group: 'Catat', id: 'supervision', href: 'ruang-guru.html#supervisi', icon: 'eye', title: 'Supervisi saya', text: 'Jadwal dan hasil supervisi akademik format AKG.', needs: 'teacher'},
  {group: 'Kelola', id: 'review', href: 'kurikulum.html', icon: 'check', title: 'Ruang persetujuan', text: 'Staf kurikulum memutuskan klinik dan switch jadwal.', needs: 'reviewer'},
  {group: 'Kelola', id: 'admin', href: 'ruang-admin.html', icon: 'shield', title: 'Ruang admin', text: 'Analisis, seluruh persetujuan, catatan guru, dan supervisi.', needs: 'admin'}
]);
export function serviceCards(has, {exclude = [], groups = null} = {}) {
  const visible = SERVICES.filter(s => !exclude.includes(s.id) && (!groups || groups.includes(s.group)) && (!s.needs || has(s.needs)));
  return [...new Set(visible.map(s => s.group))].map(group => `<section class="room-launch-group"><h3>${esc(group)}</h3><div class="room-launch">${visible.filter(s => s.group === group).map(s => `<a class="room-launch-card" href="${s.href}" data-access-fixed="true" data-service="${s.id}"><span class="room-launch-icon">${icon(s.icon)}</span><span class="room-launch-text"><strong>${esc(s.title)}</strong><small>${esc(s.text)}</small></span>${icon('arrow')}</a>`).join('')}</div></section>`).join('');
}

/** Kartu hasil supervisi AKG; `ack` menampilkan formulir tanda terima untuk guru yang bersangkutan. */
export function resultCard(r, {ack = false} = {}) {
  const domains = akgDomainScores(r.scores);
  return `<article class="room-record room-result"><header><strong>${esc(longDate(r.date))} · ${esc(r.subject)}${r.classroom ? ' · ' + esc(r.classroom) : ''}</strong><small>Supervisor: ${esc(r.supervisor)}</small></header>
   <div class="room-score"><span class="room-score-value">${Number(r.score).toLocaleString('id-ID', {maximumFractionDigits: 1})}</span><span class="room-score-label">${esc(akgPredicate(r.score))}</span></div>
   <div class="room-bars">${domains.map(d => `<div class="room-bar-row"><span>${esc(d.name)}</span><div class="room-bar" role="img" aria-label="${esc(d.name)} ${d.score}"><i style="--w:${d.score}%"></i></div><b>${Math.round(d.score)}</b></div>`).join('')}</div>
   <details class="room-details"><summary>Rincian butir</summary>${AKG_DOMAINS.map(d => `<h4>${esc(d.name)}</h4><ul class="room-item-list">${d.items.map(([id, text]) => `<li><span>${esc(text)}</span><b title="${esc(AKG_SCALE[r.scores[id]] || '')}">${esc(r.scores[id])}</b></li>`).join('')}</ul>`).join('')}</details>
   ${r.notes.strengths ? `<p><b>Kekuatan:</b> ${esc(r.notes.strengths)}</p>` : ''}${r.notes.improvements ? `<p><b>Perlu ditingkatkan:</b> ${esc(r.notes.improvements)}</p>` : ''}<p><b>Tindak lanjut:</b> ${esc(r.notes.follow_up)}</p>
   ${r.acknowledged_at ? `<p class="room-ack">${icon('check')}<span>Diterima guru${r.acknowledged_note ? ': ' + esc(r.acknowledged_note) : ''}</span></p>` : !ack ? `<p class="room-ack" data-pending="true">${icon('clock')}<span>Belum dibaca guru</span></p>` : `<form class="room-form room-ack-form" data-ack="${r.id}"><label class="room-field"><span>Tanggapan guru (opsional)</span><textarea name="note" rows="2" maxlength="1000" placeholder="Refleksi atau rencana perbaikan Anda."></textarea></label><div class="room-actions"><button type="submit" class="room-btn primary">${icon('check')}<span>Saya telah membaca hasil ini</span></button></div></form>`}</article>`;
}

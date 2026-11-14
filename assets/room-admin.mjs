/** Ruang admin kurikulum: analisis, seluruh persetujuan, catatan guru, dan supervisi AKG. */
import {access} from './curriculum-access.mjs';
import {todayWIB} from './clinic-core.mjs';
import {browserRoomClient} from './room-client.mjs';
import {periodRange, summarize, toCSV, STATUSES, AKG_DOMAINS, AKG_ITEMS, AKG_SCALE, akgScore, akgDomainScores, akgPredicate, validateSupervisionPlan, validateSupervisionRecord} from './room-core.mjs';
import {esc, icon, toast, empty, notice, busy, download, longDate, shortDate, resultCard} from './room-ui.mjs';

const api = browserRoomClient(), today = todayWIB();
const STATUS_LABEL = {pending: 'Menunggu', approved: 'Diterima', rejected: 'Ditolak', cancelled: 'Dibatalkan'};
const PERIODS = [['week', 'Pekan ini'], ['month', 'Bulan ini'], ['semester', 'Semester'], ['year', 'Tahun pelajaran']];
let period = 'month', supervision = null, selectedId = null, supFilter = 'all', navigate = () => {};
try { period = sessionStorage.getItem('maicn_room_period') || 'month'; } catch { /* preferensi opsional */ }
if (!PERIODS.some(p => p[0] === period)) period = 'month';
const number = value => Number(value).toLocaleString('id-ID', {maximumFractionDigits: 1});

/**
 * Memasang satu bagian pembinaan ke dalam Ruang kurikulum.
 * section: 'analysis' | 'notes' | 'supervision'. `go(tabId)` berpindah ke tab lain pada ruang yang sama.
 * Hanya admin; Worker dan SQL memeriksa ulang.
 */
export function mountRoomSection(host, section, {go = () => {}} = {}) {
  navigate = go;
  const panel = document.createElement('div'); panel.className = 'room room-panel room-enter'; host.replaceChildren(panel);
  if (access.context.role !== 'admin') { panel.innerHTML = notice('Bagian ini khusus admin kurikulum.', 'error'); return () => {}; }
  ({analysis: showSummary, notes: showNotes, supervision: showSupervision})[section](panel);
  return () => panel.remove();
}

/* ───────── Ringkasan & analisis ───────── */
async function showSummary(panel) {
  const range = periodRange(period, today);
  panel.innerHTML = `<div class="room-toolbar"><div class="room-segment" role="group" aria-label="Periode analisis">${PERIODS.map(([id, label]) => `<button type="button" data-period="${id}" aria-pressed="${id === period}">${label}</button>`).join('')}</div><span class="room-toolbar-meta">${esc(shortDate(range.from))} – ${esc(shortDate(range.to))}</span><button type="button" class="room-btn" id="sum-reload">${icon('refresh')}<span>Muat ulang</span></button></div><div id="sum-body" class="room-summary"><div class="room-kpis">${'<div class="room-kpi room-shimmer"></div>'.repeat(4)}</div></div>`;
  panel.querySelectorAll('[data-period]').forEach(b => b.onclick = () => { period = b.dataset.period; try { sessionStorage.setItem('maicn_room_period', period); } catch { /* opsional */ } showSummary(panel); });
  panel.querySelector('#sum-reload').onclick = () => showSummary(panel);
  const body = panel.querySelector('#sum-body');
  try {
    const s = summarize(await api.summary(range.from, range.to)); if (!body.isConnected) return;
    const max = Math.max(1, ...s.rows.map(r => r.total)), weekMax = Math.max(1, ...s.weekly.map(w => w.requests + w.clinic + w.notes)), noteMax = Math.max(1, ...s.notes.rows.map(t => Number(t.n)));
    const silent = s.notes.rows.filter(t => !Number(t.n));
    body.innerHTML = `<div class="room-kpis">
      ${kpi('Menunggu keputusan', s.pending, (s.pending ? `${s.pendingClinic} klinik · ${s.pendingSchool} ajuan layanan` : 'Tidak ada ajuan mendatang yang menunggu') + (s.expired ? ` · ${s.expired} terlewat tanpa keputusan` : ''), s.pending || s.expired ? 'warn' : 'good', s.pendingClinic >= s.pendingSchool ? '#clinic' : '#switch', s.pending || s.expired ? 'Tinjau sekarang' : 'Buka persetujuan')}
      ${kpi('Ajuan pada periode ini', s.total, s.approvalRate === null ? 'Belum ada keputusan' : `${s.approvalRate}% dari yang diputuskan diterima`)}
      ${kpi('Guru mengisi catatan harian', s.notes.coverage === null ? '–' : s.notes.coverage + '%', `${s.notes.active} dari ${s.notes.teachers} guru · ${s.notes.total} catatan`, s.notes.coverage !== null && s.notes.coverage < 50 ? 'warn' : '', '#notes', 'Baca catatan')}
      ${kpi('Rerata supervisi AKG', s.supervision.average === null ? '–' : number(s.supervision.average), s.supervision.average === null ? `${s.supervision.planned} terjadwal, belum ada hasil` : `${akgPredicate(s.supervision.average)} · ${s.supervision.done} selesai, ${s.supervision.planned} terjadwal`, '', '#supervision', 'Buka supervisi')}
     </div>
     <div class="room-grid">
      <section class="room-card room-span-2"><div class="room-card-head"><div><h3>Ajuan menurut jenis dan status</h3><p>Berdasarkan tanggal kegiatan pada periode terpilih.</p></div><ul class="room-legend" aria-label="Keterangan status">${STATUSES.map(st => `<li><i data-status="${st}"></i>${STATUS_LABEL[st]}</li>`).join('')}</ul></div>
       <div class="room-stack-chart">${s.rows.map(r => `<div class="room-stack-row"><span class="room-stack-name">${esc(r.label)}</span><div class="room-stack" role="img" aria-label="${esc(r.label)}: ${STATUSES.map(st => `${r[st]} ${STATUS_LABEL[st].toLowerCase()}`).join(', ')}">${r.total ? STATUSES.filter(st => r[st]).map(st => `<i data-status="${st}" style="--w:${r[st] / max * 100}%" data-tip="${STATUS_LABEL[st]}: ${r[st]}" tabindex="0"></i>`).join('') : ''}</div><b>${r.total}</b></div>`).join('')}</div>
       <details class="room-details"><summary>Lihat sebagai tabel</summary><div class="room-table-wrap"><table class="room-table"><thead><tr><th>Jenis</th>${STATUSES.map(st => `<th>${STATUS_LABEL[st]}</th>`).join('')}<th>Jumlah</th></tr></thead><tbody>${s.rows.map(r => `<tr><th scope="row">${esc(r.label)}</th>${STATUSES.map(st => `<td>${r[st]}</td>`).join('')}<td>${r.total}</td></tr>`).join('')}</tbody></table></div></details></section>
      <section class="room-card"><div class="room-card-head"><div><h3>Ketidakhadiran murid</h3><p>Ajuan menunggu dan diterima.</p></div></div><div class="room-tiles">${s.absence.map(a => `<div class="room-tile"><strong>${a.n}</strong><span>${esc(a.label)}</span><small>${a.students} murid</small></div>`).join('')}</div><p class="room-foot">Jurnal harian: ${s.journals.class} jurnal kelas, ${s.journals.duty} jurnal piket.</p></section>
      <section class="room-card room-span-2"><div class="room-card-head"><div><h3>Aktivitas per pekan</h3><p>Jumlah ajuan layanan, sesi klinik, dan catatan guru tiap pekan.</p></div><ul class="room-legend"><li><i data-series="1"></i>Ajuan layanan</li><li><i data-series="2"></i>Klinik</li><li><i data-series="3"></i>Catatan guru</li></ul></div>
       ${s.weekly.some(w => w.requests + w.clinic + w.notes) ? `<div class="room-columns" style="--n:${s.weekly.length}">${s.weekly.map(w => { const total = w.requests + w.clinic + w.notes; return `<div class="room-column" tabindex="0" data-tip="Pekan ${esc(shortDate(w.week))} · ajuan ${w.requests}, klinik ${w.clinic}, catatan ${w.notes}"><span class="room-column-total">${total || ''}</span><div class="room-column-bar" style="--h:${total / weekMax * 100}%">${[['3', w.notes], ['2', w.clinic], ['1', w.requests]].filter(x => x[1]).map(([series, n]) => `<i data-series="${series}" style="flex:${n}"></i>`).join('')}</div><small>${esc(shortDate(w.week))}</small></div>`; }).join('')}</div>` : empty('Belum ada aktivitas', 'Belum ada ajuan, klinik, atau catatan pada periode ini.', 'chart')}</section>
      <section class="room-card"><div class="room-card-head"><div><h3>Supervisi</h3><p>Pembinaan guru pada periode ini.</p></div></div><div class="room-tiles"><div class="room-tile"><strong>${s.supervision.planned}</strong><span>Terjadwal</span></div><div class="room-tile"><strong>${s.supervision.done}</strong><span>Selesai</span></div><div class="room-tile"><strong>${s.supervision.acknowledged}</strong><span>Dibaca guru</span></div></div><a class="room-btn" href="#supervision" data-goto="supervision">${icon('plus')}<span>Jadwalkan supervisi</span></a></section>
      <section class="room-card room-span-3"><div class="room-card-head"><div><h3>Keterisian catatan harian guru</h3><p>${silent.length ? `${silent.length} guru belum mengisi pada periode ini.` : 'Semua guru sudah mengisi pada periode ini.'}</p></div></div>
       <div class="room-table-wrap"><table class="room-table"><thead><tr><th>Guru</th><th>Mata pelajaran</th><th class="room-col-bar">Jumlah catatan</th><th>Terakhir</th></tr></thead><tbody>${s.notes.rows.map(t => `<tr${Number(t.n) ? '' : ' data-zero="true"'}><th scope="row">${esc(t.teacher)}</th><td>${esc(t.subject)}</td><td><div class="room-bar-row compact"><div class="room-bar"><i style="--w:${Number(t.n) / noteMax * 100}%"></i></div><b>${t.n}</b></div></td><td>${t.last ? esc(shortDate(t.last)) : '<span class="room-flag">Belum mengisi</span>'}</td></tr>`).join('')}</tbody></table></div></section>
     </div>`;
    body.querySelectorAll('[data-goto]').forEach(a => a.onclick = event => { event.preventDefault(); navigate(a.dataset.goto); });
    attachTips(body);
  } catch (error) { body.innerHTML = notice(error.message, 'error') + `<p class="room-foot">Tab lain pada Ruang kurikulum tetap dapat dipakai.</p>`; }
}
function kpi(label, value, text, tone = '', target = '', action = '') {
  return `<div class="room-kpi" data-tone="${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(text)}</small>${target ? `<a href="${target}" data-goto="${target.slice(1)}">${esc(action)} ${icon('arrow')}</a>` : ''}</div>`;
}
function attachTips(root) {
  let tip = null;
  const hide = () => { tip?.remove(); tip = null; };
  const show = el => { hide(); tip = document.createElement('div'); tip.className = 'room-tip'; tip.textContent = el.dataset.tip; document.body.append(tip); const r = el.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + scrollY + 'px'; };
  root.querySelectorAll('[data-tip]').forEach(el => { el.addEventListener('pointerenter', () => show(el)); el.addEventListener('focus', () => show(el)); el.addEventListener('pointerleave', hide); el.addEventListener('blur', hide); });
}

/* ───────── Catatan harian guru ───────── */
async function showNotes(panel) {
  const range = periodRange(period === 'year' || period === 'semester' ? 'month' : period, today);
  panel.innerHTML = `<section class="room-card"><div class="room-card-head"><div><h3>Catatan harian guru</h3><p>Dibaca langsung dari server. Guru menulisnya di Ruang guru.</p></div><button type="button" class="room-btn" id="notes-csv">${icon('download')}<span>Unduh CSV</span></button></div>
   <form class="room-filter" id="notes-filter"><label class="room-field"><span>Dari</span><input type="date" name="from" value="${range.from}" min="2026-07-01" max="2027-06-30" required></label><label class="room-field"><span>Sampai</span><input type="date" name="to" value="${range.to > today ? today : range.to}" min="2026-07-01" max="2027-06-30" required></label><label class="room-field"><span>Guru</span><select name="teacher"><option value="">Semua guru</option></select></label><button type="submit" class="room-btn primary">${icon('refresh')}<span>Tampilkan</span></button></form>
   <p class="room-meter-label" id="notes-count" role="status"></p><div id="notes-list"></div></section>`;
  const form = panel.querySelector('#notes-filter'), list = panel.querySelector('#notes-list'); let data = null;
  const filtered = () => data.rows.filter(r => !form.elements.teacher.value || r.teacher_code === form.elements.teacher.value);
  const render = () => {
    const rows = filtered(); panel.querySelector('#notes-count').innerHTML = `<strong>${rows.length}</strong> catatan · ${new Set(rows.map(r => r.teacher_code)).size} guru`;
    list.innerHTML = rows.length ? rows.map(r => `<article class="room-record"><header><strong>${esc(r.teacher)}</strong><small>${esc(longDate(r.date))} · ${esc(r.subject)}${(r.content.classrooms || []).length ? ' · ' + r.content.classrooms.map(esc).join(', ') : ''}</small></header><p>${esc(r.content.activities)}</p>${r.content.obstacles ? `<p><b>Kendala:</b> ${esc(r.content.obstacles)}</p>` : ''}${r.content.student_notes ? `<p><b>Catatan murid:</b> ${esc(r.content.student_notes)}</p>` : ''}<p><b>Tindak lanjut:</b> ${esc(r.content.follow_up)}</p></article>`).join('') : empty('Tidak ada catatan', 'Belum ada catatan guru pada rentang dan filter ini.');
  };
  const load = async () => {
    list.innerHTML = notice('Memuat catatan…');
    try {
      if (form.elements.from.value > form.elements.to.value) throw Error('Tanggal awal harus sebelum tanggal akhir.');
      data = await api.notes(form.elements.from.value, form.elements.to.value); if (!form.isConnected) return;
      const chosen = form.elements.teacher.value; form.elements.teacher.innerHTML = '<option value="">Semua guru</option>' + data.teachers.map(t => `<option value="${esc(t.kode)}">${esc(t.nama)}</option>`).join(''); form.elements.teacher.value = chosen; render();
    } catch (error) { data = null; panel.querySelector('#notes-count').textContent = ''; list.innerHTML = notice(error.message, 'error'); }
  };
  form.onsubmit = event => { event.preventDefault(); busy(form.querySelector('[type=submit]'), load); };
  form.elements.teacher.onchange = () => data && render();
  panel.querySelector('#notes-csv').onclick = () => { if (!data) return toast('Tampilkan catatan terlebih dahulu.', 'error'); download(`catatan-guru_${form.elements.from.value}_${form.elements.to.value}.csv`, toCSV(['Tanggal', 'Guru', 'Mapel', 'Kelas', 'Kegiatan', 'Kendala', 'Catatan murid', 'Tindak lanjut'], filtered().map(r => [r.date, r.teacher, r.subject, (r.content.classrooms || []).join(' '), r.content.activities, r.content.obstacles, r.content.student_notes, r.content.follow_up]))); };
  await load();
}

/* ───────── Supervisi AKG ───────── */
async function showSupervision(panel) {
  panel.innerHTML = `<div class="room-split wide-right"><section class="room-card"><div class="room-card-head"><div><h3>Supervisi akademik</h3><p>Instrumen AKG, ${AKG_ITEMS.length} butir, skala 1–4.</p></div><button type="button" class="room-btn primary" id="sup-new">${icon('plus')}<span>Jadwalkan</span></button></div><div class="room-segment small" role="group" aria-label="Saring status">${[['all', 'Semua'], ['planned', 'Terjadwal'], ['done', 'Selesai'], ['cancelled', 'Batal']].map(([id, label]) => `<button type="button" data-filter="${id}" aria-pressed="${id === supFilter}">${label}</button>`).join('')}</div><div id="sup-list">${notice('Memuat supervisi…')}</div></section><section class="room-card" id="sup-detail">${empty('Pilih supervisi', 'Pilih satu jadwal di daftar, atau jadwalkan supervisi baru.', 'eye')}</section></div>`;
  panel.querySelector('#sup-new').onclick = () => planForm(panel, null);
  panel.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { supFilter = b.dataset.filter; panel.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderSupList(panel); });
  await loadSupervision(panel);
}
async function loadSupervision(panel, keep = selectedId) {
  try { const next = await api.supervisions('admin'); if (!panel.querySelector('#sup-list')) return; supervision = next; selectedId = supervision.rows.some(r => r.id === keep) ? keep : null; renderSupList(panel); if (selectedId) detail(panel, supervision.rows.find(r => r.id === selectedId)); }
  catch (error) { const box = panel.querySelector('#sup-list'); if (box) { supervision = null; box.innerHTML = notice(error.message, 'error'); } }
}
function renderSupList(panel) {
  if (!supervision) return;
  const rows = supervision.rows.filter(r => supFilter === 'all' || r.status === supFilter), label = {planned: 'Terjadwal', done: 'Selesai', cancelled: 'Batal'};
  panel.querySelector('#sup-list').innerHTML = rows.length ? rows.map(r => `<button type="button" class="room-list-item" data-id="${r.id}" aria-pressed="${r.id === selectedId}"><span><strong>${esc(r.teacher)}</strong><small>${esc(shortDate(r.date))}${r.start ? ' · ' + esc(r.start) : ''} · ${esc(r.subject)}${r.classroom ? ' · ' + esc(r.classroom) : ''}</small></span><span class="room-pill" data-state="${r.status}">${r.status === 'done' ? number(r.score) + ' · ' + esc(akgPredicate(r.score)) : label[r.status]}</span></button>`).join('') : empty('Belum ada supervisi', 'Jadwalkan supervisi pertama untuk memulai pembinaan.', 'eye');
  panel.querySelectorAll('.room-list-item').forEach(b => b.onclick = () => { selectedId = b.dataset.id; renderSupList(panel); detail(panel, supervision.rows.find(r => r.id === selectedId)); panel.querySelector('#sup-detail').scrollIntoView({block: 'nearest', behavior: 'smooth'}); });
}
function planForm(panel, row) {
  const box = panel.querySelector('#sup-detail'), teachers = supervision?.teachers || [];
  box.innerHTML = `<div class="room-card-head"><div><h3>${row ? 'Ubah jadwal supervisi' : 'Jadwalkan supervisi'}</h3><p>Guru melihat jadwal ini pada Ruang guru.</p></div></div><form class="room-form" id="sup-plan" novalidate>
   <label class="room-field"><span>Guru yang disupervisi <b aria-hidden="true">*</b></span><select name="teacher_code" required><option value="">Pilih guru</option>${teachers.map(t => `<option value="${esc(t.kode)}" ${row?.teacher_code === t.kode ? 'selected' : ''}>${esc(t.nama)} · ${esc(t.mapel)}</option>`).join('')}</select></label>
   <div class="room-pair"><label class="room-field"><span>Tanggal <b aria-hidden="true">*</b></span><input type="date" name="date" required min="2026-07-01" max="2027-06-30" value="${row?.date || today}"></label><label class="room-field"><span>Jam mulai</span><input type="time" name="start" value="${row?.start || ''}"></label></div>
   <div class="room-pair"><label class="room-field"><span>Kelas</span><select name="classroom"><option value="">Menyusul</option>${['X-1', 'X-2', 'X-3'].map(c => `<option ${row?.classroom === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="room-field"><span>Supervisor <b aria-hidden="true">*</b></span><input name="supervisor" required maxlength="200" value="${esc(row?.supervisor || '')}" placeholder="Nama dan jabatan supervisor"></label></div>
   <label class="room-field"><span>Fokus supervisi</span><textarea name="focus" rows="2" maxlength="500" placeholder="Contoh: pembelajaran berdiferensiasi dan asesmen formatif.">${esc(row?.focus || '')}</textarea></label>
   <p class="room-error" role="alert"></p><div class="room-actions"><button type="button" class="room-btn" data-cancel>Batal</button><button type="submit" class="room-btn primary">${icon('check')}<span>Simpan jadwal</span></button></div></form>`;
  const form = box.querySelector('form');
  box.querySelector('[data-cancel]').onclick = () => row ? detail(panel, row) : box.innerHTML = empty('Pilih supervisi', 'Pilih satu jadwal di daftar, atau jadwalkan supervisi baru.', 'eye');
  form.onsubmit = event => { event.preventDefault(); const error = form.querySelector('.room-error'); error.textContent = '';
    busy(form.querySelector('[type=submit]'), async () => { try { const data = validateSupervisionPlan(Object.fromEntries(new FormData(form)), teachers), target = row ? {id: row.id, revision: row.revision} : {id: crypto.randomUUID(), revision: 0}; await api.supervisionSave(target, 'plan', data, crypto.randomUUID()); toast('Jadwal supervisi tersimpan.'); await loadSupervision(panel, target.id); } catch (e) { error.textContent = e.message; } }); };
  form.elements.teacher_code.focus();
}
function detail(panel, row) {
  const box = panel.querySelector('#sup-detail');
  if (row.status === 'done') {
    box.innerHTML = `<div class="room-card-head"><div><h3>Hasil supervisi · ${esc(row.teacher)}</h3><p>Instrumen ${esc(row.instrument)} · revisi ${row.revision}</p></div><div class="room-head-actions"><button type="button" class="room-btn" data-print>${icon('print')}<span>Cetak A4</span></button><button type="button" class="room-btn" data-edit>Perbaiki penilaian</button></div></div>${resultCard(row)}`;
    box.querySelector('[data-print]').onclick = () => { box.querySelectorAll('details').forEach(d => { d.open = true; }); document.body.classList.add('room-printing'); window.print(); document.body.classList.remove('room-printing'); };
    box.querySelector('[data-edit]').onclick = () => recordForm(panel, row);
    return;
  }
  box.innerHTML = `<div class="room-card-head"><div><h3>${esc(row.teacher)}</h3><p>${esc(longDate(row.date))}${row.start ? ' · ' + esc(row.start) + ' WIB' : ''}</p></div><span class="room-pill" data-state="${row.status}">${row.status === 'planned' ? 'Terjadwal' : 'Batal'}</span></div>
   <dl class="room-facts"><div><dt>Mata pelajaran</dt><dd>${esc(row.subject || '–')}</dd></div><div><dt>Kelas</dt><dd>${esc(row.classroom || 'Menyusul')}</dd></div><div><dt>Supervisor</dt><dd>${esc(row.supervisor)}</dd></div><div><dt>Fokus</dt><dd>${esc(row.focus || '–')}</dd></div></dl>
   ${row.status === 'planned' ? `<div class="room-actions"><button type="button" class="room-btn danger" data-cancel>Batalkan jadwal</button><button type="button" class="room-btn" data-plan>Ubah jadwal</button><button type="button" class="room-btn primary" data-record>${icon('note')}<span>Isi instrumen</span></button></div>` : ''}`;
  box.querySelector('[data-plan]')?.addEventListener('click', () => planForm(panel, row));
  box.querySelector('[data-record]')?.addEventListener('click', () => recordForm(panel, row));
  box.querySelector('[data-cancel]')?.addEventListener('click', event => { if (!confirm(`Batalkan supervisi ${row.teacher} pada ${longDate(row.date)}?`)) return; busy(event.currentTarget, async () => { try { await api.supervisionSave(row, 'cancel', {}, crypto.randomUUID()); toast('Jadwal supervisi dibatalkan.'); await loadSupervision(panel, row.id); } catch (e) { toast(e.message, 'error'); } }); });
}
function recordForm(panel, row) {
  const box = panel.querySelector('#sup-detail'), scores = {...row.scores};
  box.innerHTML = `<div class="room-card-head"><div><h3>Instrumen AKG · ${esc(row.teacher)}</h3><p>${esc(longDate(row.date))} · ${esc(row.subject)}${row.classroom ? ' · ' + esc(row.classroom) : ''}</p></div></div>
   <p class="room-scale">${Object.entries(AKG_SCALE).map(([n, text]) => `<span><b>${n}</b> ${esc(text)}</span>`).join('')}</p>
   <form class="room-form" id="sup-record" novalidate>${AKG_DOMAINS.map(d => `<fieldset class="room-domain"><legend><span>${esc(d.name)}</span><b data-domain="${d.id}"></b></legend>${d.items.map(([id, text]) => `<div class="room-item" role="radiogroup" aria-label="${esc(text)}"><span>${esc(text)}</span><div class="room-rate">${[1, 2, 3, 4].map(n => `<label title="${esc(AKG_SCALE[n])}"><input type="radio" name="${id}" value="${n}" ${Number(scores[id]) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>`).join('')}</fieldset>`).join('')}
   <label class="room-field"><span>Kekuatan yang teramati</span><textarea name="strengths" rows="2" maxlength="1500">${esc(row.notes?.strengths || '')}</textarea></label>
   <label class="room-field"><span>Hal yang perlu ditingkatkan</span><textarea name="improvements" rows="2" maxlength="1500">${esc(row.notes?.improvements || '')}</textarea></label>
   <label class="room-field"><span>Rencana tindak lanjut <b aria-hidden="true">*</b></span><textarea name="follow_up" rows="2" maxlength="1500" required>${esc(row.notes?.follow_up || '')}</textarea></label>
   <p class="room-error" role="alert"></p>
   <div class="room-actions sticky"><div class="room-live" aria-live="polite"><strong id="sup-live">–</strong><small id="sup-live-label">0 dari ${AKG_ITEMS.length} butir</small></div><button type="button" class="room-btn" data-cancel>Batal</button><button type="submit" class="room-btn primary">${icon('check')}<span>Simpan hasil</span></button></div></form>`;
  const form = box.querySelector('form');
  const read = () => Object.fromEntries(AKG_ITEMS.map(id => [id, Number(form.elements[id].value) || 0]));
  const refresh = () => { const current = read(), total = akgScore(current), filled = AKG_ITEMS.filter(id => current[id]).length; for (const d of akgDomainScores(current)) form.querySelector(`[data-domain="${d.id}"]`).textContent = d.score === null ? `${d.filled}/${d.total}` : Math.round(d.score); box.querySelector('#sup-live').textContent = total === null ? '–' : number(total); box.querySelector('#sup-live-label').textContent = total === null ? `${filled} dari ${AKG_ITEMS.length} butir` : akgPredicate(total); };
  form.onchange = refresh; refresh();
  box.querySelector('[data-cancel]').onclick = () => detail(panel, row);
  form.onsubmit = event => { event.preventDefault(); const error = form.querySelector('.room-error'); error.textContent = '';
    busy(form.querySelector('[type=submit]'), async () => { try { const data = validateSupervisionRecord(read(), {strengths: form.elements.strengths.value, improvements: form.elements.improvements.value, follow_up: form.elements.follow_up.value}); await api.supervisionSave(row, 'record', data, crypto.randomUUID()); toast('Hasil supervisi tersimpan. Guru dapat membacanya di Ruang guru.'); await loadSupervision(panel, row.id); } catch (e) { error.textContent = e.message; error.scrollIntoView({block: 'nearest'}); } }); };
}


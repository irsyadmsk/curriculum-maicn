/** Ruang guru: catatan harian, hasil supervisi sendiri, dan peluncur layanan. */
import {access, accessReady} from './curriculum-access.mjs';
import {todayWIB} from './clinic-core.mjs';
import {lessonCatalog} from './school-workflow-core.mjs';
import {browserRoomClient} from './room-client.mjs';
import {NOTE_FIELDS, validateNote, addDaysISO} from './room-core.mjs';
import {esc, icon, mountTabs, toast, empty, notice, busy, longDate, shortDate, serviceCards, resultCard} from './room-ui.mjs';

await accessReady;
const host = document.getElementById('room-root'), api = browserRoomClient(), ctx = access.context, today = todayWIB();
const draftKey = date => `maicn_note_draft_${ctx.user_id}_${date}`;
let notes = null, selectedDate = today, supervisions = null, alive = true, tabs = null;

if (!access.has('teacher') || !ctx.teacher_code) {
  host.innerHTML = notice('Ruang guru memerlukan akun yang sudah ditautkan ke pengampu. Admin membaca catatan guru dan supervisi melalui Ruang admin.', 'error');
} else {
  host.innerHTML = `<header class="room-hero"><div><p class="room-eyebrow">${esc(longDate(today))}</p><h2>Assalamu’alaikum, ${esc(ctx.teacher || 'Bapak/Ibu Guru')}</h2><p>Catat pembelajaran hari ini, pantau supervisi, dan ajukan layanan dari satu ruang.</p></div></header>`;
  tabs = mountTabs(host, [{id: 'catatan', label: 'Catatan harian', icon: 'note'}, {id: 'supervisi', label: 'Supervisi saya', icon: 'eye'}, {id: 'layanan', label: 'Layanan', icon: 'swap'}], (id, panel) => ({catatan: showNotes, supervisi: showSupervision, layanan: showServices})[id](panel), {label: 'Bagian ruang guru'});
  tabs.show(location.hash.slice(1) || 'catatan');
  access.subscribe(next => { if (next.user_id !== ctx.user_id || !next.capabilities.teacher) { alive = false; host.innerHTML = notice('Sesi atau hak akses berubah. Muat ulang halaman sebelum melanjutkan.', 'error'); } });
}

function lessonsOn(date) {
  const day = new Date(date + 'T12:00:00+07:00').getUTCDay();
  return lessonCatalog(window.MASTER_DATA).filter(l => l.day === day && l.teacher === ctx.teacher).sort((a, b) => a.start.localeCompare(b.start));
}

async function showNotes(panel) {
  panel.innerHTML = `<div class="room-split"><section class="room-card"><div class="room-card-head"><div><h3>Catatan harian guru</h3><p>Satu catatan per hari. Dapat diperbarui sampai 14 hari ke belakang.</p></div></div><div class="room-days" id="note-days" role="group" aria-label="Pilih tanggal catatan"></div><div id="note-form-host">${notice('Memuat catatan dari server…')}</div></section><section class="room-card"><div class="room-card-head"><div><h3>Riwayat 30 hari</h3><p>Hanya Anda dan admin kurikulum yang dapat membaca catatan ini.</p></div></div><div id="note-history"></div></section></div>`;
  await loadNotes(panel);
}
async function loadNotes(panel) {
  try {
    const next = await api.notes(addDaysISO(today, -30), today);
    if (!alive || !panel.querySelector('#note-days')) return; // tab sudah berganti saat menunggu server
    if (next.context.user_id !== ctx.user_id) throw Error('Akun berubah. Muat ulang halaman.');
    notes = next; renderDays(panel); renderForm(panel); renderHistory(panel);
  } catch (error) { const box = panel.querySelector('#note-form-host'); if (box) { box.innerHTML = notice(error.message, 'error'); panel.querySelector('#note-history').innerHTML = ''; } }
}
function renderDays(panel) {
  const days = Array.from({length: 7}, (_, n) => addDaysISO(today, n - 6));
  panel.querySelector('#note-days').innerHTML = days.map(date => { const filled = notes.rows.some(r => r.date === date), d = new Date(date + 'T00:00:00Z'); return `<button type="button" class="room-day" data-date="${date}" aria-pressed="${date === selectedDate}" data-filled="${filled}" title="${esc(longDate(date))}${filled ? ' · sudah diisi' : ' · belum diisi'}"><small>${['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getUTCDay()]}</small><strong>${d.getUTCDate()}</strong><i aria-hidden="true"></i><span class="sr-only">${filled ? 'sudah diisi' : 'belum diisi'}</span></button>`; }).join('');
  panel.querySelectorAll('.room-day').forEach(b => b.onclick = () => { selectedDate = b.dataset.date; renderDays(panel); renderForm(panel); });
}
function renderForm(panel) {
  const row = notes.rows.find(r => r.date === selectedDate), lessons = lessonsOn(selectedDate);
  let draft = null; try { draft = JSON.parse(localStorage.getItem(draftKey(selectedDate)) || 'null'); } catch { /* Draf lokal bersifat tambahan. */ }
  const value = draft || row?.content || {classrooms: [...new Set(lessons.map(l => l.classroom))]};
  panel.querySelector('#note-form-host').innerHTML = `<form id="note-form" class="room-form" novalidate><p class="room-form-date">${icon('clock')}<span><strong>${esc(longDate(selectedDate))}</strong>${row ? ` · tersimpan, revisi ${row.revision}` : ' · belum ada catatan'}${draft ? ' · <em>draf belum dikirim</em>' : ''}</span></p>
   <div class="room-chips" aria-label="Jadwal mengajar pada tanggal ini">${lessons.length ? lessons.map(l => `<span class="room-chip">${esc(l.classroom)} · ${esc(l.start)}–${esc(l.end)} · ${esc(l.subject)}</span>`).join('') : '<span class="room-chip" data-muted="true">Tidak ada blok mengajar terjadwal</span>'}</div>
   <fieldset class="room-check-row"><legend>Kelas yang diajar</legend>${['X-1', 'X-2', 'X-3'].map(c => `<label class="room-check"><input type="checkbox" name="classrooms" value="${c}" ${(value.classrooms || []).includes(c) ? 'checked' : ''}><span>${c}</span></label>`).join('')}</fieldset>
   ${NOTE_FIELDS.map(([key, label, required, hint]) => `<label class="room-field"><span>${esc(label)}${required ? ' <b aria-hidden="true">*</b>' : ''}</span><textarea name="${key}" rows="${required ? 4 : 2}" maxlength="1800" ${required ? 'required' : ''} placeholder="${esc(hint)}">${esc(value[key] || '')}</textarea></label>`).join('')}
   <p id="note-error" class="room-error" role="alert"></p>
   <div class="room-actions"><span class="room-actions-hint">Draf tersimpan otomatis di perangkat ini.</span><button type="button" class="room-btn" id="note-reset" ${draft ? '' : 'hidden'}>Buang draf</button><button type="submit" class="room-btn primary">${icon('check')}<span>${row ? 'Perbarui catatan' : 'Simpan catatan'}</span></button></div></form>`;
  const form = panel.querySelector('#note-form'), read = () => ({...Object.fromEntries(NOTE_FIELDS.map(([key]) => [key, form.elements[key].value])), classrooms: [...form.querySelectorAll('[name=classrooms]:checked')].map(i => i.value)});
  form.oninput = () => { try { localStorage.setItem(draftKey(selectedDate), JSON.stringify(read())); panel.querySelector('#note-reset').hidden = false; } catch { /* Penyimpanan lokal opsional. */ } };
  panel.querySelector('#note-reset').onclick = () => { try { localStorage.removeItem(draftKey(selectedDate)); } catch { /* opsional */ } renderForm(panel); };
  form.onsubmit = event => {
    event.preventDefault(); const error = panel.querySelector('#note-error'); error.textContent = '';
    busy(form.querySelector('[type=submit]'), async () => {
      try {
        const content = validateNote(selectedDate, read(), today), target = row ? {id: row.id, revision: row.revision} : {id: crypto.randomUUID(), revision: 0};
        await api.noteSave(target, selectedDate, content, crypto.randomUUID());
        try { localStorage.removeItem(draftKey(selectedDate)); } catch { /* opsional */ }
        toast('Catatan ' + shortDate(selectedDate) + ' tersimpan di server.'); await loadNotes(panel);
      } catch (e) { error.textContent = e.message; error.scrollIntoView({block: 'nearest'}); }
    });
  };
}
function renderHistory(panel) {
  panel.querySelector('#note-history').innerHTML = notes.rows.length ? `<p class="room-meter-label"><strong>${notes.rows.length}</strong> catatan dalam 30 hari terakhir</p>` + notes.rows.map(r => `<article class="room-record"><header><strong>${esc(longDate(r.date))}</strong><small>${(r.content.classrooms || []).map(esc).join(', ') || 'Tanpa kelas'}</small></header><p>${esc(r.content.activities)}</p>${r.content.obstacles ? `<p><b>Kendala:</b> ${esc(r.content.obstacles)}</p>` : ''}<p><b>Tindak lanjut:</b> ${esc(r.content.follow_up)}</p></article>`).join('') : empty('Belum ada catatan', 'Catatan pertama Anda akan muncul di sini setelah disimpan.');
}

async function showSupervision(panel) {
  panel.innerHTML = `<section class="room-card">${notice('Memuat jadwal dan hasil supervisi…')}</section>`;
  try {
    const next = await api.supervisions('mine'); if (!alive || tabs.current !== 'supervisi') return; supervisions = next;
    const planned = supervisions.rows.filter(r => r.status === 'planned').sort((a, b) => a.date.localeCompare(b.date)), done = supervisions.rows.filter(r => r.status === 'done');
    panel.innerHTML = `<section class="room-card"><div class="room-card-head"><div><h3>Supervisi terjadwal</h3><p>Supervisi akademik bersifat pembinaan, bukan penghakiman.</p></div></div>${planned.length ? planned.map(r => `<article class="room-record"><header><strong>${esc(longDate(r.date))}${r.start ? ' · ' + esc(r.start) + ' WIB' : ''}</strong><small>${esc(r.classroom || 'Kelas menyusul')}</small></header><p>Supervisor: ${esc(r.supervisor)}</p>${r.focus ? `<p>Fokus: ${esc(r.focus)}</p>` : ''}</article>`).join('') : empty('Belum ada jadwal', 'Jadwal supervisi akan tampil setelah ditetapkan admin kurikulum.', 'eye')}</section>
     <section class="room-card"><div class="room-card-head"><div><h3>Hasil supervisi</h3><p>Instrumen AKG: pedagogik, kepribadian, sosial, dan profesional. Skala 1–4.</p></div></div>${done.length ? done.map(r => resultCard(r, {ack: true})).join('') : empty('Belum ada hasil', 'Hasil supervisi tampil setelah instrumen diisi supervisor.', 'chart')}</section>`;
    panel.querySelectorAll('[data-ack]').forEach(form => form.onsubmit = event => {
      event.preventDefault(); const row = supervisions.rows.find(r => r.id === form.dataset.ack);
      busy(form.querySelector('button'), async () => { try { await api.supervisionSave(row, 'acknowledge', {note: form.elements.note.value.trim()}, crypto.randomUUID()); toast('Hasil supervisi telah Anda terima.'); await showSupervision(panel); } catch (e) { toast(e.message, 'error'); } });
    });
  } catch (error) { if (tabs.current === 'supervisi') panel.innerHTML = `<section class="room-card">${notice(error.message, 'error')}</section>`; }
}
function showServices(panel) {
  panel.innerHTML = `<section class="room-card"><div class="room-card-head"><div><h3>Layanan kurikulum</h3><p>Semua pengajuan dan pencatatan tersedia di Curriculum.</p></div></div>${serviceCards(access.has, {exclude: ['note', 'supervision']})}</section>`;
}

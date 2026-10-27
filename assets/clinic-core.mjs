/** Shared clinic dates and validation. Browser drafts never confer approval. */
export const CLINIC_REMOTE_ENABLED = false;
export const INSTITUTION = 'MA Insan Cendekia Nusantara';
export const YEAR = '2026/2027';
export const CLASSES = ['X-1', 'X-2', 'X-3'];
export const SLOTS = [{ day: 1, start: '20:30', end: '21:30', name: 'Senin malam' }, { day: 2, start: '16:15', end: '17:00', name: 'Selasa sore' }];
export const BLOCK_CHOICES = ['Upacara', 'KTI', 'Wali Kelas'];
export function nextMonday(day = todayWIB()) { const start = monday(day); return start === day ? day : addDays(start,7); }
export function validateBlock(value, year = YEAR) {
 if(!value || !isDate(value.date) || new Date(value.date).getUTCDay() !== 1 || !inSchoolYear(value.date,year) || !BLOCK_CHOICES.includes(value.activity) || typeof value.note !== 'string' || value.note.trim().length > 2000 || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.trim().length > 1000)throw Error('Pilih tanggal Senin, kegiatan, dan alasan penetapan.');
 return {date:value.date,activity:value.activity,note:value.note.trim(),reason:value.reason.trim()};
}
export const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export const todayWIB = (now = Date.now()) => new Date(Number(now) + 7 * 3600000).toISOString().slice(0, 10);
export function addDays(day, n) { if (!isDate(day) || !Number.isInteger(n)) throw Error('Tanggal tidak valid.'); return new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10); }
export function monday(day) { return addDays(day, -((new Date(day).getUTCDay() + 6) % 7)); }
export function slotFor(day) { return isDate(day) ? SLOTS.find(s => s.day === new Date(day).getUTCDay()) : undefined; }
export function endInstant(row) { return Date.parse(`${row.date}T${row.end}:00+07:00`); }
export function archived(row, now = Date.now()) { return endInstant(row) <= Number(now); }
export function inSchoolYear(date, year = YEAR) { const y = Number(year.slice(0, 4)); return /^\d{4}\/\d{4}$/.test(year) && Number(year.slice(5)) === y + 1 && date >= `${y}-07-01` && date <= `${y + 1}-06-30`; }
export function dateLabel(day) { return isDate(day) ? new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(day + 'T12:00:00+07:00')) : 'Tanggal perlu diperiksa'; }
const clean = (value, max, required = true) => { if (typeof value !== 'string' || value.trim().length > max || required && !value.trim()) throw Error('Isian belum lengkap atau terlalu panjang.'); return value.trim(); };
function proposalFields(value, now = Date.now(), year = YEAR) {
  if (!value || !CLASSES.includes(value.classroom) || !isDate(value.date) || !inSchoolYear(value.date, year)) throw Error('Pilih tanggal dalam tahun pelajaran dan kelas yang sesuai.');
  const slot = slotFor(value.date);
  if (!slot || value.start !== slot.start || value.end !== slot.end || endInstant(value) <= Number(now)) throw Error('Pilih sesi Senin atau Selasa yang belum selesai.');
  if (!Array.isArray(value.subjects) || value.subjects.length < 1 || value.subjects.length > 3) throw Error('Isi satu sampai tiga pilihan mapel.');
  const subjects = value.subjects.map(v => clean(v, 120));
  if (new Set(subjects.map(s => s.toLocaleLowerCase('id'))).size !== subjects.length) throw Error('Pilihan mapel tidak boleh sama.');
  const evidence = clean(value.evidence ?? '', 1000, false);
  if (evidence && !safeURL(evidence)) throw Error('Tautan bukti harus menggunakan https atau http.');
  return { date: value.date, start: slot.start, end: slot.end, classroom: value.classroom, subjects, topic: clean(value.topic ?? '', 2000, false), evidence };
}
export function validateProposal(value,now=Date.now(),year=YEAR){
 const result=proposalFields(value,now,year);
 if(!/^[A-Z]{2,4}$/.test(value.teacher_code))throw Error('Pilih guru pengampu.');
 return {...result,teacher_code:value.teacher_code,teacher:clean(value.teacher,200)};
}
export function validateRequest(value,now=Date.now(),year=YEAR){
 const result=proposalFields({...value,evidence:''},now,year);
 if(value.teacher_code&&!/^[A-Z]{2,4}$/.test(value.teacher_code))throw Error('Usulan pengampu tidak valid.');
 return {...result,teacher_code:value.teacher_code||null,teacher:value.teacher_code?clean(value.teacher,200):'',requester_label:clean(value.requester_label||'',100,false)};
}

export function safeURL(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } }
export function legacyRecords(slots, origin = 'Sumber lama') {
  if (!Array.isArray(slots)) throw Error('Format catatan lama tidak dikenali.');
  return slots.flatMap((s, i) => {
    if (!s || !isDate(s.tanggal)) return [];
    const slot = slotFor(s.tanggal); if (!slot) return [];
    return CLASSES.flatMap(classroom => { const r = s.slot_kelas?.[classroom]; if (!r || !(r.guru || r.mapel || r.usulan_mapel?.length || r.topik || r.bukti_asesmen)) return [];
      return [{ id: `legacy-${i}-${classroom}`, date: s.tanggal, start: slot.start, end: slot.end, classroom, teacher: String(r.guru || ''), subjects: Array.isArray(r.usulan_mapel) && r.usulan_mapel.length ? r.usulan_mapel.map(String) : r.mapel ? [String(r.mapel)] : [], topic: String(r.topik || ''), evidence: String(r.bukti_asesmen || ''), status: 'legacy', legacyStatus: String(r.status || 'Tanpa status'), approved_subject: null, revision: 0, origin }]; });
  });
}
export function parseRows(value, publicOnly = false) {
  if (!Array.isArray(value) || value.length > 5000) throw Error('Data klinik tidak lengkap.');
  const ids = new Set();
  return value.map(r => {
    if (!r || typeof r.id !== 'string' || ids.has(r.id) || !isDate(r.date) || !slotFor(r.date) || r.start !== slotFor(r.date).start || r.end !== slotFor(r.date).end || !CLASSES.includes(r.classroom) || typeof r.teacher !== 'string' || !r.teacher.trim() && (publicOnly || r.request_kind!=='guest' || r.status==='approved') || r.teacher.length > 200 || !Number.isSafeInteger(r.revision) || r.revision < 1 || !['pending','approved','rejected','cancelled'].includes(r.status)) throw Error('Data klinik tidak valid.');
    ids.add(r.id);
    if ((publicOnly || r.status === 'approved') && (r.status !== 'approved' || typeof r.approved_subject !== 'string' || !r.approved_subject.trim() || r.approved_subject.length > 120 || !Number.isFinite(Date.parse(r.decided_at)))) throw Error('Agenda belum disetujui.');
    if (!publicOnly && (!Array.isArray(r.subjects) || !r.subjects.length || r.subjects.length > 3 || r.subjects.some(v => typeof v !== 'string' || !v.trim() || v.length > 120) || typeof r.topic !== 'string' || r.topic.length > 2000 || typeof r.evidence !== 'string' || r.evidence.length > 1000)) throw Error('Usulan tidak lengkap.');
    if (!publicOnly && (!(r.request_kind==='guest'&&r.status!=='approved'&&!r.teacher_code) && (typeof r.teacher_code !== 'string' || !/^[A-Z]{2,4}$/.test(r.teacher_code)) || r.status === 'approved' && !r.subjects.includes(r.approved_subject))) throw Error('Keputusan tidak cocok dengan usulan.');
    return { ...r, teacher_code:r.teacher_code||'', origin: 'Server', ...(publicOnly ? { subjects: [r.approved_subject], topic: '', evidence: '' } : {}) };
  });
}
export function approvedAgenda(rows, now = Date.now()) { return parseRows(rows, true).filter(r => !archived(r, now)).sort((a,b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.classroom.localeCompare(b.classroom)); }
export function conflicts(rows, proposal, subject) {
  return rows.filter(r => r.id !== proposal.id && r.status === 'approved' && (r.date === proposal.date && r.start < proposal.end && r.end > proposal.start && (r.classroom === proposal.classroom || r.teacher_code && r.teacher_code === proposal.teacher_code) || r.classroom === proposal.classroom && monday(r.date) === monday(proposal.date) && r.approved_subject?.toLocaleLowerCase('id') === subject.toLocaleLowerCase('id')));
}

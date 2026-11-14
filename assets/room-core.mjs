/** Ruang guru dan ruang admin Curriculum: logika murni tanpa DOM, dipakai browser, Worker, dan tes. */

// Halaman ruang beserta kemampuan akun yang diwajibkan Worker sebelum berkas dikirim.
export const ROOM_PAGES = Object.freeze({'ruang-guru.html': 'teacher'});

// RPC yang boleh diteruskan Worker, dengan kemampuan minimum per pemanggilan.
export function roomRule(name, args = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key))) return null;
  switch (name) {
    case 'curriculum_teacher_note_read': return 'teacher_or_admin';
    case 'curriculum_teacher_note_write': return 'teacher';
    case 'curriculum_supervision_read': return args.p_mode === 'admin' ? 'admin' : args.p_mode === 'mine' ? 'teacher' : null;
    case 'curriculum_supervision_write': return ['plan', 'record', 'cancel'].includes(args.p_action) ? 'admin' : args.p_action === 'acknowledge' ? 'teacher' : null;
    case 'curriculum_room_summary': return 'admin';
    default: return null;
  }
}
export const roomAllows = (rule, capabilities) => rule === 'teacher_or_admin' ? capabilities.teacher === true || capabilities.admin === true : !!rule && capabilities[rule] === true;

/**
 * Instrumen supervisi akademik format AKG versi 1.
 * Empat ranah mengikuti kompetensi guru pada UU No. 14 Tahun 2005 Pasal 10 ayat (1)
 * dan Permendiknas No. 16 Tahun 2007. Kode butir harus sama dengan
 * private.curriculum_akg_items() pada server/curriculum-room.sql.
 */
export const AKG_VERSION = 'akg-1';
export const AKG_DOMAINS = Object.freeze([
  {id: 'p', name: 'Pedagogik', items: [
    ['p1', 'Mengenali karakteristik murid dan menyesuaikan pembelajaran dengan kebutuhannya'],
    ['p2', 'Merancang modul ajar yang selaras dengan CP, TP, dan ATP'],
    ['p3', 'Melaksanakan pembelajaran yang aktif, mendidik, dan berdiferensiasi'],
    ['p4', 'Memanfaatkan media dan teknologi untuk kepentingan pembelajaran'],
    ['p5', 'Melaksanakan asesmen proses dan hasil belajar sesuai tujuan'],
    ['p6', 'Menindaklanjuti hasil asesmen melalui umpan balik, remedial, dan pengayaan']]},
  {id: 'k', name: 'Kepribadian', items: [
    ['k1', 'Bertindak sesuai norma agama, hukum, sosial, dan budaya madrasah'],
    ['k2', 'Menjadi teladan: jujur, berakhlak mulia, dan konsisten'],
    ['k3', 'Menunjukkan disiplin waktu, etos kerja, dan tanggung jawab'],
    ['k4', 'Menjunjung tinggi kode etik profesi guru']]},
  {id: 's', name: 'Sosial', items: [
    ['s1', 'Bersikap inklusif, objektif, dan tidak diskriminatif kepada semua murid'],
    ['s2', 'Berkomunikasi secara efektif, empatik, dan santun dengan murid'],
    ['s3', 'Berkolaborasi dengan sejawat, wali kelas, dan orang tua']]},
  {id: 'f', name: 'Profesional', items: [
    ['f1', 'Menguasai materi, struktur, dan konsep keilmuan mata pelajaran'],
    ['f2', 'Mengaitkan materi dengan capaian pembelajaran dan konteks kehidupan'],
    ['f3', 'Mengembangkan materi pembelajaran secara kreatif'],
    ['f4', 'Melakukan refleksi dan pengembangan keprofesian berkelanjutan'],
    ['f5', 'Memanfaatkan teknologi informasi untuk pengembangan diri']]}
]);
export const AKG_ITEMS = Object.freeze(AKG_DOMAINS.flatMap(domain => domain.items.map(item => item[0])));
export const AKG_SCALE = Object.freeze({1: 'Belum tampak', 2: 'Mulai tampak', 3: 'Tampak baik', 4: 'Sangat baik'});

const valid = value => Number.isInteger(value) && value >= 1 && value <= 4;
const percent = (sum, count) => Math.round(sum / (count * 4) * 10000) / 100;
/** Nilai 0–100 dari skor butir 1–4; null bila belum lengkap. */
export function akgScore(scores) {
  const values = AKG_ITEMS.map(id => Number(scores?.[id]));
  return values.every(valid) ? percent(values.reduce((a, b) => a + b, 0), values.length) : null;
}
export function akgDomainScores(scores) {
  return AKG_DOMAINS.map(domain => {
    const values = domain.items.map(item => Number(scores?.[item[0]]));
    return {id: domain.id, name: domain.name, filled: values.filter(valid).length, total: values.length, score: values.every(valid) ? percent(values.reduce((a, b) => a + b, 0), values.length) : null};
  });
}
/** Sebutan mengikuti konversi nilai kinerja pada Permenneg PAN dan RB No. 16 Tahun 2009. */
export function akgPredicate(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return '';
  const value = Number(score);
  return value >= 91 ? 'Amat baik' : value >= 76 ? 'Baik' : value >= 61 ? 'Cukup' : value >= 51 ? 'Sedang' : 'Kurang';
}
export function validateSupervisionPlan(data, teachers) {
  if (!teachers.some(t => t.kode === data.teacher_code)) throw Error('Pilih guru dari daftar pengampu.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '') || data.date < '2026-07-01' || data.date > '2027-06-30') throw Error('Tanggal supervisi harus berada dalam tahun pelajaran 2026/2027.');
  if (!String(data.supervisor || '').trim()) throw Error('Nama supervisor wajib diisi.');
  if (data.start && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(data.start)) throw Error('Periksa jam supervisi.');
  return {teacher_code: data.teacher_code, classroom: ['X-1', 'X-2', 'X-3'].includes(data.classroom) ? data.classroom : '', date: data.date, start: data.start || '', focus: String(data.focus || '').trim().slice(0, 500), supervisor: String(data.supervisor).trim().slice(0, 200)};
}
export function validateSupervisionRecord(scores, notes) {
  if (akgScore(scores) === null) throw Error('Lengkapi skor seluruh butir instrumen (' + AKG_ITEMS.length + ' butir).');
  if (!String(notes?.follow_up || '').trim()) throw Error('Rencana tindak lanjut wajib diisi.');
  return {scores: Object.fromEntries(AKG_ITEMS.map(id => [id, Number(scores[id])])), notes: {strengths: String(notes.strengths || '').trim(), improvements: String(notes.improvements || '').trim(), follow_up: String(notes.follow_up).trim()}};
}

/** Catatan harian guru. */
export const NOTE_FIELDS = Object.freeze([
  ['activities', 'Kegiatan pembelajaran hari ini', true, 'Materi, metode, dan ketercapaian tujuan pembelajaran.'],
  ['obstacles', 'Kendala', false, 'Hambatan waktu, sarana, atau kesiapan murid.'],
  ['student_notes', 'Catatan murid', false, 'Murid yang perlu pendampingan, remedial, atau apresiasi.'],
  ['follow_up', 'Tindak lanjut', true, 'Langkah untuk pertemuan berikutnya.']
]);
export function validateNote(date, content, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > today) throw Error('Catatan hanya untuk hari ini atau hari yang sudah lewat.');
  if (daysBetween(date, today) > 14) throw Error('Catatan hanya dapat diisi sampai 14 hari ke belakang.');
  const clean = Object.fromEntries(NOTE_FIELDS.map(([key]) => [key, String(content?.[key] || '').trim().slice(0, 1800)]));
  for (const [key, label, required] of NOTE_FIELDS) if (required && !clean[key]) throw Error(label + ' wajib diisi.');
  clean.classrooms = [...new Set((content?.classrooms || []).filter(c => ['X-1', 'X-2', 'X-3'].includes(c)))];
  return clean;
}
export const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
export function addDaysISO(date, days) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

/** Rentang analisis berdasarkan tanggal WIB hari ini. */
export function periodRange(period, today) {
  const day = new Date(today + 'T00:00:00Z').getUTCDay(), monday = addDaysISO(today, -((day + 6) % 7));
  if (period === 'week') return {from: monday, to: addDaysISO(monday, 6)};
  if (period === 'month') { const start = today.slice(0, 8) + '01', next = new Date(start + 'T00:00:00Z'); next.setUTCMonth(next.getUTCMonth() + 1); return {from: start, to: addDaysISO(next.toISOString().slice(0, 10), -1)}; }
  if (period === 'semester') return today >= '2027-01-01' ? {from: '2027-01-01', to: '2027-06-30'} : {from: '2026-07-01', to: '2026-12-31'};
  return {from: '2026-07-01', to: '2027-06-30'};
}

export const REQUEST_KINDS = Object.freeze({switch: 'Switch jadwal', remedial: 'Remedial', absence: 'Sakit / izin / dispensasi', project: 'Proyek kokurikuler', collaboration: 'Kolaborasi kokurikuler'});
export const ABSENCE_CATEGORIES = Object.freeze({sakit: 'Sakit', izin: 'Izin', dispensasi: 'Dispensasi'});
export const STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'cancelled']);

/** Mengubah ringkasan server menjadi bentuk siap tampil; menolak snapshot yang tidak lengkap. */
export function summarize(summary) {
  if (!summary || summary.version !== 1 || !Array.isArray(summary.requests) || !Array.isArray(summary.notes) || !Array.isArray(summary.weekly)) throw Error('Ringkasan belum terbaca lengkap dari server.');
  const count = (rows, test) => rows.filter(test).reduce((sum, row) => sum + Number(row.n || 0), 0);
  const kinds = Object.keys(REQUEST_KINDS).map(kind => ({kind, label: REQUEST_KINDS[kind], total: count(summary.requests, r => r.kind === kind), ...Object.fromEntries(STATUSES.map(status => [status, count(summary.requests, r => r.kind === kind && r.status === status)]))}));
  const clinic = {kind: 'clinic', label: 'Klinik pembelajaran', total: count(summary.clinic || [], () => true), ...Object.fromEntries(STATUSES.map(status => [status, count(summary.clinic || [], r => r.status === status)]))};
  const rows = [clinic, ...kinds], decided = rows.reduce((sum, r) => sum + r.approved + r.rejected, 0), approved = rows.reduce((sum, r) => sum + r.approved, 0);
  const active = summary.notes.filter(t => Number(t.n) > 0).length;
  return {
    rows, total: rows.reduce((sum, r) => sum + r.total, 0),
    pending: Number(summary.pending?.school || 0) + Number(summary.pending?.clinic || 0),
    pendingSchool: Number(summary.pending?.school || 0), pendingClinic: Number(summary.pending?.clinic || 0), expired: Number(summary.pending?.expired || 0),
    approvalRate: decided ? Math.round(approved / decided * 100) : null,
    absence: Object.keys(ABSENCE_CATEGORIES).map(category => { const row = (summary.absence || []).find(r => r.category === category); return {category, label: ABSENCE_CATEGORIES[category], n: Number(row?.n || 0), students: Number(row?.students || 0)}; }),
    journals: {duty: count(summary.journals || [], r => r.kind === 'duty'), class: count(summary.journals || [], r => r.kind === 'class')},
    notes: {teachers: summary.notes.length, active, total: count(summary.notes, () => true), coverage: summary.notes.length ? Math.round(active / summary.notes.length * 100) : null, rows: summary.notes},
    supervision: {planned: Number(summary.supervision?.planned || 0), done: Number(summary.supervision?.done || 0), cancelled: Number(summary.supervision?.cancelled || 0), acknowledged: Number(summary.supervision?.acknowledged || 0), average: summary.supervision?.average === null || summary.supervision?.average === undefined ? null : Number(summary.supervision.average)},
    weekly: summary.weekly.map(w => ({week: w.week, requests: Number(w.requests || 0), clinic: Number(w.clinic || 0), notes: Number(w.notes || 0)}))
  };
}

/** CSV aman untuk aplikasi lembar kerja: sel yang tampak seperti rumus dijadikan teks. */
export function toCSV(headers, rows) {
  const cell = value => { let text = String(value ?? ''); if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
  return '﻿' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

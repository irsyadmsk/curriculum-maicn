/* ═══════════════════════════════════════════════════
   Curriculum OS — Supabase data layer
   Kalender akademik & jadwal KBM MA ICN, disimpan di
   proyek Supabase yang sama dengan irsyads.com (tabel
   curriculum_*), supaya selaras dengan situs utama.
═══════════════════════════════════════════════════ */

(function () {
  const SUPABASE_URL = 'https://mqesvxweuygplrdxchkv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_hIDyw6sOzKOj7Ta50X8HYg_jPyOMyWZ';

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const HARI_LIST = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
  const HARI_LABEL = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat' };
  const KELAS_LIST = ['X-1', 'X-2', 'X-3'];

  // Kategori (KATEGORI PROGRAM di master kalender) -> kunci warna_kategori di data.js.
  // Kategori baru yang belum ada di peta ini otomatis dislug-kan dan jatuh ke
  // warna_kategori.default — supaya admin tetap bisa menambah kategori baru
  // tanpa situs error, walau warnanya belum dikustomisasi.
  const CATEGORY_SLUG_MAP = {
    'program boarding school': 'boarding',
    'matrikulasi': 'matrikulasi',
    'libur mingguan': 'libur_mingguan',
    'matsama': 'matsama',
    'pembelajaran efektif': 'pembelajaran',
    'libur nasional': 'libur_nasional',
    'libur nasional / cuti bersama': 'cuti_bersama_nasional',
    'cuti bersama': 'cuti_bersama',
    'asesmen dan sumatif': 'asesmen',
    'kegiatan kurikulum': 'kegiatan_kurikulum',
    'kegiatan kesiswaan': 'kesiswaan',
    'kegiatan madrasah': 'madrasah',
    'pembagian rapor': 'rapor',
    'libur semester': 'libur_semester',
    'program unggulan': 'unggulan'
  };

  function categorySlug(cat) {
    const key = (cat || '').trim().toLowerCase();
    return CATEGORY_SLUG_MAP[key] || key.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'default';
  }
  function categoryColor(cat) {
    const MD = window.MASTER_DATA;
    const table = (MD && MD.warna_kategori) || {};
    return table[categorySlug(cat)] || table.default || { bg: '#E8EDE9', teks: '#555', label: cat || 'Lainnya' };
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return isoDate(d);
  }

  // Pecah daftar rentang program jadi peta per-tanggal, dipakai kalender.html
  // persis seperti bentuk lama MASTER_DATA.kalender_harian ({c,l,s,p}).
  function expandProgramsToDays(programs) {
    const map = {};
    for (const p of programs) {
      let cursor = p.start_date;
      let guard = 0;
      while (cursor <= p.end_date && guard < 400) {
        map[cursor] = {
          c: categorySlug(p.category),
          l: p.title,
          s: p.note || '',
          p: p.periode || '',
          category: p.category,
          semester: p.semester,
          is_effective: p.is_effective,
          jp: p.jp
        };
        cursor = addDays(cursor, 1);
        guard++;
      }
    }
    return map;
  }

  async function fetchCalendarPrograms() {
    const { data, error } = await client
      .from('curriculum_calendar_programs')
      .select('*')
      .order('start_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function fetchTeachers() {
    const { data, error } = await client
      .from('curriculum_teachers')
      .select('*')
      .order('nama', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function fetchScheduleLessons() {
    const { data, error } = await client
      .from('curriculum_schedule_lessons')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Susun ulang lessons jadi { 'X-1': { senin: [ {jam_ke,...}, ... ], ... }, breaks: { senin: [...] } }
  function groupLessonsByKelas(lessons) {
    const out = {};
    KELAS_LIST.forEach(k => { out[k] = {}; HARI_LIST.forEach(h => out[k][h] = []); });
    const breaks = {};
    HARI_LIST.forEach(h => breaks[h] = []);
    for (const l of lessons) {
      if (l.kelas && out[l.kelas]) {
        out[l.kelas][l.hari].push(l);
      } else if (!l.kelas) {
        breaks[l.hari].push(l);
      }
    }
    return { byKelas: out, breaks };
  }

  // ── Auth ──
  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  async function signOut() {
    await client.auth.signOut();
  }
  async function getSession() {
    const { data } = await client.auth.getSession();
    return data.session;
  }
  async function isAdmin() {
    const session = await getSession();
    if (!session) return false;
    const { data, error } = await client.from('admins').select('user_id').maybeSingle();
    if (error) return false;
    return !!data;
  }

  // ── Admin write helpers ──
  async function upsertProgram(row) {
    const { error } = await client.from('curriculum_calendar_programs').upsert(row);
    if (error) throw error;
  }
  async function deleteProgram(id) {
    const { error } = await client.from('curriculum_calendar_programs').delete().eq('id', id);
    if (error) throw error;
  }
  async function upsertTeacher(row) {
    const { error } = await client.from('curriculum_teachers').upsert(row);
    if (error) throw error;
  }
  async function deleteTeacher(kode) {
    const { error } = await client.from('curriculum_teachers').delete().eq('kode', kode);
    if (error) throw error;
  }
  async function upsertLesson(row) {
    const { error } = await client.from('curriculum_schedule_lessons').upsert(row);
    if (error) throw error;
  }
  async function deleteLesson(id) {
    const { error } = await client.from('curriculum_schedule_lessons').delete().eq('id', id);
    if (error) throw error;
  }

  window.CurriculumDB = {
    client,
    HARI_LIST, HARI_LABEL, KELAS_LIST,
    categorySlug, categoryColor,
    fetchCalendarPrograms, fetchTeachers, fetchScheduleLessons,
    expandProgramsToDays, groupLessonsByKelas,
    signIn, signOut, getSession, isAdmin,
    upsertProgram, deleteProgram,
    upsertTeacher, deleteTeacher,
    upsertLesson, deleteLesson
  };
})();

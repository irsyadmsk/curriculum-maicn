import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorker} from '../server/worker.mjs';
import {ROOM_PAGES, roomRule, roomAllows, AKG_ITEMS, AKG_DOMAINS, akgScore, akgDomainScores, akgPredicate, validateNote, validateSupervisionPlan, validateSupervisionRecord, periodRange, summarize, toCSV} from '../assets/room-core.mjs';
import {roomClient} from '../assets/room-client.mjs';
import {loadPGlite, createRoomLab, uid} from '../scripts/room-lab.mjs';

const school = 'MA Insan Cendekia Nusantara', read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const full = value => Object.fromEntries(AKG_ITEMS.map(id => [id, value]));

test('AKG instrument: four competence domains, complete-only scoring, SQL item list in sync', () => {
  assert.deepEqual(AKG_DOMAINS.map(d => d.name), ['Pedagogik', 'Kepribadian', 'Sosial', 'Profesional']);
  assert.equal(AKG_ITEMS.length, 18); assert.equal(new Set(AKG_ITEMS).size, 18);
  const sqlItems = /curriculum_akg_items\(\)[^$]*\$\$\s*select array\[([^\]]+)\]/.exec(read('server/curriculum-room.sql'))[1].split(',').map(v => v.trim().replace(/'/g, ''));
  assert.deepEqual(sqlItems, [...AKG_ITEMS]);
  assert.equal(akgScore(full(4)), 100); assert.equal(akgScore(full(3)), 75); assert.equal(akgScore(full(1)), 25);
  assert.equal(akgScore({...full(4), p1: 0}), null); assert.equal(akgScore({...full(4), p1: 5}), null); assert.equal(akgScore({...full(4), p1: 2.5}), null);
  const mixed = {...full(4), s1: 2, s2: 2, s3: 2};
  assert.equal(akgDomainScores(mixed).find(d => d.id === 's').score, 50); assert.equal(akgDomainScores(mixed).find(d => d.id === 'p').score, 100);
  assert.deepEqual([100, 91, 90.99, 76, 75, 61, 60, 51, 50].map(akgPredicate), ['Amat baik', 'Amat baik', 'Baik', 'Baik', 'Cukup', 'Cukup', 'Sedang', 'Sedang', 'Kurang']);
  assert.equal(akgPredicate(null), '');
  assert.throws(() => validateSupervisionRecord({...full(3), f5: 0}, {follow_up: 'x'}), /Lengkapi/);
  assert.throws(() => validateSupervisionRecord(full(3), {follow_up: ' '}), /tindak lanjut/i);
  assert.throws(() => validateSupervisionPlan({teacher_code: 'ZZ', date: '2026-11-20', supervisor: 'A'}, [{kode: 'SO'}]), /Pilih guru/);
  assert.throws(() => validateSupervisionPlan({teacher_code: 'SO', date: '2027-07-01', supervisor: 'A'}, [{kode: 'SO'}]), /tahun pelajaran/);
  assert.equal(validateSupervisionPlan({teacher_code: 'SO', date: '2026-11-20', supervisor: ' Waka ', classroom: 'X-9'}, [{kode: 'SO'}]).classroom, '');
});

test('teacher note rules, analysis periods, summary shaping and formula-safe CSV', () => {
  assert.throws(() => validateNote('2026-11-15', {activities: 'a', follow_up: 'b'}, '2026-11-14'), /hari ini/);
  assert.throws(() => validateNote('2026-10-30', {activities: 'a', follow_up: 'b'}, '2026-11-14'), /14 hari/);
  assert.throws(() => validateNote('2026-11-14', {activities: ' ', follow_up: 'b'}, '2026-11-14'), /wajib/);
  assert.deepEqual(validateNote('2026-11-14', {activities: ' a ', follow_up: 'b', classrooms: ['X-1', 'X-1', 'XI-9']}, '2026-11-14'), {activities: 'a', obstacles: '', student_notes: '', follow_up: 'b', classrooms: ['X-1']});
  assert.deepEqual(periodRange('week', '2026-11-14'), {from: '2026-11-09', to: '2026-11-15'});
  assert.deepEqual(periodRange('week', '2026-11-15'), {from: '2026-11-09', to: '2026-11-15'});
  assert.deepEqual(periodRange('month', '2027-02-10'), {from: '2027-02-01', to: '2027-02-28'});
  assert.deepEqual(periodRange('semester', '2027-01-01'), {from: '2027-01-01', to: '2027-06-30'});
  assert.deepEqual(periodRange('year', '2026-11-14'), {from: '2026-07-01', to: '2027-06-30'});
  const s = summarize({version: 1, requests: [{kind: 'switch', status: 'approved', n: 3}, {kind: 'switch', status: 'rejected', n: 1}, {kind: 'absence', status: 'pending', n: 2}], clinic: [{status: 'approved', n: 4}], absence: [{category: 'sakit', n: 2, students: 3}], journals: [{kind: 'duty', n: 5}], pending: {school: 2, clinic: 1}, notes: [{teacher_code: 'SO', n: 4}, {teacher_code: 'CH', n: 0}], supervision: {planned: 1, done: 2, cancelled: 0, acknowledged: 1, average: 82.5}, weekly: [{week: '2026-11-09', requests: 1, clinic: 2, notes: 3}]});
  assert.equal(s.total, 10); assert.equal(s.pending, 3); assert.equal(s.approvalRate, 88); assert.equal(s.notes.coverage, 50);
  assert.equal(s.rows.find(r => r.kind === 'switch').approved, 3); assert.equal(s.absence.find(a => a.category === 'sakit').students, 3); assert.equal(s.absence.find(a => a.category === 'izin').n, 0);
  assert.throws(() => summarize({version: 2}), /lengkap/);
  assert.equal(toCSV(['A'], [['=1+1'], ['a"b']]), '﻿"A"\r\n"\'=1+1"\r\n"a""b"\r\n');
});

test('room RPC rules: per-action capability, unknown names and odd arguments are refused', () => {
  const teacher = {teacher: true, admin: false}, admin = {teacher: false, admin: true}, staff = {teacher: false, admin: false, reviewer: true};
  assert.equal(roomRule('curriculum_school_decide', {}), null); assert.equal(roomRule('curriculum_room_summary', {'p_from;drop': 1}), null); assert.equal(roomRule('curriculum_room_summary', []), null);
  assert.equal(roomRule('curriculum_supervision_read', {p_mode: 'all'}), null); assert.equal(roomRule('curriculum_supervision_write', {p_action: 'delete'}), null);
  for (const [name, args, t, a] of [['curriculum_teacher_note_read', {}, true, true], ['curriculum_teacher_note_write', {}, true, false], ['curriculum_supervision_read', {p_mode: 'admin'}, false, true], ['curriculum_supervision_read', {p_mode: 'mine'}, true, false], ['curriculum_supervision_write', {p_action: 'record'}, false, true], ['curriculum_supervision_write', {p_action: 'acknowledge'}, true, false], ['curriculum_room_summary', {}, false, true]]) {
    const rule = roomRule(name, args); assert.equal(roomAllows(rule, teacher), t, name); assert.equal(roomAllows(rule, admin), a, name); assert.equal(roomAllows(rule, staff), false, name);
  }
  assert.equal(roomAllows(null, admin), false);
  assert.deepEqual(ROOM_PAGES, {'ruang-admin.html': 'admin', 'ruang-guru.html': 'teacher'});
});

function gateway(extra = {}) {
  const calls = [], roles = {'t-admin': {role: 'admin', user_id: 'u-admin'}, 't-teacher': {role: 'teacher', user_id: 'u-teacher', teacher_code: 'SO', teacher: 'Guru'}, 't-staff': {role: 'curriculum', user_id: 'u-staff'}, 't-member': {role: 'member', user_id: 'u-member'}};
  const worker = createWorker({fetcher: async (url, options = {}) => {
    const record = roles[options.headers?.Authorization?.slice(7)]; calls.push(url.split('/').pop());
    if (url.endsWith('/auth/v1/user')) return Response.json(record ? {id: record.user_id} : {}, {status: record ? 200 : 401});
    if (url.endsWith('/curriculum_access_context')) return Response.json({version: 1, institution: school, ...record});
    return Response.json({version: 1, rows: [], count: 0});
  }});
  const env = {ACCESS_ENABLED: 'true', ROOM_ENABLED: 'true', SUPABASE_URL: 'https://fixture.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', ASSETS: {fetch: async () => new Response('<html>ruang</html>', {headers: {'Content-Type': 'text/html'}})}, ...extra};
  const page = (path, token) => worker.fetch(new Request('https://school.test/' + path, {headers: token ? {Cookie: 'maicn_session_v1=' + token} : {}}), env);
  const rpc = (token, name, args, origin = 'https://school.test') => worker.fetch(new Request('https://school.test/api/room/rpc', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin, ...(token ? {Cookie: 'maicn_session_v1=' + token} : {})}, body: JSON.stringify({name, args})}), env);
  return {page, rpc, calls};
}

test('Worker sends the admin room only to admins and the teacher room only to linked teachers, never cached', async () => {
  const g = gateway();
  for (const token of [null, 't-member', 't-teacher', 't-staff']) { const r = await g.page('ruang-admin.html', token); assert.equal(r.status, 303, String(token)); assert.match(r.headers.get('Location'), /^\/akun\.html\?next=%2Fruang-admin\.html&access=admin$/); }
  for (const token of [null, 't-member', 't-staff']) assert.equal((await g.page('ruang-guru.html', token)).status, 303, String(token));
  for (const [path, token] of [['ruang-admin.html', 't-admin'], ['ruang-guru.html', 't-teacher']]) { const r = await g.page(path, token); assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'no-store'); assert.match(r.headers.get('X-Robots-Tag'), /noindex/); }
  assert.equal((await g.page('RUANG-ADMIN.html', null)).status, 404);
});

test('Worker room RPC: flag off makes no upstream call; capability, origin and allowlist are enforced', async () => {
  const off = gateway({ROOM_ENABLED: 'false'}), r0 = await off.rpc('t-admin', 'curriculum_room_summary', {p_from: '2026-11-01', p_to: '2026-11-30'});
  assert.equal(r0.status, 503); assert.equal((await r0.json()).error.message, 'room_disabled'); assert.deepEqual(off.calls, []);
  const g = gateway();
  assert.equal((await g.rpc('t-admin', 'curriculum_room_summary', {}, 'https://evil.test')).status, 403);
  for (const [token, name, args] of [[null, 'curriculum_teacher_note_read', {}], ['t-member', 'curriculum_teacher_note_read', {}], ['t-staff', 'curriculum_room_summary', {}], ['t-teacher', 'curriculum_room_summary', {}], ['t-teacher', 'curriculum_supervision_read', {p_mode: 'admin'}], ['t-teacher', 'curriculum_supervision_write', {p_action: 'record'}], ['t-admin', 'curriculum_school_assign', {}], ['t-admin', 'curriculum_room_summary', {'p_x y': 1}]]) {
    g.calls.length = 0; const r = await g.rpc(token, name, args); assert.equal(r.status, 403, name + ' ' + token); assert.ok(!g.calls.includes(name), 'no upstream RPC for ' + name);
  }
  const ok = await g.rpc('t-teacher', 'curriculum_supervision_read', {p_mode: 'mine'}); assert.equal(ok.status, 200); assert.equal((await ok.json()).data.count, 0);
  assert.equal((await (await createWorker({fetcher: async () => Response.json({})}).fetch(new Request('https://school.test/api/config'), {ROOM_ENABLED: 'true'})).json()).room_enabled, true);
});

test('client rejects incomplete snapshots and unconfirmed receipts; server codes become Indonesian messages', async () => {
  const client = roomClient(async name => name === 'curriculum_teacher_note_read' ? {data: {version: 1, rows: [{}], count: 2}} : name === 'curriculum_teacher_note_write' ? {data: {id: 'a', revision: 5, token: 't'}} : {data: null, error: {message: 'note_window'}});
  await assert.rejects(client.notes('2026-11-01', '2026-11-02'), /lengkap/);
  await assert.rejects(client.noteSave({id: 'a', revision: 0}, '2026-11-14', {}, 't'), /dipastikan/);
  await assert.rejects(client.supervisions('mine'), /14 hari/);
});

test('pages, hub and legacy admin point to the rooms; nothing links curriculum review to Studio any more', () => {
  for (const [page, module] of [['ruang-admin.html', 'room-admin.mjs'], ['ruang-guru.html', 'room-teacher.mjs']]) { const html = read(page); assert.ok(html.includes(`assets/${module}`)); assert.ok(html.includes('assets/room.css')); assert.ok(html.includes('id="room-root"')); assert.ok(html.includes('noindex')); }
  assert.ok(read('layanan.html').includes('assets/service-hub.mjs'));
  for (const file of ['assets/school-services.mjs', 'assets/school-journals.mjs']) assert.ok(!read(file).includes('studio.irsyads.com'), file);
  const services = read('assets/school-services.mjs'); for (const value of ['sakit', 'izin', 'dispensasi']) assert.ok(services.includes(`value="${value}"`));
  const legacy = read('admin.html'); for (const tab of ['klinik', 'inval', 'jurnal', 'supervisi']) assert.ok(!legacy.includes(`class="admin-tab" data-tab="${tab}"`), tab); assert.ok(legacy.includes('ruang-admin.html#supervisi'));
  assert.match(read('wrangler.jsonc'), /"ROOM_ENABLED": "false"/);
  assert.ok(read('assets/room.css').includes('prefers-reduced-motion'));
});

const PGlite = await loadPGlite();
test('candidate SQL: ownership, roles, revisions, idempotency, AKG scoring and admin summary', {skip: !PGlite && 'PGlite tidak tersedia; setel PGLITE_MODULE untuk menjalankan skenario SQL'}, async () => {
  const {db, rpc} = await createRoomLab(PGlite), today = (await db.query("select (now() at time zone 'Asia/Jakarta')::date::text d")).rows[0].d;
  const id = () => crypto.randomUUID(), note = {activities: 'Diskusi stratifikasi sosial', follow_up: 'Kuis formatif', classrooms: ['X-1']};
  // Catatan harian: hanya guru tertaut, hanya miliknya, jendela 14 hari.
  for (const who of [null, 'student', 'staff', 'admin']) await assert.rejects(rpc(who, 'curriculum_teacher_note_write', {p_id: id(), p_expected: 0, p_date: today, p_content: note, p_token: id()}), /forbidden|permission denied/, String(who));
  const noteId = id(), token = id(), saved = await rpc('teacher', 'curriculum_teacher_note_write', {p_id: noteId, p_expected: 0, p_date: today, p_content: note, p_token: token});
  assert.deepEqual(saved, {id: noteId, revision: 1, token});
  assert.deepEqual(await rpc('teacher', 'curriculum_teacher_note_write', {p_id: noteId, p_expected: 0, p_date: today, p_content: note, p_token: token}), saved, 'same token replays the receipt');
  await assert.rejects(rpc('teacher', 'curriculum_teacher_note_write', {p_id: noteId, p_expected: 0, p_date: today, p_content: {...note, follow_up: 'lain'}, p_token: token}), /token_mismatch/);
  await assert.rejects(rpc('chemistry', 'curriculum_teacher_note_write', {p_id: noteId, p_expected: 0, p_date: today, p_content: note, p_token: token}), /token_mismatch/);
  await assert.rejects(rpc('teacher', 'curriculum_teacher_note_write', {p_id: noteId, p_expected: 0, p_date: today, p_content: note, p_token: id()}), /stale_revision/);
  await assert.rejects(rpc('teacher', 'curriculum_teacher_note_write', {p_id: id(), p_expected: 1, p_date: today, p_content: note, p_token: id()}), /stale_revision/);
  assert.equal((await rpc('teacher', 'curriculum_teacher_note_write', {p_id: noteId, p_expected: 1, p_date: today, p_content: {...note, obstacles: 'Proyektor'}, p_token: id()})).revision, 2);
  await assert.rejects(rpc('teacher', 'curriculum_teacher_note_write', {p_id: id(), p_expected: 0, p_date: today, p_content: {activities: ' ', follow_up: 'x'}, p_token: id()}), /journal_incomplete/);
  const far = (await db.query("select ((now() at time zone 'Asia/Jakarta')::date-15)::text a,((now() at time zone 'Asia/Jakarta')::date+1)::text b")).rows[0];
  for (const date of [far.a, far.b]) await assert.rejects(rpc('teacher', 'curriculum_teacher_note_write', {p_id: id(), p_expected: 0, p_date: date, p_content: note, p_token: id()}), /note_window/);
  await rpc('chemistry', 'curriculum_teacher_note_write', {p_id: id(), p_expected: 0, p_date: today, p_content: note, p_token: id()});
  const mine = await rpc('teacher', 'curriculum_teacher_note_read', {p_from: today, p_to: today});
  assert.equal(mine.count, 1); assert.equal(mine.rows[0].teacher_code, 'SO'); assert.equal(mine.rows[0].content.obstacles, 'Proyektor'); assert.deepEqual(mine.teachers, []);
  const all = await rpc('admin', 'curriculum_teacher_note_read', {p_from: today, p_to: today}); assert.equal(all.count, 2); assert.equal(all.teachers.length, 3);
  for (const who of [null, 'student', 'staff']) await assert.rejects(rpc(who, 'curriculum_teacher_note_read', {p_from: today, p_to: today}), /forbidden|permission denied/);
  await assert.rejects(rpc('admin', 'curriculum_teacher_note_read', {p_from: '2026-07-01', p_to: '2027-12-31'}), /room_scope/);

  // Supervisi: hanya admin merencanakan dan menilai; guru hanya membaca dan menandai miliknya.
  const supId = id(), plan = {teacher_code: 'SO', date: '2026-11-20', start: '07:00', classroom: 'X-1', focus: 'Diferensiasi', supervisor: 'Waka Kurikulum'};
  for (const who of [null, 'teacher', 'staff', 'student']) await assert.rejects(rpc(who, 'curriculum_supervision_write', {p_id: supId, p_expected: 0, p_action: 'plan', p_data: plan, p_token: id()}), /forbidden|permission denied/, String(who));
  await assert.rejects(rpc('admin', 'curriculum_supervision_write', {p_id: id(), p_expected: 0, p_action: 'plan', p_data: {...plan, teacher_code: 'ZZ'}, p_token: id()}), /invalid_supervision/);
  assert.equal((await rpc('admin', 'curriculum_supervision_write', {p_id: supId, p_expected: 0, p_action: 'plan', p_data: plan, p_token: id()})).status, 'planned');
  assert.equal((await rpc('teacher', 'curriculum_supervision_read', {p_mode: 'mine'})).rows[0].start, '07:00');
  assert.equal((await rpc('chemistry', 'curriculum_supervision_read', {p_mode: 'mine'})).count, 0);
  for (const who of ['teacher', 'staff', 'student']) await assert.rejects(rpc(who, 'curriculum_supervision_read', {p_mode: 'admin'}), /forbidden/);
  await assert.rejects(rpc('staff', 'curriculum_supervision_read', {p_mode: 'mine'}), /forbidden/);
  await assert.rejects(rpc('teacher', 'curriculum_supervision_write', {p_id: supId, p_expected: 1, p_action: 'acknowledge', p_data: {}, p_token: id()}), /forbidden/, 'cannot acknowledge before a result exists');
  const record = {scores: {...full(3), p1: 4, p2: 4}, notes: {strengths: 'Tertib', improvements: '', follow_up: 'Lokakarya asesmen'}};
  await assert.rejects(rpc('admin', 'curriculum_supervision_write', {p_id: supId, p_expected: 1, p_action: 'record', p_data: {...record, scores: {...record.scores, p1: 5}}, p_token: id()}), /invalid_supervision/);
  await assert.rejects(rpc('admin', 'curriculum_supervision_write', {p_id: supId, p_expected: 1, p_action: 'record', p_data: {...record, scores: {...record.scores, zz: 4}}, p_token: id()}), /invalid_supervision/);
  await assert.rejects(rpc('admin', 'curriculum_supervision_write', {p_id: supId, p_expected: 1, p_action: 'record', p_data: {...record, notes: {follow_up: ''}}, p_token: id()}), /invalid_supervision/);
  await assert.rejects(rpc('admin', 'curriculum_supervision_write', {p_id: supId, p_expected: 0, p_action: 'record', p_data: record, p_token: id()}), /stale_revision/);
  const done = await rpc('admin', 'curriculum_supervision_write', {p_id: supId, p_expected: 1, p_action: 'record', p_data: record, p_token: id()});
  assert.equal(done.status, 'done'); assert.equal(Number(done.score), akgScore(record.scores)); assert.equal(Number(done.score), 77.78);
  await assert.rejects(rpc('admin', 'curriculum_supervision_write', {p_id: supId, p_expected: 2, p_action: 'cancel', p_data: {}, p_token: id()}), /invalid_supervision/, 'a finished supervision is not cancellable');
  await assert.rejects(rpc('chemistry', 'curriculum_supervision_write', {p_id: supId, p_expected: 2, p_action: 'acknowledge', p_data: {}, p_token: id()}), /forbidden/, 'another teacher cannot acknowledge');
  assert.equal((await rpc('teacher', 'curriculum_supervision_write', {p_id: supId, p_expected: 2, p_action: 'acknowledge', p_data: {note: 'Siap'}, p_token: id()})).revision, 3);
  await assert.rejects(rpc('teacher', 'curriculum_supervision_write', {p_id: supId, p_expected: 3, p_action: 'acknowledge', p_data: {}, p_token: id()}), /forbidden/);
  const cancelId = id(); await rpc('admin', 'curriculum_supervision_write', {p_id: cancelId, p_expected: 0, p_action: 'plan', p_data: {...plan, teacher_code: 'CH'}, p_token: id()});
  await rpc('admin', 'curriculum_supervision_write', {p_id: cancelId, p_expected: 1, p_action: 'cancel', p_data: {}, p_token: id()});
  assert.equal((await rpc('chemistry', 'curriculum_supervision_read', {p_mode: 'mine'})).count, 0, 'cancelled plans are hidden from the teacher');
  const adminRows = (await rpc('admin', 'curriculum_supervision_read', {p_mode: 'admin'})).rows; assert.equal(adminRows.length, 2); assert.ok(adminRows.find(r => r.id === supId).acknowledged_at); assert.ok(!('created_by' in adminRows[0]));

  // Ringkasan: admin saja; kategori ketidakhadiran dan cakupan catatan terhitung.
  await db.exec(`insert into private.curriculum_school_requests(institution,kind,status,date,body,student_ids) values('${school}','absence','approved','2026-11-10','{"category":"sakit"}','{a,b}'),('${school}','absence','pending','2026-11-11','{}','{c}'),('${school}','switch','rejected','2026-11-12','{}','{}'),('${school}','switch','pending','2026-08-01','{}','{}');insert into private.curriculum_clinic_requests(institution,status,date) values('${school}','approved','2026-11-12'),('${school}','pending','2026-11-13');insert into private.curriculum_school_journals(institution,kind,date) values('${school}','duty','2026-11-12');`);
  for (const who of [null, 'teacher', 'staff', 'student']) await assert.rejects(rpc(who, 'curriculum_room_summary', {p_from: '2026-11-01', p_to: '2026-11-30'}), /forbidden|permission denied/, String(who));
  const s = summarize(await rpc('admin', 'curriculum_room_summary', {p_from: '2026-11-01', p_to: '2026-11-30'}));
  assert.equal(s.rows.find(r => r.kind === 'absence').total, 2); assert.equal(s.rows.find(r => r.kind === 'switch').total, 1, 'out-of-range request excluded'); assert.equal(s.rows.find(r => r.kind === 'clinic').total, 2);
  assert.equal(s.pendingSchool, 2); assert.equal(s.pendingClinic, 1); assert.equal(s.absence.find(a => a.category === 'sakit').students, 2); assert.equal(s.absence.find(a => a.category === 'dispensasi').n, 1);
  assert.equal(s.journals.duty, 1); assert.equal(s.notes.teachers, 3); assert.equal(s.notes.active, today >= '2026-11-01' && today <= '2026-11-30' ? 2 : 0);
  assert.equal(s.supervision.done, 1); assert.equal(s.supervision.cancelled, 1); assert.equal(s.supervision.acknowledged, 1); assert.equal(s.supervision.average, 77.78); assert.ok(s.weekly.length >= 4);
  // Tabel tidak dapat dibaca langsung oleh peran klien.
  await db.exec('set role authenticated'); await assert.rejects(db.query('select * from private.curriculum_supervisions'), /permission denied/); await db.exec('reset role');
  void uid;
});

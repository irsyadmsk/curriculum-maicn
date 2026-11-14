/** Lab loopback ruang guru/admin: Worker asli + SQL kandidat di PGlite, identitas dan data fiktif, tanpa jaringan luar. */
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWorker} from '../server/worker.mjs';
import {loadPGlite, createRoomLab, identities, uid, school} from './room-lab.mjs';
import {AKG_ITEMS} from '../assets/room-core.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)), port = 4584, PGlite = await loadPGlite();
if (!PGlite) throw Error('PGlite tidak ditemukan. Setel PGLITE_MODULE ke dist/index.js paket @electric-sql/pglite.');
const {db, rpc} = await createRoomLab(PGlite), id = () => crypto.randomUUID();
const today = (await db.query("select (now() at time zone 'Asia/Jakarta')::date::text d")).rows[0].d, back = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
// Data contoh agar setiap tampilan terisi.
for (const [who, days] of [['teacher', [0, 1, 2, 4, 7, 8]], ['chemistry', [1, 3]]]) for (const n of days) await rpc(who, 'curriculum_teacher_note_write', {p_id: id(), p_expected: 0, p_date: back(n), p_content: {activities: 'Diskusi kelompok dan presentasi hasil pengamatan.', obstacles: n % 2 ? 'Waktu presentasi kurang.' : '', student_notes: '', follow_up: 'Kuis formatif pada pertemuan berikutnya.', classrooms: ['X-1', 'X-2']}, p_token: id()});
const plan = (code, date) => ({teacher_code: code, date, start: '07:00', classroom: 'X-2', focus: 'Pembelajaran berdiferensiasi', supervisor: 'Wakil Kepala Bidang Kurikulum (contoh)'});
const a = id(), b = id();
await rpc('admin', 'curriculum_supervision_write', {p_id: a, p_expected: 0, p_action: 'plan', p_data: plan('SO', back(5)), p_token: id()});
await rpc('admin', 'curriculum_supervision_write', {p_id: a, p_expected: 1, p_action: 'record', p_data: {scores: Object.fromEntries(AKG_ITEMS.map((k, i) => [k, i % 4 === 0 ? 4 : 3])), notes: {strengths: 'Pengelolaan kelas tertib dan hangat.', improvements: 'Variasi asesmen formatif.', follow_up: 'Pendampingan penyusunan rubrik pada KKG madrasah.'}}, p_token: id()});
await rpc('admin', 'curriculum_supervision_write', {p_id: b, p_expected: 0, p_action: 'plan', p_data: plan('CH', back(-3) > '2027-06-30' ? today : back(-3)), p_token: id()});
const kinds = [['switch', 'approved'], ['switch', 'pending'], ['remedial', 'approved'], ['remedial', 'rejected'], ['absence', 'approved'], ['absence', 'approved'], ['absence', 'pending'], ['project', 'approved'], ['collaboration', 'pending']];
for (const [n, [kind, status]] of kinds.entries()) await db.query('insert into private.curriculum_school_requests(institution,kind,status,date,body,student_ids) values($1,$2,$3,$4,$5,$6)', [school, kind, status, back(n * 3), JSON.stringify(kind === 'absence' ? {category: ['sakit', 'izin', 'dispensasi'][n % 3]} : {}), kind === 'absence' ? ['a', 'b'] : []]);
for (const [n, status] of ['approved', 'approved', 'pending', 'rejected', 'approved', 'cancelled'].entries()) await db.query('insert into private.curriculum_clinic_requests(institution,status,date) values($1,$2,$3)', [school, status, back(n * 4)]);
for (const n of [0, 1, 2, 3]) await db.query('insert into private.curriculum_school_journals(institution,kind,date) values($1,$2,$3)', [school, n % 2 ? 'class' : 'duty', back(n)]);

const roles = {admin: {role: 'admin'}, teacher: {role: 'teacher', teacher_code: 'SO', teacher: 'Guru Sosiologi Contoh'}, chemistry: {role: 'teacher', teacher_code: 'CH', teacher: 'Guru Kimia Contoh'}, staff: {role: 'curriculum'}, student: {role: 'member'}};
const worker = createWorker({fetcher: async (url, options = {}) => {
  const name = options.headers?.Authorization?.slice(7).replace(/^fixture-/, ''), record = roles[name];
  if (url.endsWith('/auth/v1/user')) return Response.json(record ? {id: uid(identities[name])} : {error: 'invalid'}, {status: record ? 200 : 401});
  const fn = url.split('/').pop();
  if (fn === 'curriculum_access_context') return Response.json(record ? {version: 1, institution: school, user_id: uid(identities[name]), ...record} : {}, {status: record ? 200 : 401});
  if (!/^curriculum_(teacher_note|supervision|room)_[a-z_]+$/.test(fn)) return Response.json({message: 'Lab ini hanya memuat ruang guru/admin'}, {status: 503});
  try { return Response.json(await rpc(record ? name : null, fn, JSON.parse(options.body || '{}'))); } catch (error) { return Response.json({message: error.message}, {status: 400}); }
}});
const files = new Set(JSON.parse(await fs.readFile(path.join(root, '.site/asset-manifest.json'), 'utf8')).map(r => '/' + r.path));
const banner = `<aside style="padding:10px 20px;background:#F3EDE2;color:#0B1D35;position:relative;z-index:1500;font:13px/1.6 system-ui"><strong>LAB LOKAL · DATA & AKUN CONTOH</strong> · ${['guest', ...Object.keys(roles)].map(r => `<a href="/__fixture/role/${r}">${r}</a>`).join(' · ')} · <a href="/kurikulum.html#analysis">Ruang kurikulum</a> · <a href="/ruang-guru.html">Ruang guru</a> · <a href="/layanan.html">Layanan</a></aside>`;
const mime = name => name.endsWith('.html') ? 'text/html;charset=utf-8' : /\.(js|mjs)$/.test(name) ? 'text/javascript;charset=utf-8' : name.endsWith('.css') ? 'text/css' : name.endsWith('.json') ? 'application/json' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.png') ? 'image/png' : 'application/octet-stream';
const env = {ACCESS_ENABLED: 'true', ROOM_ENABLED: 'true', PREVIEW_MODE: 'true', SUPABASE_URL: 'https://fixture.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', ASSETS: {async fetch(request) {
  const name = new URL(request.url).pathname; if (!files.has(name)) return new Response('Tidak ditemukan', {status: 404});
  let bytes = await fs.readFile(path.join(root, '.site', name.slice(1)));
  if (name.endsWith('.html') && !process.argv.includes('--no-banner')) bytes = Buffer.from(bytes.toString().replace(/(<body[^>]*>)/, `$1${banner}`));
  return new Response(bytes, {headers: {'Content-Type': mime(name), 'Cache-Control': 'no-store'}});
}}};
createServer(async (req, res) => {
  if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403); return res.end(); }
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/__fixture/role/')) { const role = url.pathname.split('/').pop(); if (role !== 'guest' && !roles[role]) { res.writeHead(404); return res.end(); } res.writeHead(303, {'Set-Cookie': `maicn_session_v1=${role === 'guest' ? '' : 'fixture-' + role}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${role === 'guest' ? 0 : 3600}`, Location: role === 'admin' ? '/kurikulum.html#analysis' : role === 'guest' || role === 'student' || role === 'staff' ? '/layanan.html' : '/ruang-guru.html', 'Cache-Control': 'no-store'}); return res.end(); }
    const chunks = []; let size = 0; for await (const c of req) { size += c.length; if (size > 64000) { res.writeHead(413); return res.end(); } chunks.push(c); }
    const response = await worker.fetch(new Request(url, {method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? {body: Buffer.concat(chunks)} : {})}), env);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(503, {'Content-Type': 'text/plain'}); res.end('Lab belum dapat menyelesaikan permintaan: ' + error.message); }
}).listen(port, '127.0.0.1', () => console.log(`Lab ruang guru/admin: http://127.0.0.1:${port}/__fixture/role/admin`));

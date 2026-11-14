/** Lab bersama tes dan pratinjau ruang: SQL kandidat asli di PGlite dengan identitas dan data fiktif. */
import fs from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export const school = 'MA Insan Cendekia Nusantara', uid = n => `83000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const identities = {admin: 1, teacher: 2, chemistry: 3, staff: 4, student: 5};
export async function loadPGlite() {
  for (const candidate of [process.env.PGLITE_MODULE, new URL('../../irsyads/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href].filter(Boolean)) {
    try { return (await import(candidate.startsWith('file:') || candidate.startsWith('/') ? pathToFileURL(candidate.replace(/^file:\/\//, '')).href : candidate)).PGlite; } catch { /* coba kandidat berikutnya */ }
  }
  return null;
}
/** Tiruan minimal objek produksi yang dibaca curriculum-room.sql; aturan peran mengikuti definisi aslinya. */
export async function createRoomLab(PGlite) {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
   create table public.user_accounts(user_id uuid primary key,status text default 'active',must_change_password boolean default false);
   create table public.curriculum_teachers(kode text primary key,nama text,mapel text);
   insert into public.curriculum_teachers values('SO','Guru Sosiologi Contoh','Sosiologi'),('CH','Guru Kimia Contoh','Kimia'),('FQ','Guru Fikih Contoh','Fikih');
   create table private.curriculum_teacher_access(user_id uuid primary key,institution text,teacher_code text,active boolean default true);
   create table private.curriculum_clinic_managers(user_id uuid,institution text,level text);
   create table private.curriculum_school_requests(id uuid primary key default gen_random_uuid(),institution text,kind text,status text,date date,body jsonb default '{}',student_ids text[] default '{}');
   create table private.curriculum_clinic_requests(id uuid primary key default gen_random_uuid(),institution text,status text,date date);
   create table private.curriculum_school_journals(id uuid primary key default gen_random_uuid(),institution text,kind text,date date);
   create function private.school_ready(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.user_accounts where user_id=p_user and status='active' and not must_change_password)$$;
   create function private.school_teacher(p_user uuid,p_institution text) returns text language sql stable security definer set search_path='' as $$select a.teacher_code from private.curriculum_teacher_access a join public.user_accounts u on u.user_id=a.user_id where a.user_id=p_user and a.institution=p_institution and a.active and u.status='active' and not u.must_change_password$$;
   create function private.curriculum_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.curriculum_clinic_managers where user_id=auth.uid() and institution='${school}' and level='admin')$$;
   grant usage on schema public,auth to anon,authenticated,service_role;`);
  for (const n of Object.values(identities)) { await db.query('insert into auth.users values($1)', [uid(n)]); await db.query('insert into public.user_accounts(user_id) values($1)', [uid(n)]); }
  await db.query("insert into private.curriculum_clinic_managers values($1,$2,'admin'),($3,$2,'staff')", [uid(1), school, uid(4)]);
  await db.query("insert into private.curriculum_teacher_access values($1,$3,'SO'),($2,$3,'CH')", [uid(2), uid(3), school]);
  await db.exec(await fs.readFile(root + 'server/curriculum-room.sql', 'utf8'));
  let queue = Promise.resolve();
  /** Memanggil RPC sebagai identitas tertentu; antrean menjaga `set role` tidak saling menimpa. */
  function rpc(identity, name, args = {}) {
    const run = queue.then(async () => {
      const keys = Object.keys(args);
      if (!/^curriculum_[a-z_]+$/.test(name) || keys.some(k => !/^p_[a-z_]+$/.test(k))) throw Error('invalid fixture call');
      await db.exec('reset role'); await db.query("select set_config('fixture.uid',$1,false)", [identity ? uid(identities[identity]) : '']); await db.exec('set role ' + (identity ? 'authenticated' : 'anon'));
      try { return (await db.query(`select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}`).join(',')}) as v`, keys.map(k => args[k]))).rows[0].v; } finally { await db.exec('reset role'); }
    });
    queue = run.catch(() => {});
    return run;
  }
  return {db, rpc};
}

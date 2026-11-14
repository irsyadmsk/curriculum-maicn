import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire(new URL('../../irsyads/package.json',import.meta.url)),{PGlite}=require('@electric-sql/pglite');
const base=fileURLToPath(new URL('../../',import.meta.url)),db=new PGlite(),school='MA Insan Cendekia Nusantara',year='2026/2027',uid='81000000-0000-4000-8000-000000000001';
let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++},reject=async(fn,re)=>{await assert.rejects(fn,re);checks++};
try{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${uid}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function private.is_admin() returns boolean language sql as $$select auth.uid()='${uid}'::uuid$$;create table public.user_accounts(user_id uuid primary key,status text,must_change_password boolean,login_email text);insert into user_accounts values('${uid}','active',false,'admin@example.test');create table public.profiles(id uuid primary key,full_name text);create table public.user_roles(user_id uuid,role_id text);create table public.curriculum_teachers(kode text primary key,nama text,mapel text);insert into curriculum_teachers values('AA','Guru A','Fisika'),('BB','Guru B','Kimia');grant usage on schema public,auth to anon,authenticated,service_role;`);
for(const p of ['irsyads/supabase/migrations/20261026130151_curriculum_clinic_access.sql','curriculum-maicn/server/clinic-intake-v2.sql','curriculum-maicn/server/clinic-allocation.sql','curriculum-maicn/server/school-workflows.sql','curriculum-maicn/server/school-notifications.sql','curriculum-maicn/server/curriculum-staff.sql'])await db.exec(await fs.readFile(base+p,'utf8'));
for(const [id,name,c] of [['a','Murid A','X-1'],['b','Murid B','X-1'],['c','Murid C','X-2'],['d','Murid D','X-2']])await db.query('insert into private.curriculum_clinic_roster values($1,$2,$3,$4,$5,$6)',[school,year,id,name,c,'synthetic']);
const as=async(role,user='')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role '+role)};
const read=async(sql,args=[])=>{const r=await db.query(sql,args);return r.rows[0]?.v},id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,token=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const inspect=async(sql,args=[])=>{await as('postgres');try{return await read(sql,args)}finally{await as('authenticated',uid)}};
const proposal={date:'2026-12-07',start:'20:30',end:'21:30',classroom:'X-1',target_mode:'class',participant_ids:['a','b'],request_kind:'teacher',teacher_code:'AA',subjects:['Fisika'],topic:'Contoh',contact_email:'teacher@example.test',evidence:'https://drive.google.com/file/d/abcdefghijklmno/view'};
const intake=(n,p=proposal)=>read('select public.curriculum_clinic_intake($1,$2,$3,$4,$5,$6) v',[school,year,id(n),token(n),String(n).padStart(64,'a'),p]);
const decide=(n,action,revision=1)=>read('select public.curriculum_clinic_write($1,$2,$3,$4,$5,$6,$7) v',[school,year,action,id(n),revision,{subject:'Fisika',note:'Ditinjau'},crypto.randomUUID()]);
await as('service_role');for(let n=1;n<=3;n++)await intake(n);await intake(5,{...proposal,request_kind:'guest',teacher_code:null});
await as('postgres');
await db.exec(await fs.readFile(base+'curriculum-maicn/server/curriculum-operations.sql','utf8'));
await db.exec(await fs.readFile(new URL('../server/curriculum-action-repair.sql',import.meta.url),'utf8'));
await as('authenticated',uid);
await reject(()=>decide(1,'approve'),/identity_or_location_required/);ok((await decide(2,'reject')).status,'rejected');
const identity={confirmed:true,requester_kind:'teacher',requester_id:'AA',location:'Kelas X-1'},verify=(n,data=identity,tok=token(100+n))=>read('select public.curriculum_clinic_verify_legacy($1,$2,$3,$4) v',[id(n),1,data,tok]);
await reject(()=>verify(1,{...identity,requester_id:'BB'}),/invalid_requester/);ok((await verify(1)).identity_verified,true);ok((await verify(1)).identity_verified,true);
await reject(()=>verify(1,{...identity,location:'Kelas X-2'}),/token_mismatch/);ok((await decide(1,'approve')).status,'approved');
const move={target_mode:'class',classroom:'X-2',note:'Kurikulum menimbang kebutuhan kelas X-2'},retarget=(n,rev=2,data=move,tok=token(200+n))=>read('select public.curriculum_clinic_retarget($1,$2,$3,$4,$5,$6,$7) v',[school,year,'retarget',id(n),rev,data,tok]);
ok((await retarget(1)).status,'pending');ok((await retarget(1)).revision,3);
ok(await inspect('select to_jsonb(participant_ids) v from private.curriculum_clinic_requests where id=$1',[id(1)]),['c','d']);
await reject(()=>retarget(1,2,move,token(333)),/stale_revision/);await reject(()=>retarget(1,3,{...move,participant_ids:['forged'],target_mode:'students'},token(334)),/invalid_participants/);
await verify(3);await decide(3,'approve');await reject(()=>decide(1,'approve',3),/clinic_conflict/); // Same teacher still teaching X-1 in clinic 3.
await decide(3,'cancel',2);ok((await decide(1,'approve',3)).status,'approved');
await read('select public.curriculum_clinic_enrichment($1,$2,$3,$4,$5) v',[school,year,id(1),4,'finalize']);await reject(()=>retarget(1,4,move,token(335)),/enrichment_finalized/);
const bytes=Buffer.concat([Buffer.from('ffd8ff','hex'),Buffer.alloc(40,5)]).toString('base64');
const legacyStudent={confirmed:true,requester_kind:'student',requester_id:'a',requester_class:'X-1',location:'Kelas X-1'};
await reject(()=>verify(5,legacyStudent),/invalid_photo/);ok((await verify(5,{...legacyStudent,identity_photo:bytes,photo_mime:'image/jpeg'})).identity_verified,true);
ok(await inspect("select count(*)::int v from private.curriculum_operations_receipts where intent::text like '%'||$1||'%'",[bytes]),0);ok((await decide(5,'reject')).status,'rejected');
await as('service_role');const student={...proposal,request_kind:'guest',teacher_code:null,date:'2026-12-14',requester_kind:'student',requester_id:'a',requester_class:'X-1',identity_photo:bytes,photo_mime:'image/jpeg',location:'Kelas X-1'};ok((await intake(4,student)).status,'pending');
await as('authenticated',uid);await read('select public.curriculum_operations_write($1,$2,$3,$4) v',['identity',{kind:'clinic',id:id(4),confirmed:true,location:'Kelas X-1'},1,token(400)]);
// Rejection never needs a teaching assignment and must delete the photo.
ok((await decide(4,'reject')).status,'rejected');ok(await inspect("select photo is null v from private.curriculum_request_details where request_id=$1",[id(4)]),true);
ok(await inspect("select count(*)::int v from private.curriculum_clinic_events where intent::text like '%'||$1||'%'",[bytes]),0);
await as('service_role');const project={title:'Kegiatan bebas buatan guru',date:'2026-12-08',start:'15:00',end:'16:00',teacher_code:'AA',tp:'Menerapkan konsep',reason:'Praktik bersama',student_ids:[],classroom:'X-1',body:{end_date:'2026-12-09'},contact_email:proposal.contact_email,evidence:proposal.evidence,requester_kind:'teacher',requester_id:'AA'};
ok((await read('select public.curriculum_school_guest($1,$2,$3,$4,$5) v',['project',id(9),project,token(9),'b'.repeat(64)])).status,'pending');
await as('anon');await reject(()=>retarget(1,4,move,token(999)),/permission denied/);await reject(()=>verify(1),/permission denied/);
await as('authenticated','81000000-0000-4000-8000-000000000099');await reject(()=>retarget(1,4,move,token(999)),/forbidden/);
console.log('Synthetic PostgreSQL checks passed:',checks);
}finally{await db.close()}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createWorker} from '../server/worker.mjs';
import {capabilities,routeAccess,parseAccess} from '../assets/access-core.mjs';
const school='MA Insan Cendekia Nusantara',origin='https://curriculum.example.test';
function fixture(){
 const roles=new Map([['teacher-token',{version:1,institution:school,user_id:'teacher-a',role:'teacher',teacher_code:'GU',teacher:'Guru A'}],['manager-token',{version:1,institution:school,user_id:'manager-a',role:'curriculum'}],['member-token',{version:1,institution:school,user_id:'member-a',role:'member'}]]),calls=[],assets=[];
 let challenge={success:true,hostname:'curriculum.example.test',action:'clinic_request'};
 const env={ACCESS_ENABLED:'true',CLINIC_ENABLED:'true',SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',CLINIC_SERVICE_KEY:'server-example',TURNSTILE_SECRET:'secret-example',TURNSTILE_SITE_KEY:'public-site-key',REQUEST_HASH_SECRET:'hash-example',ASSETS:{async fetch(r){assets.push(new URL(r.url).pathname);return new Response('protected asset fixture',{headers:{'Content-Type':'text/plain','Cache-Control':'public,max-age=86400'}})}}};
 const worker=createWorker({now:()=>Date.parse('2026-10-26T00:00Z'),fetcher:async(url,options)=>{
  calls.push({url,options});if(url.includes('siteverify'))return Response.json(challenge);
  const token=options.headers.Authorization.slice(7),role=roles.get(token);
  if(url.endsWith('/auth/v1/user'))return Response.json(role?{id:role.user_id, user_metadata:{role:'admin'}}:{error:'unauthorized'},{status:role?200:401});
  if(url.endsWith('/curriculum_access_context'))return Response.json(role||{}, {status:role?200:401});
  if(url.endsWith('/curriculum_clinic_guest_request')){const body=JSON.parse(options.body);return Response.json({id:body.p_id,token:body.p_token,status:'pending',revision:1})}
  return Response.json({rows:[],count:0});
 }});
 const request=(path,{token,method='GET',body,requestOrigin=origin,headers={}}={})=>worker.fetch(new Request(origin+path,{method,headers:{...(token?{Cookie:'maicn_session_v1='+token}:{}),...(body!==undefined?{'Content-Type':'application/json',Origin:requestOrigin}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
 return{env,roles,calls,assets,request,setChallenge(v){challenge=v}};
}
test('only verified institution roles gain teacher/reviewer capabilities; case variants stay protected',()=>{
 assert.equal(capabilities('member').teacher,false);assert.equal(capabilities('teacher').teacher,true);assert.equal(capabilities('teacher').reviewer,false);assert.equal(capabilities('curriculum').reviewer,true);
 assert.throws(()=>parseAccess({version:1,institution:school,role:'teacher',user_id:'a'}));
 assert.equal(routeAccess('/assets/Student-Roster-Data.js'),'teacher');assert.equal(routeAccess('/assets/clinic-legacy-data.js'),'reviewer');
});
test('guest requests to private pages and direct data assets never reach the asset binding',async()=>{
 const f=fixture();for(const path of ['/murid.html','/rapor.html','/presensi.html','/karakter.html','/admin.html?role=admin']){const r=await f.request(path);assert.equal(r.status,303,path);assert.ok(r.headers.get('Location').startsWith('/akun.html?next='));assert.equal(await r.text(),'')}
 for(const path of ['/assets/student-roster-data.js','/assets/Student-Roster-Data.js','/assets/report-roster.js','/assets/clinic-legacy-data.js'])assert.equal((await f.request(path)).status,403,path);
 assert.equal(f.assets.length,0);assert.equal(f.calls.length,0);
});
test('a normal signed-in account or a forged cookie cannot become a teacher',async()=>{
 const f=fixture();assert.equal((await f.request('/assets/student-roster-data.js',{token:'member-token'})).status,403);assert.equal((await f.request('/assets/student-roster-data.js',{token:'teacher'})).status,401);assert.equal((await f.request('/api/access',{token:'member-token'})).status,200);const c=await (await f.request('/api/access',{token:'member-token'})).json();assert.equal(c.role,'member');assert.equal(c.capabilities.teacher,false);assert.equal(f.assets.length,0);
});
test('teacher reads private pages/data without public caching, but cannot open the admin/legacy report area',async()=>{
 const f=fixture();const r=await f.request('/murid.html',{token:'teacher-token'});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(r.headers.get('Vary'),/Cookie/);assert.equal((await f.request('/assets/student-roster-data.js',{token:'teacher-token'})).status,200);assert.equal((await f.request('/admin.html',{token:'teacher-token'})).status,303);assert.equal((await f.request('/assets/clinic-legacy-data.js',{token:'teacher-token'})).status,403);assert.equal((await f.request('/admin.html',{token:'manager-token'})).status,200);
 f.roles.set('teacher-token',{version:1,institution:school,user_id:'teacher-a',role:'member'});assert.equal((await f.request('/assets/student-roster-data.js',{token:'teacher-token'})).status,403,'revocation is read again for the same token');
});
test('session bridge verifies native identity and scope, uses HttpOnly cookie, and rejects cross-site writes',async()=>{
 const f=fixture();const r=await f.request('/api/session',{method:'POST',body:{token:'teacher-token',role:'admin'}});assert.equal(r.status,200);assert.equal((await r.json()).role,'teacher');assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);assert.match(r.headers.get('Set-Cookie'),/Secure/);assert.match(r.headers.get('Set-Cookie'),/SameSite=Lax/);
 assert.equal((await f.request('/api/session',{method:'POST',body:{token:'teacher-token'},requestOrigin:'https://other.example.test'})).status,403);
 const config=await(await f.request('/api/config')).json();assert.equal(config.CLINIC_SERVICE_KEY,undefined);assert.ok(!JSON.stringify(config).includes('server-example'));assert.ok(!JSON.stringify(config).includes('secret-example'));
 const out=await f.request('/api/session',{method:'DELETE',headers:{Origin:origin}});assert.match(out.headers.get('Set-Cookie'),/Max-Age=0/);
});
test('guest clinical request requires action/hostname-bound validation; gateway keeps it pending and hashes the address',async()=>{
 const f=fixture(),body={id:'request-example',token:'receipt-example',challenge:'proof-example',data:{date:'2026-10-26',subjects:['Matematika'],status:'approved'}};
 f.setChallenge({success:true,hostname:'wrong.example.test',action:'clinic_request'});assert.equal((await f.request('/api/clinic/request',{method:'POST',body,headers:{'CF-Connecting-IP':'192.0.2.1'}})).status,400);assert.equal(f.calls.filter(v=>v.url.endsWith('curriculum_clinic_guest_request')).length,0);
 f.setChallenge({success:true,hostname:'curriculum.example.test',action:'clinic_request'});const r=await f.request('/api/clinic/request',{method:'POST',body,headers:{'CF-Connecting-IP':'192.0.2.1'}});assert.equal(r.status,201);assert.equal((await r.json()).status,'pending');const sent=JSON.parse(f.calls.find(v=>v.url.endsWith('curriculum_clinic_guest_request')).options.body);assert.match(sent.p_fingerprint,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(sent).includes('192.0.2.1'));
 assert.equal((await f.request('/api/clinic/request',{method:'POST',body:{...body,challenge:''}})).status,400);
});
test('teacher operations and approval RPCs remain separate, even for someone already logged in',async()=>{
 const f=fixture();assert.equal((await f.request('/api/clinic/rpc',{token:'member-token',method:'POST',body:{name:'curriculum_clinic_write',args:{}}})).status,403);assert.equal((await f.request('/api/clinic/rpc',{token:'teacher-token',method:'POST',body:{name:'curriculum_monday_write',args:{}}})).status,403);assert.equal((await f.request('/api/clinic/rpc',{token:'teacher-token',method:'POST',body:{name:'arbitrary_function',args:{}}})).status,403);
 assert.equal((await f.request('/api/clinic/rpc',{method:'POST',body:{name:'curriculum_clinic_read',args:{p_mode:'public'}}})).status,200);
});
test('held integrations make no outbound auth/DB calls; repository, double-encoded paths and old routes do not expose source',async()=>{
 const f=fixture();f.env.ACCESS_ENABLED='false';f.env.CLINIC_ENABLED='false';assert.equal((await(await f.request('/api/access',{token:'teacher-token'})).json()).role,'guest');assert.equal((await f.request('/assets/student-roster-data.js',{token:'teacher-token'})).status,403);assert.equal((await f.request('/api/clinic/request',{method:'POST',body:{}})).status,503);assert.equal(f.calls.length,0);
 for(const path of ['/docs/source.txt','/server/worker.mjs','/assets/%252e%252e/student-roster-data.js'])assert.ok((await f.request(path)).status>=400,path);
 assert.equal((await f.request('/p5-ppra.html')).status,308);
});
test('curated build keeps workbook/clinic source bytes intact and publishes no private booking notes in public academic bundles',async()=>{
 const manifest=JSON.parse(await fs.readFile('.site/asset-manifest.json','utf8'));assert.ok(manifest.every(r=>!r.path.startsWith('docs/')&&!r.path.startsWith('scripts/')&&!r.path.startsWith('ops/')));assert.equal(manifest.find(r=>r.path==='assets/student-roster-data.js').access,'teacher');assert.equal(manifest.find(r=>r.path==='assets/clinic-legacy-data.js').access,'reviewer');
 const publicData=JSON.parse(await fs.readFile('.site/master-data.json','utf8'));assert.equal(publicData.klinik_pembelajaran.jadwal_booking,undefined);const context={window:{}};vm.runInNewContext(await fs.readFile('data.js','utf8'),context);const original=context.MASTER_DATA||context.window.MASTER_DATA;assert.deepEqual(publicData.jadwal_kbm_v2.rombongan_belajar,[...original.jadwal_kbm_v2.rombongan_belajar]);assert.equal(publicData.jadwal_kbm_v2.matriks_guru.length,21);
 const summary=await fs.readFile('assets/student-roster-summary.js','utf8');assert.ok(!summary.includes('nama'));assert.ok(!summary.includes('nisn'));assert.equal((await fs.readFile('.site/assets/student-roster-data.js','utf8')),(await fs.readFile('assets/student-roster-data.js','utf8')));
});

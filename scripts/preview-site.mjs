/** Actual Worker router + curated files. --fixtures is isolated to port 4573. */
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWorker} from '../server/worker.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),fixtures=process.argv.includes('--fixtures'),port=fixtures?4573:4570;
const files=new Set(JSON.parse(await fs.readFile(path.join(root,'.site/asset-manifest.json'),'utf8')).map(r=>'/'+r.path));
const roles={teacher:{user_id:'fixture-teacher',role:'teacher',teacher_code:'GU',teacher:'Guru Contoh'},curriculum:{user_id:'fixture-curriculum',role:'curriculum'},admin:{user_id:'fixture-admin',role:'admin'},member:{user_id:'fixture-member',role:'member'}};
const tokens=new Map(Object.keys(roles).map(role=>['fixture-'+role,roles[role]]));
const nativeFetch=async(url,options={})=>{
 if(!fixtures)throw Error('Remote access is disabled in this local preview');
 const token=options.headers?.Authorization?.slice(7),record=tokens.get(token);
 if(url.endsWith('/auth/v1/user'))return Response.json(record?{id:record.user_id}:{error:'invalid token'},{status:record?200:401});
 if(url.endsWith('/rest/v1/rpc/curriculum_access_context'))return Response.json(record?{version:1,institution:'MA Insan Cendekia Nusantara',...record}:{},{status:record?200:401});
 return Response.json({error:'Synthetic integration only'},{status:503});
};
const worker=createWorker({fetcher:nativeFetch});
const mime=name=>name.endsWith('.html')?'text/html;charset=utf-8':/\.(?:js|mjs)$/.test(name)?'text/javascript;charset=utf-8':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.woff2')?'font/woff2':name.endsWith('.png')?'image/png':'application/octet-stream';
const env={ACCESS_ENABLED:fixtures?'true':'false',CLINIC_ENABLED:'false',PREVIEW_MODE:fixtures?'true':'false',SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',ASSETS:{async fetch(request){
 const name=new URL(request.url).pathname;if(!files.has(name))return new Response('Tidak ditemukan',{status:404});
 let bytes=await fs.readFile(path.join(root,'.site',name.slice(1)));
 if(fixtures&&name==='/assets/clinic-legacy-data.js')bytes=Buffer.from('window.MAICN_CLINIC_LEGACY=[];');
 if(fixtures&&name==='/assets/student-roster-data.js'){
  const classes=Object.fromEntries(['X-1','X-2','X-3'].map(c=>[c,Array.from({length:19},(_,n)=>({id:`fixture-${c}-${n}`,nama:`Murid Contoh ${c} ${n+1}`,kelas:c,nomor:n+1,nis:null,nisn:null,source:'Pratinjau sintetis'}))]));
  bytes=Buffer.from('window.MAICN_STUDENT_ROSTER='+JSON.stringify({schemaVersion:1,tahunPelajaran:'2026/2027',source:{file:'DATA CONTOH · bukan data sekolah'},classes,unassigned:[{id:'fixture-pending',nama:'Murid Contoh Belum Ditempatkan',kelas:null,nomor:null,nis:null,nisn:null}]})+';');
 }
 if(fixtures&&name.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace('<body',`<body`).replace(/(<body[^>]*>)/,`$1<aside style="position:relative;z-index:1200;background:#F3EDE2;color:#0B1D35;border-bottom:1px solid #D9CCB9;padding:12px 20px;font:12px/1.8 system-ui"><strong>PRATINJAU LOKAL · DATA & AKUN CONTOH</strong> · <a href="/__fixture/role/guest">Tamu</a> · <a href="/__fixture/role/member">Akun umum</a> · <a href="/__fixture/role/teacher">Guru</a> · <a href="/__fixture/role/curriculum">Kurikulum</a></aside>`));
 return new Response(bytes,{headers:{'Content-Type':mime(name),'Cache-Control':'no-store'}});
}}};
createServer(async(req,res)=>{
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);return res.end()}
 try{
  const url=new URL(req.url,'http://'+req.headers.host);
  if(fixtures&&url.pathname==='/__fixture/audit'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(path.join(root,'server/preview-layout.html')))}
  if(fixtures&&url.pathname.startsWith('/__fixture/role/')){const role=url.pathname.split('/').pop();if(role!=='guest'&&!roles[role]){res.writeHead(404);return res.end()}res.writeHead(303,{'Set-Cookie':`maicn_session_v1=${role==='guest'?'':'fixture-'+role}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${role==='guest'?0:3600}`,Location:'/index.html','Cache-Control':'no-store'});return res.end()}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32000){res.writeHead(413);return res.end()}chunks.push(chunk)}
  const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),response=await worker.fetch(request,env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{'Content-Type':'text/plain'});res.end('Pratinjau lokal belum tersedia.')}
}).listen(port,'127.0.0.1',()=>console.log(`${fixtures?'Synthetic audience':'Guest site'} preview: http://127.0.0.1:${port}`));

/** Loopback-only, fictional catalogue, mocked Turnstile/DB/provider. No remote fetch. */
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWorker} from '../server/worker.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),port=4576,institution='MA Insan Cendekia Nusantara',year='2026/2027';
const students=['X-1','X-2','X-3'].flatMap(kelas=>Array.from({length:19},(_,i)=>({id:`fixture-${kelas}-${i+1}`,nama:`Murid Contoh ${kelas} ${i+1}`,kelas}))),teachers=[{kode:'AA',nama:'Guru Contoh A',mapel:'Fisika'},{kode:'BB',nama:'Guru Contoh B',mapel:'Kimia'}];
const received=new Map();
const worker=createWorker({fetcher:async(url,options)=>{
 if(url.includes('siteverify'))return Response.json({success:true,hostname:'127.0.0.1',action:'clinic_request'});
 if(url.endsWith('/curriculum_clinic_catalog'))return Response.json({version:2,year,students,teachers});
 if(url.endsWith('/curriculum_clinic_read'))return Response.json({version:1,institution,year,rows:[],count:0,teachers:[],can_review:false,read_at:new Date().toISOString()});
 if(url.endsWith('/curriculum_clinic_intake')){const body=JSON.parse(options.body);received.set(body.p_id,body.p_data);return Response.json({id:body.p_id,token:body.p_token,status:'pending',revision:1})}
 throw Error('Remote access is disabled in the synthetic preview');
}});
const files=new Set(JSON.parse(await fs.readFile(path.join(root,'.site/asset-manifest.json'),'utf8')).map(r=>'/'+r.path));
const env={ACCESS_ENABLED:'true',CLINIC_ENABLED:'true',CLINIC_V2_ENABLED:'true',PREVIEW_MODE:'true',SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',CLINIC_SERVICE_KEY:'fixture-service',TURNSTILE_SECRET:'fixture-secret',TURNSTILE_SITE_KEY:'fixture-key',REQUEST_HASH_SECRET:'fixture-hash',ASSETS:{async fetch(request){
 const name=new URL(request.url).pathname;if(!files.has(name))return new Response('Tidak ditemukan',{status:404});
 let bytes=await fs.readFile(path.join(root,'.site',name.slice(1)));
 if(name.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace(/(<body[^>]*>)/,`$1<aside style="padding:12px;background:#F3EDE2;color:#0B1D35">PRATINJAU SINTETIS · Nama, akun, verifikasi dan pengiriman contoh.</aside><script>window.turnstile={render(el,options){document.querySelector(el).textContent='Verifikasi contoh lokal';options.callback('fixture-proof');return 'fixture-widget'},reset(){}};</script>`));
 return new Response(bytes,{headers:{'Content-Type':name.endsWith('.html')?'text/html;charset=utf-8':/\.(js|mjs)$/.test(name)?'text/javascript;charset=utf-8':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.svg')?'image/svg+xml':'application/octet-stream'}});
}}};
createServer(async(req,res)=>{
 if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);return res.end()}
 try{
  if(req.url==='/__fixture/received'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify([...received.values()]))}
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>32000){res.writeHead(413);return res.end()}chunks.push(c)}
  const response=await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:{...req.headers,'CF-Connecting-IP':'192.0.2.1'},...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503);res.end('Pratinjau belum tersedia')}
}).listen(port,'127.0.0.1',()=>console.log(`Synthetic Clinic v2: http://127.0.0.1:${port}/klinik.html`));

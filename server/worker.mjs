import {normalizePath,routeAccess,parseAccess,capabilities} from '../assets/access-core.mjs';
const institution='MA Insan Cendekia Nusantara',cookieName='maicn_session_v1';
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Cookie, Authorization',...extra}});
const guest=enabled=>({version:1,institution,role:'guest',user_id:null,enabled});
function publicKey(value){
 if(typeof value!=='string')return false;if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(value))return true;
 try{const payload=JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return payload.role==='anon'}catch{return false}
}
const safeReturn=v=>typeof v==='string'&&/^\/[a-z0-9-]+\.html(?:#[a-z0-9-]+)?$/.test(v)?v:'/index.html';
function cookie(request){const v=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);return v&&v.length<=8192&&/^[A-Za-z0-9_.-]+$/.test(v)?v:null}
const sessionCookie=(token,url,age=3600)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${['127.0.0.1','localhost'].includes(url.hostname)?'':'; Secure'}`;
export function createWorker({fetcher=fetch,now=()=>Date.now()}={}){
 async function upstream(env,path,token,body,service=false){
  const key=service?env.CLINIC_SERVICE_KEY:env.SUPABASE_PUBLISHABLE_KEY;
  if(!env.SUPABASE_URL||!key||!service&&!publicKey(key))throw Error('Integration unavailable');
  const response=await fetcher(env.SUPABASE_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+(service?key:token||key),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Upstream unavailable');return response.json();
 }
 async function context(env,token){
  if(env.ACCESS_ENABLED!=='true'||!token)return parseAccess(guest(env.ACCESS_ENABLED==='true'));
  const user=await upstream(env,'/auth/v1/user',token);
  if(!user?.id)throw Error('Session unavailable');
  const value=await upstream(env,'/rest/v1/rpc/curriculum_access_context',token,{p_institution:institution});
  const access=parseAccess({...value,enabled:true});if(access.user_id!==user.id)throw Error('Account changed');return access;
 }
 async function bodyJSON(request,max=24000){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('Invalid request');
  const reader=request.body?.getReader();if(!reader)throw Error('Missing request');let length=0,chunks=[];
  for(;;){const r=await reader.read();if(r.done)break;length+=r.value.byteLength;if(length>max){await reader.cancel();throw Error('Request too large')}chunks.push(r.value)}
  const all=new Uint8Array(length);let pos=0;for(const part of chunks){all.set(part,pos);pos+=part.byteLength}return JSON.parse(new TextDecoder().decode(all));
 }
 async function requestClinic(request,env,url){
  if(env.CLINIC_ENABLED!=='true'||env.ACCESS_ENABLED!=='true'||!env.CLINIC_SERVICE_KEY||!env.TURNSTILE_SECRET||!env.REQUEST_HASH_SECRET)return json({error:'Permintaan online belum diaktifkan. Draf tetap bisa disimpan.'},503);
  const payload=await bodyJSON(request,16000);
  if(typeof payload.challenge!=='string'||payload.challenge.length>2048||!payload.challenge)return json({error:'Verifikasi permintaan belum selesai.'},400);
  const verify=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:payload.challenge}),signal:AbortSignal.timeout(10000)});
  const validation=await verify.json();if(!verify.ok||validation.success!==true||validation.hostname!==url.hostname||validation.action!=='clinic_request')return json({error:'Verifikasi permintaan gagal. Silakan ulangi.'},400);
  // Keep raw addresses out of storage and logs. Limits are enforced transactionally by the guest RPC.
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'Verifikasi jaringan belum tersedia.'},503);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.REQUEST_HASH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip+'|'+new Date(now()+7*3600000).toISOString().slice(0,10)));
  const fingerprint=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const receipt=await upstream(env,'/rest/v1/rpc/curriculum_clinic_guest_request',null,{p_institution:institution,p_year:'2026/2027',p_id:payload.id,p_token:payload.token,p_fingerprint:fingerprint,p_data:payload.data},true);
  if(receipt?.id!==payload.id||receipt.status!=='pending'||receipt.token!==payload.token)return json({error:'Hasil belum dapat dipastikan. Simpan nomor permintaan sebelum mencoba lagi.'},502);
  return json({id:receipt.id,status:receipt.status,revision:receipt.revision,token:receipt.token},201);
 }
 return {async fetch(request,env){
  const url=new URL(request.url),path=normalizePath(url.pathname);if(!path)return json({error:'Alamat tidak valid.'},400);
  try{
   if(url.pathname.startsWith('/api/')){
    if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return json({error:'Asal permintaan tidak sesuai.'},403);
    if(url.pathname==='/api/config'&&request.method==='GET')return json({enabled:env.ACCESS_ENABLED==='true',login_enabled:env.ACCESS_ENABLED==='true'&&env.PREVIEW_MODE!=='true'&&publicKey(env.SUPABASE_PUBLISHABLE_KEY),clinic_enabled:env.CLINIC_ENABLED==='true',turnstile_site_key:env.TURNSTILE_SITE_KEY||'',...(env.ACCESS_ENABLED==='true'&&env.PREVIEW_MODE!=='true'&&publicKey(env.SUPABASE_PUBLISHABLE_KEY)?{supabase_url:env.SUPABASE_URL,supabase_key:env.SUPABASE_PUBLISHABLE_KEY}:{})});
    if(url.pathname==='/api/access'&&request.method==='GET'){try{return json(await context(env,cookie(request)))}catch{return json({error:'Sesi belum dapat diperiksa. Masuk kembali.'},401)}}
    if(url.pathname==='/api/session'&&request.method==='DELETE')return json({ok:true},200,{'Set-Cookie':sessionCookie('',url,0)});
    if(url.pathname==='/api/session'&&request.method==='POST'){
     if(env.ACCESS_ENABLED!=='true')return json({error:'Masuk akun situs ini menunggu aktivasi pengelola.'},503);
     const payload=await bodyJSON(request,12000);if(typeof payload.token!=='string'||payload.token.length>8192||!/^[A-Za-z0-9_.-]+$/.test(payload.token))return json({error:'Sesi tidak valid.'},400);
     const access=await context(env,payload.token);return json(access,200,{'Set-Cookie':sessionCookie(payload.token,url)});
    }
    if(url.pathname==='/api/clinic/request'&&request.method==='POST')return await requestClinic(request,env,url);
    if(url.pathname==='/api/clinic/rpc'&&request.method==='POST'){
     if(env.CLINIC_ENABLED!=='true')return json({data:null,error:{message:'Integrasi belum diaktifkan.'}},503);
     const payload=await bodyJSON(request),args=payload.args||{},name=payload.name;
     const rules={curriculum_clinic_read:args.p_mode==='public'?'public':args.p_mode==='review'?'reviewer':'teacher',curriculum_clinic_write:'teacher',curriculum_clinic_history:'teacher',curriculum_monday_read:'public',curriculum_monday_write:'reviewer'};
     if(!Object.hasOwn(rules,name)||args.p_institution&&args.p_institution!==institution||args.p_year&&args.p_year!=='2026/2027')return json({data:null,error:{message:'forbidden'}},403);
     const required=rules[name],access=required==='public'?parseAccess(guest(true)):await context(env,cookie(request));if(required!=='public'&&!access.capabilities[required])return json({data:null,error:{message:'forbidden'}},403);
     const data=await upstream(env,'/rest/v1/rpc/'+name,required==='public'?null:cookie(request),args);return json({data,error:null});
    }
    return json({error:'Layanan tidak ditemukan.'},404);
   }
   const oldPages={'/p5-ppra.html':'/kokurikuler.html','/modul.html':'/buku-kerja.html','/profil.html':'/akun.html'};
   if(Object.hasOwn(oldPages,path))return Response.redirect(url.origin+oldPages[path],308);
   if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
   // The build binding contains only curated site assets, never the repository root.
   if(/^\/(?:docs|ops|scripts|tests|scratch|server|node_modules|\.git|\.wrangler)(?:\/|$)/i.test(path)||!/^\/(?:[a-z0-9-]+\.html|data\.js|master-data\.json|favicon\.(?:ico|svg)|assets\/[A-Za-z0-9_./-]+|templates\/[A-Za-z0-9_./-]+|robots\.txt)$/.test(path))return new Response('Tidak ditemukan',{status:404});
   const required=routeAccess(path);
   if(required!=='public'){
    let access;try{access=await context(env,cookie(request))}catch{return json({error:'Sesi belum dapat diperiksa.'},401)}
    if(!access.capabilities[required]){
     if(path.endsWith('.html'))return new Response(null,{status:303,headers:{Location:'/akun.html?next='+encodeURIComponent(safeReturn(path))+'&access='+required,'Cache-Control':'no-store'}});
     return new Response('Akun guru diperlukan',{status:403,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization'}});
    }
   }
   const response=await env.ASSETS.fetch(new Request(new URL(path,url),request)),headers=new Headers(response.headers);
   headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
   if(required!=='public'){headers.set('Cache-Control','no-store');headers.set('Vary','Cookie, Authorization');headers.set('X-Robots-Tag','noindex, nofollow, noarchive')}
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }catch{return json({error:'Layanan belum dapat menyelesaikan permintaan. Draf tidak dihapus.'},503)}
 }};
}
export default createWorker();

import {sendOperationsEmail} from './curriculum-digest.mjs';
import {normalizePath,routeAccess,parseAccess,capabilities} from '../assets/access-core.mjs';
import {sendDecisionEmail} from './clinic-email.mjs';
import {usesClinicSession,validSchoolSession} from '../assets/school-workflow-core.mjs';
import {CONTENT_ADMIN_PAGES,contentWrite} from '../assets/curriculum-content-core.mjs';
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
  if(!response.ok){const detail=await response.json().catch(()=>({}));const code=String(detail.message||'');throw Error(/allocation_choice_required|invalid_allocation|clinic_empty_selection|choose_one_proposed_subject|invalid_evidence|clinic_location_conflict|invalid_location|clinic_allocation_locked|archived_schedule_locked|decision_note_required|invalid_transition|invalid_teacher(?!_)|invalid_subject\b|invalid_date_time|identity_or_location_required|identity_required|invalid_requester|invalid_photo|invalid_attachment|token_mismatch|invalid_switch|switch_slot_used|teacher_conflict|schedule_conflict|student_link_required|login_required|assign_teacher|invalid_assignment|assignment_overlap|journal_incomplete|tp_required|invalid_project|active_collaborations|source_changed|forbidden|active_class_role|teacher_contact_required|clinic_participant_conflict|clinic_conflict|enrichment_finalized|invalid_participants|invalid_teacher_contact|invalid_subjects|stale_revision|request_limit/.exec(code)?.[0]||'Upstream unavailable')}return response.json();
 }
 async function context(env,token){
  if(env.ACCESS_ENABLED!=='true'||!token)return parseAccess(guest(env.ACCESS_ENABLED==='true'));
  const user=await upstream(env,'/auth/v1/user',token);
  if(!user?.id)throw Error('Session unavailable');
  const value=await upstream(env,'/rest/v1/rpc/'+(env.SCHOOL_ENABLED==='true'?'curriculum_school_context':'curriculum_access_context'),token,{p_institution:institution});
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
  const payload=await bodyJSON(request,280000);
  if(payload.data?.requester_kind&&env.CURRICULUM_OPERATIONS_ENABLED!=='true')return json({error:'Verifikasi identitas menunggu aktivasi. Simpan draf tanpa foto dan coba lagi.'},503);
  if(typeof payload.challenge!=='string'||payload.challenge.length>2048||!payload.challenge)return json({error:'Verifikasi permintaan belum selesai.'},400);
  const verify=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:payload.challenge}),signal:AbortSignal.timeout(10000)});
  const validation=await verify.json();if(!verify.ok||validation.success!==true||validation.hostname!==url.hostname||validation.action!=='clinic_request')return json({error:'Verifikasi permintaan gagal. Silakan ulangi.'},400);
  // Keep raw addresses out of storage and logs. Limits are enforced transactionally by the guest RPC.
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'Verifikasi jaringan belum tersedia.'},503);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.REQUEST_HASH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip+'|'+new Date(now()+7*3600000).toISOString().slice(0,10)));
  const fingerprint=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(env.CLINIC_V2_ENABLED!=='true')return json({error:'Formulir peserta baru menunggu aktivasi pengelola.'},503);
  let receipt;
  try {receipt=await upstream(env,'/rest/v1/rpc/curriculum_clinic_intake',null,{p_institution:institution,p_year:'2026/2027',p_id:payload.id,p_token:payload.token,p_fingerprint:fingerprint,p_data:payload.data},true)}
  catch(error){const messages={clinic_participant_conflict:'Ada peserta yang sudah diterima di klinik pada waktu yang sama. Pilih sesi lain.',clinic_conflict:'Pengampu atau kelas sudah terjadwal pada sesi ini.',enrichment_finalized:'Pembagian klinik dan pengayaan sesi ini sudah ditetapkan.',invalid_requester:'Pilih nama dan kelas pengaju dari daftar resmi.',invalid_photo:'Sertakan foto pengaju yang dapat dibuka, maksimal 180 KB setelah diproses.',invalid_participants:'Pilih peserta dari daftar resmi sesuai kelas.',invalid_teacher_contact:'Email dan bukti Google Drive guru wajib diisi.',invalid_subjects:'Pilih satu mapel resmi.',request_limit:'Batas pengajuan hari ini tercapai.'};return json({error:messages[error.message]||'Hasil belum dapat dipastikan. Simpan nomor ajuan dan periksa sebelum mencoba kembali.'},messages[error.message]?409:503)}
  if(receipt?.id!==payload.id||receipt.status!=='pending'||receipt.token!==payload.token)return json({error:'Hasil belum dapat dipastikan. Simpan nomor permintaan sebelum mencoba lagi.'},502);
  return json({id:receipt.id,status:receipt.status,revision:receipt.revision,token:receipt.token},201);
 }
 return {async fetch(request,env){
  const url=new URL(request.url),path=normalizePath(url.pathname);if(!path)return json({error:'Alamat tidak valid.'},400);
  try{
   if(url.pathname.startsWith('/api/')){
    if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return json({error:'Asal permintaan tidak sesuai.'},403);
    if(path==='/api/curriculum/content'){
     if(!['GET','POST'].includes(request.method))return json({error:'Metode tidak tersedia.'},405);
     const access=await context(env,cookie(request));
     if(access.role!=='admin')return json({error:'forbidden'},403);
     if(env.CURRICULUM_CONTENT_ENABLED!=='true')return json({error:'Penyimpanan buku dan program belum diaktifkan.'},503);
     let args={};if(request.method==='POST'){try{args=contentWrite(await bodyJSON(request,24000))}catch{return json({error:'invalid_content'},400)}}
     try{return json(await upstream(env,'/rest/v1/rpc/curriculum_content_'+(request.method==='GET'?'read':'write'),cookie(request),args))}
     catch(e){return json({error:e.message},e.message==='stale_revision'?409:e.message==='forbidden'?403:503)}
    }
    if(url.pathname==='/api/curriculum/today'&&request.method==='GET'){
     if(env.CURRICULUM_OPERATIONS_ENABLED!=='true')return json({error:'Informasi harian menunggu aktivasi.'},503);
     const date=url.searchParams.get('date');if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return json({error:'Tanggal tidak valid.'},400);
     return json(await upstream(env,'/rest/v1/rpc/curriculum_today',null,{p_date:date}));
    }
    if(url.pathname==='/api/curriculum/notifications'&&request.method==='GET'){
     if(env.CURRICULUM_OPERATIONS_ENABLED!=='true')return json({error:'Notifikasi baru menunggu aktivasi.'},503);
     const a=await context(env,cookie(request));if(!a.capabilities.reviewer)return json({error:'forbidden'},403);
     return json(await upstream(env,'/rest/v1/rpc/curriculum_operations_notifications',cookie(request),{}));
    }
    if(url.pathname==='/api/curriculum/operations'){
     if(env.CURRICULUM_OPERATIONS_ENABLED!=='true')return json({error:'Ruang kurikulum baru menunggu aktivasi.'},503);
     const a=await context(env,cookie(request));if(!a.capabilities.reviewer)return json({error:'forbidden'},403);
     try{
      if(request.method==='GET'){
       const date=url.searchParams.get('date');if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return json({error:'Tanggal tidak valid.'},400);
       if(url.searchParams.has('photo'))return json(await upstream(env,'/rest/v1/rpc/curriculum_operations_photo',cookie(request),{p_kind:url.searchParams.get('kind'),p_id:url.searchParams.get('photo')}),200,{'Content-Security-Policy':"default-src 'none'"});
       return json(await upstream(env,'/rest/v1/rpc/curriculum_operations_read',cookie(request),{p_date:date}));
      }
      if(request.method!=='POST')return json({error:'Metode tidak tersedia.'},405);
      const v=await bodyJSON(request,280000);if(!['identity','legacy_identity','location','location_add','announcement','workday'].includes(v.action)||!Number.isSafeInteger(v.expected)||typeof v.token!=='string')return json({error:'Isian tidak valid.'},400);
      if(v.action==='legacy_identity')return json(await upstream(env,'/rest/v1/rpc/curriculum_clinic_verify_legacy',cookie(request),{p_id:v.data?.id,p_expected:v.expected,p_data:v.data,p_token:v.token}));
      return json(await upstream(env,'/rest/v1/rpc/curriculum_operations_write',cookie(request),{p_action:v.action,p_data:v.data,p_expected:v.expected,p_token:v.token}));
     }catch(e){return json({error:e.message},409)}
    }
    if(url.pathname==='/api/config'&&request.method==='GET')return json({enabled:env.ACCESS_ENABLED==='true',login_enabled:env.ACCESS_ENABLED==='true'&&env.PREVIEW_MODE!=='true'&&publicKey(env.SUPABASE_PUBLISHABLE_KEY),clinic_enabled:env.CLINIC_ENABLED==='true',clinic_v2_enabled:env.CLINIC_V2_ENABLED==='true',school_enabled:env.SCHOOL_ENABLED==='true',turnstile_site_key:env.TURNSTILE_SITE_KEY||'',...(env.ACCESS_ENABLED==='true'&&env.PREVIEW_MODE!=='true'&&publicKey(env.SUPABASE_PUBLISHABLE_KEY)?{supabase_url:env.SUPABASE_URL,supabase_key:env.SUPABASE_PUBLISHABLE_KEY,auth_turnstile_site_key:env.AUTH_TURNSTILE_SITE_KEY||'0x4AAAAAAFDQV6mCoi-38feC'}:{})});
    if(url.pathname==='/api/clinic/catalog'&&request.method==='GET'){
     if(env.CLINIC_V2_ENABLED!=='true')return json({error:'Daftar peserta menunggu aktivasi pengelola.'},503);
     const catalog=await upstream(env,'/rest/v1/rpc/curriculum_clinic_catalog',null,{p_institution:institution,p_year:'2026/2027'},true);
     return json(catalog);
    }
    if(url.pathname==='/api/school/catalog'&&request.method==='GET'){
     if(env.SCHOOL_ENABLED!=='true')return json({error:'Layanan baru menunggu aktivasi pengelola.'},503);
     return json(await upstream(env,'/rest/v1/rpc/curriculum_school_catalog',null,{},true));
    }
    if(url.pathname==='/api/clinic/receipt'&&request.method==='POST'){
     if(env.CURRICULUM_OPERATIONS_ENABLED!=='true')return json({error:'Pemeriksaan bukti menunggu aktivasi.'},503);
     const v=await bodyJSON(request,1000),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;if(!uuid.test(v.id)||!uuid.test(v.token))return json({error:'Nomor bukti tidak valid.'},400);
     return json(await upstream(env,'/rest/v1/rpc/curriculum_clinic_receipt',null,{p_id:v.id,p_token:v.token},true));
    }
    if(url.pathname==='/api/school/receipt'&&request.method==='POST'){
     if(env.SCHOOL_ENABLED!=='true')return json({error:'Integrasi belum diaktifkan.'},503);
     const p=await bodyJSON(request,1000),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;if(!uuid.test(p.id)||!uuid.test(p.token))return json({error:'Nomor bukti tidak valid.'},400);
     return json(await upstream(env,'/rest/v1/rpc/curriculum_school_receipt',null,{p_id:p.id,p_token:p.token},true));
    }
    if(url.pathname==='/api/school/request'&&request.method==='POST'){
     if(env.SCHOOL_ENABLED!=='true')return json({error:'Layanan baru menunggu aktivasi pengelola.'},503);
     try{const payload=await bodyJSON(request,280000);if(payload.data?.requester_kind&&env.CURRICULUM_OPERATIONS_ENABLED!=='true')return json({error:'Verifikasi identitas menunggu aktivasi.'},503);const access=await context(env,cookie(request));let receipt;
     if(payload.kind==='remedial'&&!access.capabilities.school)return json({error:'Masuk dengan akun sekolah untuk mengajukan Remedial.'},403);
     if(usesClinicSession(payload.kind)&&!validSchoolSession(payload.data,now()))return json({error:'outside_clinic_session'},422);
     if(access.user_id){receipt=await upstream(env,'/rest/v1/rpc/curriculum_school_submit',cookie(request),{p_kind:payload.kind,p_id:payload.id,p_data:payload.data,p_token:payload.token})}
     else{
      if(!env.TURNSTILE_SECRET||!env.REQUEST_HASH_SECRET||!env.CLINIC_SERVICE_KEY||typeof payload.challenge!=='string'||!payload.challenge||payload.challenge.length>2048)return json({error:'Selesaikan verifikasi permintaan.'},400);
      const check=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:payload.challenge}),signal:AbortSignal.timeout(10000)}),v=await check.json();
      if(!check.ok||v.success!==true||v.hostname!==url.hostname||v.action!=='school_request')return json({error:'Verifikasi permintaan gagal.'},400);
      const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'Verifikasi jaringan belum tersedia.'},503);
      const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.REQUEST_HASH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip+'|'+new Date(now()+7*3600000).toISOString().slice(0,10))),fingerprint=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
      receipt=await upstream(env,'/rest/v1/rpc/curriculum_school_guest',null,{p_kind:payload.kind,p_id:payload.id,p_data:payload.data,p_token:payload.token,p_fingerprint:fingerprint},true);
     }
     if(receipt?.id!==payload.id||receipt.token!==payload.token||receipt.status!=='pending')return json({error:'Hasil belum pasti. Simpan nomor ajuan dan periksa sebelum mencoba lagi.'},502);
     return json(receipt,201);}catch(error){
      if(error.message==='Upstream unavailable')return json({error:'Pengiriman belum dapat dipastikan. Periksa nomor ajuan sebelum mencoba kembali.'},503);
      return json({error:error.message},409);
     }
    }
    if(url.pathname==='/api/school/rpc'&&request.method==='POST'){
     if(env.SCHOOL_ENABLED!=='true')return json({data:null,error:{message:'Integrasi sekolah menunggu aktivasi.'}},503);
     const payload=await bodyJSON(request),name=payload.name,args=payload.args||{},rules={curriculum_school_read:args.p_mode==='public'?'public':args.p_mode==='review'?'reviewer':'school',curriculum_school_decide:'reviewer',curriculum_school_journal_read:'school',curriculum_school_journal_write:'school',curriculum_school_settings:'admin',curriculum_school_assign:'admin'};
     if(!Object.hasOwn(rules,name))return json({data:null,error:{message:'forbidden'}},403);
     const required=rules[name],a=required==='public'?parseAccess(guest(true)):await context(env,cookie(request));if(required!=='public'&&!a.capabilities[required])return json({data:null,error:{message:'forbidden'}},403);
     try{return json({data:await upstream(env,'/rest/v1/rpc/'+name,required==='public'?null:cookie(request),args),error:null})}catch(error){return json({data:null,error:{message:error.message}},409)}
    }
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
     const rules={curriculum_clinic_read:args.p_mode==='public'?'public':args.p_mode==='review'?'reviewer':'teacher',curriculum_clinic_retarget:'reviewer',curriculum_clinic_allocate:'reviewer',curriculum_clinic_review_v2:'reviewer',curriculum_clinic_write_v2:'reviewer',curriculum_clinic_enrichment:'reviewer',curriculum_clinic_write:'school',curriculum_clinic_history:'school',curriculum_monday_read:'public',curriculum_monday_write:'reviewer'};
     if(!Object.hasOwn(rules,name)||args.p_institution&&args.p_institution!==institution||args.p_year&&args.p_year!=='2026/2027')return json({data:null,error:{message:'forbidden'}},403);
     const required=rules[name],access=required==='public'?parseAccess(guest(true)):await context(env,cookie(request));if(required!=='public'&&!access.capabilities[required])return json({data:null,error:{message:'forbidden'}},403);
     try{const data=await upstream(env,'/rest/v1/rpc/'+name,required==='public'?null:cookie(request),args);return json({data,error:null})}
     catch(error){return json({data:null,error:{message:error.message}},error.message==='forbidden'?403:409)}
    }
    return json({error:'Layanan tidak ditemukan.'},404);
   }
   const oldPages={'/p5-ppra.html':'/kokurikuler.html','/modul.html':'/buku-kerja.html','/profil.html':'/akun.html'};
   if(Object.hasOwn(oldPages,path))return Response.redirect(url.origin+oldPages[path],308);
   if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
   // The build binding contains only curated site assets, never the repository root.
   if(/^\/(?:docs|ops|scripts|tests|scratch|server|node_modules|\.git|\.wrangler)(?:\/|$)/i.test(path)||!/^\/(?:[a-z0-9-]+\.html|data\.js|master-data\.json|favicon\.(?:ico|svg)|assets\/[A-Za-z0-9_./-]+|templates\/[A-Za-z0-9_./-]+|robots\.txt)$/.test(path))return new Response('Tidak ditemukan',{status:404});
   const required=routeAccess(path);
   if(CONTENT_ADMIN_PAGES.includes(path.slice(1))){
    let a;try{a=await context(env,cookie(request))}catch{if(path.endsWith('.html'))return new Response(null,{status:303,headers:{Location:'/akun.html?next='+encodeURIComponent(path)+'&session=check','Cache-Control':'no-store'}});return json({error:'Sesi belum dapat diperiksa.'},401)}
    if(a.role!=='admin')return new Response(null,{status:303,headers:{Location:'/akun.html?next='+encodeURIComponent(path),'Cache-Control':'no-store','Vary':'Cookie, Authorization'}});
   }
   if(required!=='public'){
    let access;try{access=await context(env,cookie(request))}catch{if(path.endsWith('.html'))return new Response(null,{status:303,headers:{Location:'/akun.html?next='+encodeURIComponent(path)+'&session=check','Cache-Control':'no-store'}});return json({error:'Sesi belum dapat diperiksa.'},401)}
    if(!access.capabilities[required]){
     if(path.endsWith('.html'))return new Response(null,{status:303,headers:{Location:'/akun.html?next='+encodeURIComponent(safeReturn(path))+'&access='+required,'Cache-Control':'no-store'}});
     return new Response('Akun guru diperlukan',{status:403,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization'}});
    }
   }
   const response=await env.ASSETS.fetch(new Request(new URL(path,url),request)),headers=new Headers(response.headers);
   headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
   if(required!=='public'){headers.set('Cache-Control','no-store');headers.set('Vary','Cookie, Authorization');headers.set('X-Robots-Tag','noindex, nofollow, noarchive')}
   if(CONTENT_ADMIN_PAGES.includes(path.slice(1))){headers.set('Cache-Control','no-store');headers.set('Vary','Cookie, Authorization');headers.set('X-Robots-Tag','noindex, nofollow, noarchive')}
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }catch{return json({error:'Layanan belum dapat menyelesaikan permintaan. Draf tidak dihapus.'},503)}
 },async scheduled(_event,env){
  if(env.CURRICULUM_OPERATIONS_EMAIL_ENABLED==='true'){
   try{await upstream(env,'/rest/v1/rpc/curriculum_operations_enqueue',null,{p_at:new Date(_event.scheduledTime??now()).toISOString()},true)}catch{/* Retry next tick; unique event keys prevent duplicate messages. */}
  }
  const sources=[];if(env.CLINIC_EMAIL_ENABLED==='true')sources.push('clinic');if(env.SCHOOL_EMAIL_ENABLED==='true')sources.push('school');
  if(env.CURRICULUM_OPERATIONS_EMAIL_ENABLED==='true')sources.push('operations');if(!sources.length)return;
  if(env.CURRICULUM_EMAIL_EDGE_ENABLED==='true'){
   try{await fetcher(env.SUPABASE_URL+'/functions/v1/curriculum-notifications',{method:'POST',headers:{Authorization:'Bearer '+env.CLINIC_SERVICE_KEY,'Content-Type':'application/json'},body:JSON.stringify({sources}),signal:AbortSignal.timeout(55000)})}catch{/* Durable leases permit safe retry without logging personal data. */}
   return;
  }
  if(!env.RESEND_API_KEY)return;
  for(const source of sources){
   let jobs;try{jobs=await upstream(env,'/rest/v1/rpc/curriculum_'+source+'_email_claim',null,{},true)}catch{continue}
   for(const job of jobs){try{if(source==='operations'){const provider=await sendOperationsEmail(job,{apiKey:env.RESEND_API_KEY,fetcher});await upstream(env,'/rest/v1/rpc/curriculum_operations_email_complete',null,{p_id:job.id,p_lease:job.lease,p_provider_id:provider},true);continue}const result=await sendDecisionEmail(job.snapshot,{apiKey:env.RESEND_API_KEY,fetcher});await upstream(env,'/rest/v1/rpc/curriculum_'+source+'_email_complete',null,{p_id:job.id,p_lease:job.lease,p_provider_id:result.provider_id},true)}catch{/* Retry leases retain provider idempotency keys; no personal data is logged. */}}
  }

 }};
}
export default createWorker();

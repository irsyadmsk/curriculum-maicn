import {parseAccess,capabilities,routeAccess} from './access-core.mjs';
import './terminology.mjs';
import {accountTarget} from './account-sso.mjs';
import {hasNativeSession,restoreNativeSession} from './curriculum-runtime.mjs';
let state=parseAccess({version:1,institution:'MA Insan Cendekia Nusantara',role:'guest',user_id:null}),ready=false;
let readRevision=0,readController=null;
let lastVerifiedId=null;
let nativeSessionStarted=false;
async function keepNativeSession(){
 if(nativeSessionStarted||!state.enabled||!state.user_id||window.CurriculumDB||!hasNativeSession())return;nativeSessionStarted=true;
 try{nativeSessionStarted=await restoreNativeSession()}catch{nativeSessionStarted=false;/* The gateway remains authoritative; retry on the next visibility check. */}
}
const subscribers=new Set();
const has=permission=>permission==='public'||permission==='request'||ready&&state.capabilities[permission]===true;
function canLink(href){try{const u=new URL(href,location.href);if(u.origin===location.origin)return has(routeAccess(u.pathname));if(u.hostname==='studio.irsyads.com')return has('studio');return true}catch{return false}}
function apply(){
 document.body.dataset.audience=state.role;document.body.classList.add('access-ready');
 const contentNav=document.querySelector('.clay-nav-menu');if(contentNav&&!contentNav.querySelector('[data-content-nav]')){const label=document.createElement('div');label.className='clay-nav-section-title';label.textContent='BUKU & PROGRAM';contentNav.append(label);for(const [href,label,admin] of [['buku-kurikulum.html','Ringkasan buku kurikulum',false],['program.html','Program kurikulum',false],['buku-admin.html','Buku utama · admin',true],['program-kurikulum.html','Monitoring program · admin',true]]){const a=document.createElement('a');a.dataset.contentNav='true';a.dataset.adminContent=String(admin);a.href=href;a.className='clay-nav-item';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('aria-hidden','true');svg.classList.add('ui-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',admin?'M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5':'M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16');svg.append(path);const span=document.createElement('span');span.textContent=label;a.append(svg,span);contentNav.append(a)}}
 document.querySelectorAll('[data-admin-content="true"]').forEach(a=>{a.hidden=state.role!=='admin'});
 document.querySelectorAll('[data-needs]').forEach(el=>{el.hidden=!has(el.dataset.needs)});
 document.querySelectorAll('a[href]').forEach(a=>{if(a.dataset.accessFixed==='true')return;const u=new URL(a.href,location.href);const permission=u.origin===location.origin?routeAccess(u.pathname):u.hostname==='studio.irsyads.com'?'studio':'public';if(permission!=='public'){a.hidden=!has(permission);a.dataset.accessControlled=permission}});
 document.querySelectorAll('.clay-nav-menu a').forEach(a=>{const current=new URL(a.href,location.href).pathname===location.pathname;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 document.querySelectorAll('.clay-nav-section-title,.clay-nav-group-title,.clay-nav-label,.ui-nav-label').forEach(label=>{let node=label.nextElementSibling,found=false;while(node&&!node.matches('.clay-nav-section-title,.clay-nav-group-title,.clay-nav-label,.ui-nav-label')){if(node.matches('a')&&!node.hidden)found=true;node=node.nextElementSibling}label.hidden=!found});
 const nav=document.querySelector('.clay-nav-menu');if(nav&&!nav.querySelector('[data-school-nav]')){const a=document.createElement('a');a.dataset.schoolNav='true';a.className='clay-nav-item';a.href='layanan.html';a.innerHTML='<span>Layanan akademik & jurnal</span>';nav.append(a)}
 const staffNav=document.querySelector('.clay-nav-menu');if(staffNav&&!staffNav.querySelector('[data-staff-nav]')){const a=document.createElement('a');a.dataset.staffNav='true';a.dataset.needs='reviewer';a.className='clay-nav-item';a.href='kurikulum.html';a.textContent='Persetujuan kurikulum';a.hidden=!has('reviewer');staffNav.append(a)};
 const top=document.querySelector('.clay-topbar-right');
 if(top&&location.pathname!=='/akun.html'){
  let account=top.querySelector('.ui-account-entry');
  if(!account){
   account=document.createElement('a');
   account.className='ui-account-entry';
   account.dataset.accessFixed='true';
   top.prepend(account);
  }
  const adminPage=location.pathname==='/admin.html';
  const labels={guest:'Masuk',member:'Akun',student:'Akun murid',teacher:'Akun guru',curriculum:'Kurikulum',admin:adminPage?'Akun & keluar':'Admin Kurikulum'};
  if(account.dataset.role!==state.role){
   const adminShortcut=has('admin')&&!adminPage;
   account.dataset.role=state.role;
   account.classList.toggle('ui-admin-entry',adminShortcut);
   account.href=adminShortcut?'/admin.html':state.role==='curriculum'?'/kurikulum.html#clinic':state.role==='guest'?'/akun.html?next='+encodeURIComponent(accountTarget(location.pathname+(location.pathname==='/layanan.html'?location.search:location.hash))):'/akun.html';
   const icon=adminShortcut?'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>':'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>';
   account.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+icon+'</svg><span></span>';
   account.querySelector('span').textContent=labels[state.role];
  }
 }
 document.querySelectorAll('[data-audience-copy]').forEach(el=>{const copy=el.dataset[has('teacher')?'teacherCopy':'publicCopy'];if(copy&&el.textContent!==copy)el.textContent=copy});
 document.querySelectorAll('[data-public-content]').forEach(el=>{el.hidden=has('teacher')});
}
let painting=false;function scheduleApply(){if(painting)return;painting=true;requestAnimationFrame(()=>{painting=false;apply()})}
export async function refreshAccess({quiet=ready}={}){
 const revision=++readRevision;readController?.abort();const controller=new AbortController();readController=controller;let timeout=setTimeout(()=>controller.abort(),12000);
 if(!quiet){ready=false;state=parseAccess({version:1,institution:'MA Insan Cendekia Nusantara',role:'guest',user_id:null});apply();}
 let verified=false;
 try{
  const read=async()=>{
   const response=await fetch('/api/access',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401)return null;
   if(!response.ok)throw Error('Hak akses belum dapat diperiksa.');
   return parseAccess(await response.json());
  };
  let next=await read();
  if((!next||next.enabled&&!next.user_id)&&hasNativeSession()){
   clearTimeout(timeout);
   if(await restoreNativeSession()){
    if(revision!==readRevision)return state;
    timeout=setTimeout(()=>controller.abort(),12000);
    next=await read();
   }
  }
  if(!next)throw Error('Sesi belum dapat diperiksa.');
  if(revision!==readRevision)return state;
  verified=true;
  document.body.dataset.connection='online';
  if(location.pathname!=='/akun.html'&&lastVerifiedId&&lastVerifiedId!==next.user_id){
   window.dispatchEvent(new Event('curriculum-before-account-change'));
   location.reload();
   return state;
  }
  lastVerifiedId=next.user_id;
  state=next;
  ready=true;
 }
 catch{if(revision!==readRevision)return state;ready=true;document.body.dataset.connection='offline';}
 finally{clearTimeout(timeout)}
 apply();subscribers.forEach(fn=>fn(state));window.dispatchEvent(new CustomEvent('curriculum-access-changed',{detail:{role:state.role}}));
 keepNativeSession();
 const permission=routeAccess(location.pathname);if(verified&&permission!=='public'&&!has(permission))location.replace('/akun.html?next='+encodeURIComponent(location.pathname+location.hash));
 return state;
}
export const accessReady=refreshAccess();
export const access={has,canLink,get context(){return state},get ready(){return ready},refresh:refreshAccess,verify:()=>refreshAccess({quiet:true}),subscribe(fn){subscribers.add(fn);if(ready)fn(state);return()=>subscribers.delete(fn)}};
window.CurriculumAccess=access;
// The browser helper adapts presentation only. The Worker and SQL independently enforce access.
window.CurriculumClinicProxy={auth:{async getSession(){return {data:{session:state.user_id?{user:{id:state.user_id}}:null},error:null}}},rpc(name,args){return{async abortSignal(signal){const response=await fetch('/api/clinic/rpc',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name,args}),signal});const data=await response.json();return data.error?{data:null,error:data.error}:data}}}};
const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.matches?.('.ui-account-entry'))))scheduleApply()});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAccess()});
window.addEventListener('pagehide',()=>{document.body.classList.remove('access-ready')});
window.addEventListener('pageshow',event=>{if(event.persisted)refreshAccess()});
accessReady.then(()=>import(access.has('reviewer')?'./curriculum-admin-notifications.mjs':'./clinic-notifications.mjs')).catch(()=>{});

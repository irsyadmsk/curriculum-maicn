import {parseAccess,capabilities,routeAccess} from './access-core.mjs';
import './terminology.mjs';
let state=parseAccess({version:1,institution:'MA Insan Cendekia Nusantara',role:'guest',user_id:null}),ready=false;
let readRevision=0,readController=null;
let lastVerifiedId=null;
let nativeSessionStarted=false;
async function keepNativeSession(){
 if(nativeSessionStarted||!state.enabled||!state.user_id||window.CurriculumDB)return;nativeSessionStarted=true;
 try{const response=await fetch('/api/config',{cache:'no-store'}),config=await response.json();if(!config.login_enabled||config.supabase_url!=='https://mqesvxweuygplrdxchkv.supabase.co')return;const runtime=await import('./curriculum-runtime.mjs');await runtime.curriculumDB()}catch{/* The gateway remains authoritative if background refresh is unavailable. */}
}
const subscribers=new Set();
const has=permission=>permission==='public'||permission==='request'||ready&&state.capabilities[permission]===true;
function canLink(href){try{const u=new URL(href,location.href);if(u.origin===location.origin)return has(routeAccess(u.pathname));if(u.hostname==='studio.irsyads.com')return has(u.hash==='#kurikulum'?'reviewer':'teacher');return true}catch{return false}}
function apply(){
 document.body.dataset.audience=state.role;document.body.classList.add('access-ready');
 document.querySelectorAll('[data-needs]').forEach(el=>{el.hidden=!has(el.dataset.needs)});
 document.querySelectorAll('a[href]').forEach(a=>{if(a.dataset.accessFixed==='true')return;const u=new URL(a.href,location.href);const permission=u.origin===location.origin?routeAccess(u.pathname):u.hostname==='studio.irsyads.com'?'reviewer':'public';if(permission!=='public'){a.hidden=!has(permission);a.dataset.accessControlled=permission}});
 document.querySelectorAll('.clay-nav-menu a').forEach(a=>{const current=new URL(a.href,location.href).pathname===location.pathname;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 document.querySelectorAll('.clay-nav-section-title,.clay-nav-group-title,.clay-nav-label,.ui-nav-label').forEach(label=>{let node=label.nextElementSibling,found=false;while(node&&!node.matches('.clay-nav-section-title,.clay-nav-group-title,.clay-nav-label,.ui-nav-label')){if(node.matches('a')&&!node.hidden)found=true;node=node.nextElementSibling}label.hidden=!found});
 const top=document.querySelector('.clay-topbar-right');if(top){let account=top.querySelector('.ui-account-entry');if(!account){account=document.createElement('a');account.className='ui-account-entry';account.href='akun.html';account.dataset.accessFixed='true';top.prepend(account)}const labels={guest:'Masuk guru',member:'Akun umum',teacher:'Ruang guru',curriculum:'Kurikulum',admin:'Admin'};if(account.dataset.role!==state.role){account.dataset.role=state.role;account.setAttribute('aria-label',labels[state.role]);account.title=labels[state.role];account.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span>'+labels[state.role]+'</span>'}}
 document.querySelectorAll('[data-audience-copy]').forEach(el=>{const copy=el.dataset[has('teacher')?'teacherCopy':'publicCopy'];if(copy&&el.textContent!==copy)el.textContent=copy});
 document.querySelectorAll('[data-public-content]').forEach(el=>{el.hidden=has('teacher')});
}
let painting=false;function scheduleApply(){if(painting)return;painting=true;requestAnimationFrame(()=>{painting=false;apply()})}
export async function refreshAccess({quiet=false}={}){
 const revision=++readRevision;readController?.abort();const controller=new AbortController();readController=controller;const timeout=setTimeout(()=>controller.abort(),12000);
 if(!quiet){ready=false;state=parseAccess({version:1,institution:'MA Insan Cendekia Nusantara',role:'guest',user_id:null});apply();}
 try{const r=await fetch('/api/access',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const next=parseAccess(await r.json());if(revision!==readRevision)return state;if(lastVerifiedId&&lastVerifiedId!==next.user_id){location.reload();return state}lastVerifiedId=next.user_id;state=next;ready=true;}
 catch{if(revision!==readRevision)return state;state=parseAccess({version:1,institution:'MA Insan Cendekia Nusantara',role:'guest',user_id:null});ready=true;}
 finally{clearTimeout(timeout)}
 apply();subscribers.forEach(fn=>fn(state));window.dispatchEvent(new CustomEvent('curriculum-access-changed',{detail:{role:state.role}}));
 keepNativeSession();
 const permission=routeAccess(location.pathname);if(permission!=='public'&&!has(permission))location.replace('/akun.html?next='+encodeURIComponent(location.pathname));
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

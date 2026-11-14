import {connectSession} from './account-sso.mjs';

const authOrigin='https://mqesvxweuygplrdxchkv.supabase.co';
const nativeStorageKey='sb-'+new URL(authOrigin).hostname.split('.')[0]+'-auth-token';
let pending, restoring;
export function hasNativeSession(){
 try{
  if(location.hostname==='irsyads.com'||location.hostname.endsWith('.irsyads.com')){
   return document.cookie.split(/;\s*/).some(part=>part.startsWith(nativeStorageKey+'=')||part.startsWith(nativeStorageKey+'.0='));
  }
  return Boolean(localStorage.getItem(nativeStorageKey));
 }catch{return false}
}
export function restoreNativeSession(){
 if(!hasNativeSession())return Promise.resolve(false);
 restoring??=(async()=>{
  const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Konfigurasi sesi belum tersedia.');
  const config=await response.json();
  if(!config.login_enabled||config.supabase_url!==authOrigin)return false;
  return connectSession(await curriculumDB());
 })().finally(()=>{restoring=undefined});
 return restoring;
}
/** Reuse the Irsyads ID shared session; the Worker verifies native identity and school roles. */
export async function curriculumDB(){
 if(window.CurriculumDB)return window.CurriculumDB;
 pending??=(async()=>{
  for(const [src,available] of [['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',()=>window.supabase],['assets/irsyads-session.js',()=>window.IrsyadsCurriculumSession],['assets/curriculum-data.js',()=>window.CurriculumDB]]){
   if(available())continue;
   await new Promise((resolve,reject)=>{const s=document.createElement('script'),timer=setTimeout(()=>{s.remove();reject(Error('Sesi belum termuat. Coba kembali.'))},12000);s.src=src;s.onload=()=>{clearTimeout(timer);resolve()};s.onerror=()=>{clearTimeout(timer);s.remove();reject(Error('Sesi belum termuat. Coba kembali.'))};document.head.append(s)});
  }
  if(!window.CurriculumDB)throw Error('Sesi Curriculum belum tersedia.');return window.CurriculumDB;
 })().catch(error=>{pending=undefined;throw error});
 return pending;
}

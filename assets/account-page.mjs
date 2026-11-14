import {accessReady,access,refreshAccess} from './curriculum-access.mjs';
import {curriculumDB,restoreNativeSession} from './curriculum-runtime.mjs';
import {accountTarget,ssoLink,connectSession} from './account-sso.mjs';
import {verificationGate} from './submission-flow.mjs';

const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
const form=$('#account-password-form');
const requested=params.get('next');
const returnTo=accountTarget(requested&&!requested.includes('#')?requested+location.hash:requested);
const ssoReturn=params.get('sso')==='return';
let gate;

function showFeedback(selector,text){
 const output=$(selector);
 output.textContent=text;
 output.hidden=!text;
}
const message=text=>showFeedback('#account-message',text);
const authError=text=>showFeedback('#account-auth-error',text);
const challengeStatus=text=>showFeedback('#account-challenge-status',text);
function destination(){
 if(requested)return returnTo;
 if(access.has('admin'))return '/admin.html';
 if(access.has('reviewer'))return '/kurikulum.html#clinic';
 return '/index.html';
}
function render(){
 const role=access.context.role;
 const labels={guest:'Tamu',member:'Akun umum',student:'Murid',teacher:'Guru',curriculum:'Pengelola kurikulum',admin:'Admin'};
 $('#account-heading').textContent=role==='guest'?'Masuk ke Curriculum':'Akun Curriculum';
 $('#account-role').textContent=labels[role];
 $('#account-role-line').hidden=role==='guest';
 $('#account-login').hidden=role!=='guest';
 $('#account-session').hidden=role==='guest';
 $('#account-return').href=access.canLink(destination())?destination():'/index.html';
 $('#account-teacher-note').textContent=role==='guest'?'Gunakan akun Irsyads Anda.':role==='member'?'Untuk membuka ruang sekolah, selesaikan aktivasi akun atau hubungi pengelola akses.':'Hak akses Curriculum mengikuti penugasan akun Anda.';
}
function continueToPage(){
 if(!access.context.user_id)return;
 if(access.canLink(destination()))location.replace(destination());
 else message('Akun ini belum memiliki akses ke halaman tujuan. Hubungi pengelola Curriculum jika Anda memerlukan akses.');
}
$('#account-submit').href=ssoLink(location.origin,returnTo);
await accessReady;
render();
if(requested&&!ssoReturn&&access.context.user_id)continueToPage();

try{
 const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(12000)});
 const config=await response.json();
 if(!response.ok||!config.login_enabled)throw Error();
 if(ssoReturn){
  const connected=await restoreNativeSession();
  if(connected){await refreshAccess();render();continueToPage()}
  else message('Sesi Irsyads ID belum terbaca. Coba masuk langsung atau ulangi SSO.');
 }
 if(access.context.role==='guest'){
  form.hidden=false;
  gate=verificationGate($('#account-challenge'),{sitekey:config.auth_turnstile_site_key,action:'curriculum_login',size:'compact',appearance:'interaction-only',submitLabel:'Masuk langsung',onStatus:text=>challengeStatus(text==='Verifikasi selesai.'?'':text)});
  gate.mount().catch(error=>challengeStatus(error.message));
 }
}catch{
 message('Layanan masuk belum dapat diperiksa. Muat ulang halaman atau gunakan Irsyads ID (SSO).');
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const button=$('#account-password-submit');
 const password=$('#account-password');
 if(!gate||button.disabled)return;
 button.disabled=true;
 button.textContent='Memeriksa akun…';
 message('');
 authError('');
 challengeStatus('');
 let authenticated=false;
 try{
  const captchaToken=await gate.wait();
  const db=await curriculumDB();
  const signedIn=await db.signIn($('#account-email').value.trim(),password.value,captchaToken);
  authenticated=true;
  if(!await connectSession(db))throw Error('Curriculum session unavailable');
  await refreshAccess();
  if(!signedIn.user?.id||access.context.user_id!==signedIn.user.id)throw Error('Curriculum access unavailable');
  render();
  message('Berhasil masuk ke Curriculum.');
  continueToPage();
 }catch(error){
  const known={
   invalid_credentials:'Email atau kata sandi tidak cocok.',
   email_not_confirmed:'Email belum terverifikasi. Buka Irsyads ID untuk menyelesaikan aktivasi.',
   captcha_failed:'Verifikasi keamanan gagal. Selesaikan verifikasi lalu coba lagi.',
   over_request_rate_limit:'Terlalu banyak percobaan. Tunggu sebentar lalu coba kembali.'
  };
  authError(authenticated?'Akun sudah terverifikasi. Muat ulang halaman untuk menyambungkan sesi Curriculum.':known[error?.code]||(error?.message?.startsWith('Verifikasi')?error.message:'Sesi belum dapat disambungkan. Coba lagi atau gunakan Irsyads ID (SSO).'));
 }finally{
  password.value='';
  if(!$('#account-login').hidden)gate.reset();
  button.disabled=false;
  button.textContent='Masuk langsung';
 }
});
$('#account-logout').onclick=async()=>{
 const button=$('#account-logout');
 button.disabled=true;
 try{
  const db=await curriculumDB(),session=await db.getSession();
  if(session)await db.signOut(session);
  const response=await fetch('/api/session',{method:'DELETE',credentials:'same-origin',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error();
  location.replace('/akun.html');
 }catch{message('Keluar akun belum terkonfirmasi. Periksa koneksi lalu coba kembali.')}
 finally{button.disabled=false}
};

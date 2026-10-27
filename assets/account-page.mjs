import {accessReady,access,refreshAccess} from './curriculum-access.mjs';
import {curriculumDB} from './curriculum-runtime.mjs';
import {accountTarget,ssoLink,connectSession} from './account-sso.mjs';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),returnTo=accountTarget(params.get('next'));
const message=text=>{$('#account-message').textContent=text};
function render(){const c=access.context,labels={guest:'Tamu',member:'Akun umum',teacher:'Guru',curriculum:'Pengelola kurikulum',admin:'Admin'};$('#account-role').textContent=labels[c.role];$('#account-login').hidden=c.role!=='guest';$('#account-session').hidden=c.role==='guest';$('#account-teacher-note').textContent=access.has('teacher')?'Akun Irsyads ID Anda terhubung dengan ruang guru.':c.role==='member'?'Anda sudah masuk melalui Irsyads ID. Akses guru memerlukan penetapan pengelola.':'Masuk sekali melalui Irsyads ID untuk membuka ruang guru. Murid dan tamu tetap dapat membaca informasi serta meminta Klinik tanpa akun.';$('#account-return').href=access.canLink(returnTo)?returnTo:'/index.html';}
$('#account-submit').href=ssoLink(location.origin,returnTo);
await accessReady;render();
try{
 const response=await fetch('/api/config',{cache:'no-store'}),config=await response.json();
 if(!response.ok||!config.login_enabled)throw Error();
 const db=await curriculumDB();
 const connected=await connectSession(db);
 await refreshAccess();render();
 if(connected&&params.get('sso')==='return'){
  message('SSO berhasil. Hak akses akun sudah diperiksa.');
  if(access.canLink(returnTo))location.replace(returnTo);
 }else if(!connected)message(params.get('sso')==='return'?'Sesi SSO belum terbaca. Buka Irsyads ID untuk masuk kembali.':'Gunakan akun Irsyads ID Anda. Setelah masuk, Anda akan kembali ke Curriculum.');
}catch{message('Sesi SSO belum dapat diperiksa. Coba kembali atau lanjutkan membaca informasi umum.');}
$('#account-logout').onclick=async()=>{
 const button=$('#account-logout');button.disabled=true;
 try{const db=await curriculumDB(),session=await db.getSession();if(session)await db.signOut(session);const response=await fetch('/api/session',{method:'DELETE',credentials:'same-origin'});if(!response.ok)throw Error();await refreshAccess();render();message('Anda sudah keluar dari sesi Irsyads ID di peramban ini.');}
 catch{message('Keluar akun belum terkonfirmasi. Periksa koneksi lalu coba kembali.');}
 finally{button.disabled=false}
};

import {access,accessReady} from './curriculum-access.mjs';
import {mountSchoolAdmin} from './school-admin.mjs';
import {browserSchoolClient} from './school-client.mjs';
const host=document.getElementById('curriculum-review-root');let mounted=null,cleanup=null,revision=0;
async function show(tab='clinic'){
 const read=++revision;cleanup?.();cleanup=null;
 const ctx=await access.verify();if(read!==revision)return;
 host.replaceChildren();if(!ctx.capabilities.reviewer){host.textContent='Akses staf kurikulum diperlukan. Masuk kembali menggunakan akun yang ditugaskan.';return}
 const section=document.createElement('section'),intro=document.createElement('p'),tabs=document.createElement('nav'),body=document.createElement('div');
 intro.className='clinic-connection';intro.textContent=ctx.role==='admin'?'Ruang persetujuan kurikulum. Keputusan tersimpan di server dan tampil pada agenda setelah diterima.':'Staf kurikulum · persetujuan klinik dan switch jadwal. Keputusan tetap memeriksa bentrok dan revisi terbaru.';
 tabs.className='school-tabs';tabs.setAttribute('aria-label','Jenis ajuan');
 for(const [kind,label] of [['clinic','Persetujuan klinik'],['switch','Switch jadwal']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(tab===kind));b.onclick=()=>{history.replaceState(null,'','#'+kind);show(kind)};tabs.append(b)}
 section.append(intro,tabs,body);host.append(section);mounted=ctx.user_id;
 if(tab==='switch'){cleanup=mountSchoolAdmin(body,browserSchoolClient(),{ownerId:ctx.user_id,role:ctx.role,allowedKinds:['switch'],reviewOnly:true});return}
 body.textContent='Memuat ajuan klinik…';try{const {mountClinicReview}=await import('./clinic-review-ui.js');if(read!==revision)return;body.replaceChildren();cleanup=mountClinicReview(body,ctx.user_id)}catch{if(read===revision)body.textContent='Ruang klinik belum dapat dimuat. Muat ulang halaman.'}
}
await accessReady;show(location.hash==='#switch'?'switch':'clinic');
access.subscribe(ctx=>{if(mounted&&(!ctx.capabilities.reviewer||ctx.user_id!==mounted)){revision++;cleanup?.();cleanup=null;mounted=null;host.textContent='Sesi atau hak akses berubah. Muat ulang sebelum melanjutkan.'}});
window.addEventListener('pagehide',()=>{revision++;cleanup?.()});

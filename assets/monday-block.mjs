import {CLINIC_REMOTE_ENABLED,nextMonday,dateLabel,isDate} from './clinic-core.mjs';
import {clinicClient} from './clinic-client.mjs';
import {accessReady} from './curriculum-access.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let date=nextMonday(),snapshot=null,error='';
const root=document.querySelector('#monday-home-agenda')||document.querySelector('#monday-schedule-agenda');
const studioURL=()=>`https://studio.irsyads.com/?clinic=review&block-date=${date}#kurikulum`;
function render(){
 if(!root)return;
 const row=snapshot?.rows.find(r=>r.date===date);
 root.innerHTML=`<div class="monday-agenda-content"><div><p class="clinic-muted">${esc(dateLabel(date))} · 07.00–07.40 WIB · Semua kelas X</p><h3>${esc(row?.activity||'Kegiatan belum ditetapkan')}</h3><p>${esc(row?.note||'Upacara, KTI, atau Wali Kelas mengikuti pilihan kurikulum per tanggal.')}</p>${error?`<p role="status">${esc(error)}</p>`:!CLINIC_REMOTE_ENABLED?'<p class="clinic-muted">Penetapan melalui Studio menunggu aktivasi integrasi.</p>':''}</div><a data-needs="reviewer" class="ui-button ui-button-secondary" href="${esc(studioURL())}">Pilih kegiatan di Studio ↗</a></div>`;
 document.querySelectorAll('[data-monday-activity]').forEach(el=>{const text=row?.activity||'Blok Senin · Upacara / KTI / Wali Kelas';if(el.textContent!==text)el.textContent=text});
 window.dispatchEvent(new Event('monday-block-updated'));
}
async function load(){if(!CLINIC_REMOTE_ENABLED){render();return}try{await accessReady;snapshot=await clinicClient(window.CurriculumClinicProxy).blocks();error='';render()}catch{error='Agenda belum berhasil diperbarui. Periksa kembali sebelum menggunakan jadwal ini.';render()}}
const picker=document.querySelector('#monday-date');if(picker){picker.value=date;picker.onchange=()=>{if(isDate(picker.value)&&new Date(picker.value).getUTCDay()===1){date=picker.value;render()}else{picker.setCustomValidity('Pilih hari Senin.');picker.reportValidity();picker.setCustomValidity('')}}}
window.openMondayBlock=()=>{
 const row=snapshot?.rows.find(r=>r.date===date);let dialog=document.querySelector('#monday-info-dialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='monday-info-dialog';dialog.className='monday-info-dialog';dialog.setAttribute('aria-label','Blok Senin JP 1');document.body.append(dialog)}
 dialog.innerHTML=`<h2>Senin, JP 1</h2><p>${esc(dateLabel(date))} · 07.00–07.40 WIB</p><h3>${esc(row?.activity||'Kegiatan belum ditetapkan')}</h3><p>${esc(row?.note||'Pilihan kegiatan: Upacara, KTI, atau Wali Kelas.')}</p><p>Admin atau pengelola kurikulum menetapkan kegiatan per tanggal melalui Studio.</p><div class="clinic-row"><button type="button" id="monday-info-close" class="ui-button ui-button-secondary">Tutup</button><a data-needs="reviewer" class="ui-button ui-button-primary" href="${esc(studioURL())}">Pilih / edit di Studio ↗</a></div>`;
 dialog.querySelector('#monday-info-close').onclick=()=>dialog.close();dialog.showModal();
};
const tbody=document.querySelector('#tbody-kbm');if(tbody)new MutationObserver(()=>{const row=snapshot?.rows.find(r=>r.date===date);tbody.querySelectorAll('[data-monday-activity]').forEach(el=>{el.textContent=row?.activity||'Blok Senin · Upacara / KTI / Wali Kelas'});window.dispatchEvent(new Event('monday-block-updated'))}).observe(tbody,{childList:true});
render();load();document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});

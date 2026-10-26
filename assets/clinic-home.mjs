import {CLINIC_REMOTE_ENABLED,approvedAgenda,dateLabel} from './clinic-core.mjs';
import {clinicClient} from './clinic-client.mjs';
import {accessReady} from './curriculum-access.mjs';
const root=document.querySelector('#clinic-home-agenda');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='maicn_clinic_read_approvals_v1';
async function render(){
 if(!root)return;
 if(!CLINIC_REMOTE_ENABLED){root.innerHTML='<p class="ui-empty">Agenda klinik akan tampil di sini setelah disetujui kurikulum. Integrasi persetujuan Studio sedang disiapkan.</p>';return}
 try{
  await accessReady;
  const snapshot=await clinicClient(window.CurriculumClinicProxy).read(),rows=approvedAgenda(snapshot.rows);
  let seen=[];try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(v)&&v.length<=5000)seen=v.filter(v=>typeof v==='string')}catch{/* Read markers never affect approvals. */}
  const unread=rows.filter(r=>!seen.includes(r.id+':'+r.revision));
  root.innerHTML=rows.length?`<p class="clinic-muted" role="status">${unread.length?`${unread.length} jadwal baru atau diperbarui`:'Semua jadwal sudah dibaca'} · WIB</p>${rows.slice(0,6).map(r=>`<article class="clinic-home-item"><span class="clinic-badge clinic-approved">${esc(r.classroom)} · Disetujui</span>${!seen.includes(r.id+':'+r.revision)?'<span class="clinic-badge">Baru</span>':''}<h3>${esc(r.approved_subject)}</h3><p>${esc(dateLabel(r.date))} · ${esc(r.start)}–${esc(r.end)} WIB</p><p>${esc(r.teacher)}</p></article>`).join('')}<button type="button" class="ui-button ui-button-secondary" id="clinic-mark-read">Tandai sudah dibaca</button>`:'<p class="ui-empty">Belum ada klinik mendatang yang disetujui.</p>';
  const b=document.querySelector('#clinic-mark-read');if(b)b.onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(rows.map(r=>r.id+':'+r.revision)));b.disabled=true;b.textContent='Sudah dibaca';render()}catch{b.textContent='Penanda belum tersimpan'}};
 }catch{root.innerHTML='<p class="ui-empty">Agenda klinik belum berhasil diperbarui. <a href="klinik.html">Periksa halaman Klinik</a>.</p>'}
}
render();document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
setInterval(()=>{if(!document.hidden)render()},60000);

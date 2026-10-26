import {CLINIC_REMOTE_ENABLED,YEAR,CLASSES,SLOTS,todayWIB,addDays,monday,slotFor,dateLabel,archived,legacyRecords,validateProposal,validateRequest,safeURL,inSchoolYear} from './clinic-core.mjs';
import {clinicClient} from './clinic-client.mjs';
import {accessReady,access} from './curriculum-access.mjs';
await accessReady;
const initialRole=access.context.role;
let config={clinic_enabled:false,turnstile_site_key:''};try{const r=await fetch('/api/config',{cache:'no-store'});config=await r.json()}catch{}
let challenge='',challengeWidget=null;
const $ = s => document.querySelector(s), esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='maicn_clinic_drafts_v2_2026-2027_'+(access.context.user_id||'guest');
const state={week:monday(todayWIB()),tab:'schedule',drafts:[],legacy:[],remote:[],feed:[],teachers:CLINIC_REMOTE_ENABLED?[]:window.MASTER_DATA?.jadwal_kbm_v2?.matriks_guru||[],raw:null,storageOK:true,owner:access.context.user_id,editing:null,expected:null,busy:false,notice:'',filters:{from:'',to:'',classroom:'',status:''}};
const api=clinicClient(window.CurriculumClinicProxy);
const labels={draft:'Draf perangkat',pending:'Menunggu konfirmasi',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan',legacy:'Catatan lama'};
const root=$('#clinic-root');
function loadDrafts(){
  const raw=localStorage.getItem(KEY), parsed=raw===null?[]:JSON.parse(raw);
  if(!Array.isArray(parsed)||parsed.length>5000||new Set(parsed.map(r=>r?.id)).size!==parsed.length||parsed.some(r=>!r||typeof r.id!=='string'||r.status!=='draft'||!slotFor(r.date)||r.start!==slotFor(r.date).start||r.end!==slotFor(r.date).end||!CLASSES.includes(r.classroom)||!Array.isArray(r.subjects)||r.subjects.length<1||r.subjects.length>3||r.subjects.some(s=>typeof s!=='string'||!s.trim()||s.length>120)||typeof r.teacher!=='string'||typeof r.topic!=='string'||typeof r.evidence!=='string'||!Number.isSafeInteger(r.revision)))throw Error('Draf perangkat tidak dapat dibaca. Data asli dipertahankan; unduh cadangan sebelum pemulihan.');
  state.raw=raw;state.drafts=parsed;
}
try{loadDrafts()}catch(e){state.storageOK=false;state.notice=e.message}
if(access.has('reviewer')){try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/clinic-legacy-data.js';script.onload=resolve;script.onerror=reject;document.head.append(script)})}catch{state.notice='Catatan sumber lama belum dapat dibaca. Data perangkat tetap dipertahankan.'}}
try{
 const raw=access.has('reviewer')?localStorage.getItem('maicn_klinik_bookings'):null;
 state.legacy=access.has('reviewer')?legacyRecords(raw===null?(window.MAICN_CLINIC_LEGACY||[]):JSON.parse(raw),raw===null?'Sumber awal situs':'Browser lama'):[];
}catch{state.notice+=' Catatan lama belum dapat dibaca. Isi aslinya tetap dipertahankan.'}
function ownRequests(){return state.drafts.map(r=>state.remote.find(v=>v.id===r.id)||state.feed.find(v=>v.id===r.id)||(r.sentReceipt?{...r,status:'pending',localReceipt:true,origin:'Perangkat ini'}:r))}
function records(){
 const rem=new Map(state.feed.map(r=>[r.id,r]));state.remote.forEach(r=>rem.set(r.id,r));
 return [...rem.values(),...ownRequests().filter(r=>!rem.has(r.id)),...state.legacy];
}
function notify(message){state.notice=message;const n=$('#clinic-notice');if(n){n.textContent=message;n.hidden=!message}}
function recordCard(r){
 const url=safeURL(r.evidence), ended=archived(r);
 return `<article class="clinic-record" data-status="${esc(r.status)}"><div class="clinic-row"><span class="clinic-badge ${r.status==='approved'?'clinic-approved':''}">${esc(labels[r.status]||r.status)}</span><span class="clinic-muted">${esc(r.classroom)}</span></div><h3>${esc(r.approved_subject||r.subjects.join(' / ')||'Mapel belum tercatat')}</h3><p>${esc(r.teacher||'Pengampu belum tercatat')}</p>${state.tab==='schedule'?'':`<p class="clinic-muted">${esc(dateLabel(r.date))} · ${esc(r.start)}–${esc(r.end)} WIB</p>`}${r.topic?`<p class="clinic-note">${esc(r.topic)}</p>`:''}${r.localReceipt?'<small>Status saat dikirim: menunggu konfirmasi. Ikuti agenda untuk jadwal resmi.</small>':''}${r.status==='legacy'?`<small>Status tersimpan: ${esc(r.legacyStatus)} · ${esc(r.origin)}. Persetujuan server belum diverifikasi.</small>`:''}${r.decision_note?`<p class="clinic-note">Keputusan: ${esc(r.decision_note)}</p>`:''}${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Buka bukti ↗</a>`:r.evidence?`<p class="clinic-muted">Bukti lama: ${esc(r.evidence)}</p>`:''}${r.status==='draft'?`<button type="button" data-edit="${esc(r.id)}">${ended?'Lihat draf terdahulu':'Lanjutkan draf'}</button>`:''}${r.origin==='Server'&&state.owner&&state.remote.some(v=>v.id===r.id)?`<div class="clinic-row">${!ended&&r.status==='pending'?`<button type="button" data-remote-edit="${esc(r.id)}">Edit usulan</button>`:''}<button type="button" data-report="${esc(r.id)}">Catatan laporan</button></div>`:''}</article>`;
}
function render(){
 const all=records(), ended=all.filter(r=>archived(r));
 root.innerHTML=`<section class="clinic-intro"><div><p class="ui-eyebrow">KLINIK PEMBELAJARAN · ${YEAR}</p><h2>Ruang tumbuh,<br><em>di waktu yang tepat.</em></h2><p>Ajukan kebutuhan belajar. Kurikulum memilih satu mapel per sesi; jadwal yang disetujui tampil di beranda.</p></div><div class="clinic-intro-actions"><button type="button" class="ui-button ui-button-primary" id="clinic-new">+ Ajukan klinik</button><a class="ui-button ui-button-secondary" data-needs="reviewer" href="https://studio.irsyads.com/?clinic=review#kurikulum">Edit & konfirmasi di Studio ↗</a></div></section>
 <div class="clinic-summary"><div><strong>Senin malam</strong><span>20.30–21.30 WIB</span></div><div><strong>Selasa sore</strong><span>16.15–17.00 WIB</span></div><div><strong>1 mapel disetujui</strong><span>Per sesi, per kelas · pilihan mapel bebas</span></div></div>
 <p class="clinic-connection">${CLINIC_REMOTE_ENABLED?'Persetujuan diperiksa melalui akun Irsyads.':'Draf bisa diisi sekarang. Pengiriman, persetujuan Studio, dan agenda lintas perangkat menunggu aktivasi integrasi.'}</p>
 <p id="clinic-notice" class="clinic-feedback" role="status" ${state.notice?'':'hidden'}>${esc(state.notice)}</p>
 <div class="clinic-tabs" role="group" aria-label="Tampilan klinik"><button data-tab="schedule" aria-pressed="${state.tab==='schedule'}">Jadwal</button><button data-tab="requests" aria-pressed="${state.tab==='requests'}">${access.has('teacher')?'Usulan & laporan':'Permintaan saya'} <span>${state.drafts.filter(r=>!r.sentReceipt).length+state.remote.length}</span></button>${access.has('teacher')?`<button data-tab="archive" aria-pressed="${state.tab==='archive'}">Arsip & laporan <span>${ended.length}</span></button>`:''}</div>
 <section id="clinic-view" aria-label="${state.tab==='archive'?'Arsip klinik':'Daftar klinik'}"></section>
 <details class="clinic-help"><summary>Cara pengisian & penyimpanan data</summary><ol><li>Pilih tanggal Senin/Selasa, kelas, dan pengampu.</li><li>Tulis 1–3 pilihan mapel apa saja dan kebutuhan belajarnya.</li><li>Simpan draf, lalu kirim ketika integrasi aktif. Hanya admin atau pengelola kurikulum yang ditunjuk dapat menyetujui satu mapel.</li><li>Begitu sesi berakhir dalam WIB, catatan otomatis tampil di arsip. Filter dan cetak kapan saja.</li></ol><p>Draf perangkat belum terkirim. Catatan lama tetap dipertahankan beserta status asalnya; tidak dianggap sebagai persetujuan server baru.</p><button type="button" data-needs="teacher" id="clinic-backup">Unduh cadangan perangkat</button></details>`;
 $('#clinic-new').onclick=()=>openForm();
 root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
 $('#clinic-backup').onclick=backup;
 renderView();
}
function renderView(){
 const target=$('#clinic-view'),all=records();
 target.dataset.needs=access.has('teacher')&&state.tab!=='schedule'?'teacher':'public';
 if(state.tab==='schedule'){
  target.innerHTML=`<div class="clinic-date-nav"><button type="button" id="clinic-prev" aria-label="Pekan sebelumnya">←</button><label>Pekan mulai<input id="clinic-week" type="date" value="${state.week}"></label><button type="button" id="clinic-next" aria-label="Pekan berikutnya">→</button><button type="button" id="clinic-today">Pekan ini</button></div><p class="clinic-muted">${esc(dateLabel(state.week))} – ${esc(dateLabel(addDays(state.week,6)))} · WIB</p><div id="clinic-sessions" class="clinic-sessions">${SLOTS.map((s,i)=>{
   const date=addDays(state.week,i),end=archived({date,end:s.end}),within=inSchoolYear(date);
   return `<section class="clinic-session"><header><div><p class="ui-eyebrow">${esc(s.name)} · ${!within?'Di luar tahun pelajaran':end?'Sesi berakhir':'Sesi mendatang'}</p><h3>${esc(dateLabel(date))}</h3><p>${s.start}–${s.end} WIB</p></div>${!end&&within?`<button type="button" data-date="${date}">Ajukan sesi ini</button>`:`<span class="clinic-badge">${within?'Tersimpan di arsip':'Di luar tahun pelajaran'}</span>`}</header><div class="clinic-class-grid">${CLASSES.map(c=>{const rows=all.filter(r=>r.date===date&&r.classroom===c&&r.status==='approved');return `<div><h4>Kelas ${c}</h4>${rows.length?rows.map(recordCard).join(''):'<p class="clinic-empty">Belum ada klinik yang disetujui.</p>'}</div>`}).join('')}</div></section>`;
  }).join('')}</div>`;
  $('#clinic-prev').onclick=()=>{state.week=addDays(state.week,-7);renderView()};$('#clinic-next').onclick=()=>{state.week=addDays(state.week,7);renderView()};$('#clinic-today').onclick=()=>{state.week=monday(todayWIB());renderView()};$('#clinic-week').onchange=e=>{if(e.target.value){state.week=monday(e.target.value);renderView()}};
  target.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>openForm(null,b.dataset.date));
 }else if(state.tab==='requests'){
  const mine=[...ownRequests().filter(r=>!state.remote.some(v=>v.id===r.id)),...state.remote].sort((a,b)=>a.date.localeCompare(b.date));
  target.innerHTML=`<div class="clinic-section-title"><div><h2>${access.has('teacher')?'Usulan & laporan saya':'Permintaan perangkat ini'}</h2><p>Draf perangkat dan usulan yang dikirim melalui akun ini.</p></div><button type="button" id="clinic-refresh">Periksa server</button></div>${mine.length?`<div class="clinic-record-grid">${mine.map(recordCard).join('')}</div>`:'<p class="clinic-empty">Belum ada usulan. Mulai dengan tombol “Ajukan klinik”.</p>'}`;
  $('#clinic-refresh').onclick=()=>refresh(true);
 }else{
  const f=state.filters;
  target.innerHTML=`<div class="clinic-section-title"><div><h2>Arsip & laporan</h2><p>Otomatis setelah waktu selesai. Riwayat tetap tersimpan.</p></div><button type="button" id="clinic-print">Cetak laporan</button></div><div class="clinic-filters"><label>Dari tanggal<input type="date" id="archive-from" value="${esc(f.from)}"></label><label>Sampai tanggal<input type="date" id="archive-to" value="${esc(f.to)}"></label><label>Kelas<select id="archive-class"><option value="">Semua kelas</option>${CLASSES.map(c=>`<option ${f.classroom===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Status<select id="archive-status"><option value="">Semua status</option>${Object.entries(labels).map(([key,val])=>`<option value="${key}" ${f.status===key?'selected':''}>${val}</option>`).join('')}</select></label></div><p class="clinic-muted">Arsip dari server mengikuti hak akun. Catatan browser lama dan draf perangkat disertakan dengan label asalnya.</p><div id="clinic-archive-list"></div>`;
  const update=()=>{state.filters={from:$('#archive-from').value,to:$('#archive-to').value,classroom:$('#archive-class').value,status:$('#archive-status').value};renderArchive()};
  ['archive-from','archive-to','archive-class','archive-status'].forEach(id=>$('#'+id).onchange=update);
  $('#clinic-print').onclick=printReport;renderArchive();
 }
 bindRecordActions(target);
}
function bindRecordActions(target){
 target.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openForm(state.drafts.find(r=>r.id===b.dataset.edit)));
 target.querySelectorAll('[data-remote-edit]').forEach(b=>b.onclick=()=>openForm(state.remote.find(r=>r.id===b.dataset.remoteEdit)));
 target.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>openForm(state.remote.find(r=>r.id===b.dataset.report),undefined,true));
}
function archiveRows(){const f=state.filters;return records().filter(r=>archived(r)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!f.classroom||r.classroom===f.classroom)&&(!f.status||r.status===f.status)).sort((a,b)=>b.date.localeCompare(a.date)||a.classroom.localeCompare(b.classroom));}
function renderArchive(){const rows=archiveRows(),bad=state.filters.from&&state.filters.to&&state.filters.from>state.filters.to;$('#clinic-archive-list').innerHTML=bad?'<p class="clinic-feedback">Tanggal akhir harus sesudah tanggal awal.</p>':`<p class="clinic-muted">${rows.length} catatan sesuai filter</p>${rows.length?`<div class="clinic-record-grid">${rows.map(recordCard).join('')}</div>`:'<p class="clinic-empty">Tidak ada arsip sesuai filter.</p>'}`;$('#clinic-print').disabled=!!bad||!rows.length;bindRecordActions($('#clinic-archive-list'));}
function defaultDate(){let d=todayWIB();for(let n=0;n<8;n++,d=addDays(d,1)){const s=slotFor(d);if(s&&!archived({date:d,end:s.end}))return d}return d}
function openForm(row=null,date=defaultDate(),report=false){
 if(access.has('teacher')&&CLINIC_REMOTE_ENABLED&&!state.teachers.length){notify('Daftar pengampu sedang dimuat. Coba lagi sesaat atau muat ulang agenda.');return;}
 state.editing=row;state.expected=state.raw;state.formId=row?.id||crypto.randomUUID();state.pendingToken=null;
 const dialog=$('#clinic-dialog'),form=$('#clinic-form');form.reset();form.dataset.report=report?'true':'false';
 $('#clinic-form-title').textContent=report?'Catatan laporan':row?'Lanjutkan permintaan':access.has('teacher')?'Usulan Klinik guru':'Ajukan kebutuhan belajar';
 $('#clinic-teacher').innerHTML='<option value="">Pilih pengampu</option>'+state.teachers.map(t=>`<option value="${esc(t.nama)}">${esc(t.nama)}</option>`).join('');
 $('#clinic-date').value=row?.date||date;$('#clinic-class').value=row?.classroom||'X-1';$('#clinic-teacher').value=row?.teacher||'';
 [0,1,2].forEach(i=>$('#clinic-subject-'+i).value=row?.subjects[i]||'');$('#clinic-topic').value=row?.topic||'';$('#clinic-evidence').value=row?.evidence||'';
 const ended=row&&archived(row);
 $('#clinic-schedule-fields').disabled=report||ended;$('#clinic-report-fields').disabled=!!(ended&&!report);$('#clinic-form-note').textContent=report?'Catatan dan bukti masuk riwayat revisi. Tanggal dan keputusan tetap.':row?.origin==='Server'?'Perubahan usulan harus dikonfirmasi ulang oleh kurikulum.':access.has('teacher')?'Semua mapel boleh diajukan. Pilih 1–3; kurikulum menyetujui satu.':'Boleh diajukan tanpa akun. Pilih 1–3 mapel dan tuliskan kebutuhanmu; pengampu dan jadwal resmi ditetapkan kurikulum.';
 $('#clinic-save-draft').hidden=report||row?.origin==='Server'||!!ended;$('#clinic-teacher').required=access.has('teacher');$('#clinic-teacher').closest('label').hidden=!access.has('teacher');if(!access.has('teacher'))$('#clinic-teacher').value='';document.querySelector('label[for="clinic-teacher"]').firstChild.textContent=access.has('teacher')?'Guru pengampu':'Usulan pengampu (opsional)';$('#clinic-evidence').closest('label').hidden=!access.has('teacher');$('#clinic-requester').closest('label').hidden=access.has('teacher');$('#clinic-requester').value=row?.requester_label||'';
 $('#clinic-send').hidden=!!(ended&&!report);$('#clinic-send').textContent=report?'Simpan catatan laporan':row?.origin==='Server'?'Kirim perubahan':access.has('teacher')?'Kirim usulan guru':'Kirim permintaan';$('#clinic-send').disabled=!CLINIC_REMOTE_ENABLED;
 $('#clinic-form-error').textContent=ended&&!report?'Draf terdahulu dipertahankan sebagai arsip. Buat usulan baru untuk sesi mendatang.':'';
 $('#clinic-auth-entry').hidden=access.has('teacher');
 updateSlot();dialog.showModal();setupChallenge().catch(()=>{$('#clinic-form-error').textContent='Verifikasi permintaan belum dapat dimuat. Simpan draf dan coba lagi saat koneksi tersedia.';});
}
function updateSlot(){const s=slotFor($('#clinic-date').value);$('#clinic-slot-info').textContent=s?`${s.name} · ${s.start}–${s.end} WIB`:'Pilih hari Senin atau Selasa.';}
$('#clinic-date').onchange=updateSlot;
$('#clinic-dialog-close').onclick=()=>$('#clinic-dialog').close();
$('#clinic-cancel').onclick=()=>$('#clinic-dialog').close();
async function storeDraft(row){
 if(!state.storageOK)throw Error('Penyimpanan belum dapat dibaca. Cadangkan data sebelum melanjutkan.');
 if(!navigator.locks?.request)throw Error('Penyimpanan aman memerlukan browser terbaru. Isian tetap terbuka untuk disalin.');
 await navigator.locks.request(KEY,()=>{
  if(localStorage.getItem(KEY)!==state.expected)throw Error('Draf berubah di tab lain. Tutup formulir dan muat ulang sebelum menyimpan.');
  const next=state.drafts.filter(r=>r.id!==row.id).concat(row),raw=JSON.stringify(next);localStorage.setItem(KEY,raw);state.raw=raw;state.drafts=next;
 });
}
$('#clinic-form').onsubmit=async e=>{
 e.preventDefault();if(state.busy)return;const send=e.submitter?.id==='clinic-send',report=e.currentTarget.dataset.report==='true';
 state.busy=true;$('#clinic-form-error').textContent='';let row=state.editing;
 const buttons=[...e.currentTarget.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{
  const date=$('#clinic-date').value,s=slotFor(date),teacher=state.teachers.find(t=>t.nama===$('#clinic-teacher').value);
  const proposal=report?{topic:$('#clinic-topic').value.trim(),evidence:$('#clinic-evidence').value.trim()}:(access.has('teacher')?validateProposal:validateRequest)({date,start:s?.start,end:s?.end,classroom:$('#clinic-class').value,teacher_code:teacher?.kode,teacher:teacher?.nama,subjects:[0,1,2].map(i=>$('#clinic-subject-'+i).value.trim()).filter(Boolean),topic:$('#clinic-topic').value,evidence:$('#clinic-evidence').value,requester_label:$('#clinic-requester').value});
  if(report&&proposal.evidence&&!safeURL(proposal.evidence))throw Error('Gunakan tautan http atau https untuk bukti.');
  if(send){
   if(access.has('teacher')&&!state.owner)throw Error('Sesi guru berakhir. Masuk kembali sebelum mengirim.');
   if(!report&&row?.origin!=='Server'){
    row={...proposal,id:row?.id||state.formId,status:'draft',revision:(row?.revision||0)+1,origin:'Perangkat ini',saved_at:new Date().toISOString()};
    await storeDraft(row);state.editing=row;state.expected=state.raw;
   }
   const action=report?'report':row?.origin==='Server'?'edit':'submit',signature=JSON.stringify([row.id,row?.origin==='Server'?row.revision:0,action,proposal]);
   if(state.pendingToken&&state.pendingToken.signature!==signature)throw Error('Hasil pengiriman sebelumnya belum dipastikan. Periksa server sebelum mengubah dan mengirim ulang.');
   state.pendingToken??={signature,token:crypto.randomUUID()};
   let receipt;
   if(access.has('teacher'))receipt=await api.write({owner:state.owner,action,id:row.id,revision:row?.origin==='Server'?row.revision:0,data:proposal,token:state.pendingToken.token});
   else{if(!challenge)throw Error('Selesaikan verifikasi permintaan di bawah formulir.');const response=await fetch('/api/clinic/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,token:state.pendingToken.token,data:proposal,challenge})});receipt=await response.json();challenge='';if(challengeWidget!==null)window.turnstile?.reset(challengeWidget);if(!response.ok||receipt.id!==row.id||receipt.status!=='pending'||receipt.token!==state.pendingToken.token)throw Error(receipt.error||'Hasil pengiriman belum dapat dipastikan. Periksa nomor permintaan sebelum mencoba kembali.');}

   // Retain the draft and receipt in the device backup, but do not offer it for duplicate submission.
   if(row?.status==='draft')await storeDraft({...row,sentReceipt:receipt});
   await refresh(false);notify('Server menerima usulan. Status persetujuan mengikuti keputusan kurikulum.');
  }else{
   await storeDraft({...proposal,id:row?.id||state.formId,status:'draft',revision:(row?.revision||0)+1,origin:'Perangkat ini',saved_at:new Date().toISOString()});notify('Draf tersimpan di perangkat ini. Belum dikirim atau disetujui.');
  }
  $('#clinic-dialog').close();state.tab='requests';render();
 }catch(err){$('#clinic-form-error').textContent=err.message}finally{state.busy=false;buttons.forEach(b=>b.disabled=b.id==='clinic-send'&&!CLINIC_REMOTE_ENABLED)}
};
async function refresh(manual=false){
 if(!CLINIC_REMOTE_ENABLED){if(manual)notify('Integrasi server belum diaktifkan. Draf dan arsip perangkat tetap tersedia.');return}
 try{
  const owner=access.context.user_id;if(state.owner!==owner)state.remote=[];state.owner=owner;
  const [feed,mine]=await Promise.all([api.read(),access.has('teacher')&&state.owner?api.read({mode:access.has('reviewer')?'review':'mine',owner:state.owner}):null]);state.feed=feed.rows;state.remote=mine?.rows||[];if(mine)state.teachers=mine.teachers;render();
 }catch{notify('Data server belum berhasil diperbarui. Catatan terakhir tetap ditampilkan; jangan kirim ulang sebelum memeriksa hasil.');}
}
function backup(){try{const content=JSON.stringify({exported_at:new Date().toISOString(),year:YEAR,drafts_raw:localStorage.getItem(KEY),legacy_raw:localStorage.getItem('maicn_klinik_bookings')},null,2),url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cadangan-klinik-'+todayWIB()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{notify('Cadangan belum berhasil dibuat. Penyimpanan tidak diubah.')}}
function printReport(){
 const rows=archiveRows();if(!rows.length)return;
 const report=$('#clinic-print-report'),f=state.filters;
 report.innerHTML=`<h1>Laporan Arsip Klinik Pembelajaran</h1><p>Curriculum · ${YEAR}</p><p>Periode: ${esc(f.from||'Semua tanggal')} s.d. ${esc(f.to||todayWIB())} · ${esc(f.classroom||'Semua kelas')} · ${esc(labels[f.status]||'Semua status')}</p><p>Dicetak ${esc(new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB · ${rows.length} catatan</p><table><thead><tr><th>Tanggal / sesi</th><th>Kelas / pengampu</th><th>Mapel & status</th><th>Catatan / bukti</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(dateLabel(r.date))}<br>${r.start}–${r.end} WIB</td><td>${esc(r.classroom)}<br>${esc(r.teacher)}</td><td>${esc(r.approved_subject||r.subjects.join(' / '))}<br>${esc(labels[r.status])}${r.status==='legacy'?` (${esc(r.legacyStatus)}, belum diverifikasi)`:''}<br>Asal: ${esc(r.origin)} · Revisi ${r.revision}</td><td>${esc(r.topic)}<br>${esc(r.evidence)}<br>${esc(r.decision_note||'')}</td></tr>`).join('')}</tbody></table><p>Catatan lama dan draf perangkat bukan persetujuan server. Laporan ini mencatat penjadwalan dan tindak lanjut, bukan bukti kelulusan peserta.</p>`;
 let preview=$('#clinic-print-preview');if(!preview){preview=document.createElement('dialog');preview.id='clinic-print-preview';preview.className='monday-info-dialog';preview.setAttribute('aria-label','Pratinjau laporan klinik');document.body.append(preview)}
 preview.innerHTML=`<h2>Pratinjau laporan</h2><p>${rows.length} catatan · ${esc(f.from||'Semua tanggal')} s.d. ${esc(f.to||todayWIB())} · ${esc(f.classroom||'Semua kelas')}</p><p>Status dan asal data disertakan agar draf atau catatan lama tidak terbaca sebagai persetujuan baru.</p><div class="clinic-print-preview-list">${rows.map(r=>`<article><h3>${esc(r.approved_subject||r.subjects.join(' / '))}</h3><p>${esc(dateLabel(r.date))} · ${r.classroom} · ${esc(labels[r.status])}</p><p>${esc(r.teacher)} · ${esc(r.origin)}</p></article>`).join('')}</div><div class="clinic-row"><button type="button" id="clinic-print-preview-close" class="ui-button ui-button-secondary">Kembali</button><button type="button" id="clinic-print-confirm" class="ui-button ui-button-primary">Cetak / simpan PDF</button></div>`;
 $('#clinic-print-preview-close').onclick=()=>preview.close();$('#clinic-print-confirm').onclick=()=>{preview.close();document.body.classList.add('clinic-printing');window.print()};preview.showModal();
}
window.addEventListener('afterprint',()=>document.body.classList.remove('clinic-printing'));
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){if($('#clinic-dialog').open){notify('Draf berubah di tab lain. Isian terbuka tetap dipertahankan; muat ulang sebelum menyimpan.')}else try{loadDrafts();render()}catch(err){state.storageOK=false;notify(err.message)}}});
// Recompute archive boundaries while the page remains open and on mobile wake-up.
setInterval(()=>{if(!$('#clinic-dialog').open&&!root.contains(document.activeElement))render()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#clinic-dialog').open){render();refresh()}});
render();refresh();
access.subscribe(next=>{if(next.user_id!==state.owner||next.role!==initialRole)location.reload()});

async function setupChallenge(){
 if(access.has('teacher')||!CLINIC_REMOTE_ENABLED||!config.clinic_enabled||!config.turnstile_site_key)return;
 if(!window.turnstile){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=resolve;script.onerror=reject;document.head.append(script)})}
 if(challengeWidget===null)challengeWidget=window.turnstile.render('#clinic-challenge',{sitekey:config.turnstile_site_key,action:'clinic_request',callback:token=>{challenge=token},'expired-callback':()=>{challenge=''},'error-callback':()=>{challenge=''}});
}

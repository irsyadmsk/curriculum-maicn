import {requestJSON} from './curriculum-api.mjs';
import {CLINIC_REMOTE_ENABLED,YEAR,CLASSES,SLOTS,todayWIB,addDays,monday,slotFor,dateLabel,archived,legacyRecords,validateProposal,validateRequest,safeURL,inSchoolYear,validSession,validAudience} from './clinic-core.mjs';
import {clinicClient} from './clinic-client.mjs';
import {accessReady,access} from './curriculum-access.mjs';
import {classroomLabel,effectiveParticipants} from './clinic-intake-core.mjs';
import {intakeCatalog,mountIntake} from './clinic-intake-form.mjs';
import {checkForm,prepareForm,formError} from './form-feedback.mjs';
import {sendPending,lockInputs,showReceipt,verificationGate} from './submission-flow.mjs';
await accessReady;
const initialRole=access.context.role;
let config={clinic_enabled:false,turnstile_site_key:''},configPromise,gate;
function loadConfig(){return configPromise??=requestJSON('/api/config').then(value=>config=value).catch(error=>{configPromise=null;throw error})}
loadConfig().catch(()=>{});
const $ = s => document.querySelector(s), esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='maicn_clinic_drafts_v2_2026-2027_'+(access.context.user_id||'guest');
const receiptStates=new Map();
const state={week:monday(todayWIB()),tab:new URLSearchParams(location.search).get('view')==='requests'?'requests':'schedule',drafts:[],legacy:[],remote:[],feed:[],teachers:CLINIC_REMOTE_ENABLED?[]:window.MASTER_DATA?.jadwal_kbm_v2?.matriks_guru||[],raw:null,storageOK:true,owner:access.context.user_id,editing:null,expected:null,busy:false,notice:'',filters:{from:'',to:'',classroom:'',status:''}};
const api=clinicClient(window.CurriculumClinicProxy);
const labels={draft:'Draf · belum dikirim',unconfirmed:'Pengiriman belum dipastikan',pending:'Menunggu konfirmasi',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan',legacy:'Catatan lama'};
const root=$('#clinic-root');
function loadDrafts(){
  const raw=localStorage.getItem(KEY), parsed=raw===null?[]:JSON.parse(raw);
  if(!Array.isArray(parsed)||parsed.length>5000||new Set(parsed.map(r=>r?.id)).size!==parsed.length||parsed.some(r=>!r||typeof r.id!=='string'||r.status!=='draft'||!Number.isSafeInteger(r.revision)||typeof r.date!=='string'||typeof r.teacher!=='string'||typeof r.topic!=='string'||typeof r.evidence!=='string'||!Array.isArray(r.subjects)||r.subjects.some(s=>typeof s!=='string'||s.length>120)||(r.draft_version!==1&&(!slotFor(r.date)||!validSession(r)||!validAudience(r)||!r.subjects.length||r.subjects.some(s=>!s.trim())))))throw Error('Draf perangkat tidak dapat dibaca. Data asli dipertahankan; unduh cadangan sebelum pemulihan.');
  state.raw=raw;state.drafts=parsed;
}
try{loadDrafts()}catch(e){state.storageOK=false;state.notice=e.message}
if(access.has('reviewer')){try{await new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>reject(Error('Catatan lama terlalu lama dimuat.')),8000);script.src='assets/clinic-legacy-data.js';script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);reject(Error('Catatan lama belum tersedia.'))};document.head.append(script)})}catch{state.notice='Catatan sumber lama belum dapat dibaca. Data perangkat tetap dipertahankan.'}}
try{
 const raw=access.has('reviewer')?localStorage.getItem('maicn_klinik_bookings'):null;
 state.legacy=access.has('reviewer')?legacyRecords(raw===null?(window.MAICN_CLINIC_LEGACY||[]):JSON.parse(raw),raw===null?'Sumber awal situs':'Browser lama'):[];
}catch{state.notice+=' Catatan lama belum dapat dibaca. Isi aslinya tetap dipertahankan.'}
function ownRequests(){return state.drafts.map(r=>receiptStates.get(r.id)?.found?{...r,...receiptStates.get(r.id),localReceipt:false,origin:'Bukti server'}:state.remote.find(v=>v.id===r.id)||state.feed.find(v=>v.id===r.id)||(r.sentReceipt?{...r,status:'pending',localReceipt:true,origin:'Bukti penerimaan server'}:r.pendingReceipt?{...r,status:'unconfirmed',localReceipt:true,origin:'Perangkat ini'}:r))}
function records(){
 const rem=new Map(state.feed.map(r=>[r.id,r]));state.remote.forEach(r=>rem.set(r.id,r));
 return [...rem.values(),...ownRequests().filter(r=>!rem.has(r.id)),...state.legacy];
}
function notify(message){state.notice=message;const n=$('#clinic-notice');if(n){n.textContent=message;n.hidden=!message}}
function recordCard(r){
 const url=safeURL(r.evidence), ended=archived(r);
 return `<article class="clinic-record" data-status="${esc(r.status)}"><div class="clinic-row"><span class="clinic-badge ${r.status==='approved'?'clinic-approved':''}">${esc(labels[r.status]||r.status)}</span><span class="clinic-muted">${esc(classroomLabel(r))}</span></div><h3>${esc(r.approved_subject||r.subjects.join(' / ')||'Mapel belum tercatat')}</h3><p>${esc(r.teacher||'Pengampu belum tercatat')}</p>${state.tab==='schedule'?'':`<p class="clinic-muted">${esc(dateLabel(r.date))} · ${esc(r.start)}–${esc(r.end)} WIB</p>`}${(r.participant_ids?.length||r.participant_count)?`<p class="clinic-muted">${r.participant_ids?effectiveParticipants(r).length:r.participant_count} peserta · ${r.target_mode==='class'?'satu kelas':'per murid'}</p>`:''}${r.topic?`<p class="clinic-note">${esc(r.topic)}</p>`:''}${r.localReceipt?`<small>${r.sentReceipt?'Server sudah menerima ajuan. Periksa status terbaru sebelum mengirim ulang.':'Belum ada kepastian diterima server. Ajuan ini belum masuk antrean admin.'}</small>`:''}${r.submissionError?`<p class="clinic-feedback">Belum terkirim: ${esc(r.submissionError)}</p>`:''}${r.status==='legacy'?`<small>Status tersimpan: ${esc(r.legacyStatus)} · ${esc(r.origin)}. Persetujuan server belum diverifikasi.</small>`:''}${r.decision_note?`<p class="clinic-note">Keputusan: ${esc(r.decision_note)}</p>`:''}${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Buka bukti ↗</a>`:r.evidence?`<p class="clinic-muted">Bukti lama: ${esc(r.evidence)}</p>`:''}${['draft','unconfirmed'].includes(r.status)?`<button type="button" data-edit="${esc(r.id)}">${ended?'Lihat draf terdahulu':r.status==='unconfirmed'?'Periksa & lanjutkan pengiriman':'Lanjutkan draf'}</button>`:''}${r.origin==='Server'&&state.owner&&state.remote.some(v=>v.id===r.id)?`<div class="clinic-row">${!ended&&r.status==='pending'?`<button type="button" data-remote-edit="${esc(r.id)}">Edit usulan</button>`:''}<button type="button" data-report="${esc(r.id)}">Catatan laporan</button></div>`:''}</article>`;
}
function render(){
 const all=records(), ended=all.filter(r=>archived(r));
 root.innerHTML=`<section class="clinic-intro"><div><p class="ui-eyebrow">KLINIK PEMBELAJARAN · ${YEAR}</p><h2>Belajar lebih terarah.</h2><p>Ajukan kelas atau murid pilihan. Kurikulum menentukan jadwal resmi.</p></div><div class="clinic-intro-actions"><button type="button" class="ui-button ui-button-primary" id="clinic-new">+ Ajukan klinik</button><button type="button" class="ui-button" data-open-teacher-help="clinic">Cara mengajukan</button><a class="ui-button ui-button-secondary" data-needs="reviewer" href="kurikulum.html#clinic">Tinjau ajuan</a></div></section>
 <div class="clinic-summary"><div><span>Sesi 01</span><strong>Senin malam</strong><span>20.30–21.30 WIB</span></div><div><span>Sesi 02</span><strong>Selasa sore</strong><span>16.15–17.00 WIB</span></div><div class="clinic-summary-help"><strong>Baru pertama mengajukan?</strong><span>Pilih nama → peserta → Kirim ajuan.</span><button type="button" data-open-teacher-help="status">Pahami status ajuan →</button></div></div>
 <p class="clinic-connection">${CLINIC_REMOTE_ENABLED?'Pengajuan tanpa login. Bukti opsional. Simpan nomor ajuan setelah berhasil dikirim.':'Pengiriman belum aktif. Draf tetap dapat disimpan di perangkat.'}</p>
 <p id="clinic-notice" class="clinic-feedback" role="status" ${state.notice?'':'hidden'}>${esc(state.notice)}</p>
 <div class="clinic-tabs" role="group" aria-label="Tampilan klinik"><button data-tab="schedule" aria-pressed="${state.tab==='schedule'}">Jadwal</button><button data-tab="requests" aria-pressed="${state.tab==='requests'}">${access.has('teacher')?'Usulan & laporan':'Permintaan saya'} <span>${new Set([...ownRequests().map(r=>r.id),...state.remote.map(r=>r.id)]).size}</span></button>${access.has('teacher')?`<button data-tab="archive" aria-pressed="${state.tab==='archive'}">Arsip & laporan <span>${ended.length}</span></button>`:''}</div>
 <section id="clinic-view" aria-label="${state.tab==='archive'?'Arsip klinik':'Daftar klinik'}"></section>
 <details class="clinic-help"><summary>Cara pengisian & penyimpanan data</summary><ol><li>Pilih tanggal Senin/Selasa, kelas, dan pengampu.</li><li>${access.has('teacher')?'Mapel terisi sesuai pengampu: satu guru, satu mapel. Tuliskan kebutuhan belajarnya.':'Pilih satu mapel dan murid yang memerlukan klinik.'}</li><li>Simpan draf, lalu kirim ketika integrasi aktif. Hanya admin atau pengelola kurikulum yang ditunjuk dapat menyetujui satu mapel.</li><li>Begitu sesi berakhir dalam WIB, catatan otomatis tampil di arsip. Filter dan cetak kapan saja.</li></ol><p>Draf perangkat belum terkirim. Catatan lama tetap dipertahankan beserta status asalnya; tidak dianggap sebagai persetujuan server baru.</p><button type="button" data-needs="teacher" id="clinic-backup">Unduh cadangan perangkat</button></details>`;
 $('#clinic-new').onclick=()=>openForm();
 root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
 $('#clinic-backup').onclick=backup;
 $('#clinic-notice').insertAdjacentHTML('afterend','<div id="clinic-receipt"></div>');
 showReceipt($('#clinic-receipt'),state.receipt,{summary:state.receiptSummary,volatile:state.deviceReceiptOnly,onCheck:()=>refresh(true)});
 renderView();
}
function renderView(){
 const target=$('#clinic-view'),all=records();
 target.dataset.needs=access.has('teacher')&&state.tab!=='schedule'?'teacher':'public';
 if(state.tab==='schedule'){
  target.innerHTML=`<div class="clinic-date-nav"><button type="button" id="clinic-prev" aria-label="Pekan sebelumnya">←</button><label>Pekan mulai<input id="clinic-week" type="date" value="${state.week}"></label><button type="button" id="clinic-next" aria-label="Pekan berikutnya">→</button><button type="button" id="clinic-today">Pekan ini</button></div><p class="clinic-muted">${esc(dateLabel(state.week))} – ${esc(dateLabel(addDays(state.week,6)))} · WIB</p><div id="clinic-sessions" class="clinic-sessions">${SLOTS.map((s,i)=>{
   const date=addDays(state.week,i),end=archived({date,end:s.end}),within=inSchoolYear(date);
   return `<section class="clinic-session"><header><div><p class="ui-eyebrow">${esc(s.name)} · ${!within?'Di luar tahun pelajaran':end?'Sesi berakhir':'Sesi mendatang'}</p><h3>${esc(dateLabel(date))}</h3><p>${s.start}–${s.end} WIB</p></div>${!end&&within?`<button type="button" data-date="${date}">Ajukan sesi ini</button>`:`<span class="clinic-badge">${within?'Tersimpan di arsip':'Di luar tahun pelajaran'}</span>`}</header><div class="clinic-class-grid">${CLASSES.map(c=>{const rows=all.filter(r=>r.date===date&&r.classroom===c&&r.status==='approved');return `<div><h4>Kelas ${c}</h4>${rows.length?rows.map(recordCard).join(''):'<p class="clinic-empty">Belum ada klinik yang disetujui.</p>'}</div>`}).join('')}</div>${(()=>{const named=all.filter(r=>r.date===date&&r.status==='approved'&&!r.classroom);return named.length?`<section class="clinic-per-student-box"><h4>Klinik per murid · lintas kelas</h4>${named.map(recordCard).join('')}</section>`:''})()}</section>`;
  }).join('')}</div>`;
  $('#clinic-prev').onclick=()=>{state.week=addDays(state.week,-7);renderView()};$('#clinic-next').onclick=()=>{state.week=addDays(state.week,7);renderView()};$('#clinic-today').onclick=()=>{state.week=monday(todayWIB());renderView()};$('#clinic-week').onchange=e=>{if(e.target.value){state.week=monday(e.target.value);renderView()}};
  target.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>openForm(null,b.dataset.date));
 }else if(state.tab==='requests'){
  const mine=[...ownRequests().filter(r=>!state.remote.some(v=>v.id===r.id)),...state.remote].sort((a,b)=>a.date.localeCompare(b.date));
  target.innerHTML=`<div class="clinic-section-title"><div><h2>${access.has('teacher')?'Usulan & laporan saya':'Permintaan perangkat ini'}</h2><p>Draf dan bukti pengiriman dari perangkat ini. Keputusan untuk ajuan guru dikirim lewat email.</p></div><button type="button" id="clinic-refresh">Periksa server</button></div>${mine.length?`<div class="clinic-record-grid">${mine.map(recordCard).join('')}</div>`:'<p class="clinic-empty">Belum ada usulan. Mulai dengan tombol “Ajukan klinik”.</p>'}`;
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
function archiveRows(){const f=state.filters;return records().filter(r=>archived(r)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!f.classroom||r.classroom===f.classroom||r.scope_classrooms?.includes(f.classroom))&&(!f.status||r.status===f.status)).sort((a,b)=>b.date.localeCompare(a.date)||String(a.classroom||'').localeCompare(String(b.classroom||'')));}
function renderArchive(){const rows=archiveRows(),bad=state.filters.from&&state.filters.to&&state.filters.from>state.filters.to;$('#clinic-archive-list').innerHTML=bad?'<p class="clinic-feedback">Tanggal akhir harus sesudah tanggal awal.</p>':`<p class="clinic-muted">${rows.length} catatan sesuai filter</p>${rows.length?`<div class="clinic-record-grid">${rows.map(recordCard).join('')}</div>`:'<p class="clinic-empty">Tidak ada arsip sesuai filter.</p>'}`;$('#clinic-print').disabled=false;$('#clinic-print').title=bad?'Perbaiki rentang tanggal sebelum mencetak.':!rows.length?'Belum ada catatan sesuai filter.':'Cetak atau simpan laporan sebagai PDF.';bindRecordActions($('#clinic-archive-list'));}
function defaultDate(){let d=todayWIB();for(let n=0;n<8;n++,d=addDays(d,1)){const s=slotFor(d);if(s&&!archived({date:d,end:s.end}))return d}return d}
let intakeForm,opening=false;
async function openForm(row=null,date=defaultDate(),report=false){
 if(state.busy||opening){notify('Permintaan sedang diproses. Tunggu sampai selesai.');return}
 opening=true;notify('Membuka formulir…');
 const form=$('#clinic-form'),dialog=$('#clinic-dialog');
 intakeForm?.clear();intakeForm=null;gate?.dispose();gate=null;
 form.innerHTML='<p role="status">Memuat daftar guru dan murid…</p><button type="button" data-loading-cancel>Tutup</button>';form.querySelector('[data-loading-cancel]').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();
 try{
 const [catalog]=await Promise.all([intakeCatalog(),loadConfig()]);if(!dialog.open)return;
 if(row?.pendingReceipt&&!row.sentReceipt){const check=await requestJSON('/api/clinic/receipt',{body:{id:row.id,token:row.pendingReceipt.token}});receiptStates.set(row.id,check);if(check.found){dialog.close();render();notify('Ajuan ini sudah diterima server. Status terbaru ditampilkan; tidak perlu mengirim ulang.');return}}
 state.editing=row;state.expected=state.raw;state.formId=row?.id||crypto.randomUUID();state.pendingToken=row?.pendingReceipt?{token:row.pendingReceipt.token,signature:null}:null;
 form.dataset.report=report?'true':'false';
 intakeForm=mountIntake(form,catalog,{row,date,report,teacherDefault:access.context.teacher_code});
 prepareForm(form);
 $('#clinic-form-title').textContent=report?'Catatan laporan':'Ajukan klinik';
 const ended=row&&archived(row);
 $('#clinic-schedule-fields').disabled=report||!!ended;$('#clinic-report-fields').disabled=!!ended&&!report;
 $('#clinic-save-draft').hidden=report||row?.origin==='Server'||!!ended;
 $('#clinic-send').hidden=!!ended&&!report;$('#clinic-send').disabled=false;$('#clinic-send').setAttribute('aria-disabled',String(!config.clinic_v2_enabled));
 $('#clinic-form-error').textContent=!config.clinic_v2_enabled?'Pengiriman belum diaktifkan. Anda dapat mengisi dan menyimpan draf.':row?.pendingReceipt&&!row.sentReceipt?'Nomor ini belum ditemukan di server. Lengkapi isian dan kirim kembali memakai nomor yang sama.':'Pilih nama pengaju dan peserta, bukti boleh menyusul; selesaikan verifikasi permintaan untuk mengirim.';
 $('#clinic-cancel').onclick=closeForm;$('#clinic-date').onchange=updateSlot;
 updateSlot();
 if(!report&&row?.origin!=='Server'){gate=verificationGate($('#clinic-challenge'),{sitekey:config.turnstile_site_key,action:'clinic_request',onStatus:message=>{if($('#clinic-form-error'))$('#clinic-form-error').textContent=message}});gate.mount().catch(error=>{const output=$('#clinic-form-error');if(output)output.textContent=error.message})}
 notify('');
 }catch(error){form.innerHTML=`<p role="alert">${esc(error.message)}</p><button type="button" data-form-retry>Coba lagi</button><button type="button" data-loading-cancel>Tutup</button>`;form.querySelector('[data-form-retry]').onclick=()=>openForm(row,date,report);form.querySelector('[data-loading-cancel]').onclick=()=>dialog.close();notify('Formulir belum dapat dimuat. Coba lagi dari kotak formulir.')}finally{opening=false}
}
function updateSlot(event){const s=slotFor($('#clinic-date').value);if(s){if(event?.target?.id==='clinic-date'){ $('#clinic-start').value=s.start;$('#clinic-end').value=s.end}$('#clinic-start').min=s.start;$('#clinic-start').max=s.end;$('#clinic-end').min=s.start;$('#clinic-end').max=s.end}$('#clinic-slot-info').textContent=s?`${s.name} · ${s.start}–${s.end} WIB`:'Pilih hari Senin atau Selasa.';const summary=$('#clinic-schedule-summary');if(summary)summary.textContent=s?`${s.name} · ${$('#clinic-date').value} · ${$('#clinic-start').value}–${$('#clinic-end').value} WIB`:'Pilih tanggal sesi';}
function closeForm(){if(state.busy){formError($('#clinic-form'),$('#clinic-form-error'),'Permintaan sedang diproses. Tunggu hasilnya agar nomor ajuan tetap dapat diperiksa.');return}savePartial();gate?.dispose();$('#clinic-dialog').close();intakeForm?.clear();intakeForm=null;render()}
$('#clinic-dialog-close').onclick=closeForm;
$('#clinic-dialog').addEventListener('cancel',event=>{event.preventDefault();closeForm()});
let saveTimer;
async function savePartial(force=false){if(!intakeForm||state.pendingToken||state.editing?.origin==='Server'||$('#clinic-form').dataset.report==='true')return;const draft=intakeForm.draft();if(force!==true&&!draft.requester_id&&!draft.topic&&!draft.participant_ids.length)return;const row={...draft,id:state.formId,status:'draft',revision:(state.editing?.revision||0)+1,origin:'Perangkat ini',saved_at:new Date().toISOString()};await storeDraft(row,{submission:true});state.editing=row;}
$('#clinic-form').addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!state.busy)savePartial()},500)});
window.addEventListener('pagehide',savePartial);window.addEventListener('curriculum-before-account-change',savePartial);
async function storeDraft(row,{submission=false}={}){
 const {identity_photo,photo_mime,...safe}=row;row=safe;
 const write=()=>{
  if(!state.storageOK)throw Error('Penyimpanan belum dapat dibaca. Cadangkan data sebelum melanjutkan.');
  if(localStorage.getItem(KEY)!==state.expected)throw Error('Draf berubah di tab lain. Tutup formulir dan muat ulang sebelum menyimpan.');
  const next=state.drafts.filter(r=>r.id!==row.id).concat(row),raw=JSON.stringify(next);localStorage.setItem(KEY,raw);state.raw=raw;state.expected=raw;state.drafts=next;
 };
 // Device drafts are optional for sending. Keep the same receipt in memory if
 // storage is blocked/full or changed in another tab; never overwrite that data.
 if(submission){try{write()}catch{state.drafts=state.drafts.filter(r=>r.id!==row.id).concat(row);state.deviceReceiptOnly=true}return}
 if(navigator.locks?.request)await navigator.locks.request(KEY,{ifAvailable:true},lock=>{if(!lock)throw Error('Draf sedang disimpan di tab lain. Coba lagi.');write()});else write();
}
// Mobile/in-app browsers may omit submitter; preserve the clicked action.
$('#clinic-form').addEventListener('click',e=>{const button=e.target.closest('button[type="submit"]');if(button)e.currentTarget.dataset.submitAction=button.id});
$('#clinic-form').onsubmit=async e=>{
 e.preventDefault();const form=e.currentTarget;if(state.busy)return;const send=(e.submitter?.id||form.dataset.submitAction||'clinic-send')!=='clinic-save-draft',report=form.dataset.report==='true';delete form.dataset.submitAction;
 if(send&&!checkForm(form,$('#clinic-form-error')))return;
 state.busy=true;$('#clinic-form-error').textContent='';let row=state.editing;
 const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 const sendButton=$('#clinic-send');let unlock=()=>{};if(send)sendButton.textContent='Memeriksa ajuan…';
 try{
  if(!send){await savePartial(true);notify(state.deviceReceiptOnly?'Draf tersimpan sementara di halaman ini. Penyimpanan perangkat tidak tersedia; lanjutkan tanpa menutup halaman.':'Draf tersimpan di perangkat. Belum dikirim ke kurikulum.');gate?.dispose();$('#clinic-dialog').close();intakeForm?.clear();intakeForm=null;state.tab='requests';render();return}
  if(!config.clinic_v2_enabled)throw Error('Pengiriman belum aktif. Isian tetap dapat disimpan sebagai draf.');
  let challenge='';if(!report&&row?.origin!=='Server'){const raw=intakeForm.draft(),intake=intakeForm.read();(intake.request_kind==='teacher'?validateProposal:validateRequest)({...raw,...intake});sendButton.textContent='Memverifikasi…';await savePartial();challenge=await gate.wait();if(!checkForm(form,$('#clinic-form-error')))return}
  // Read only after verification: edits made while waiting are part of this snapshot.
  const date=$('#clinic-date').value,s=slotFor(date);
  const intake=report?null:intakeForm.read({photoRequired:false});
  const base={date,intake_version:2,start:$('#clinic-start').value,end:$('#clinic-end').value,classroom:$('#clinic-class').value,...intake,topic:$('#clinic-topic').value};
  const proposal=report?{topic:$('#clinic-topic').value.trim(),evidence:$('#clinic-evidence').value.trim()}:{...(intake.request_kind==='teacher'?validateProposal:validateRequest)(base),...intake,intake_version:2};
  if(report&&proposal.evidence&&!safeURL(proposal.evidence))throw Error('Periksa tautan bukti.');
  unlock=lockInputs(form);
  if(send){
   if(!config.clinic_v2_enabled)throw Error('Pengiriman alur baru menunggu aktivasi pengelola.');
   if(!report&&row?.origin!=='Server'){
    row={...proposal,id:row?.id||state.formId,status:'draft',revision:(row?.revision||0)+1,origin:'Perangkat ini',saved_at:new Date().toISOString()};
    await storeDraft(row,{submission:true});state.editing=row;state.expected=state.raw;
   }
   const action=report?'report':row?.origin==='Server'?'edit':'submit',signature=JSON.stringify([row.id,row?.origin==='Server'?row.revision:0,action,proposal]);
   if(state.pendingToken&&state.pendingToken.signature!==null&&state.pendingToken.signature!==signature)throw Error('Hasil pengiriman sebelumnya belum dipastikan. Periksa server sebelum mengubah dan mengirim ulang.');
   state.pendingToken??={signature,token:crypto.randomUUID()};state.pendingToken.signature??=signature;
   if(!report&&row?.origin!=='Server')await storeDraft({...row,pendingReceipt:{id:row.id,token:state.pendingToken.token}},{submission:true});
   sendButton.textContent='Mengirim ajuan…';
   let receipt;
   if(report||row?.origin==='Server')receipt=await api.write({owner:state.owner,action,id:row.id,revision:row?.origin==='Server'?row.revision:0,data:proposal,token:state.pendingToken.token});
   else{
    if(!challenge)throw Error('Verifikasi kedaluwarsa. Tekan Kirim ajuan lagi untuk memperbaruinya.');
    try{receipt=await sendPending('/api/clinic/request',{id:row.id,token:state.pendingToken.token,data:proposal,challenge})}
    catch(error){if(error.definitive){await storeDraft({...row,pendingReceipt:undefined,submissionError:error.message},{submission:true});state.pendingToken=null}throw error}
    finally{gate?.reset()}
   }

   // Retain the draft and receipt in the device backup, but do not offer it for duplicate submission.
   if(row?.status==='draft')await storeDraft({...row,sentReceipt:receipt},{submission:true});
   if(!report){state.receipt=receipt;state.receiptSummary=proposal.subjects?.join(' / ')+' · '+proposal.date+' · '+(proposal.classroom||'Per murid')}
   notify('Server menerima usulan. Keputusan mengikuti kurikulum.');refresh(false);
  }
  gate?.dispose();intakeForm?.clear();intakeForm=null;$('#clinic-dialog').close();state.tab='requests';render();
 }catch(err){formError($('#clinic-form'),$('#clinic-form-error'),err.message)}finally{unlock();state.busy=false;buttons.forEach(b=>b.disabled=false);sendButton.textContent='Kirim ajuan'}
};
async function refresh(manual=false){
 if(!CLINIC_REMOTE_ENABLED){if(manual)notify('Integrasi server belum diaktifkan. Draf dan arsip perangkat tetap tersedia.');return}
 try{
  const owner=access.context.user_id;if(state.owner!==owner)state.remote=[];state.owner=owner;
  const [feed,mine]=await Promise.all([api.read(),access.has('teacher')&&state.owner?api.read({mode:access.has('reviewer')?'review':'mine',owner:state.owner}):null]);state.remoteLoaded=true;state.feed=feed.rows;state.remote=mine?.rows||[];if(mine)state.teachers=mine.teachers;render();await Promise.all(state.drafts.filter(r=>r.sentReceipt?.token||r.pendingReceipt?.token).map(async r=>{try{const check=await requestJSON('/api/clinic/receipt',{body:{id:r.id,token:r.sentReceipt?.token||r.pendingReceipt.token}});receiptStates.set(r.id,check);if(check.found&&state.receipt?.id===r.id)state.receipt={...state.receipt,...check}}catch{/* A failed check never resets the receipt or authorizes a duplicate. */}}));if(receiptStates.size)render();
  }catch{notify(state.receipt?'Ajuan sudah diterima. Pembaruan daftar terkendala; bukti penerimaan tetap berlaku.':'Data server belum berhasil diperbarui. Catatan terakhir tetap ditampilkan; periksa hasil sebelum mengirim ulang.');}
}
function backup(){try{const content=JSON.stringify({exported_at:new Date().toISOString(),year:YEAR,drafts_raw:localStorage.getItem(KEY),legacy_raw:localStorage.getItem('maicn_klinik_bookings')},null,2),url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cadangan-klinik-'+todayWIB()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{notify('Cadangan belum berhasil dibuat. Penyimpanan tidak diubah.')}}
function printReport(){
 const rows=archiveRows();if(state.filters.from&&state.filters.to&&state.filters.from>state.filters.to){notify('Tanggal akhir harus sesudah tanggal awal.');return}if(!rows.length){notify('Belum ada catatan sesuai filter untuk dicetak. Ubah periode atau status.');return}
 const report=$('#clinic-print-report'),f=state.filters;
 report.innerHTML=`<h1>Laporan Arsip Klinik Pembelajaran</h1><p>Curriculum · ${YEAR}</p><p>Periode: ${esc(f.from||'Semua tanggal')} s.d. ${esc(f.to||todayWIB())} · ${esc(f.classroom||'Semua kelas')} · ${esc(labels[f.status]||'Semua status')}</p><p>Dicetak ${esc(new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB · ${rows.length} catatan</p><table><thead><tr><th>Tanggal / sesi</th><th>Kelas / pengampu</th><th>Mapel & status</th><th>Catatan / bukti</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(dateLabel(r.date))}<br>${r.start}–${r.end} WIB</td><td>${esc(classroomLabel(r))}<br>${esc(r.teacher)}</td><td>${esc(r.approved_subject||r.subjects.join(' / '))}<br>${esc(labels[r.status])}${r.status==='legacy'?` (${esc(r.legacyStatus)}, belum diverifikasi)`:''}<br>Asal: ${esc(r.origin)} · Revisi ${r.revision}</td><td>${esc(r.topic)}<br>${esc(r.evidence)}<br>${esc(r.decision_note||'')}</td></tr>`).join('')}</tbody></table><p>Catatan lama dan draf perangkat bukan persetujuan server. Laporan ini mencatat penjadwalan dan tindak lanjut, bukan bukti kelulusan peserta.</p>`;
 let preview=$('#clinic-print-preview');if(!preview){preview=document.createElement('dialog');preview.id='clinic-print-preview';preview.className='monday-info-dialog';preview.setAttribute('aria-label','Pratinjau laporan klinik');document.body.append(preview)}
 preview.innerHTML=`<h2>Pratinjau laporan</h2><p>${rows.length} catatan · ${esc(f.from||'Semua tanggal')} s.d. ${esc(f.to||todayWIB())} · ${esc(f.classroom||'Semua kelas')}</p><p>Status dan asal data disertakan agar draf atau catatan lama tidak terbaca sebagai persetujuan baru.</p><div class="clinic-print-preview-list">${rows.map(r=>`<article><h3>${esc(r.approved_subject||r.subjects.join(' / '))}</h3><p>${esc(dateLabel(r.date))} · ${esc(classroomLabel(r))} · ${esc(labels[r.status])}</p><p>${esc(r.teacher)} · ${esc(r.origin)}</p></article>`).join('')}</div><div class="clinic-row"><button type="button" id="clinic-print-preview-close" class="ui-button ui-button-secondary">Kembali</button><button type="button" id="clinic-print-confirm" class="ui-button ui-button-primary">Cetak / simpan PDF</button></div>`;
 $('#clinic-print-preview-close').onclick=()=>preview.close();$('#clinic-print-confirm').onclick=()=>{preview.close();document.body.classList.add('clinic-printing');window.print()};preview.showModal();
}
window.addEventListener('afterprint',()=>document.body.classList.remove('clinic-printing'));
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){if($('#clinic-dialog').open){notify('Draf berubah di tab lain. Isian terbuka tetap dipertahankan; muat ulang sebelum menyimpan.')}else try{loadDrafts();render()}catch(err){state.storageOK=false;notify(err.message)}}});
// Recompute archive boundaries while the page remains open and on mobile wake-up.
setInterval(()=>{if(!$('#clinic-dialog').open&&!root.contains(document.activeElement))render()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#clinic-dialog').open){render();refresh()}});
render();refresh();
if(new URLSearchParams(location.search).get('ajukan')==='1'){const url=new URL(location.href);url.searchParams.delete('ajukan');history.replaceState(history.state,'',url);openForm()}
access.subscribe(next=>{if(next.user_id!==state.owner||next.role!==initialRole)location.reload()});


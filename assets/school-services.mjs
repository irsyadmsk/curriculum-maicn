import {mountIdentity} from './requester-identity.mjs';
import {accessReady,access} from './curriculum-access.mjs';
import {todayWIB,monday,addDays,slotFor} from './clinic-core.mjs';
import {KINDS,DAYS,validateRequest,statusLabel,usesClinicSession,nextSchoolSessionDate} from './school-workflow-core.mjs';
import {driveEvidence} from './clinic-intake-core.mjs';
import {browserSchoolClient} from './school-client.mjs';
import {checkForm,prepareForm,formError} from './form-feedback.mjs';
import {requestJSON} from './curriculum-api.mjs';
import {deviceStore,sendPending,lockInputs,showReceipt,verificationGate} from './submission-flow.mjs';
await accessReady;
const root=document.querySelector('#school-root'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),api=browserSchoolClient(),ctx=access.context,owner=ctx.user_id||'guest',pendingKey='maicn_school_pending_'+owner,receiptKey='maicn_school_receipts_'+owner;
const device=deviceStore(),draftKey='maicn_school_drafts_'+owner,acknowledged=new Set();
let requesterIdentity,gate,draftTimer;
let catalog={students:[],teachers:[],lessons:[],projects:[]},config={},busy=false,kind=new URLSearchParams(location.search).get('kind')||'switch';
if(!Object.hasOwn(KINDS,kind))kind='switch';
async function loadCatalog(){const [c,r]=await Promise.all([requestJSON('/api/school/catalog'),requestJSON('/api/config')]);catalog=c;config=r}
try{await loadCatalog()}catch(e){config.error=e.message}
root.innerHTML=`<nav class="school-tabs" aria-label="Layanan akademik"><a href="klinik.html">Klinik & pengayaan</a><a href="jurnal.html">Jurnal & arsip A4</a><a href="ruang-guru.html" data-needs="teacher" data-access-fixed="true">Ruang guru</a><a href="kurikulum.html" data-needs="reviewer">Ruang kurikulum</a></nav><div class="school-layout"><section class="school-panel" id="ajukan"><h2>Ajukan layanan akademik</h2><p>Keputusan ditetapkan admin atau kurikulum. Switch hanya berlaku pada pekan yang dipilih.</p><label>Jenis ajuan<select id="school-kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><p id="school-notice" class="school-notice" role="status"></p><div class="school-actions"><button type="button" id="school-restore">Pulihkan ajuan belum dipastikan</button></div><div id="school-form-host"></div></section><section class="school-panel"><h2>Ajuan saya</h2><p>${ctx.user_id?'Status yang dibaca dari server untuk akun Anda.':'Bukti pengiriman perangkat ini. Jadwal resmi hanya muncul setelah diterima.'}</p><div class="school-actions"><button id="school-refresh" type="button">Periksa status</button></div><div id="school-own"></div></section></div>`;
const $=s=>root.querySelector(s),notice=text=>$('#school-notice').textContent=text;
$('#school-notice').insertAdjacentHTML('afterend','<button type="button" id="school-retry">Muat ulang daftar</button>');$('#school-retry').hidden=!config.error;$('#school-retry').onclick=async()=>{if(busy)return notice('Tunggu proses pengiriman selesai.');saveDraft();$('#school-retry').textContent='Memuat…';try{await loadCatalog();renderForm();$('#school-retry').hidden=true}catch(error){notice(error.message)}finally{$('#school-retry').textContent='Muat ulang daftar'}};
$('#school-own').insertAdjacentHTML('beforebegin','<div id="school-receipt"></div><button type="button" id="school-new" hidden>Buat ajuan baru</button>');$('#school-new').onclick=()=>{if(busy)return notice('Tunggu proses pengiriman selesai.');renderForm({useDraft:false});$('#school-form').scrollIntoView({block:'start'})};
try{$('#school-restore').hidden=!device.read(pendingKey)}catch(error){notice(error.message)}
$('#school-kind').value=kind;$('#school-kind').onchange=e=>{if(busy){e.target.value=kind;notice('Ajuan sedang diproses. Tunggu hasilnya sebelum mengganti layanan.');return}saveDraft();kind=e.target.value;renderForm()};$('#school-refresh').onclick=loadMine;$('#school-restore').onclick=()=>{if(busy)return notice('Tunggu proses pengiriman selesai.');restore()};
function renderForm({useDraft=true}={}){
 requesterIdentity?.clear();
 gate?.dispose();gate=null;
 const remedial=kind==='remedial',isStudent=ctx.role==='student',linkedStudent=remedial&&isStudent?catalog.students.find(s=>s.id===ctx.student_id):null;
 const needsLogin=remedial&&!access.has('school'),needsLink=remedial&&isStudent&&!linkedStudent,blocked=needsLogin||needsLink;
 const sharedSlot=usesClinicSession(kind),defaultDate=sharedSlot?nextSchoolSessionDate():todayWIB();
 const returnTo='/akun.html?next='+encodeURIComponent('/layanan.html?kind=remedial');
 $('#school-form-host').innerHTML=`<p ${needsLogin?'':'hidden'}>Remedial memerlukan akun sekolah. <a href="${returnTo}">Masuk ke Curriculum</a></p><p ${needsLink?'':'hidden'}>Akun murid belum terhubung ke daftar kelas. Hubungi admin Curriculum untuk menautkan akun.</p><form id="school-form" ${blocked?'hidden':''}><fieldset id="school-fields">
 <label>${kind==='project'?'Nama kegiatan kokurikuler · isi sendiri':'Judul / keperluan'}<input id="school-title" maxlength="200" required placeholder="${kind==='project'?'Tulis nama kegiatan yang ingin diajukan':KINDS[kind]}" ${kind==='project'?'list="school-project-ideas"':''}></label><datalist id="school-project-ideas"><option value="Praktik haji"><option value="Kewirausahaan"><option value="Aksi lingkungan"></datalist>
 <div id="school-requester"></div>
 <label id="school-teacher-label">Guru / pengampu<select id="school-teacher"><option value="">Pilih guru</option>${catalog.teachers.map(t=>`<option value="${esc(t.kode)}">${esc(t.nama)}</option>`).join('')}</select></label>
 <label id="school-subject-label">Mapel<select id="school-subject"><option value="">Pilih satu mapel</option>${[...new Set(catalog.teachers.map(t=>t.mapel))].map(v=>`<option>${esc(v)}</option>`).join('')}</select></label>
 <fieldset id="school-switch"><legend>Blok jadwal asli</legend><label>Pekan mulai Senin<input id="school-week" type="date" value="${monday(todayWIB())}" min="2026-07-01" max="2027-06-30"></label><label>Blok yang ingin ditukar<select id="school-from"></select></label><label>Blok pengganti pada kelas dan JP yang sama<select id="school-to"></select></label><p id="school-switch-summary"></p></fieldset>
 <div id="school-project-label"><label>Gabung proyek yang telah diterima<select id="school-project"><option value="">${catalog.projects.length?'Pilih proyek':'Belum ada proyek yang disetujui'}</option>${catalog.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)} · ${esc(p.subject)}</option>`).join('')}</select></label><p>${catalog.projects.length?'Kolaborasi harus terhubung ke proyek yang sudah disetujui.':'Belum ada pilihan kolaborasi. Ajukan kegiatan sendiri dahulu untuk ditinjau kurikulum.'}</p><button type="button" id="school-create-project">Ajukan kegiatan sendiri</button></div>
 <div id="school-date-fields" class="school-pair"><label>Tanggal<input id="school-date" type="date" required value="${defaultDate}" min="${todayWIB()}" max="2027-06-30"></label><label id="school-end-date-label">Tanggal akhir proyek<input id="school-end-date" type="date" value="${defaultDate}" min="${defaultDate}" max="2027-06-30"></label></div>
 <p id="school-slot-info" ${sharedSlot?'':'hidden'}></p>
 <label id="school-category-label">Jenis ketidakhadiran<select id="school-category"><option value="sakit">Sakit</option><option value="izin">Izin</option><option value="dispensasi">Dispensasi kegiatan</option></select></label><label id="school-full-day-label">Rentang izin<select id="school-full-day"><option value="partial">Pada jam tertentu</option><option value="full">Satu hari penuh</option></select></label><div id="school-time-fields" class="school-pair"><label>Mulai<input id="school-start" type="time" required value="15:00"></label><label>Selesai<input id="school-end" type="time" required value="15:40"></label></div>
 <label id="school-class-label">Kelas proyek<select id="school-class"><option value="">Lintas kelas</option>${['X-1','X-2','X-3'].map(c=>`<option>${c}</option>`).join('')}</select></label>
 <div id="school-participants"><label>Cari murid<input id="school-search" type="search" placeholder="Nama dari semua kelas"></label><div id="school-students" class="school-students">${catalog.students.filter(s=>!(kind==='remedial'&&isStudent)||s.id===ctx.student_id).map(s=>`<label><input type="checkbox" value="${esc(s.id)}" ${kind==='remedial'&&isStudent?'checked disabled':''}>${esc(s.nama)} · ${esc(s.kelas||'Belum ada kelas')}</label>`).join('')}</div><small id="school-student-hint">${kind==='remedial'&&isStudent&&!ctx.student_id?'Akun belum dihubungkan ke roster; admin perlu menetapkan tautan akun terlebih dahulu.':'Pilih satu atau beberapa nama dari daftar resmi.'}</small></div>
 <label id="school-tp-label">TP dan keterkaitan dengan proyek<textarea id="school-tp" maxlength="4000" rows="3"></textarea></label><label>Alasan / rencana kegiatan<textarea id="school-reason" maxlength="4000" rows="3" required></textarea></label>
 <label id="school-email-label">Email keputusan (opsional)<input id="school-email" type="email" maxlength="254"></label><label id="school-evidence-label">Bukti Google Drive (opsional)<input id="school-evidence" type="url" maxlength="1000" placeholder="https://drive.google.com/file/d/…/view"></label>
 </fieldset><div class="school-review-summary" id="school-summary"></div><div id="school-challenge"></div><p id="school-verification" role="status" hidden></p><p id="school-error" role="alert"></p><div class="school-actions"><button type="submit" class="primary" id="school-send">Kirim ajuan</button><button type="button" id="school-save">Simpan draf</button></div><p id="school-draft-status" role="status"></p></form>`;
 $('#school-form').insertAdjacentHTML('afterbegin',`<div class="school-inline-help"><div><strong>${kind==='switch'?'Switch jadwal':kind==='project'?'Kokurikuler':'Pengajuan akademik'}</strong><button type="button" data-open-teacher-help="${kind==='switch'?'switch':kind==='project'||kind==='collaboration'?'project':'status'}">Panduan pengisian →</button></div><p>${kind==='switch'?'Pilih guru → dua blok setara → kirim.':kind==='project'?'Tulis nama kegiatan sendiri → lengkapi rencana → kirim.':'Lengkapi isian → kirim → tunggu keputusan.'}</p><small>Berhasil dikirim jika server memberikan nomor ajuan. Bukti dan email boleh dikosongkan.</small></div>`);
 const toggle=(id,show,required=false)=>{const el=$(id);el.hidden=!show;el.querySelectorAll('input,select,textarea').forEach(v=>{v.disabled=!show;v.required=show&&required})};
 toggle('#school-teacher-label',kind!=='absence'&&!(kind==='remedial'&&isStudent),['switch','project','collaboration'].includes(kind)||kind==='remedial'&&!isStudent);
 toggle('#school-subject-label',kind==='remedial',true);toggle('#school-switch',kind==='switch',true);toggle('#school-project-label',kind==='collaboration',true);toggle('#school-date-fields',kind!=='switch');toggle('#school-end-date-label',kind==='project',true);toggle('#school-category-label',kind==='absence');toggle('#school-full-day-label',kind==='absence');toggle('#school-time-fields',kind!=='switch');toggle('#school-class-label',kind==='project');toggle('#school-participants',['remedial','absence'].includes(kind));toggle('#school-tp-label',['project','collaboration'].includes(kind),true);
 toggle('#school-email-label',['switch','project','collaboration'].includes(kind),false);toggle('#school-evidence-label',['switch','project','collaboration'].includes(kind),false);
 $('#school-teacher').value=ctx.teacher_code||'';if(ctx.teacher_code)$('#school-teacher').disabled=true;
 $('#school-project').value=new URLSearchParams(location.search).get('project')||'';
 function fillTeacher(){const teacher=catalog.teachers.find(t=>t.kode===$('#school-teacher').value);if(!isStudent){$('#school-subject').value=teacher?.mapel||'';$('#school-subject').disabled=true}
  const lessons=catalog.lessons.filter(l=>l.teacher_code===$('#school-teacher').value);$('#school-from').innerHTML='<option value="">Pilih blok mengajar</option>'+lessons.map(l=>`<option value="${esc(l.id)}">${esc(DAYS[l.day])} · ${l.classroom} · ${l.start}–${l.end} · ${l.jp} JP · ${esc(l.subject)}</option>`).join('');fillTargets();}
 function fillTargets(){const a=catalog.lessons.find(l=>l.id===$('#school-from').value),to=catalog.lessons.filter(l=>a&&l.id!==a.id&&l.classroom===a.classroom&&l.jp===a.jp&&l.teacher_code!==a.teacher_code);$('#school-to').innerHTML='<option value="">Pilih blok setara</option>'+to.map(l=>`<option value="${esc(l.id)}">${esc(DAYS[l.day])} · ${l.classroom} · ${l.start}–${l.end} · ${l.jp} JP · ${esc(l.subject)} · ${esc(l.teacher)}</option>`).join('');$('#school-switch-summary').textContent=a?`${a.classroom} · ${a.jp} JP. Pertukaran hanya untuk pekan yang dipilih; pekan berikutnya memakai jadwal reguler.`:''}
 $('#school-teacher').onchange=fillTeacher;$('#school-from').onchange=fillTargets;fillTeacher();
 const dateInput=$('#school-date'),endDateInput=$('#school-end-date');
 let previousDate=dateInput.value;
 function updateSession(reset=false){
  if(!sharedSlot)return;
  const slot=slotFor(dateInput.value);
  dateInput.setCustomValidity(slot||!dateInput.value?'':'Pilih hari Senin atau Selasa.');
  endDateInput.min=dateInput.value||todayWIB();
  if(kind==='project'&&reset&&(!endDateInput.value||endDateInput.value===previousDate||endDateInput.value<dateInput.value))endDateInput.value=dateInput.value;
  if(reset)previousDate=dateInput.value;
  for(const [selector,key] of [['#school-start','start'],['#school-end','end']]){
   const input=$(selector);input.min=slot?.start||'';input.max=slot?.end||'';
   if(reset)input.value=slot?.[key]||'';
  }
  $('#school-slot-info').textContent=slot?`${slot.name} · ${slot.start}–${slot.end} WIB`:'Pilih sesi Klinik: Senin 20:30–21:30 atau Selasa 16:15–17:00 WIB.';
 }
 dateInput.onchange=()=>updateSession(true);
 updateSession(true);
 dateInput.required=kind!=='switch';
 for(const id of ['#school-start','#school-end'])$(id).required=kind!=='switch';
 $('#school-full-day').onchange=()=>{const full=$('#school-full-day').value==='full';$('#school-start').value=full?'00:00':'07:00';$('#school-end').value=full?'23:59':'08:20';$('#school-start').readOnly=full;$('#school-end').readOnly=full};
 $('#school-search').oninput=e=>$('#school-students').querySelectorAll('label').forEach(l=>l.hidden=!l.textContent.toLocaleLowerCase('id').includes(e.target.value.toLocaleLowerCase('id')));
 requesterIdentity=mountIdentity($('#school-requester'),catalog,{kind:isStudent?'student':'teacher',id:linkedStudent?.id||ctx.teacher_code,classroom:linkedStudent?.kelas||'',allowKind:!remedial});
 if(linkedStudent)$('#school-requester').querySelectorAll('select').forEach(el=>el.disabled=true);
 dateInput.oninput=()=>updateSession(false);
 $('#school-requester').addEventListener('identity-change',e=>{if(e.detail.kind==='teacher'&&!ctx.teacher_code){$('#school-teacher').value=e.detail.id;fillTeacher()}});
 toggle('#school-email-label',ctx.role!=='student',false);toggle('#school-evidence-label',ctx.role!=='student',false);
 $('#school-requester').addEventListener('identity-kind',e=>{const teacher=e.detail.teacher;toggle('#school-email-label',teacher,false);toggle('#school-evidence-label',teacher,false)});
 prepareForm($('#school-form'));$('#school-form').onsubmit=submit;$('#school-send').disabled=false;$('#school-send').setAttribute('aria-disabled',String(!config.school_enabled));notice(config.error||(!config.school_enabled?'Pengiriman belum aktif. Isian dapat dilengkapi, tetapi belum dapat dikirim.':''));
 $('#school-create-project').onclick=()=>{if(busy)return notice('Tunggu proses pengiriman selesai.');const title=$('#school-title').value,tp=$('#school-tp').value,reason=$('#school-reason').value;saveDraft();kind='project';$('#school-kind').value=kind;renderForm();$('#school-title').value=title;$('#school-tp').value=tp;$('#school-reason').value=reason;notice('Isi nama kegiatan sendiri. Tidak perlu menunggu proyek lain disetujui.');$('#school-title').focus()};
 $('#school-save').onclick=()=>saveDraft(true);const changed=()=>{$('#school-form').dataset.dirty='true';clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,500);summary()};$('#school-form').addEventListener('input',changed);$('#school-form').addEventListener('change',changed);
 if(useDraft)try{const draft=device.read(draftKey,{})?.[kind];if(draft){applyDraft(draft);previousDate=dateInput.value;$('#school-draft-status').textContent='Draf perangkat dipulihkan. Periksa sebelum mengirim.'}}catch(error){notice(error.message)}summary();
 if(!ctx.user_id&&!blocked&&config.school_enabled){
  const verification=$('#school-verification'),status=message=>{verification.textContent=message;verification.hidden=!message};
  gate=verificationGate($('#school-challenge'),{sitekey:config.turnstile_site_key,action:'school_request',size:'compact',appearance:'interaction-only',onStatus:message=>status(message==='Verifikasi selesai.'?'':message)});
  gate.mount().catch(error=>status(error.message));
 }
}
function snapshot(){return {kind,fields:Object.fromEntries([...$('#school-form').querySelectorAll('input[id],select[id],textarea[id]')].filter(e=>e.type!=='file'&&e.type!=='checkbox').map(e=>[e.id,e.value])),student_ids:[...$('#school-students').querySelectorAll('input:checked')].map(e=>e.value),identity:requesterIdentity.snapshot()}}
function saveDraft(explicit=false){if(!requesterIdentity||!$('#school-form')||$('#school-form').hidden)return;try{const draft=snapshot();if(explicit!==true&&!draft.fields['school-title']&&!draft.fields['school-reason']&&!draft.identity.requester_id)return;const all=device.read(draftKey,{})||{};device.write(draftKey,{...all,[kind]:draft});$('#school-draft-status').textContent=device.volatile?'Draf sementara di halaman ini. Penyimpanan perangkat tidak tersedia.':'Draf tersimpan di perangkat · belum dikirim.'}catch(error){notice(error.message)}}
function applyDraft(draft){
 for(const [id,value]of Object.entries(draft.fields||{})){
  const input=$('#'+id);
  if(input&&typeof value==='string')input.value=value;
 }
 if(ctx.teacher_code)$('#school-teacher').value=ctx.teacher_code;
 $('#school-teacher').onchange();
 if(draft.fields?.['school-from']){
  $('#school-from').value=draft.fields['school-from'];
  $('#school-from').onchange();
  $('#school-to').value=draft.fields['school-to']||'';
 }
 const linked=kind==='remedial'&&ctx.role==='student';
 $('#school-students').querySelectorAll('input').forEach(input=>{input.checked=linked?input.value===ctx.student_id:(draft.student_ids||[]).includes(input.value)});
 if(draft.identity&&!linked)requesterIdentity.restore(kind==='remedial'?{...draft.identity,requester_kind:'teacher',requester_id:ctx.teacher_code||draft.identity.requester_id}:draft.identity);
 $('#school-date').oninput();
}
function summary(){const name=$('#school-teacher').selectedOptions[0]?.textContent||'',date=kind==='switch'?$('#school-week').value:$('#school-date').value;$('#school-summary').innerHTML='<strong>Periksa sebelum kirim</strong><p></p>';const time=usesClinicSession(kind)&&$('#school-start').value&&$('#school-end').value?`${$('#school-start').value}–${$('#school-end').value} WIB`:'';$('#school-summary p').textContent=[KINDS[kind],$('#school-title').value||'Judul belum diisi',name,date,time].filter(Boolean).join(' · ')}
function accepted(receipt,data,requestKind=kind){
 const {identity_photo,photo_mime,...safe}=data;acknowledged.add(JSON.stringify({kind:requestKind,data:safe}));
 clearTimeout(draftTimer);let storageIssue=false;
 try{const own=device.read(receiptKey,[])||[];if(!own.some(r=>r.id===receipt.id))own.push({id:receipt.id,token:receipt.token,title:data.title,kind:requestKind,date:data.date,status:receipt.status});device.write(receiptKey,own);device.remove(pendingKey)}catch{storageIssue=true;device.cache(receiptKey,[{id:receipt.id,token:receipt.token,title:data.title,kind:requestKind,date:data.date,status:receipt.status}]);device.remove(pendingKey)}
 try{const drafts=device.read(draftKey,{})||{};delete drafts[requestKind];device.write(draftKey,drafts)}catch{storageIssue=true}
 showReceipt($('#school-receipt'),receipt,{summary:KINDS[requestKind]+' · '+data.title,volatile:device.volatile||storageIssue,onCheck:loadMine});$('#school-new').hidden=false;
}
async function submit(event){
 event.preventDefault();if(busy||$('#school-form').hidden)return;if(!config.school_enabled){formError($('#school-form'),$('#school-error'),config.error||'Pengiriman belum aktif. Gunakan Muat ulang daftar.');return}if(!checkForm($('#school-form'),$('#school-error')))return;
 busy=true;const form=$('#school-form'),send=$('#school-send');send.disabled=true;$('#school-save').disabled=true;send.textContent='Memeriksa…';$('#school-error').textContent='';let unlock=()=>{};
 try{
  saveDraft();let challenge='';if(!ctx.user_id){send.textContent='Memverifikasi…';challenge=await gate.wait();if(!checkForm(form,$('#school-error')))return}
  const a=catalog.lessons.find(l=>l.id===$('#school-from').value),date=kind==='switch'&&a?addDays($('#school-week').value,a.day-1):$('#school-date').value;
  const body=kind==='switch'?{week:$('#school-week').value,from_id:$('#school-from').value,to_id:$('#school-to').value}:kind==='collaboration'?{parent_id:$('#school-project').value}:kind==='project'?{end_date:$('#school-end-date').value}:kind==='absence'?{full_day:$('#school-full-day').value==='full',category:$('#school-category').value}:{full_day:false};
  const evidence=$('#school-evidence').value.trim(),normalized=evidence?driveEvidence(evidence):null;if(evidence&&!normalized)throw Error('Gunakan tautan file Google Drive yang valid.');
  const identity=requesterIdentity.read();
  const absLabel=kind==='absence'?$('#school-category').selectedOptions[0].textContent+' — ':'',rawTitle=$('#school-title').value.trim();
  const data={...validateRequest(kind,{title:rawTitle&&absLabel&&!rawTitle.startsWith(absLabel)?absLabel+rawTitle:rawTitle,date,start:kind==='switch'&&a?a.start:$('#school-start').value,end:kind==='switch'&&a?a.end:$('#school-end').value,teacher_code:$('#school-teacher').value||null,subject:$('#school-subject').value,classroom:$('#school-class').value||null,student_ids:[...$('#school-students').querySelectorAll('input:checked')].map(x=>x.value),tp:$('#school-tp').value.trim(),reason:$('#school-reason').value.trim(),contact_email:$('#school-email').value.trim(),evidence:normalized?.url||'',body},catalog,ctx),...identity};
  const {identity_photo,photo_mime,...draftData}=data,signature=JSON.stringify({kind,data:draftData});if(acknowledged.has(signature)){form.hidden=true;notice('Isian yang sama sudah diterima server. Periksa bukti penerimaan; tidak perlu mengirim ulang.');return}let pending=device.read(pendingKey);
  unlock=lockInputs(form);
  if(pending){const check=await lookup(pending);if(check?.found){const original=JSON.parse(pending.signature);accepted({...check,id:pending.id,token:pending.token},original.data,original.kind);form.hidden=true;notice('Ajuan sebelumnya sudah diterima. Data baru belum dikirim.');return}if(pending.signature!==signature)throw Error('Pengiriman sebelumnya belum dipastikan. Pilih Pulihkan ajuan belum dipastikan, lalu periksa nomor yang sama sebelum mengubah isian.')}
  pending??={id:crypto.randomUUID(),token:crypto.randomUUID(),signature};device.write(pendingKey,pending);send.textContent='Mengirim…';
  let receipt;try{receipt=await sendPending('/api/school/request',{kind,data,id:pending.id,token:pending.token,challenge})}catch(error){if(error.definitive)device.remove(pendingKey);throw error}
  accepted(receipt,data);requesterIdentity.clear();form.hidden=true;notice('Server menerima ajuan. Menunggu keputusan kurikulum.');loadMine();
 }catch(error){formError(form,$('#school-error'),error.message)}finally{gate?.reset();unlock();busy=false;send.disabled=false;$('#school-save').disabled=false;send.textContent='Kirim ajuan';try{$('#school-restore').hidden=!device.read(pendingKey)}catch{}}
}
async function lookup(row){return requestJSON('/api/school/receipt',{body:{id:row.id,token:row.token}})}
async function loadMine(){try{
 let receipts=device.read(receiptKey,[])||[],pending=device.read(pendingKey);
 if(pending&&!busy){const check=await lookup(pending);if(check?.found){const original=JSON.parse(pending.signature);accepted({...check,id:pending.id,token:pending.token},original.data,original.kind);if(!$('#school-form').dataset.dirty)$('#school-form').hidden=true;receipts=device.read(receiptKey,[])||[]}}
 const rows=access.has('school')?(await api.read('mine')).rows:await Promise.all(receipts.map(async r=>r.token?{...r,...await lookup(r)}:r));
 $('#school-own').innerHTML=rows.length?rows.map(r=>`<article class="school-record"><small>${esc(KINDS[r.kind])} · ${esc(statusLabel(r.status))}</small><h3>${esc(r.title)}</h3><p>${esc(r.date)}</p>${r.decision_note?`<p>${esc(r.decision_note)}</p>`:''}<small>Nomor ajuan ${esc(r.id)}</small></article>`).join(''):'<p>Belum ada ajuan untuk akun atau perangkat ini.</p>';
 const id=$('#school-receipt dd')?.textContent,row=rows.find(r=>r.id===id),status=$('#school-receipt dl>div:nth-child(2) dd');if(row&&status)status.textContent=statusLabel(row.status);
 }catch(e){$('#school-own').textContent=e.message}}
function restore(){try{const p=device.read(pendingKey);if(!p){notice('Tidak ada ajuan yang perlu dipulihkan.');return}const original=JSON.parse(p.signature),d=original.data,body=d.body||{};saveDraft();kind=original.kind;$('#school-kind').value=kind;renderForm({useDraft:false});applyDraft({identity:d,student_ids:d.student_ids,fields:Object.fromEntries(Object.entries({'school-title':d.title,'school-teacher':d.teacher_code,'school-date':d.date,'school-end-date':body.end_date,'school-start':d.start,'school-end':d.end,'school-tp':d.tp,'school-reason':d.reason,'school-email':d.contact_email,'school-evidence':d.evidence,'school-class':d.classroom,'school-week':body.week,'school-project':d.body.parent_id,'school-category':body.category,'school-from':body.from_id,'school-to':body.to_id}).filter(([,v])=>v!==undefined&&v!==null))});summary();notice('Isian dipulihkan dengan nomor yang sama. Periksa status atau kirim ulang isian yang sama.')}catch(e){notice(e.message)}}

window.addEventListener('pagehide',()=>saveDraft());window.addEventListener('curriculum-before-account-change',()=>saveDraft());
renderForm();loadMine();access.subscribe(next=>{if(next.user_id!==ctx.user_id||next.role!==ctx.role){saveDraft();location.reload()}});

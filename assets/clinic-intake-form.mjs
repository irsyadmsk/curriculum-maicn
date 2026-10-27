import {validateCatalog,driveEvidence,validateIntake} from './clinic-intake-core.mjs';
import {slotFor} from './clinic-core.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalogPromise;
export async function intakeCatalog(){
  if(!catalogPromise)catalogPromise=fetch('/api/clinic/catalog',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Daftar peserta resmi menunggu aktivasi. Draf lama tetap tersimpan.');return validateCatalog(await r.json())}).catch(error=>{catalogPromise=null;throw error});
  return catalogPromise;
}
export function mountIntake(form,catalog,{row,date,report,teacherDefault}){
  const kind=row?.request_kind||teacherDefault&&'teacher'||'guest';
  form.innerHTML=`<p id="clinic-form-note">Murid dan guru dapat mengajukan tanpa login. Ajuan diputuskan admin/kurikulum di Studio.</p>
  <fieldset id="clinic-schedule-fields"><legend>01 · Pengajuan & peserta</legend>
  <label for="clinic-kind">Saya mengajukan sebagai<select id="clinic-kind"><option value="guest">Murid</option><option value="teacher">Guru</option></select></label>
  <div class="clinic-pair"><label for="clinic-date">Tanggal sesi<input id="clinic-date" type="date" required min="2026-07-01" max="2027-06-30"></label><label for="clinic-class">Kelas<select id="clinic-class" required>${['X-1','X-2','X-3'].map(c=>`<option>${c}</option>`).join('')}</select></label></div><p id="clinic-slot-info" role="status"></p>
  <div class="clinic-pair"><label for="clinic-start">Mulai<input id="clinic-start" type="time" required></label><label for="clinic-end">Selesai<input id="clinic-end" type="time" required></label></div><p class="clinic-muted">Waktu dapat dibagi dalam sesi yang tersedia agar murid dapat mengikuti klinik berikutnya pada hari yang sama.</p>
  <label for="clinic-target">Peserta klinik<select id="clinic-target"><option value="students">Pilih per nama</option><option value="class">Satu kelas</option></select></label>
  <div id="clinic-participant-fields"><label for="clinic-student-search">Cari murid lintas kelas<input id="clinic-student-search" type="search" placeholder="Cari nama dari semua kelas"></label><fieldset class="clinic-participants"><legend>Pilih satu atau beberapa murid</legend><div id="clinic-student-options"></div></fieldset></div>
  <p id="clinic-participant-count" role="status"></p><p class="clinic-muted">Per nama boleh menggabungkan murid dari beberapa kelas. Kelas asal ditampilkan sebagai informasi.</p>
  <label for="clinic-teacher">Guru pengampu<select id="clinic-teacher"><option value="">Pilih guru</option>${catalog.teachers.map(t=>`<option value="${esc(t.kode)}">${esc(t.nama)}</option>`).join('')}</select></label>
  <label for="clinic-subject-0">Mapel<select id="clinic-subject-0" required><option value="">Pilih satu mapel</option>${[...new Set(catalog.teachers.map(t=>t.mapel))].map(s=>`<option>${esc(s)}</option>`).join('')}</select></label>
  <label for="clinic-email">Email penerima keputusan<input id="clinic-email" type="email" maxlength="254" autocomplete="email"><small>Keputusan diterima/ditolak dikirim ke email ini. Pemilihan nama guru akan diperiksa admin bersama bukti.</small></label></fieldset>
  <fieldset id="clinic-report-fields"><legend>02 · Kebutuhan & bukti</legend><label for="clinic-topic">Topik / catatan belajar<textarea id="clinic-topic" rows="3" maxlength="2000"></textarea></label>
  <label for="clinic-evidence">Bukti Google Drive<input id="clinic-evidence" type="url" maxlength="1000" placeholder="https://drive.google.com/file/d/…/view"><small>Tempel tautan file Drive. Pastikan admin dapat melihat file; bukti wajib untuk guru.</small></label><div id="clinic-evidence-preview"></div></fieldset>
  <div id="clinic-challenge"></div><p id="clinic-form-error" role="alert"></p><div class="clinic-actions"><button type="submit" id="clinic-save-draft" class="ui-button-primary">Simpan draf</button><button type="submit" id="clinic-send">Kirim ajuan</button><button type="button" id="clinic-cancel">Batal</button></div>`;
  const $=s=>form.querySelector(s);
  $('#clinic-kind').value=kind;$('#clinic-date').value=row?.date||date;$('#clinic-class').value=row?.classroom||'X-1';$('#clinic-target').value=row?.target_mode||'students';$('#clinic-teacher').value=row?.teacher_code||teacherDefault||'';$('#clinic-email').value=row?.contact_email||'';$('#clinic-topic').value=row?.topic||'';$('#clinic-evidence').value=row?.evidence||'';
  const selected=new Set(row?.participant_ids||[]);
  const slot=slotFor(row?.date||date);$('#clinic-start').value=row?.start||slot?.start||'';$('#clinic-end').value=row?.end||slot?.end||'';
  function participants(){
    const classroom=$('#clinic-class').value,query=$('#clinic-student-search').value.trim().toLocaleLowerCase('id');
    $('#clinic-student-options').innerHTML=catalog.students.map(s=>`<label class="clinic-student-choice" ${s.nama.toLocaleLowerCase('id').includes(query)?'':'hidden'}><input type="checkbox" value="${esc(s.id)}" ${selected.has(s.id)?'checked':''}>${esc(s.nama)} · ${esc(s.kelas||'Belum ada kelas')}</label>`).join('');
    $('#clinic-student-options').querySelectorAll('input').forEach(box=>box.onchange=()=>{box.checked?selected.add(box.value):selected.delete(box.value);count()});count();
  }
  function count(){const perClass=$('#clinic-target').value==='class',n=perClass?catalog.students.filter(s=>s.kelas===$('#clinic-class').value).length:selected.size;$('#clinic-participant-count').textContent=`${n} murid dipilih`;$('#clinic-participant-fields').hidden=perClass;$('#clinic-class').closest('label').hidden=!perClass;$('#clinic-class').required=perClass;$('#clinic-class').disabled=!perClass}
  function mode(){const teacher=$('#clinic-kind').value==='teacher';$('#clinic-teacher').closest('label').hidden=!teacher;$('#clinic-teacher').required=teacher;$('#clinic-email').closest('label').hidden=!teacher;$('#clinic-email').required=teacher;$('#clinic-evidence').closest('label').hidden=!teacher;$('#clinic-evidence').required=teacher;$('#clinic-subject-0').disabled=teacher;
    if(teacher){const t=catalog.teachers.find(t=>t.kode===$('#clinic-teacher').value);$('#clinic-subject-0').value=t?.mapel||''}preview();}
  function preview(){const evidence=$('#clinic-kind').value==='teacher'&&driveEvidence($('#clinic-evidence').value);$('#clinic-evidence-preview').innerHTML=evidence?`<iframe title="Pratinjau bukti Google Drive" src="${esc(evidence.embed)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe><a href="${esc(evidence.url)}" target="_blank" rel="noopener noreferrer">Buka bukti di Drive</a>`:'';}
  $('#clinic-class').onchange=count;$('#clinic-student-search').oninput=participants;$('#clinic-target').onchange=count;$('#clinic-kind').onchange=mode;$('#clinic-teacher').onchange=mode;$('#clinic-evidence').onchange=preview;
  participants();mode();if(kind==='guest')$('#clinic-subject-0').value=row?.subjects?.[0]||'';
  $('#clinic-schedule-fields').disabled=report;
  return {read(){return validateIntake({request_kind:$('#clinic-kind').value,target_mode:$('#clinic-target').value,classroom:$('#clinic-class').value,participant_ids:[...selected],teacher_code:$('#clinic-teacher').value,subjects:[$('#clinic-subject-0').value],contact_email:$('#clinic-email').value,evidence:$('#clinic-evidence').value},catalog)}};
}

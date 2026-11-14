import {SLOTS,CLASSES,dateLabel,isDate,addDays} from './clinic-core.mjs';
export const LOCATIONS=['Kelas X-1','Kelas X-2','Kelas X-3','Lantai 1','Kelas lantai 2 Gedung Maiyoma Chaidir'];
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nextReviewDay(date,overrides=[]){
 if(!isDate(date))throw Error('Tanggal tidak valid.');
 for(let i=0;i<370;i++){const d=new Date(date+'T00:00:00Z'),override=overrides.find(x=>x.date===date);if(override?override.is_workday:![0,6].includes(d.getUTCDay()))return date;d.setUTCDate(d.getUTCDate()+1);date=d.toISOString().slice(0,10)}throw Error('Kalender kerja belum tersedia.');
}
export function participantTable(rows,roster){
 const active=rows.filter(r=>['pending','approved'].includes(r.status));
 return roster.flatMap(s=>{const choices=active.filter(r=>(r.status==='approved'?r.approved_participant_ids??r.participant_ids:r.participant_ids)?.includes(s.id));
 const conflict=choices.some((a,i)=>choices.some((b,j)=>i<j&&a.date===b.date&&a.start<b.end&&a.end>b.start));
 const accepted=choices.filter(r=>r.status==='approved').length,pending=choices.length-accepted;
 return[{...s,clinics:choices,conflict,multiple:choices.length>1,status:conflict?'Bentrok waktu · perlu keputusan':choices.length>1?`${accepted} disetujui · ${pending} menunggu · waktu berbeda`:accepted?'Satu klinik disetujui':pending?'Ajuan menunggu':'Belum terjadwal'}]});
}
export function whatsappText({date,clinic=[],roster=[],news=[],monday=null,school={rows:[]},includeNextDay=true}){
 const lines=['*INFORMASI KURIKULUM MA INSAN CENDEKIA NUSANTARA*',''],time=v=>String(v||'');
 if(monday?.activity)lines.push('*Senin · JP 1*',`Kegiatan: ${monday.activity}`,'Waktu: 07.00–07.40 WIB',...(monday.note?[`Catatan: ${monday.note}`]:[]),'');
 const days=[date];if(includeNextDay&&new Date(date+'T12:00:00Z').getUTCDay()===1)days.push(addDays(date,1));
 for(const currentDay of days){let number=0;
  lines.push(`*${dateLabel(currentDay)}*`,'*Klinik pembelajaran*');
  const slots=SLOTS.filter(s=>s.day===new Date(currentDay+'T12:00:00Z').getUTCDay());
  if(!slots.length)lines.push('Tidak ada sesi klinik reguler hari ini.','');
  for(const slot of slots){
   const rows=clinic.filter(r=>r.date===currentDay&&r.status==='approved'&&r.start<slot.end&&r.end>slot.start).sort((a,b)=>a.start.localeCompare(b.start)||(a.target_mode==='class'?CLASSES.indexOf(a.classroom):CLASSES.length)-(b.target_mode==='class'?CLASSES.indexOf(b.classroom):CLASSES.length)||String(a.approved_subject||a.subjects?.[0]||'').localeCompare(String(b.approved_subject||b.subjects?.[0]||''),'id'));
   lines.push(`${slot.name} · ${time(slot.start)}–${time(slot.end)} WIB`,'');
   if(!rows.length)lines.push('Belum ada klinik yang disetujui.','');
   for(const r of rows){
    const ids=r.approved_participant_ids??r.participant_ids??[],people=roster.filter(s=>ids.includes(s.id)),whole=r.target_mode==='class'&&r.classroom;
    lines.push(`${++number}. *${r.approved_subject||r.subjects?.[0]||'Mapel belum ditetapkan'}*`,...(r.start!==slot.start||r.end!==slot.end?[`Waktu: ${time(r.start)}–${time(r.end)} WIB`]:[]),`Pengampu: ${r.teacher||'Belum ditetapkan'}`);
    if(whole)lines.push(`Peserta: Kelas ${r.classroom} (${ids.length} murid)`);else lines.push(`Peserta: Per murid (${ids.length} murid)`);
    lines.push(`Lokasi: ${r.location||'Belum ditetapkan'}`);
    if(!whole){lines.push('Daftar peserta:');if(people.length)people.forEach((p,i)=>lines.push(`  ${i+1}) ${p.nama} (${p.kelas||'belum berkelas'})`));else lines.push('  Daftar nama sesuai penetapan kurikulum.');}
    const excluded=(r.participant_ids||[]).filter(id=>!ids.includes(id));if(excluded.length){lines.push('Tidak termasuk:');for(const id of excluded){const person=roster.find(p=>p.id===id),exception=r.participant_exceptions?.find(e=>e.student_id===id),destination=clinic.find(c=>c.id===exception?.destination_id);lines.push(`  - ${person?.nama||'Murid terpilih'} → ${destination?.approved_subject||destination?.subjects?.[0]||'klinik lain sesuai penempatan'}`)}}
    lines.push('');
   }
   const assigned=new Set(rows.flatMap(r=>r.approved_participant_ids??r.participant_ids??[]));let freeCount=0;const freeLines=[];
   for(const c of CLASSES){const members=roster.filter(s=>s.kelas===c),free=members.filter(s=>!assigned.has(s.id));freeCount+=free.length;if(members.length&&free.length===members.length)freeLines.push(`- Kelas ${c} (${members.length} murid)`);else if(free.length){freeLines.push(`- Murid ${c} yang belum terjadwal (${free.length}):`);free.forEach((p,i)=>freeLines.push(`  ${i+1}) ${p.nama}`));}else if(!members.length&&!rows.some(r=>r.classroom===c||r.scope_classrooms?.includes(c)))freeLines.push(`- Kelas ${c}: belum ada klinik yang disetujui.`);}
   if(freeLines.length)lines.push('*Belum terjadwal*',...freeLines,'');
  }
 }
 const activities=(school?.rows||[]).filter(r=>r.status==='approved'&&(r.kind==='switch'?[r.body?.from_date,r.body?.to_date].some(d=>days.includes(d)):r.kind==='project'?r.date<=days.at(-1)&&(r.body?.end_date||r.date)>=date:days.includes(r.date)));
 if(activities.length){lines.push('*Informasi akademik disetujui*');activities.forEach((r,i)=>{lines.push(`${i+1}. *${r.title||r.kind}*`);if(r.kind==='switch')lines.push(`   Kelas: ${r.classroom}`,`   Dari: ${r.body.from_date} · ${time(r.body.from?.start||r.start)} WIB`,`   Ke: ${r.body.to_date} · ${time(r.body.to?.start||r.start)} WIB`);else lines.push(`   ${r.classroom||r.subject||'Kegiatan madrasah'}`,`   ${r.date} · ${time(r.start)}–${time(r.end)} WIB`);lines.push('')});}
 const announcements=news.filter(n=>n.status==='published'&&n.date_from<=date&&n.date_to>=date);
 if(announcements.length){lines.push('*Pengumuman*');announcements.forEach((n,i)=>lines.push(`${i+1}. *${n.title}*`,...(n.body?[n.body]:[]),...(n.attachment?[`Lampiran: ${n.attachment}`]:[]),''));}
 lines.push('_Belum terjadwal bukan berarti kegiatan dibebaskan. Ikuti arahan kurikulum._','','_*Wakil Kepala Madrasah Bidang Kurikulum*_');return lines.join('\n');
}
export async function copyText(value,field){
 try{await navigator.clipboard.writeText(value);return true}catch{if(field){field.hidden=false;field.value=value;field.focus();field.select()}return false}
}

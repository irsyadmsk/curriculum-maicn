const escape = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Called only with a server outbox event. Never accepts a browser recipient. */
export function decisionEmail(event) {
  if (event.request_kind!=='teacher' || !['approved','rejected'].includes(event.status)) return null;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(event.contact_email||'') || /[\r\n]/.test(event.contact_email)) throw Error('Invalid recipient');
  if(event.activity_kind){
    const kind={switch:'switch jadwal',project:'proyek kokurikuler',collaboration:'kolaborasi kokurikuler',remedial:'remedial',absence:'dispensasi / izin KBM'}[event.activity_kind];if(!kind)throw Error('Invalid activity kind');
    const subject=`[Curriculum] Ajuan ${kind} ${event.status==='approved'?'diterima':'ditolak'}`;
    const lines=[`Yth. Bapak/Ibu ${event.teacher},`,subject.replace('[Curriculum] ',''),`Kegiatan: ${event.title}`,`Mapel: ${event.subject}`,`Jadwal: ${event.date} ${event.start}–${event.end} WIB`,...(event.activity_kind==='switch'?[`Pekan: ${event.body.week}. Hanya berlaku pada pekan tersebut; pekan berikutnya kembali ke jadwal reguler.`,`Pertukaran: ${event.body.from.subject} (${event.body.from_date}) dengan ${event.body.to.subject} (${event.body.to_date})`]:[]),`Catatan kurikulum: ${event.decision_note}`,`Nomor ajuan: ${event.id}`,'Pesan otomatis dari Curriculum. Alamat ini tidak menerima balasan.'];
    return{from:'Curriculum Irsyads <noreply@irsyads.com>',to:[event.contact_email],subject,text:lines.join('\n\n'),html:`<!doctype html><html lang="id"><body style="font:16px/1.6 Arial,sans-serif;color:#0B1D35"><main style="max-width:600px;margin:auto;padding:28px"><h1 style="font-size:24px">${escape(subject.replace('[Curriculum] ',''))}</h1>${lines.map(line=>`<p>${escape(line)}</p>`).join('')}</main></body></html>`};
  }
  const accepted=event.status==='approved', title=event.allocation_update?'Penyesuaian peserta klinik':accepted?'Ajuan klinik diterima':'Ajuan klinik ditolak';
  const participants=event.participants||[],exceptions=event.exceptions||[];
  const audience=event.target_mode==='class'?`Kelas ${event.classroom}`:`Per nama lintas kelas${event.scope_classrooms?.length?' ('+event.scope_classrooms.join(', ')+')':''}`;
  const body=[`Yth. Bapak/Ibu ${event.teacher},`,`${title} oleh pengelola kurikulum.`,
    `Mapel: ${event.approved_subject||event.subjects?.[0]||''}`,`Sasaran: ${audience}`,`Jadwal ajuan: ${event.date}, ${event.start}–${event.end} WIB`,
    `Jumlah peserta ${accepted?'disetujui':'diajukan'}: ${participants.length||event.approved_participant_ids?.length||event.participant_ids?.length||0}`,
    ...(participants.length?[`Daftar nama ${accepted?'yang disetujui':'yang diajukan'}:\n${participants.map(s=>`${s.nama} (${s.kelas||'belum ada kelas'})`).join('\n')}`]:[]),
    ...(accepted&&exceptions.length?[`Diterima untuk ${audience}, kecuali:\n${exceptions.map(s=>`${s.nama} (${s.kelas||'belum ada kelas'}) masuk klinik ${s.subject} — ${s.teacher}. Alasan: ${s.reason}`).join('\n')}`]:[]),
    `Catatan kurikulum: ${event.decision_note||''}`,
    accepted?'Silakan melaksanakan klinik sesuai jadwal yang telah disetujui.':'Silakan meninjau catatan kurikulum sebelum mengajukan kembali.',
    `Nomor ajuan: ${event.id}`, 'Pesan otomatis dari Curriculum. Alamat ini tidak menerima balasan.'];
  return {from:'Curriculum Irsyads <noreply@irsyads.com>',to:[event.contact_email],subject:`[Curriculum] ${title} — ${event.date}`,
    text:body.join('\n\n'),html:`<!doctype html><html lang="id"><body style="margin:0;background:#F3EDE2;font:16px/1.6 Arial,sans-serif;color:#0B1D35"><main style="max-width:600px;margin:24px auto;background:#fff;padding:32px"><p>CURRICULUM · MAICN</p><h1 style="font-size:26px">${title}</h1>${body.map(line=>`<p>${escape(line).replace(/\n/g,'<br>')}</p>`).join('')}<a href="https://curriculum.irsyads.com/klinik.html">Lihat agenda klinik</a></main></body></html>`};
}
export async function sendDecisionEmail(event,{apiKey,fetcher=fetch}={}) {
  const message=decisionEmail(event);
  if (!message) return {skipped:true};
  if (!apiKey) throw Error('Email provider unavailable');
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`${event.activity_kind?'school':'clinic'}/${event.id}/${event.revision}`},body:JSON.stringify(message),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('Email provider did not accept the message');
  const result=await response.json(); if (!result.id) throw Error('Email receipt missing');
  return {provider_id:result.id};
}

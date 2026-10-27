export function clinicNotifications(rows,actor){
 if(!actor?.user_id||!['teacher','curriculum','admin'].includes(actor.role))return[];
 return rows.filter(r=>['approved','rejected','cancelled'].includes(r.status)&&(r.owner_id===actor.user_id||actor.teacher_code&&r.teacher_code===actor.teacher_code)).map(r=>{
  const own=r.owner_id===actor.user_id,assigned=actor.teacher_code&&r.teacher_code===actor.teacher_code;
  const title=r.status==='approved'?r.request_kind==='guest'&&assigned?'Ajuan murid/tamu diterima':own?'Ajuan Klinik Anda diterima':'Anda ditetapkan sebagai pengampu Klinik':r.status==='rejected'?'Ajuan Klinik ditolak':'Klinik dibatalkan';
  return {key:[r.id,r.status,r.decided_at||r.updated_at||'',r.teacher_code||''].join(':'),id:r.id,status:r.status,title,subject:r.approved_subject||r.subjects?.[0]||'Klinik pembelajaran',date:r.date,start:r.start,end:r.end,classroom:r.classroom,note:r.decision_note||'',at:r.decided_at||r.updated_at||''};
 }).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}

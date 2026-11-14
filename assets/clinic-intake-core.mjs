/** Intake v2: roster identities, one subject, and participant conflicts. No authority on the device. */
export function driveEvidence(value) {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password || url.port) return null;
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)\/(?:view|preview)?$/)?.[1]
      || (url.pathname === '/open' ? url.searchParams.get('id') : null);
    if (!id || !/^[\w-]{10,200}$/.test(id)) return null;
    return {url:`https://drive.google.com/file/d/${id}/view`,embed:`https://drive.google.com/file/d/${id}/preview`};
  } catch { return null; }
}
export function validateCatalog(data) {
  if (!data || data.version !== 2 || data.year !== '2026/2027' || !Array.isArray(data.students) || !Array.isArray(data.teachers) || data.students.length > 5000) throw Error('Daftar resmi belum tersedia.');
  const ids = new Set(), codes = new Set();
  for (const s of data.students) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || typeof s.nama !== 'string' || !s.nama.trim() || !['X-1','X-2','X-3',null].includes(s.kelas)) throw Error('Daftar murid tidak valid.');
    ids.add(s.id);
  }
  for (const t of data.teachers) {
    if (!t || !/^[A-Z]{2,4}$/.test(t.kode) || codes.has(t.kode) || typeof t.nama !== 'string' || !t.nama.trim() || typeof t.mapel !== 'string' || !t.mapel.trim()) throw Error('Daftar pengampu tidak lengkap.');
    codes.add(t.kode);
  }
  if (!ids.size || !codes.size) throw Error('Daftar resmi belum lengkap.');
  return data;
}
export function selectedParticipants(value, roster) {
  if (!['class','students'].includes(value.target_mode)) throw Error('Pilih satu kelas atau per nama.');
  const available = value.target_mode==='class'?roster.filter(s => s.kelas === value.classroom):roster;
  if (!available.length) throw Error('Daftar kelas belum tersedia.');
  const ids = value.target_mode === 'class' ? available.map(s=>s.id) : value.participant_ids;
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !available.some(s=>s.id===id))) throw Error('Pilih murid dari daftar resmi.');
  return [...ids].sort();
}
export function validateIntake(value, catalog) {
  validateCatalog(catalog);
  if (!['teacher','guest'].includes(value.request_kind)) throw Error('Pilih pengajuan murid atau guru.');
  const result = {request_kind:value.request_kind,target_mode:value.target_mode,classroom:value.target_mode==='class'?value.classroom:null,participant_ids:selectedParticipants(value,catalog.students)};
  if (value.request_kind === 'teacher') {
    const teacher = catalog.teachers.find(t=>t.kode===value.teacher_code);
    if (!teacher) throw Error('Pilih guru dari daftar pengampu.');
    const email = String(value.contact_email||'').trim();
    if (email && (email.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || /[\r\n]/.test(email))) throw Error('Periksa format email, atau kosongkan jika tidak digunakan.');
    const evidence = driveEvidence(value.evidence);
    if (String(value.evidence||'').trim() && !evidence) throw Error('Gunakan tautan file Google Drive yang valid, atau kosongkan jika bukti menyusul.');
    return {...result,teacher_code:teacher.kode,teacher:teacher.nama,subjects:[teacher.mapel],contact_email:email,evidence:evidence?.url||''};
  }
  const subjects = [...new Set(catalog.teachers.map(t=>t.mapel))];
  if (!Array.isArray(value.subjects) || value.subjects.length!==1 || !subjects.includes(value.subjects[0])) throw Error('Pilih tepat satu mapel dari daftar.');
  return {...result,teacher_code:null,teacher:'',subjects:[value.subjects[0]],contact_email:'',evidence:''};
}
export const overlaps = (a,b) => a.date===b.date && a.start<b.end && a.end>b.start;
export const effectiveParticipants = row => row.status==='approved' ? row.approved_participant_ids??row.participant_ids??[] : row.participant_ids??[];
export const classroomLabel = row => {const count=row.approved_participant_ids?.length??row.participant_ids?.length??row.participant_count;if(row.target_mode==='students'||row.classroom===null)return 'Per murid'+(count===undefined?'':' · '+count+' peserta')+((row.scope_classrooms||row.classrooms||[]).length?' · '+(row.scope_classrooms||row.classrooms).join(', '):'');return (row.classroom||'Kelas belum dipilih')+((row.participant_exceptions?.length||row.exception_count)?' · kecuali '+(row.participant_exceptions?.length||row.exception_count)+' murid':'')};
export function participantConflicts(rows, proposal, statuses=['approved']) {
  const ids = new Set(effectiveParticipants(proposal));
  return rows.filter(r=>r.id!==proposal.id && statuses.includes(r.status) && overlaps(r,proposal) && effectiveParticipants(r).some(id=>ids.has(id)));
}
export function allocationConflicts(rows, proposal) {
  const peers=rows.filter(r=>r.id!==proposal.id&&r.status==='approved'&&overlaps(r,proposal));
  return (proposal.participant_ids||[]).flatMap(id=>{const options=peers.filter(r=>effectiveParticipants(r).includes(id));return options.length?[{student_id:id,options}]:[]});
}
export function allocationPeerRevisions(rows, proposal) {
  const ids=new Set(proposal.participant_ids||[]);
  return Object.fromEntries(rows.filter(r=>r.id!==proposal.id&&r.status==='approved'&&overlaps(r,proposal)&&(effectiveParticipants(r).some(id=>ids.has(id))||(r.participant_exceptions||[]).some(ex=>ids.has(ex.student_id)))).map(r=>[r.id,r.revision]));
}
export function enrichmentCandidates(students, clinic, rows=[]) {
  if (clinic.status!=='approved' || !effectiveParticipants(clinic).length) throw Error('Tetapkan peserta klinik terlebih dahulu.');
  const assigned=new Set([...effectiveParticipants(clinic),...rows.filter(r=>r.id!==clinic.id&&r.status==='approved'&&overlaps(r,clinic)).flatMap(effectiveParticipants)]);
  const scope=new Set(clinic.scope_classrooms||[clinic.classroom]);
  return students.filter(s=>s.kelas && scope.has(s.kelas) && !assigned.has(s.id));
}

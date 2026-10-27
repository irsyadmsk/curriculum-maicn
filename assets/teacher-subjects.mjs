const key=value=>String(value||'').split(',')[0].replace(/\*/g,'').trim().toLocaleLowerCase('id').replace(/\s+/g,' ');
export function assignedSubjects(teacher,source=[]){
 if(!teacher)return[];
 const matched=source.filter(row=>key(row.nama)===key(teacher.nama));
 const values=teacher.mapel?[teacher.mapel]:matched.map(row=>row.mapel);
 return [...new Set(values.flatMap(value=>Array.isArray(value)?value:[value]).map(value=>String(value||'').trim()).filter(Boolean))];
}
export function accountTeacher(context,teachers){
 const byName=teachers.filter(t=>key(t.nama)===key(context.teacher));
 return byName.length===1?byName[0]:null;
}
export function proposalSubjects(teacherMode,values){return (teacherMode?values.slice(0,1):values).map(value=>String(value||'').trim()).filter(Boolean)}

import {isDate,monday,addDays,todayWIB,CLASSES,YEAR,inSchoolYear} from './clinic-core.mjs';
export const KINDS={switch:'Switch jadwal',project:'Proyek kokurikuler',collaboration:'Kolaborasi kokurikuler',remedial:'Remedial',absence:'Dispensasi / izin KBM'};
export const DAYS=['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
export const timeValue=v=>String(v||'').replace('.',':');
export const validTime=v=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v||'');
export function lessonCatalog(data){
 const out=[];
 for(const [day,slots] of Object.entries(data?.jadwal_kbm_v2?.jadwal_mingguan||{}))for(const classroom of CLASSES){
  let last=null;
  for(const slot of slots){const row=slot.kelas?.[classroom],jp=Number(slot.jam_ke),start=timeValue(slot.mulai),end=timeValue(slot.selesai);
   if(slot.is_break||!Number.isInteger(jp)||jp<1||!row?.mapel||!row.guru_nama||/Upacara|Bimbingan KTI|Wali Kelas/i.test(row.mapel)){last=null;continue}
   if(last&&last.teacher===row.guru_nama&&last.subject===row.mapel&&last.end===start&&last.last_jp+1===jp){last.end=end;last.jp++;last.last_jp=jp;last.id=`${day}-${classroom}-${last.first_jp}-${jp}`}
   else{last={id:`${day}-${classroom}-${jp}-${jp}`,day:DAYS.indexOf(day),classroom,start,end,jp:1,first_jp:jp,last_jp:jp,teacher:row.guru_nama,subject:row.mapel};out.push(last)}
  }
 }
 return out;
}
export function validateSwitch({week,from_id,to_id},lessons){
 if(!isDate(week)||monday(week)!==week||!inSchoolYear(week,YEAR))throw Error('Pilih awal pekan dalam tahun pelajaran.');
 const a=lessons.find(r=>r.id===from_id),b=lessons.find(r=>r.id===to_id);
 if(!a||!b||a.id===b.id||a.classroom!==b.classroom||a.jp!==b.jp||(a.teacher_code||a.teacher)===(b.teacher_code||b.teacher))throw Error('Switch harus kelas sama, jumlah JP sama, dan dua pengampu berbeda.');
 const from_date=addDays(week,a.day-1),to_date=addDays(week,b.day-1);if(!inSchoolYear(from_date)||!inSchoolYear(to_date))throw Error('Kedua sesi harus berada dalam tahun pelajaran yang sama.');
 return{week,from_id,to_id,from_date,to_date};
}
export function effectiveLessons(lessons,requests,week){
 const active=requests.filter(r=>r.kind==='switch'&&r.status==='approved'&&r.body.week===week);
 return lessons.map(row=>{const change=active.find(r=>r.body.from_id===row.id||r.body.to_id===row.id),peer=change&&lessons.find(x=>x.id===(change.body.from_id===row.id?change.body.to_id:change.body.from_id));return {...row,date:addDays(week,row.day-1),...(peer?{teacher:peer.teacher,teacher_code:peer.teacher_code,subject:peer.subject,temporary:true,request_id:change.id}:{})}});
}
export function effectiveHomeSource(source,day,changes,today=todayWIB()){
 const week=monday(today),data=structuredClone(source),slots=data?.jadwal_kbm_v2?.jadwal_mingguan?.[day];if(!slots)return source;
 for(const change of changes.filter(r=>r.kind==='switch'&&r.body.week===week))for(const [key,other] of [['from','to'],['to','from']]){
  const a=change.body[key],b=change.body[other];if(!a||!b||a.day!==DAYS.indexOf(day))continue;
  for(const slot of slots){const row=slot.kelas?.[a.classroom],time=timeValue(slot.mulai);if(row&&!slot.is_break&&time>=a.start&&time<a.end){row.mapel=b.subject;row.guru_nama=b.teacher;row.guru_kode=b.teacher_code;row.temporary_switch=true}}
 }
 return data;
}
export function dutiesToday(data,date=todayWIB()){
 const day=DAYS[new Date(date+'T12:00:00+07:00').getUTCDay()];
 return (data?.jadwal_kbm_v2?.guru_piket||[]).filter(r=>r.hari.toLocaleLowerCase('id')===day);
}
export function validateRequest(kind,data,catalog,context={}){
 if(!KINDS[kind]||!isDate(data.date)||!inSchoolYear(data.date))throw Error('Pilih jenis ajuan dan tanggal yang benar.');
 if(!String(data.title||'').trim()||data.title.length>200)throw Error('Judul wajib diisi, maksimal 200 karakter.');
 if(kind==='switch')return{...data,body:validateSwitch(data.body,catalog.lessons)};
 if(kind==='remedial'&&!['teacher','student','curriculum','admin'].includes(context.role))throw Error('Remedial wajib login SSO akun guru atau murid sekolah.');
 if(['project','collaboration'].includes(kind)&&!String(data.tp||'').trim())throw Error('Tuliskan TP dan kaitannya dengan proyek.');
 if(kind==='collaboration'&&!data.body?.parent_id)throw Error('Pilih proyek yang sudah disetujui.');
 if(!validTime(data.start)||!validTime(data.end)||data.start>=data.end)throw Error('Jam mulai harus sebelum jam selesai.');
 if(['absence','remedial'].includes(kind)&&(!Array.isArray(data.student_ids)||!data.student_ids.length||data.student_ids.some(id=>!catalog.students.some(s=>s.id===id))))throw Error('Pilih murid dari daftar resmi.');
 return data;
}
export const statusLabel=s=>({pending:'Menunggu',approved:'Diterima',rejected:'Ditolak',cancelled:'Dibatalkan'}[s]||s);

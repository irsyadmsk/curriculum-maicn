export const ACCESS_ROLES = ['guest','member','student','teacher','curriculum','admin'];
export const PUBLIC_PAGES = ['index.html','info-murid.html','jadwal.html','kalender.html','klinik.html','kokurikuler.html','kom.html','unggulan.html','akun.html','layanan.html','jurnal.html'];
export const TEACHER_PAGES = ['murid.html','rapor.html','buku-kerja.html','asesmen.html','karakter.html','presensi.html','struktur.html'];
export const REVIEW_PAGES = ['admin.html','kurikulum.html'];
export const PRIVATE_ASSETS = ['assets/student-roster-data.js','assets/report-roster.js','assets/kokurikuler-records.js'];
export function capabilities(role) {
 const teacher=['teacher','admin'].includes(role),reviewer=['curriculum','admin'].includes(role);
 return Object.freeze({public:true,request:true,teacher,reviewer,school:teacher||reviewer||role==='student',admin:role==='admin',studio:role==='admin',authenticated:role!=='guest'});
}
export function parseAccess(value){
 if(!value||value.version!==1||!ACCESS_ROLES.includes(value.role)||value.institution!=='MA Insan Cendekia Nusantara'||value.role!=='guest'&&(typeof value.user_id!=='string'||!value.user_id))throw Error('Hak akses belum dapat diperiksa.');
 if(value.role==='teacher'&&(!/^[A-Z]{2,4}$/.test(value.teacher_code)||typeof value.teacher!=='string'||!value.teacher))throw Error('Akun guru belum terhubung.');
 return {version:1,role:value.role,user_id:value.role==='guest'?null:value.user_id,institution:value.institution,teacher_code:value.teacher_code||null,teacher:value.teacher||'',student_id:value.student_id||null,classroom:value.classroom||null,capabilities:Object.freeze({...capabilities(value.role),teacher:capabilities(value.role).teacher||value.role==='curriculum'&&/^[A-Z]{2,4}$/.test(value.teacher_code||'')&&!!value.teacher,studio:value.studio_allowed===undefined?value.role==='admin':value.studio_allowed===true}),enabled:value.enabled===true};
}
export function routeAccess(path){
 const file=path.replace(/^\//,'').toLowerCase();
 if(file==='jurnal.html')return'school';
 if(file==='assets/clinic-legacy-data.js')return'reviewer';
 if(file==='admin.html')return'admin';
 if(REVIEW_PAGES.includes(file))return'reviewer';
 if(TEACHER_PAGES.includes(file)||PRIVATE_ASSETS.includes(file)||file.startsWith('assets/templates/')||file.startsWith('templates/'))return'teacher';
 return'public';
}
export function normalizePath(path){
 try{const decoded=decodeURIComponent(path);if(!decoded.startsWith('/')||/[\\\0%]/.test(decoded)||decoded.split('/').some(p=>p==='.'||p==='..'))return null;return decoded==='/'?'/index.html':decoded}catch{return null}
}

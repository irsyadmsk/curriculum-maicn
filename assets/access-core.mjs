export const ACCESS_ROLES = ['guest','member','teacher','curriculum','admin'];
export const PUBLIC_PAGES = ['index.html','info-murid.html','jadwal.html','kalender.html','klinik.html','kokurikuler.html','kom.html','unggulan.html','akun.html'];
export const TEACHER_PAGES = ['murid.html','rapor.html','buku-kerja.html','asesmen.html','karakter.html','presensi.html','struktur.html'];
export const REVIEW_PAGES = ['admin.html'];
export const PRIVATE_ASSETS = ['assets/student-roster-data.js','assets/report-roster.js','assets/kokurikuler-records.js'];
export function capabilities(role) {
 const teacher=['teacher','curriculum','admin'].includes(role),reviewer=['curriculum','admin'].includes(role);
 return Object.freeze({public:true,request:true,teacher,reviewer});
}
export function parseAccess(value){
 if(!value||value.version!==1||!ACCESS_ROLES.includes(value.role)||value.institution!=='MA Insan Cendekia Nusantara'||value.role!=='guest'&&(typeof value.user_id!=='string'||!value.user_id))throw Error('Hak akses belum dapat diperiksa.');
 if(value.role==='teacher'&&(!/^[A-Z]{2,4}$/.test(value.teacher_code)||typeof value.teacher!=='string'||!value.teacher))throw Error('Akun guru belum terhubung.');
 return {version:1,role:value.role,user_id:value.role==='guest'?null:value.user_id,institution:value.institution,teacher_code:value.teacher_code||null,teacher:value.teacher||'',capabilities:capabilities(value.role),enabled:value.enabled===true};
}
export function routeAccess(path){
 const file=path.replace(/^\//,'').toLowerCase();
 if(file==='assets/clinic-legacy-data.js')return'reviewer';
 if(REVIEW_PAGES.includes(file))return'reviewer';
 if(TEACHER_PAGES.includes(file)||PRIVATE_ASSETS.includes(file)||file.startsWith('assets/templates/')||file.startsWith('templates/'))return'teacher';
 return'public';
}
export function normalizePath(path){
 try{const decoded=decodeURIComponent(path);if(!decoded.startsWith('/')||/[\\\0%]/.test(decoded)||decoded.split('/').some(p=>p==='.'||p==='..'))return null;return decoded==='/'?'/index.html':decoded}catch{return null}
}

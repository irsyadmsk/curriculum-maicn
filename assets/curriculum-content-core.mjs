export const CONTENT_PAGE='program-kurikulum.html';
export const CONTENT_ADMIN_PAGES=[CONTENT_PAGE,'buku-admin.html'];
export function relatedPage(code){
 if(code.startsWith('AS-'))return 'asesmen.html';
 if(code.startsWith('KK-'))return 'kokurikuler.html';
 return ({'PP-01':'buku-kerja.html','PP-02':'jadwal.html','PP-10':'info-murid.html','PP-11':'klinik.html'})[code]||'unggulan.html';
}
export function contentWrite(value){
 if(!value||typeof value.id!=='string'||!/^(B-\d{4}|[A-Z]{2}-\d{2}|K-\d{2})$/.test(value.id)||!Number.isSafeInteger(value.revision)||value.revision<1||!value.content||typeof value.content!=='object'||Array.isArray(value.content))throw Error('invalid_content');
 return {p_id:value.id,p_expected:value.revision,p_content:value.content};
}

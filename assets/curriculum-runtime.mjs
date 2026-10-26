let pending;
/** Reuse the existing isolated Curriculum session; no assumed cross-domain browser session. */
export async function curriculumDB(){
 if(window.CurriculumDB)return window.CurriculumDB;
 pending??=(async()=>{
  for(const src of ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js','assets/irsyads-session.js','assets/curriculum-data.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)});
  if(!window.CurriculumDB)throw Error('Sesi Curriculum belum tersedia.');return window.CurriculumDB;
 })();
 return pending;
}

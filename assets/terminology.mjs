/** Current interface vocabulary; historical storage keys and authored source files are preserved. */
export const PROFILE_DIMENSIONS=['Keimanan dan ketakwaan terhadap Tuhan Yang Maha Esa','Kewargaan','Penalaran kritis','Kreativitas','Kolaborasi','Kemandirian','Kesehatan','Komunikasi'];
export const PANCA_CINTA=['Cinta Allah dan Rasul-Nya','Cinta Ilmu','Cinta Lingkungan','Cinta Diri dan Sesama Manusia','Cinta Tanah Air'];
export function termText(value){return String(value).replace(/\b(?:Projek\s+)?P5(?:-PPRA|RA)?\b/gi,'Kokurikuler').replace(/Profil Pelajar Pancasila/g,'profil lulusan').replace(/\bPPRA\b/g,'Panca Cinta').replace(/\b(?:santri|siswa|peserta didik)\b/gi,v=>v===v.toUpperCase()?'MURID':/^[A-Z]/.test(v)?'Murid':'murid')}
// Adapt public calendar/agenda labels only. Never rewrite stored notes or roster names.
if(typeof document!=='undefined'){
 const root=location.pathname.endsWith('kalender.html')?document.querySelector('main'):document.querySelector('#ui-agenda-list');
 let active=false;const apply=()=>{if(active||!root)return;active=true;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(node.parentElement.closest('script,style,textarea,input,code,[data-preserve-source]'))continue;const text=termText(node.nodeValue);if(node.nodeValue!==text)node.nodeValue=text}active=false};
 if(root){new MutationObserver(apply).observe(root,{childList:true,subtree:true});apply()}
}

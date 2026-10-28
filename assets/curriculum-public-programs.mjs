// Deliberately selected public summaries. Never import private notes or book blocks here.
export const publicPrograms=[
 {id:'PP-02',title:'Pembelajaran reguler & blok',summary:'Pembelajaran terencana dengan pendampingan guru dan kegiatan pengembangan potensi.',kind:'utama',href:'jadwal.html'},
 {id:'KK-03',title:'Literasi dan pembiasaan',summary:'Kegiatan membaca, refleksi, dan penguatan kebiasaan belajar dalam keseharian madrasah.',kind:'utama',href:'kokurikuler.html'},
 {id:'AS-05',title:'Sumatif akhir semester ganjil',summary:'Persiapan asesmen dan pelaporan hasil belajar semester ganjil.',kind:'rencana',when:'30 November–4 Desember 2026',start:'2026-11-30',end:'2026-12-04',href:'kalender.html'},
 {id:'IN-06',title:'Pelatihan literasi AI untuk guru',summary:'Pengembangan keterampilan penggunaan AI dalam pembelajaran serta etika penggunaannya.',kind:'rencana',when:'Januari 2027',start:'2027-01-01',end:'2027-01-31',href:'program.html#IN-06'},
 {id:'KK-02',title:'Kokurikuler: kesehatan mental & budaya positif',summary:'Rencana projek untuk membangun kepedulian, kesehatan mental, dan budaya positif.',kind:'rencana',when:'Maret–Juni 2027',start:'2027-03-01',end:'2027-06-30',href:'kokurikuler.html'}
];
export const jakartaDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function upcomingPrograms(today=jakartaDate()){return publicPrograms.filter(p=>p.kind==='rencana'&&p.end>=today).sort((a,b)=>a.start.localeCompare(b.start))}
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
export function mountPrograms(target,programs,{home=false,today=jakartaDate()}={}){
 if(!target)return;target.replaceChildren();
 for(const p of programs){const article=el('article',undefined,home?'ui-period':'');article.id=p.id;article.append(el('span',p.kind==='utama'?'PROGRAM UTAMA':p.end<today?'RENCANA DALAM BUKU':p.start<=today?'PERIODE RENCANA SAAT INI':'RENCANA MENDATANG',home?'ui-chip':'eyebrow'),el('h3',p.title),el('p',p.summary));if(p.when)article.append(el('p',p.when));const a=el('a','Lihat bagian terkait',home?'ui-text-link':'');a.href=p.href;article.append(a);target.append(article)}
}
if(typeof document!=='undefined'){
 const home=document.getElementById('home-curriculum-programs');if(home){const upcoming=upcomingPrograms();mountPrograms(home,upcoming.length?upcoming.slice(0,3):publicPrograms.filter(p=>p.kind==='utama'),{home:true})}
 mountPrograms(document.getElementById('main-programs'),publicPrograms.filter(p=>p.kind==='utama'));
 mountPrograms(document.getElementById('planned-programs'),publicPrograms.filter(p=>p.kind==='rencana'));
}

import {access,accessReady} from './curriculum-access.mjs';
import {clinicClient} from './clinic-client.mjs';
import {dateLabel} from './clinic-core.mjs';
import {clinicNotifications} from './clinic-notification-core.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let widget=null,items=[],actor=null,busy=false,revision=0,unread=[];
const storageKey=id=>'curriculum_clinic_notifications_v1_'+encodeURIComponent(id);
function readSeen(){try{const values=JSON.parse(localStorage.getItem(storageKey(actor))||'[]');return new Set(Array.isArray(values)?values.filter(v=>typeof v==='string').slice(-1000):[])}catch{return new Set()}}
function paint(error=''){
 if(!widget)return;const seen=readSeen();unread=items.filter(i=>!seen.has(i.key));const open=widget.open;
 widget.innerHTML=`<summary aria-label="Notifikasi Klinik${unread.length?', '+unread.length+' belum dibaca':''}" title="Notifikasi Klinik"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>${unread.length?`<span class="clinic-notification-count" aria-hidden="true">${unread.length>99?'99+':unread.length}</span>`:''}</summary><section class="clinic-notification-panel" aria-label="Keputusan Klinik untuk Anda"><h2>Notifikasi Klinik</h2><p class="clinic-notification-status" role="status">${esc(error||`${unread.length} belum dibaca`)}</p><div class="clinic-notification-list">${items.length?items.slice(0,50).map(i=>`<article data-status="${i.status}">${!seen.has(i.key)?'<span class="clinic-badge">Baru</span>':''}<strong>${esc(i.title)}</strong><p>${esc(i.subject)} · ${esc(i.classroom)}</p><p>${esc(dateLabel(i.date))} · ${esc(i.start)}–${esc(i.end)} WIB</p>${i.note?`<p>${esc(i.note)}</p>`:''}<a href="/klinik.html?view=requests">Buka ajuan Klinik ↗</a></article>`).join(''):'<p>Belum ada keputusan Klinik untuk akun Anda.</p>'}</div><div class="clinic-notification-actions"><button type="button" data-clinic-notification-refresh>Periksa terbaru</button>${unread.length?'<button type="button" data-clinic-notification-read>Tandai dibaca</button>':''}</div></section>`;
 widget.open=open;widget.querySelector('[data-clinic-notification-refresh]').onclick=()=>refresh();
 widget.querySelector('[data-clinic-notification-read]')?.addEventListener('click',()=>{try{const next=[...readSeen(),...items.map(i=>i.key)];localStorage.setItem(storageKey(actor),JSON.stringify([...new Set(next)].slice(-1000)));paint()}catch{paint('Penanda dibaca belum tersimpan. Coba kembali.')}});
}
async function refresh(){
 const context=access.context;
 if(!access.has('teacher')||!context.user_id){revision++;actor=null;items=[];widget?.remove();widget=null;document.body.classList.remove('has-clinic-notifications');return;}
 const mine=context.user_id;if(busy&&actor===mine)return;const request=++revision;
 if(actor!==mine){actor=mine;items=[];widget?.remove();widget=null;}
 if(!widget){const host=document.querySelector('.clay-topbar-right');if(!host)return;widget=document.createElement('details');widget.className='clinic-notifications';host.prepend(widget);document.body.classList.add('has-clinic-notifications');paint();}
 if(busy)return;busy=true;
 try{const snapshot=await clinicClient(window.CurriculumClinicProxy).read({mode:'mine',owner:mine});if(request!==revision||actor!==mine||access.context.user_id!==mine)return;const next=clinicNotifications(snapshot.rows,context);if(JSON.stringify(next)!==JSON.stringify(items)||widget.querySelector('.clinic-notification-status')?.textContent.includes('belum dapat')){items=next;paint();}}
 catch{if(request===revision)paint('Notifikasi belum dapat diperbarui. Periksa kembali.');}
 finally{busy=false;if(actor&&actor!==mine)refresh();}
}
await accessReady;await refresh();
window.addEventListener('curriculum-access-changed',()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
document.addEventListener('click',event=>{if(widget?.open&&!widget.contains(event.target))widget.open=false});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&widget?.open){widget.open=false;widget.querySelector('summary')?.focus()}});
window.addEventListener('storage',event=>{if(actor&&event.key===storageKey(actor))paint()});
setInterval(()=>{if(!document.hidden)refresh()},60000);

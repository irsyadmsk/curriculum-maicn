import {todayWIB,dateLabel} from './clinic-core.mjs';
import {termText} from './terminology.mjs';
const selector=document.querySelector('#student-info-class'),list=document.querySelector('#student-info-lessons');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const today=todayWIB(),day=['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][new Date(today).getUTCDay()],rows=window.CurriculumUI.scheduleFor(window.MASTER_DATA,day,selector.value);document.querySelector('#student-info-today').textContent=dateLabel(today)+' · WIB';list.innerHTML=rows.length?rows.map(r=>`<article class="ui-schedule-row"><div class="ui-schedule-time"><strong>${esc(r.start)}</strong>${esc(r.end)}</div><div class="ui-schedule-subject"><strong>${esc(termText(r.subject))}</strong><span>${esc(r.teacher||'Pengampu pada jadwal kelas')}</span></div><span class="ui-chip">JP ${esc(r.jp.join('–'))}</span></article>`).join(''):'<p class="clinic-empty">Tidak ada jadwal reguler pada hari ini. Periksa kalender untuk kegiatan khusus madrasah.</p>'}
if(selector&&list){selector.onchange=render;render()}

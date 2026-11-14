// Keep validation visible even when the field lives inside a collapsed section.
export function formError(form, output, message, control){
 if(!control){const routes=[[/email/i,'input[type="email"]'],[/drive|tautan|bukti/i,'input[type="url"]'],[/nama dan kelas pengaju/i,'[data-identity-name]'],[/murid|peserta/i,'#clinic-target,#school-search'],[/pengampu|pilih guru/i,'#clinic-teacher,#school-teacher'],[/mapel/i,'#clinic-subject-0,#school-subject'],[/waktu|tanggal|sesi/i,'#clinic-date,#school-date,#school-week']];for(const [pattern,selector]of routes){if(pattern.test(message)){control=[...form.querySelectorAll(selector)].find(e=>!e.disabled&&!e.closest('[hidden]'));if(control)break}}}
 output.textContent=message;output.hidden=false;
 form.querySelectorAll('[data-inline-error]').forEach(e=>{const id=e.id;form.querySelectorAll('[aria-describedby]').forEach(c=>{const remaining=c.getAttribute('aria-describedby').split(' ').filter(v=>v!==id).join(' ');remaining?c.setAttribute('aria-describedby',remaining):c.removeAttribute('aria-describedby')});e.remove()});
 if(control){for(let p=control.parentElement;p&&p!==form;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;control.setAttribute('aria-invalid','true');const note=document.createElement('span');note.dataset.inlineError='';note.id='field-error-'+(control.id||'identity');note.className='field-error';note.textContent=message;control.insertAdjacentElement('afterend',note);control.setAttribute('aria-describedby',[control.getAttribute('aria-describedby'),note.id].filter(Boolean).join(' '));control.focus();control.scrollIntoView?.({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 else output.scrollIntoView?.({block:'nearest',behavior:'smooth'});
}
export function checkForm(form,output){
 const control=[...form.elements].find(el=>el.willValidate&&!el.validity.valid);
 if(!control)return true;
 const label=(control.labels?.[0]?.childNodes[0]?.textContent||control.getAttribute('aria-label')||'isian wajib').trim();
 formError(form,output,control.validity.valueMissing?'Lengkapi '+label+'.':control.validity.typeMismatch?'Periksa format '+label+'.':'Periksa '+label+'. '+control.validationMessage,control);return false;
}
const prepared=new WeakSet();
export function prepareForm(form){form.noValidate=true;if(!prepared.has(form)){form.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');const note=e.target.nextElementSibling;if(note?.hasAttribute('data-inline-error')){const id=note.id,remaining=(e.target.getAttribute('aria-describedby')||'').split(' ').filter(v=>v&&v!==id).join(' ');remaining?e.target.setAttribute('aria-describedby',remaining):e.target.removeAttribute('aria-describedby');note.remove()}});prepared.add(form);}}

import {requestJSON} from './curriculum-api.mjs';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Storage failure must never turn an acknowledged server write into a failure.
export function deviceStore(){
 const memory=new Map(),unreadable=new Set();let volatile=false;
 return {get volatile(){return volatile},read(key,fallback=null){
  if(memory.has(key))return memory.get(key);
  let raw;try{raw=localStorage.getItem(key)}catch{volatile=true;return fallback}
  if(raw===null)return fallback;
  try{const value=JSON.parse(raw);memory.set(key,value);return value}catch{unreadable.add(key);throw Error('Catatan perangkat belum dapat dibaca. Data asal dipertahankan; periksa status ajuan sebelumnya sebelum mengirim ulang.')}
 },cache(key,value){unreadable.add(key);volatile=true;memory.set(key,value)},write(key,value){memory.set(key,value);if(unreadable.has(key)){volatile=true;return value}try{localStorage.setItem(key,JSON.stringify(value))}catch{volatile=true}return value},remove(key){memory.set(key,null);if(unreadable.has(key)){volatile=true;return}try{localStorage.removeItem(key)}catch{volatile=true}}};
}
export async function sendPending(url,payload){
 const receipt=await requestJSON(url,{body:payload,timeout:45000});
 if(receipt?.id!==payload.id||receipt.token!==payload.token||receipt.status!=='pending')throw Error('Bukti penerimaan belum sesuai. Periksa status dengan nomor ajuan yang sama sebelum mengirim ulang.');
 return receipt;
}
export function lockInputs(form){
 const controls=[...form.querySelectorAll('input,select,textarea')].map(control=>[control,control.disabled]);
 controls.forEach(([control])=>control.disabled=true);
 return ()=>controls.forEach(([control,disabled])=>control.disabled=disabled);
}
export function showReceipt(host,receipt,{summary='',onCheck,volatile=false}={}){
 if(!host||!receipt)return;
 const status={approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan',pending:'Menunggu keputusan kurikulum'}[receipt.status]||'Diterima server';
 host.innerHTML=`<section class="submission-receipt" aria-label="Bukti penerimaan"><p class="ui-eyebrow">DITERIMA SERVER</p><h3>Ajuan sudah masuk.</h3><p>${escapeHTML(summary)}</p><dl><div><dt>Nomor ajuan</dt><dd>${escapeHTML(receipt.id)}</dd></div><div><dt>Status</dt><dd>${status}</dd></div></dl><div class="submission-receipt-actions"><button type="button" data-copy-receipt>Salin nomor</button>${onCheck?'<button type="button" data-check-receipt>Periksa status</button>':''}</div><p role="status" data-receipt-status>${volatile?'Simpan nomor ini. Catatan hanya tersedia selama halaman ini terbuka.':'Tidak perlu mengirim ulang. Bukti penerimaan ini tetap berlaku saat pembaruan daftar terkendala.'}</p></section>`;
 host.querySelector('[data-copy-receipt]').onclick=async()=>{const output=host.querySelector('[data-receipt-status]');try{await navigator.clipboard.writeText(receipt.id);output.textContent='Nomor ajuan disalin.'}catch{const input=document.createElement('textarea');input.value=receipt.id;host.append(input);input.focus();input.select();output.textContent='Pilih Salin pada nomor yang sudah disorot.'}};
 const check=host.querySelector('[data-check-receipt]');if(check)check.onclick=async()=>{check.disabled=true;check.textContent='Memeriksa…';try{await onCheck()}catch(error){host.querySelector('[data-receipt-status]').textContent=error.message}finally{check.disabled=false;check.textContent='Periksa status'}};
}
let scriptPromise;
async function loadTurnstile(){
 if(window.turnstile)return;
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();reject(Error('Verifikasi terlalu lama dimuat. Periksa koneksi lalu coba lagi.'))},12000);script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Verifikasi belum dapat dimuat. Isian tetap ada; coba lagi.'))};document.head.append(script)}).catch(error=>{scriptPromise=null;throw error});
 await scriptPromise;
}
export function verificationGate(host,{sitekey,action,size,appearance,submitLabel="Kirim ajuan",onStatus=()=>{}}){
 let widget=null,token='',mounting=null,disposed=false,failed=false;
 const waiting=new Set();
 const settle=(error,value)=>{for(const entry of waiting){clearTimeout(entry.timer);error?entry.reject(error):entry.resolve(value)}waiting.clear()};
 async function mount(){
  if(disposed)throw Error('Formulir sudah ditutup. Buka kembali untuk melanjutkan.');
  if(widget!==null)return;
  if(!sitekey)throw Error('Verifikasi belum tersedia. Periksa koneksi dan muat konfigurasi kembali.');
  if(!mounting)mounting=(async()=>{await loadTurnstile();if(disposed)return;widget=window.turnstile.render(host,{sitekey,action,...(size?{size}:{}),...(appearance?{appearance}:{}),callback:value=>{token=value;failed=false;onStatus('Verifikasi selesai.');settle(null,value)},'expired-callback':()=>{token='';failed=true;onStatus('Verifikasi kedaluwarsa. Tekan '+submitLabel+' untuk memperbaruinya.')},'error-callback':()=>{token='';failed=true;const error=Error('Verifikasi terkendala koneksi. Tekan '+submitLabel+' untuk mencoba lagi.');onStatus(error.message);settle(error)}})})().catch(error=>{mounting=null;throw error});
  await mounting;
 }
 return {get ready(){return !!token},mount,async wait(){await mount();if(disposed)throw Error('Formulir sudah ditutup.');if(token)return token;if(failed){failed=false;window.turnstile.reset(widget)}onStatus('Selesaikan kotak verifikasi untuk melanjutkan.');return new Promise((resolve,reject)=>{const entry={resolve,reject,timer:setTimeout(()=>{waiting.delete(entry);reject(Error('Verifikasi belum selesai. Selesaikan kotaknya, lalu tekan '+submitLabel+' lagi.'))},30000)};waiting.add(entry)})},reset(){token='';failed=false;if(widget!==null)try{window.turnstile.reset(widget)}catch{widget=null;mounting=null}},dispose(){disposed=true;token='';settle(Error('Verifikasi dibatalkan karena formulir ditutup.'));if(widget!==null)try{window.turnstile.remove(widget)}catch{}}};
}

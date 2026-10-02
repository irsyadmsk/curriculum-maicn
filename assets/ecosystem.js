// Public UI only. Firebase and academic data remain under their existing controls.
(() => {
 const target=document.querySelector('.nav-right'); if(!target)return;
 const appearance=document.createElement('details');appearance.className='irsyads-controls';
 appearance.innerHTML='<summary aria-label="Tampilan" title="Tampilan">◐ <span>Tampilan</span></summary><div><label>Tema<select id="irsyads-theme"><option value="system">Ikuti perangkat</option><option value="light">Terang</option><option value="dark">Gelap</option></select></label><label>Warna<select id="irsyads-palette"><option value="krem">Irsyads</option><option value="forest">Hutan</option><option value="ocean">Laut</option><option value="royal">Royal</option><option value="aurora">Aurora</option><option value="earth">Bumi</option></select></label></div>';
 const launcher=document.createElement('details');launcher.className='irsyads-controls';
 launcher.innerHTML='<summary aria-label="Ruang Irsyads" title="Ruang Irsyads">▦ <span>Ruang Irsyads</span></summary><div><strong>Ruang Irsyads</strong><div class="irsyads-app-links"></div></div>';
 target.prepend(appearance,launcher);
 const theme=appearance.querySelector('select#irsyads-theme'),palette=appearance.querySelector('select#irsyads-palette');
 const read=()=>{try{return localStorage.getItem('irsyads-theme')||'system'}catch{return document.cookie.split(/;\s*/).find(v=>v.startsWith('irsyads-appearance-theme='))?.split('=')[1]||'system'}};
 const sync=()=>{theme.value=read();palette.value=document.documentElement.dataset.palette||'krem'};sync();
 theme.addEventListener('change',()=>window.dispatchEvent(new CustomEvent('irsyads-appearance-change',{detail:{theme:theme.value}})));
 palette.addEventListener('change',()=>window.dispatchEvent(new CustomEvent('irsyads-appearance-change',{detail:{palette:palette.value}})));
 window.addEventListener('focus',sync);window.addEventListener('pageshow',sync);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){appearance.open=false;launcher.open=false}});
 document.addEventListener('click',e=>{if(!appearance.contains(e.target))appearance.open=false;if(!launcher.contains(e.target))launcher.open=false});
 let apps=[],groups={},tiles=null;
 const populate=()=>{
  const lang=window.IrsyadsLanguage?.preferredLanguage()||'id',box=launcher.querySelector('.irsyads-app-links');box.replaceChildren();
  const choices=tiles??apps.filter(app=>app.launcher&&app.group!=='pengelola').slice(0,9).map(app=>({id:app.id,group:app.group}));
  for(const group of ['karya','aplikasi','akun']) {
  const selected=choices.filter(tile=>tile.group===group).flatMap(tile=>{const app=apps.find(app=>app.id===tile.id&&app.launcher&&app.group!=='pengelola');return app?[app]:[]});
  if(selected.length){const heading=document.createElement('strong');heading.textContent=groups[group]?.id||group;heading.style.gridColumn='1 / -1';box.append(heading)}
  for(const app of selected){
   const a=document.createElement('a'),url=new URL(app.url);a.textContent=app.name+(app.status==='beta'?' · Beta':'');a.title=app.description.id;
   if(app.id==='site'&&lang!=='id')url.pathname='/'+lang+'/';
   if(['verify','letters'].includes(app.id)&&app.languages.includes(lang))url.searchParams.set('lang',lang);
   a.href=url.toString();a.dataset.launcherId=app.id;if(app.id==='curriculum')a.setAttribute('aria-current','page');box.append(a);
  }
  }
  const studio=apps.find(app=>app.id==='studio');if(studio){const a=document.createElement('a');a.textContent=studio.name;a.href=studio.url;a.style.gridColumn='1 / -1';box.append(a)}
  const all=document.createElement('a');all.textContent='Semua aplikasi →';all.href='https://irsyads.com'+(lang==='id'?'':'/'+lang)+'/apps';box.append(all);
  document.querySelectorAll('a[href="https://irsyads.com"]').forEach(a=>a.href='https://irsyads.com'+(lang==='id'?'':'/'+lang)+'/');
 };
 fetch('assets/irsyads-v1/ecosystem.json').then(r=>{if(!r.ok)throw Error('registry');return r.json()}).then(data=>{apps=data.apps;groups=data.groups;populate()}).catch(()=>{const a=document.createElement('a');a.textContent='Semua aplikasi Irsyads';a.href='https://irsyads.com/apps';launcher.querySelector('.irsyads-app-links').append(a)});
 launcher.addEventListener('toggle',async()=>{if(launcher.open&&apps.length){populate();if(window.IrsyadsLauncher){tiles=await window.IrsyadsLauncher.readLauncher();populate()}}});
})();

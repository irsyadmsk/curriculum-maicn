// Public navigation only; academic data and authentication keep their controls.
(() => {
 const navbar=document.querySelector('.navbar'); if(!navbar)return;
 const brand=navbar.querySelector('.nav-brand'),navigation=document.createElement('div');
 if(brand)brand.replaceWith(navigation);else navbar.prepend(navigation);
 window.IrsyadsServiceNavigation?.mount(navigation,'curriculum','Curriculum');
 const target=navbar.querySelector('.nav-right')||navbar;
 const appearance=document.createElement('details');appearance.className='irsyads-controls';
 appearance.innerHTML='<summary aria-label="Tampilan / Appearance" title="Tampilan / Appearance"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg></summary><div><label>Warna / Palette<select id="irsyads-palette"><option value="krem">Irsyads</option><option value="forest">Hutan</option><option value="ocean">Laut</option><option value="royal">Royal</option><option value="aurora">Aurora</option><option value="earth">Bumi</option></select></label></div>';
 target.prepend(appearance);
 const palette=appearance.querySelector('select');
 const sync=()=>{palette.value=document.documentElement.dataset.palette||'krem'};sync();
 palette.addEventListener('change',()=>window.IrsyadsPreferences?.set({palette:palette.value}));
 window.addEventListener('irsyads-preferences-applied',sync);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&appearance.open){appearance.open=false;appearance.querySelector('summary').focus()}});
 document.addEventListener('click',e=>{if(!appearance.contains(e.target))appearance.open=false});
 // Native details need no scroll lock or scrollTo; the document keeps its position.
})();

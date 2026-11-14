/** Peluncur semua layanan kurikulum di atas halaman Layanan akademik. */
import {access, accessReady} from './curriculum-access.mjs';
import {serviceCards} from './room-ui.mjs';
await accessReady;
const root = document.querySelector('#school-root');
if (root && !document.querySelector('.room-hub')) {
  const hub = document.createElement('section');
  hub.className = 'room-hub'; hub.setAttribute('aria-label', 'Semua layanan kurikulum');
  const render = () => { hub.innerHTML = `<div class="room-hub-head"><h2>Semua layanan kurikulum</h2><p>Ajukan, catat, dan kelola dari satu pintu. Layanan yang tampil mengikuti akun Anda.</p></div>${serviceCards(access.has)}`; };
  render(); root.before(hub);
  access.subscribe(render);
  // Kartu "Ajukan" pada halaman ini langsung mengganti jenis formulir tanpa memuat ulang.
  hub.addEventListener('click', event => {
    const card = event.target.closest('a[href^="layanan.html?kind="]'), select = document.querySelector('#school-kind');
    if (!card || !select) return;
    event.preventDefault();
    select.value = new URL(card.href).searchParams.get('kind'); select.dispatchEvent(new Event('change'));
    history.replaceState(null, '', card.getAttribute('href'));
    document.querySelector('#ajukan')?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
    document.querySelector('#school-title')?.focus({preventScroll: true});
  });
}

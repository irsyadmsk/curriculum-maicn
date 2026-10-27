/* Local UI only. Academic records, authentication and shared navigation are unchanged. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const icon = name => {
    const paths = {
      search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>',
      arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      page: '<path d="M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h6"/>',
      chart: '<path d="M4 3v18h17M9 16v-5m5 5V7m5 9V4"/>',
      users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.page}</svg>`;
  };

  function dateInJakarta(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  const dateLabel = (date, options = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('id-ID', { ...options, timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`));

  // Only join adjacent slots with exactly the same source identity and touching times.
  function scheduleFor(source, day, classroom) {
    const slots = source?.jadwal_kbm_v2?.jadwal_mingguan?.[day];
    if (!Array.isArray(slots)) return [];
    const result = [];
    let previousSourceWasLesson = false;
    for (const slot of slots) {
      const lesson = slot.kelas?.[classroom];
      if (slot.is_break || !lesson?.mapel) { previousSourceWasLesson = false; continue; }
      const previous = result[result.length - 1];
      if (previousSourceWasLesson && previous && previous.end === slot.mulai && previous.subject === lesson.mapel && previous.teacher === lesson.guru_nama && previous.code === lesson.guru_kode) {
        previous.end = slot.selesai;
        previous.jp.push(String(slot.jam_ke));
      } else {
        result.push({ start: slot.mulai, end: slot.selesai, subject: lesson.mapel, teacher: lesson.guru_nama || '', code: lesson.guru_kode || '', jp: [String(slot.jam_ke)] });
      }
      previousSourceWasLesson = true;
    }
    return result;
  }

  function upcomingAgenda(source, today) {
    const entries = Object.entries(source?.kalender_harian || {}).sort(([a],[b]) => a.localeCompare(b));
    const ranges = [];
    for (const [date, value] of entries) {
      if (!value.l || /^(kbm|pembelajaran|mat_kbm)$/.test(value.c) || /^(Libur Mingguan|KBM Reguler)$/i.test(value.l)) continue;
      const previous = ranges[ranges.length - 1];
      const adjacent = previous && new Date(`${date}T12:00:00Z`) - new Date(`${previous.end}T12:00:00Z`) === 86400000;
      if (adjacent && previous.label === value.l && previous.category === value.c) previous.end = date;
      else ranges.push({ start: date, end: date, label: value.l, category: value.c, program: value.p || '' });
    }
    return ranges.filter(range => range.end >= today).slice(0, 3);
  }

  // Exposed pure projections let focused offline checks verify source fidelity.
  function legacyDialogIsOpen(modal) {
    // Calendar overlays remain display:flex while closed, with opacity:0.
    // Only an explicit application open state may isolate the rest of the page.
    if (modal.hidden || !['active','open','show'].some(state => modal.classList.contains(state))) return false;
    const style = getComputedStyle(modal);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  window.CurriculumUI = { scheduleFor, upcomingAgenda, dateInJakarta, legacyDialogIsOpen };

  function initializeDrawer() {
    const sidebar = $('.clay-sidebar');
    if (!sidebar) return;
    const breakpoint = window.matchMedia('(max-width: 1024px)');
    $$('.clay-mobile-menu-btn').forEach(button => button.setAttribute('aria-controls', 'main-clay-sidebar'));
    let returnFocus = null;
    const isolated = new Map();
    function isolateBackground() {
      // Isolate siblings along the sidebar's ancestor path, including the fixed bottom bar.
      let current = sidebar;
      while (current && current !== document.body) {
        for (const sibling of current.parentElement.children) {
          if (sibling === current || sibling.matches('script,style,.clay-drawer-backdrop')) continue;
          if (!isolated.has(sibling)) isolated.set(sibling, sibling.inert);
          sibling.inert = true;
        }
        current = current.parentElement;
      }
    }
    function releaseBackground() { isolated.forEach((inert, element) => { element.inert = inert; }); isolated.clear(); }
    function setDrawer(open, restore = true) {
      open = Boolean(open && breakpoint.matches);
      const wasOpen = document.body.classList.contains('drawer-open');
      if (open && !wasOpen) returnFocus = document.activeElement;
      document.body.classList.toggle('drawer-open', open);
      $$('[aria-controls="main-clay-sidebar"]').forEach(button => button.setAttribute('aria-expanded', String(open)));
      sidebar.inert = breakpoint.matches && !open;
      if (open) {
        sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true');
        isolateBackground(); $('.clay-drawer-close-btn', sidebar)?.focus();
      } else {
        sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); releaseBackground();
        if (wasOpen && restore && returnFocus?.isConnected) returnFocus.focus();
      }
    }
    window.toggleClayDrawer = open => setDrawer(typeof open === 'boolean' ? open : !document.body.classList.contains('drawer-open'));
    $('.clay-drawer-backdrop')?.addEventListener('click', () => setDrawer(false));
    sidebar.addEventListener('click', event => { if (event.target.closest('a[href]')) setDrawer(false, false); });
    document.addEventListener('keydown', event => {
      if (!document.body.classList.contains('drawer-open')) return;
      if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); }
      if (event.key === 'Tab') {
        const focusable = $$('a[href],button:not([disabled]),input,select,[tabindex="0"]', sidebar).filter(element => element.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    breakpoint.addEventListener('change', () => { document.body.classList.remove('sidebar-collapsed'); setDrawer(false, false); });
    if (breakpoint.matches) document.body.classList.remove('sidebar-collapsed');
    setDrawer(false, false);
  }

  function initializeSearch() {
    const topbar = $('.clay-topbar-right');
    if (topbar && !$('[data-open-search]', topbar)) {
      const trigger = document.createElement('button');
      trigger.type = 'button'; trigger.className = 'ui-search-trigger'; trigger.dataset.openSearch = '';
      trigger.setAttribute('aria-label', 'Cari halaman dan layanan');
      trigger.innerHTML = `${icon('search')}<span>Cari di Curriculum</span><kbd>Ctrl K</kbd>`;
      topbar.prepend(trigger);
    }
    const records = $$('.clay-sidebar .clay-nav-item[href]').map(link => ({ title: link.textContent.trim(), href: link.getAttribute('href'), keywords: '' }));
    records.push(
      { title: 'Presensi & jurnal mengajar', href: 'jadwal.html#tab-presensi', keywords: 'presensi murid hadir jurnal kelas' },
      { title: 'Guru piket', href: 'jadwal.html#tab-piket', keywords: 'piket jurnal catatan' },
      { title: 'Info murid', href: 'info-murid.html', keywords: 'murid jadwal kelas informasi klinik tanpa akun' },
      { title: 'Direktori guru', href: 'index.html#section-teachers', keywords: 'nama pengampu mapel mata pelajaran' },
      { title: 'Studio Kurikulum', href: 'https://studio.irsyads.com/?lang=id#kurikulum', keywords: 'ruang kerja kelola' },
    );
    const dialog = document.createElement('dialog');
    dialog.className = 'ui-command'; dialog.setAttribute('aria-labelledby', 'ui-command-title');
    dialog.innerHTML = `<div class="ui-command-head"><h2 id="ui-command-title">Mau menuju ke mana?</h2><button type="button" class="ui-icon-button" aria-label="Tutup pencarian">${icon('close')}</button></div><div class="ui-field-search">${icon('search')}<label class="sr-only" for="ui-command-input">Cari halaman dan layanan</label><input type="search" id="ui-command-input" placeholder="Jadwal, presensi, buku kerja…" autocomplete="off"></div><p class="sr-only" role="status" id="ui-command-count"></p><div class="ui-command-results"></div><div class="ui-command-footer">Gunakan Tab untuk memilih · Enter untuk membuka · Esc untuk menutup</div>`;
    document.body.append(dialog);
    const input = $('input', dialog), results = $('.ui-command-results', dialog);
    function render() {
      const query = input.value.trim().toLocaleLowerCase('id');
      const matches = records.filter(record => (window.CurriculumAccess?.canLink(record.href) ?? false) && `${record.title} ${record.keywords}`.toLocaleLowerCase('id').includes(query));
      $('#ui-command-count').textContent = `${matches.length} halaman ditemukan`;
      results.innerHTML = matches.length ? matches.map(record => `<a class="ui-command-result" href="${escapeHTML(record.href)}">${icon('page')}<span><strong>${escapeHTML(record.title)}</strong><small>${record.href.startsWith('https:') ? 'Ruang pengelolaan · perlu otorisasi' : 'Portal Curriculum'}</small></span>${icon('arrow')}</a>`).join('') : '<div class="ui-empty"><strong>Halaman tidak ditemukan</strong>Coba “jadwal”, “guru”, atau “buku kerja”.</div>';
    }
    function openSearch() {
      if (document.body.classList.contains('drawer-open')) window.toggleClayDrawer(false);
      input.value = ''; render(); dialog.showModal(); input.focus();
    }
    $$('[data-open-search]').forEach(button => button.addEventListener('click', openSearch));
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $('a', results)?.click(); } if (event.key === 'ArrowDown') { event.preventDefault(); $('a', results)?.focus(); } });
    $('.ui-icon-button', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } if (event.target.closest('a')) dialog.close(); });
    document.addEventListener('keydown', event => {
      const editing = event.target.closest('input,textarea,select,[contenteditable="true"]');
      if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !editing)) { event.preventDefault(); if (!dialog.open) openSearch(); }
    });
  }

  function initializeHome() {
    if (!$('#ui-schedule-list')) return;
    const source = window.MASTER_DATA;
    const today = dateInJakarta();
    const now = new Date(`${today}T12:00:00+07:00`);
    const weekday = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][now.getUTCDay()];
    const daySelect = $('#ui-schedule-day');
    daySelect.value = ['sabtu','minggu'].includes(weekday) ? 'senin' : weekday;
    let classroom = 'X-1';
    function renderSchedule() {
      const slots = scheduleFor(source, daySelect.value, classroom);
      $('#ui-schedule-list').innerHTML = slots.length ? slots.map(slot => `<div class="ui-schedule-row"><div class="ui-schedule-time"><strong>${escapeHTML(slot.start)}</strong>${escapeHTML(slot.end)}</div><div class="ui-schedule-subject"><strong>${escapeHTML(slot.subject)}</strong><span>${escapeHTML(slot.teacher || 'Pengampu belum tercantum')}</span></div><span class="ui-chip">JP ${escapeHTML(slot.jp.join('–'))}</span></div>`).join('') : '<p class="ui-empty">Jadwal untuk pilihan ini belum tersedia.</p>';
      $('#ui-schedule-summary').textContent = `${daySelect.selectedOptions[0].textContent} · ${classroom} · ${slots.length} kegiatan`;
    }
    $$('[data-schedule-class]').forEach(button => button.addEventListener('click', () => {
      classroom = button.dataset.scheduleClass;
      $$('[data-schedule-class]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      renderSchedule();
    }));
    daySelect.addEventListener('change', renderSchedule);
    renderSchedule();

    const teachers = source?.jadwal_kbm_v2?.matriks_guru || [];
    $('#ui-stat-teachers').textContent = teachers.length || '—';
    $('#ui-stat-classes').textContent = source?.jadwal_kbm_v2?.rombongan_belajar?.length || '—';
    if ($('#ui-stat-weeks')) $('#ui-stat-weeks').textContent = source?.headline?.minggu_efektif ?? '—';
    if ($('#ui-stat-students')) $('#ui-stat-students').textContent = window.MAICN_ROSTER_SUMMARY?.assigned ?? window.StudentRoster?.assigned().length ?? '—';
    $('#ui-stat-duration').innerHTML = `${escapeHTML(source?.jadwal_kbm_v2?.durasi_jp ?? '—')}<span style="display:inline;font-size:12px;margin-left:4px">mnt</span>`;

    window.renderPortalTeachers = (query = '') => {
      const normalized = query.trim().toLocaleLowerCase('id');
      const filtered = teachers.filter(teacher => `${teacher.nama} ${teacher.mapel} ${teacher.kode}`.toLocaleLowerCase('id').includes(normalized));
      $('#portal-teacher-count').textContent = `${filtered.length} dari ${teachers.length} guru pengampu`;
      $('#portal-teacher-empty').hidden = filtered.length > 0;
      $('#portal-teacher-list').hidden = filtered.length === 0;
      $('#portal-teacher-list').innerHTML = filtered.map(teacher => `<div class="teacher-item-card"><div class="teacher-code-badge" aria-hidden="true">${escapeHTML(teacher.kode)}</div><div><div class="teacher-name-label">${escapeHTML(teacher.nama)}</div><div class="teacher-subject-label">${escapeHTML(teacher.mapel)}</div></div></div>`).join('');
      $('#portal-teacher-list').scrollTop = 0;
    };
    window.filterPortalTeachers = event => window.renderPortalTeachers(event.target.value);
    window.renderPortalTeachers();

    const terms = [
      { name: 'Semester ganjil', start: '2026-07-13', end: '2026-12-18' },
      { name: 'Jeda semester', start: '2026-12-19', end: '2027-01-03' },
      { name: 'Semester genap', start: '2027-01-04', end: '2027-06-18' },
    ];
    const term = terms.find(item => today >= item.start && today <= item.end);
    $('#ui-today-label').textContent = dateLabel(today, { day: 'numeric', month: 'short', year: 'numeric' });
    if (term) {
      $('#ui-term-name').textContent = term.name;
      $('#ui-term-range').textContent = `${dateLabel(term.start)} – ${dateLabel(term.end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
      const progress = Math.max(0,Math.min(100,Math.round((now - new Date(`${term.start}T12:00:00+07:00`)) / (new Date(`${term.end}T12:00:00+07:00`) - new Date(`${term.start}T12:00:00+07:00`)) * 100)));
      $('.ui-term-progress').setAttribute('aria-valuenow', progress);
      $('.ui-term-progress span').style.width = `${progress}%`;
      $('#ui-term-progress-label').textContent = `${progress}% rentang semester`;
    } else {
      $('#ui-term-name').textContent = today < terms[0].start ? 'Menjelang tahun ajaran' : 'Tahun ajaran berakhir';
      $('.ui-term-progress').hidden = true;
    }

    const agenda = upcomingAgenda(source, today);
    $('#ui-agenda-subtitle').textContent = 'Agenda berikutnya · kalender sumber';
    $('#ui-agenda-list').innerHTML = agenda.length ? agenda.map(item => `<article class="ui-agenda-item"><div class="ui-agenda-date" aria-hidden="true"><span>${dateLabel(item.start,{ month:'short' })}</span><strong>${dateLabel(item.start,{ day:'numeric' })}</strong></div><div><h3>${escapeHTML(item.label)}</h3><p>${dateLabel(item.start)}${item.end !== item.start ? ` – ${dateLabel(item.end)}` : ''}</p><span class="ui-chip">${escapeHTML(item.program || 'Kalender akademik')}</span></div></article>`).join('') : '<p class="ui-empty">Belum ada agenda berikutnya pada kalender sumber tahun ini.</p>';
  }

  function initializeScheduleCards() {
    const table = $('#table-kbm'), tbody = $('#tbody-kbm');
    if (!table || !tbody) return;
    const tableWrapper = table.closest('.table-wrap,.ui-table-scroll');
    if (!tableWrapper) return;
    const toolbar = document.createElement('div'); toolbar.className = 'ui-schedule-view';
    toolbar.innerHTML = '<span>Tampilan jadwal</span><div class="ui-segmented" role="group" aria-label="Tampilan jadwal"><button type="button" data-view="cards" aria-pressed="true">Kartu</button><button type="button" data-view="table" aria-pressed="false">Tabel</button></div>';
    const cards = document.createElement('div'); cards.className = 'ui-lesson-cards'; cards.setAttribute('aria-live', 'polite');
    tableWrapper.before(toolbar,cards);
    const mobile = matchMedia('(max-width: 700px)');
    const tabbar = $('.clay-tab-bar');
    if (tabbar) {
      const mobileTabs = document.createElement('div'); mobileTabs.className = 'ui-mobile-tabs';
      const label = document.createElement('label'); label.htmlFor = 'ui-academic-view'; label.textContent = 'Ruang jadwal';
      const select = document.createElement('select'); select.id = 'ui-academic-view';
      const buttons = $$('.tab-btn[data-tab]',tabbar);
      const names = {'tab-kbm':'Jadwal mengajar','tab-matriks':'Direktori & matriks guru','tab-piket':'Guru piket','tab-inval':'Izin & tukar jadwal','tab-asrama':'Rutinitas asrama','tab-presensi':'Presensi KBM'};
      buttons.forEach(button => { const option=document.createElement('option'); option.value=button.dataset.tab; option.textContent=names[option.value]||button.textContent.trim(); option.selected=button.classList.contains('active'); if(button.dataset.needs)option.dataset.needs=button.dataset.needs; select.append(option); button.addEventListener('click',()=>{select.value=button.dataset.tab;}); });
      select.addEventListener('change',()=>buttons.find(button=>button.dataset.tab===select.value)?.click());
      mobileTabs.append(label,select); tabbar.before(mobileTabs); tabbar.classList.add('ui-desktop-tabs');
    }
    const actions = $('#tab-kbm .action-buttons');
    if (actions) {
      const details=document.createElement('details'); details.className='ui-schedule-actions'; details.open=!mobile.matches;
      const summary=document.createElement('summary'); summary.textContent='Tindakan jadwal'; actions.before(details); details.append(summary,actions);
      mobile.addEventListener('change',()=>{details.open=!mobile.matches;});
    }
    let view = mobile.matches ? 'cards' : 'table';
    const setView = choice => {
      view = choice;
      tableWrapper.classList.toggle('ui-table-on-mobile', choice === 'table');
      cards.classList.toggle('ui-cards-active', choice === 'cards');
      $$('[data-view]',toolbar).forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view === choice)));
    };
    function renderCards() {
      cards.replaceChildren();
      for (const row of tbody.rows) {
        const cells = [...row.cells];
        if (cells.length < 4) {
          const breakRow = document.createElement('p'); breakRow.className = 'ui-lesson-break'; breakRow.textContent = cells[0]?.textContent.trim().replace(/☕\s*—\s*|\s*—$/g,'') || ''; cards.append(breakRow); continue;
        }
        const card = document.createElement('article'); card.className = 'ui-lesson-card';
        const subject = $('.mapel-title',cells[3])?.textContent.trim() || cells[3].textContent.trim();
        const teacher = $('.guru-sub',cells[3])?.textContent.trim().replace(/\s+/g,' ') || '';
        const status = cells[4]?.textContent.trim().replace(/[●⚠️🔄]/gu,'').trim() || 'Terjadwal';
        card.innerHTML = `<div class="ui-lesson-meta"><span class="ui-chip">JP ${escapeHTML(cells[0].textContent.trim())}</span><span>${escapeHTML(cells[1].textContent.trim())} · ${escapeHTML(cells[2].textContent.trim())}</span></div><h3>${escapeHTML(subject)}</h3><p>${escapeHTML(teacher)}</p><div class="ui-lesson-bottom"><span>${escapeHTML(status === 'Terjadwal Hadir' ? 'Terjadwal' : status)}</span></div>`;
        const originalAction = $('button',cells[cells.length-1]);
        if (originalAction) {
          const action = document.createElement('button'); action.type = 'button'; action.className = 'ui-button'; action.textContent = originalAction.textContent.trim();
          action.addEventListener('click', () => originalAction.click()); $('.ui-lesson-bottom',card).append(action);
        }
        cards.append(card);
      }
      setView(view);
    }
    toolbar.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)setView(button.dataset.view);});
    mobile.addEventListener('change',()=>setView(mobile.matches?'cards':'table'));
    new MutationObserver(renderCards).observe(tbody,{childList:true});
    window.addEventListener('monday-block-updated',renderCards);
    renderCards();
  }

  function initializeLegacyDialogs() {
    $$('.modal-overlay,.clay-modal-overlay,.p5-modal-backdrop').forEach((modal,index) => {
      let open=false, previousFocus=null;
      const isolated=new Map();
      const closeButton=$('.modal-close-btn,.modal-close,.p5-modal-close,button[aria-label*="Tutup"],button[onclick^="close"]',modal);
      if(closeButton) closeButton.setAttribute('aria-label','Tutup dialog');
      const close=()=>{if(closeButton)closeButton.click();else modal.classList.remove('active','open','show');};
      function sync() {
        const visible=legacyDialogIsOpen(modal);
        if(visible===open)return;
        open=visible;
        if(open) {
          previousFocus=document.activeElement;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
          const heading=$('h2,h3',modal);
          if(heading && !modal.hasAttribute('aria-labelledby')){heading.id ||= `ui-dialog-heading-${index}`;modal.setAttribute('aria-labelledby',heading.id);}
          let current=modal;
          while(current && current!==document.body){for(const sibling of current.parentElement.children){if(sibling===current||sibling.matches('script,style'))continue;isolated.set(sibling,sibling.inert);sibling.inert=true;}current=current.parentElement;}
          (closeButton||$('input,select,textarea,button',modal))?.focus();
        } else {
          isolated.forEach((inert,element)=>{element.inert=inert;});isolated.clear();
          if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
        }
      }
      modal.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();close();}
        if(event.key==='Tab'){
          const focusable=$$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',modal).filter(element=>element.getClientRects().length);
          const first=focusable[0],last=focusable[focusable.length-1];
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
        }
      });
      new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class','style']});sync();
    });
  }

  function initializePage() {
    const serviceSummary = $('.irsyads-nav-wrapper .irsyads-navigation summary');
    if (serviceSummary) serviceSummary.setAttribute('aria-label', 'Navigasi ekosistem Irsyads');
    const serviceMenu = serviceSummary?.parentElement;
    // This right-aligned workspace control opens by click or keyboard at every size.
    if (serviceMenu) ['pointerenter','pointerleave'].forEach(type=>serviceMenu.addEventListener(type,event=>event.stopImmediatePropagation(),true));
    $$('.clay-stat-icon-wrap').forEach((element,index) => { element.innerHTML = icon(['chart','page','clock','users'][index % 4]); element.setAttribute('aria-hidden','true'); });
    // Remove decorative emoji only from chrome; authored academic text and data stay intact.
    $$('.clay-tab-btn,.btn-action,.btn-clay-pill,.clay-hero-tag,.clay-hero-badge').forEach(element => {
      const walker = document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) walker.currentNode.textContent = walker.currentNode.textContent.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'');
    });
    $$('table').forEach(table => {
      if (['auto','scroll'].includes(getComputedStyle(table.parentElement).overflowX)) return;
      const wrapper = document.createElement('div'); wrapper.className = 'ui-table-scroll';
      wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', 'Tabel akademik, gulir mendatar untuk melihat semua kolom');
      table.before(wrapper); wrapper.append(table);
    });
    // Decorative shell utilities retain their existing academic/search controls.
    $$('.clay-topbar .clay-circle-btn').forEach(button => {
      if (!button.hasAttribute('aria-label') && button.title) button.setAttribute('aria-label', button.title);
    });
    $$('.clay-sidebar .clay-nav-item').forEach(link => { if (!link.hasAttribute('aria-label')) link.setAttribute('aria-label', link.textContent.trim()); });
    const main = $('.clay-main-content');
    if (main && !main.id) { main.id = 'main-clay-content'; main.tabIndex = -1; }
    if (main && !$('.skip-link')) {
      const skip = document.createElement('a'); skip.className = 'skip-link'; skip.href = '#main-clay-content'; skip.textContent = 'Lewati ke konten utama'; document.body.prepend(skip);
    }
    // Existing schedule tabs did not resolve their public anchor links.
    function resolveScheduleHash() {
      if (!location.pathname.endsWith('jadwal.html')) return;
      const target = /^#tab-(presensi|piket|matriks|kbm|asrama)$/.exec(location.hash);
      if (!target) return;
      const panel = document.getElementById(`tab-${target[1]}`);
      const button = $$('.tab-btn').find(item => item.dataset.tab === `tab-${target[1]}`);
      if (panel && button && !button.classList.contains('active')) button.click();
    }
    window.addEventListener('hashchange', resolveScheduleHash); resolveScheduleHash();
    if(main&&!$('.ui-irsyads-credit',main)){
      const credit=document.createElement('footer');credit.className='ui-irsyads-credit';
      credit.innerHTML='<span>Curriculum</span><span>Dikembangkan oleh <a href="https://irsyads.com/" target="_blank" rel="noopener noreferrer">Irsyads · irsyads.com ↗</a></span>';
      main.append(credit);
    }
    initializeDrawer(); initializeSearch(); initializeHome(); initializeScheduleCards(); initializeLegacyDialogs();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializePage);
  else initializePage();
})();

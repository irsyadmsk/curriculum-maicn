/* ═══════════════════════════════════════════════════
   CURRICULUM OS — App Core v3.0
   Aquamorphic Edition · Firebase Edition
═══════════════════════════════════════════════════ */

// ─── Utilities ───
window.AppUtils = {
  countUp(el) {
    const target = parseInt(el.getAttribute('data-target'), 10) || 0;
    const duration = 1800;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.floor(target * ease);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    };
    requestAnimationFrame(tick);
  },

  openModal(id)  { document.getElementById(id)?.classList.add('active'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('active'); },

  toast(msg, dur = 2800) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), dur);
  },

  formatDate(d = new Date()) {
    const days   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  },

  formatTime(d = new Date()) {
    return d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  }
};

// ─── Firebase Auth Wrapper ───
const Auth = {
  _user: null,
  _profile: null,

  isLoggedIn() { return !!this._user; },

  getUser() { return this._profile; },

  async login(email, password) {
    if (!window.auth) throw new Error('Firebase belum siap');
    const cred = await window.auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  },

  async logout() {
    if (!window.auth) return;
    await window.auth.signOut();
  },

  // Dipanggil saat auth state berubah
  onStateChange(callback) {
    if (!window.auth) { callback(null, null); return; }
    window.auth.onAuthStateChanged(async (user) => {
      this._user = user;
      if (user) {
        // Ambil profil dari Firestore
        try {
          const snap = await window.db.collection('users').doc(user.uid).get();
          this._profile = snap.exists ? { uid: user.uid, email: user.email, ...snap.data() } : { uid: user.uid, email: user.email, role: 'guru', name: user.email };
        } catch {
          this._profile = { uid: user.uid, email: user.email, role: 'guru', name: user.email };
        }
      } else {
        this._profile = null;
      }
      callback(user, this._profile);
    });
  },

  isAdmin() { return this._profile?.role === 'admin'; },
  isGuru()  { return this._profile?.role === 'guru' || this.isAdmin(); }
};

// ─── Seed Comments (selalu tampil, tidak dari Firestore) ───
const SEED_COMMENTS = [
  { id:'seed-1', name:'Bapak Ahmad Fauzi', role:'guru', text:'Alhamdulillah, portal kurikulum ini sangat membantu kami para guru untuk memahami alur pembelajaran sepanjang tahun. Desainnya pun nyaman dilihat.', ts: { toDate: () => new Date('2026-06-15T08:30:00') }, _seed: true },
  { id:'seed-2', name:'Siti Rahmawati', role:'orang-tua', text:'Sebagai orang tua, saya merasa terbantu sekali bisa melihat kalender akademik secara lengkap. Terima kasih MA ICN sudah transparan.', ts: { toDate: () => new Date('2026-06-17T14:12:00') }, _seed: true },
  { id:'seed-3', name:'Farhan Al-Ghifari', role:'siswa', text:'Portal ini keren banget! Bisa cek jadwal STS dan SAS dari jauh hari. Desainnya juga modern 👍', ts: { toDate: () => new Date('2026-06-20T19:45:00') }, _seed: true },
];

// ─── Comments Module (Firebase Firestore) ───
const Comments = {
  _unsub: null,

  formatTs(ts) {
    if (!ts) return '-';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('id-ID', { dateStyle:'short', timeStyle:'short' });
    } catch { return '-'; }
  },

  async add(name, role, text) {
    if (!window.db) throw new Error('Database belum siap');
    await window.db.collection('comments').add({
      name: name.trim(),
      role,
      text: text.trim(),
      ts: firebase.firestore.FieldValue.serverTimestamp(),
      approved: true
    });
  },

  async delete(id) {
    if (!window.db) return;
    await window.db.collection('comments').doc(id).delete();
  },

  // Real-time listener
  listen(container, isAdminFn) {
    if (this._unsub) this._unsub();
    if (!window.db) {
      this._renderFallback(container);
      return;
    }
    this._unsub = window.db.collection('comments')
      .orderBy('ts', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const all = [...docs, ...SEED_COMMENTS];
        this._render(all, container, isAdminFn());
      }, err => {
        console.error('Komentar gagal dimuat:', err);
        this._renderFallback(container);
      });
  },

  _renderFallback(container) {
    if (!container) return;
    this._render(SEED_COMMENTS, container, false);
  },

  _render(list, container, isAdmin) {
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<div class="comment-empty">✦ Belum ada komentar. Jadilah yang pertama!</div>';
      return;
    }
    const roleLabel = { guru:'Guru', siswa:'Siswa', 'orang-tua':'Orang Tua', lainnya:'Lainnya' };
    container.innerHTML = list.map(c => `
      <div class="comment-item" data-id="${c.id}">
        <div class="comment-header">
          <div>
            <span class="comment-name">${escHtml(c.name)}</span>
            <span class="comment-role role-${c.role}">${roleLabel[c.role] || c.role}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="comment-time">${this.formatTs(c.ts)}</span>
            ${isAdmin && !c._seed ? `<button class="btn btn-sm btn-danger" onclick="AppUtils.deleteComment('${c.id}')">Hapus</button>` : ''}
          </div>
        </div>
        <div class="comment-text">${escHtml(c.text)}</div>
      </div>
    `).join('');
  }
};

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

AppUtils.deleteComment = async function(id) {
  if (!Auth.isLoggedIn()) return;
  try {
    await Comments.delete(id);
    AppUtils.toast('Komentar dihapus');
  } catch (e) {
    AppUtils.toast('Gagal menghapus: ' + e.message);
  }
};

// ─── Embeds / Modules Module (Firebase Firestore) ───
const Embeds = {
  async add(title, url, category, uploadedBy) {
    if (!window.db) throw new Error('Database belum siap');
    await window.db.collection('modules').add({
      title: title.trim(),
      url: url.trim(),
      category,
      uploadedBy: uploadedBy || 'admin',
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async delete(id) {
    if (!window.db) return;
    await window.db.collection('modules').doc(id).delete();
  },

  async load() {
    if (!window.db) return [];
    const snap = await window.db.collection('modules').orderBy('ts', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  listen(onUpdate) {
    if (!window.db) return;
    return window.db.collection('modules').orderBy('ts', 'desc').onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }
};

// ─── Loading Screen ───
function initLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (!screen) return;
  const path = window.location.pathname;
  const isBeranda = path.endsWith('index.html') || path === '/' || path.endsWith('/curriculum-maicn/');
  if (isBeranda) {
    setTimeout(() => screen.classList.add('hidden'), 1600);
  } else {
    screen.classList.add('hidden');
  }
  window.addEventListener('offline', () => {
    const textEl = screen.querySelector('.loading-text');
    if (textEl) textEl.textContent = "Menunggu Jaringan...";
    screen.classList.remove('hidden');
  });
  window.addEventListener('online', () => {
    const textEl = screen.querySelector('.loading-text');
    if (textEl) textEl.textContent = "Terhubung Kembali";
    setTimeout(() => screen.classList.add('hidden'), 1000);
  });
}

// ─── Floating Clock ───
function initClock() {
  const clockEl = document.getElementById('floating-clock');
  if (!clockEl) return;
  const timeEl = clockEl.querySelector('.clock-time');
  const dateEl = clockEl.querySelector('.clock-date');
  const tick = () => {
    const now = new Date();
    if (timeEl) timeEl.innerHTML = `<span class="clock-dot"></span>${AppUtils.formatTime(now)}`;
    if (dateEl) dateEl.textContent = AppUtils.formatDate(now);
  };
  tick();
  setInterval(tick, 1000);
}

// ─── Navbar ───
function initNavbar() {
  const navbar   = document.getElementById('navbar');
  const toggle   = document.getElementById('nav-toggle');
  const links    = document.getElementById('nav-links');
  const loginBtn = document.getElementById('btn-login-nav');

  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 30);
    });
  }
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('show'));
    document.addEventListener('click', (e) => {
      if (!navbar?.contains(e.target)) links.classList.remove('show');
    });
  }
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (Auth.isLoggedIn()) {
        if (Auth.isAdmin()) showAdminPanel();
        else showGuruPanel();
      } else {
        AppUtils.openModal('modal-login');
      }
    });
  }
}

function updateAuthUI(user, profile) {
  const loginBtn     = document.getElementById('btn-login-nav');
  const adminSection = document.getElementById('admin-section');
  const guruSection  = document.getElementById('guru-section');

  if (!loginBtn) return;

  if (user && profile) {
    loginBtn.textContent = `⚙ ${profile.name || profile.email}`;
    loginBtn.classList.add('logged-in');
    if (profile.role === 'admin') {
      if (adminSection) adminSection.classList.add('show');
      if (guruSection)  guruSection.classList.remove('show');
    } else {
      if (adminSection) adminSection.classList.remove('show');
      if (guruSection)  guruSection.classList.add('show');
    }
  } else {
    loginBtn.textContent = 'Masuk';
    loginBtn.classList.remove('logged-in');
    if (adminSection) adminSection.classList.remove('show');
    if (guruSection)  guruSection.classList.remove('show');
  }
}

// ─── Login Modal ───
function initLoginModal() {
  const form  = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailOrUser = document.getElementById('login-user').value.trim();
    const pass        = document.getElementById('login-pass').value;
    const btn         = form.querySelector('button[type=submit]');

    // Tambahkan @maicn.sch.id jika user ketik hanya username (tanpa @)
    const email = emailOrUser.includes('@') ? emailOrUser : `${emailOrUser}@maicn.sch.id`;

    btn.disabled = true;
    btn.textContent = 'Memproses…';

    try {
      await Auth.login(email, pass);
      AppUtils.closeModal('modal-login');
      form.reset();
      if (errEl) errEl.classList.remove('show');
      AppUtils.toast(`Selamat datang! 👋`);
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
        ? 'Email atau password salah.'
        : err.code === 'auth/invalid-email'
        ? 'Format email tidak valid.'
        : err.message || 'Gagal masuk.';
      if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk →';
    }
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await Auth.logout();
    AppUtils.closeModal('modal-admin');
    AppUtils.closeModal('modal-guru');
    AppUtils.toast('Berhasil keluar.');
  });

  document.getElementById('btn-logout-guru')?.addEventListener('click', async () => {
    await Auth.logout();
    AppUtils.closeModal('modal-guru');
    AppUtils.toast('Berhasil keluar.');
  });
}

// ─── Admin Panel ───
function showAdminPanel() {
  AppUtils.openModal('modal-admin');
  renderAdminEmbeds();
}

function showGuruPanel() {
  AppUtils.openModal('modal-guru');
}

function initAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const parent = tab.closest('.admin-tabs')?.parentElement;
      parent?.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      parent?.querySelectorAll('.admin-panel-content').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById(`panel-${target}`)?.classList.add('active');
    });
  });
}

function renderAdminEmbeds(list) {
  const container = document.getElementById('embed-list-admin');
  if (!container) return;
  if (!list || !list.length) {
    container.innerHTML = '<div class="comment-empty">Belum ada modul/tautan.</div>';
    return;
  }
  container.innerHTML = list.map(e => `
    <div class="embed-item">
      <div class="embed-item-info">
        <div class="embed-item-title">${escHtml(e.title)}</div>
        <div class="embed-item-url" style="font-size:0.75rem;color:var(--text-soft)">${escHtml(e.category)} · ${escHtml(e.uploadedBy || '-')}</div>
      </div>
      <div class="embed-item-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteEmbed('${e.id}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

window.deleteEmbed = async function(id) {
  if (!Auth.isAdmin()) return;
  try {
    await Embeds.delete(id);
    AppUtils.toast('Modul dihapus.');
  } catch (e) {
    AppUtils.toast('Gagal hapus: ' + e.message);
  }
};

function initEmbedForm() {
  // Admin embed form
  const formAdmin = document.getElementById('embed-form');
  if (formAdmin) {
    formAdmin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title    = document.getElementById('embed-title').value;
      const url      = document.getElementById('embed-url').value;
      const category = document.getElementById('embed-category').value;
      if (!title || !url) return;
      try {
        await Embeds.add(title, url, category, Auth.getUser()?.name || 'admin');
        formAdmin.reset();
        AppUtils.toast('Modul berhasil ditambahkan!');
      } catch (err) {
        AppUtils.toast('Gagal: ' + err.message);
      }
    });
  }

  // Guru upload form
  const formGuru = document.getElementById('guru-embed-form');
  if (formGuru) {
    formGuru.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Auth.isGuru()) {
        AppUtils.toast('Sesi berakhir, silakan masuk kembali.');
        return;
      }
      const title    = document.getElementById('guru-embed-title').value.trim();
      const url      = document.getElementById('guru-embed-url').value.trim();
      const category = document.getElementById('guru-embed-category').value;
      const mapel    = document.getElementById('guru-embed-mapel').value.trim();
      if (!mapel || !title || !url) {
        AppUtils.toast('Lengkapi semua kolom terlebih dahulu.');
        return;
      }
      const btn = formGuru.querySelector('button[type=submit]');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Mengunggah…';
      try {
        if (!window.db) throw new Error('Koneksi database belum siap. Coba muat ulang halaman.');
        const profile = Auth.getUser();
        await Embeds.add(`[${mapel}] ${title}`, url, category, profile?.name || profile?.email || 'guru');
        formGuru.reset();
        AppUtils.toast('Modul berhasil diunggah! ✨');
        AppUtils.closeModal('modal-guru');
      } catch (err) {
        const msg = (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient'))
          ? 'Akses ditolak. Hubungi admin untuk mengatur izin Firestore.'
          : 'Gagal mengunggah: ' + (err.message || 'Kesalahan tidak dikenal');
        AppUtils.toast(msg, 5000);
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    });
  }
}

// ─── Comments ───
function initCommentForm() {
  const form = document.getElementById('comment-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('comment-name').value;
    const role = document.getElementById('comment-role').value;
    const text = document.getElementById('comment-text').value;
    if (!name || !text) return;

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Mengirim…';

    try {
      await Comments.add(name, role, text);
      form.reset();
      AppUtils.toast('Terima kasih atas komentarnya! ✨');
    } catch (err) {
      AppUtils.toast('Gagal kirim: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kirim Komentar ✦';
    }
  });
}

function initCommentListener() {
  const container = document.getElementById('comment-list');
  if (!container) return;

  // Tampilkan loading state
  container.innerHTML = '<div class="comment-empty">✦ Memuat komentar…</div>';

  // Tunggu Firebase siap lalu listen
  const start = () => Comments.listen(container, () => Auth.isLoggedIn());

  if (window.db) {
    start();
  } else {
    // Firebase mungkin belum siap, tunggu sebentar
    setTimeout(() => {
      if (window.db) start();
      else Comments._renderFallback(container);
    }, 1500);
  }
}

// ─── Scroll Reveal ───
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.animate-up').forEach(el => el.classList.add('in-view'));
    return;
  }
  const obs = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        if (entry.target.classList.contains('stat-num') && !entry.target.dataset.counted) {
          entry.target.dataset.counted = 'true';
          AppUtils.countUp(entry.target);
        }
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.08 });
  document.querySelectorAll('.animate-up, .stat-num').forEach(el => obs.observe(el));
}

// ─── Close modals ───
function initModalBackdrop() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
}

// ─── Hero Parallax ───
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const heroBg = document.querySelector('.hero-bg-img');
  const heroInner = document.querySelector('.hero-inner');
  if (!hero) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const h = hero.offsetHeight;
    const progress = Math.min(y / h, 1);
    if (heroBg) heroBg.style.transform = `scale(${1.05 + progress * 0.06}) translateY(${y * 0.25}px)`;
    if (heroInner) {
      heroInner.style.transform = `translateY(${y * 0.15}px)`;
      heroInner.style.opacity = 1 - progress * 1.4;
    }
  }, { passive: true });
}

// ─── Theme Switcher ───
const THEMES = {
  forest: { primary:'#1A4731', light:'#2D6A4F', dark:'#0E2E1F', aqua:'#2EC4B6', aquaDeep:'#0A8F85', bg:'linear-gradient(135deg,#dff0e8 0%,#e8f4f0 40%,#eaf3f6 70%,#e0eff5 100%)' },
  ocean:  { primary:'#0C4A6E', light:'#0369A1', dark:'#072F44', aqua:'#22D3EE', aquaDeep:'#0891B2', bg:'linear-gradient(135deg,#dbeafe 0%,#e0f2fe 50%,#ecfeff 100%)' },
  royal:  { primary:'#4C1D95', light:'#6D28D9', dark:'#2E1065', aqua:'#A78BFA', aquaDeep:'#7C3AED', bg:'linear-gradient(135deg,#ede9fe 0%,#f3e8ff 50%,#faf5ff 100%)' },
  earth:  { primary:'#78350F', light:'#B45309', dark:'#451A03', aqua:'#F59E0B', aquaDeep:'#D97706', bg:'linear-gradient(135deg,#fef3c7 0%,#fde68a 10%,#fef9ec 50%,#fff7ed 100%)' },
};

function applyTheme(name) {
  const t = THEMES[name];
  if (!t) return;
  const root = document.documentElement;
  root.style.setProperty('--primary',       t.primary);
  root.style.setProperty('--primary-light', t.light);
  root.style.setProperty('--primary-dark',  t.dark);
  root.style.setProperty('--aqua',          t.aqua);
  root.style.setProperty('--aqua-deep',     t.aquaDeep);
  root.style.setProperty('--bg-mesh',       t.bg);
  localStorage.setItem('curriculum_theme', name);
  document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.theme === name));
}

function initThemePanel() {
  const btn   = document.getElementById('theme-panel-btn');
  const panel = document.getElementById('theme-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open'); });
  document.querySelectorAll('.theme-dot').forEach(dot => dot.addEventListener('click', () => applyTheme(dot.dataset.theme)));

  const slider = document.getElementById('glass-slider');
  if (slider) {
    slider.addEventListener('input', () => {
      const v = slider.value / 100;
      document.documentElement.style.setProperty('--glass-card', `rgba(255,255,255,${v})`);
      document.documentElement.style.setProperty('--glass-white', `rgba(255,255,255,${Math.min(v + 0.15, 0.97)})`);
      document.getElementById('glass-val').textContent = slider.value + '%';
    });
  }

  const saved = localStorage.getItem('curriculum_theme');
  if (saved && THEMES[saved]) applyTheme(saved);
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  initLoadingScreen();
  initClock();
  initNavbar();
  initLoginModal();
  initAdminTabs();
  initEmbedForm();
  initCommentForm();
  initCommentListener();
  initScrollReveal();
  initModalBackdrop();
  initHeroParallax();
  initThemePanel();
  initWaterEffects();

  // Close modal buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => AppUtils.closeModal(btn.dataset.closeModal));
  });

  // Auth state listener (Firebase)
  Auth.onStateChange((user, profile) => {
    updateAuthUI(user, profile);
    // Re-render comments saat auth berubah (tampilkan tombol hapus jika admin)
    const container = document.getElementById('comment-list');
    if (container && window.db) {
      Comments.listen(container, () => Auth.isLoggedIn());
    }
    // Refresh admin embeds listener
    if (user && profile?.role === 'admin') {
      Embeds.listen(list => renderAdminEmbeds(list));
    }
  });
});

/* ── Water / Ripple Effects ── */
function initWaterEffects() {
  const RIPPLE_COLORS = ['rgba(46,196,182,', 'rgba(26,71,49,', 'rgba(201,162,39,'];
  let dropThrottle = 0;

  document.addEventListener('click', e => {
    createRipple(e.clientX, e.clientY, 120 + Math.random() * 80, RIPPLE_COLORS[0]);
    createRipple(e.clientX, e.clientY, 60 + Math.random() * 40, RIPPLE_COLORS[1], 80);
  });

  document.addEventListener('mousemove', e => {
    const now = Date.now();
    if (now - dropThrottle < 40) return;
    dropThrottle = now;
    if (Math.random() > 0.45) return;
    createDrop(e.clientX, e.clientY);
  });

  function createRipple(x, y, size, colorBase, delay = 0) {
    const el = document.createElement('div');
    el.className = 'water-ripple';
    el.style.cssText = `left:${x - size/2}px;top:${y - size/2}px;width:${size}px;height:${size}px;border:2px solid ${colorBase}0.5);background:radial-gradient(circle,${colorBase}0.06) 0%,transparent 70%);animation-delay:${delay}ms;`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function createDrop(x, y) {
    const el = document.createElement('div');
    el.className = 'water-drop';
    const offset = (Math.random() - 0.5) * 20;
    el.style.cssText = `left:${x + offset - 3}px;top:${y + offset - 3}px;`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

/* ═══════════════════════════════════════════════════
   CURRICULUM OS — App Core v2.0
   Aquamorphic Edition
═══════════════════════════════════════════════════ */

// ─── Auth Config (ganti password di sini) ───
const AUTH_CONFIG = {
  username: 'admin',
  password: 'maicn2025',
  displayName: 'Waka Kurikulum'
};

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
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
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

// ─── Auth Module ───
const Auth = {
  SESSION_KEY: 'curriculum_session',

  isLoggedIn() {
    try { return !!JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); }
    catch { return false; }
  },

  login(user, pass) {
    if (user === AUTH_CONFIG.username && pass === AUTH_CONFIG.password) {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({ user, name: AUTH_CONFIG.displayName, ts: Date.now() }));
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  getUser() {
    try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); }
    catch { return null; }
  }
};

// ─── Comments Module ───
const Comments = {
  KEY: 'curriculum_comments',

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },

  save(list) {
    localStorage.setItem(this.KEY, JSON.stringify(list));
  },

  add(name, role, text) {
    const list = this.load();
    list.unshift({
      id: Date.now(),
      name: name.trim(),
      role,
      text: text.trim(),
      ts: new Date().toLocaleString('id-ID', { dateStyle:'short', timeStyle:'short' })
    });
    if (list.length > 50) list.length = 50;
    this.save(list);
    return list;
  },

  delete(id) {
    const list = this.load().filter(c => c.id !== id);
    this.save(list);
    return list;
  },

  render(list, container, isAdmin = false) {
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<div class="comment-empty">✦ Belum ada komentar. Jadilah yang pertama berbagi kesan!</div>';
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
            <span class="comment-time">${c.ts}</span>
            ${isAdmin ? `<button class="btn btn-sm btn-danger" onclick="AppUtils.deleteComment(${c.id})">Hapus</button>` : ''}
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

AppUtils.deleteComment = function(id) {
  if (!Auth.isLoggedIn()) return;
  const list = Comments.delete(id);
  const container = document.getElementById('comment-list');
  if (container) Comments.render(list, container, true);
  AppUtils.toast('Komentar dihapus');
};

// ─── Embeds Module ───
const Embeds = {
  KEY: 'curriculum_embeds',

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },

  save(list) { localStorage.setItem(this.KEY, JSON.stringify(list)); },

  add(title, url, category) {
    const list = this.load();
    list.push({ id: Date.now(), title: title.trim(), url: url.trim(), category, ts: Date.now() });
    this.save(list);
    return list;
  },

  delete(id) {
    const list = this.load().filter(e => e.id !== id);
    this.save(list);
    return list;
  }
};

// ─── Loading Screen ───
function initLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (!screen) return;
  const delay = 1600;
  setTimeout(() => screen.classList.add('hidden'), delay);
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
  const navbar  = document.getElementById('navbar');
  const toggle  = document.getElementById('nav-toggle');
  const links   = document.getElementById('nav-links');
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

  updateAuthUI();

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (Auth.isLoggedIn()) {
        showAdminPanel();
      } else {
        AppUtils.openModal('modal-login');
      }
    });
  }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('btn-login-nav');
  const adminSection = document.getElementById('admin-section');
  if (!loginBtn) return;

  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    loginBtn.textContent = `⚙ ${user?.name || 'Admin'}`;
    loginBtn.classList.add('logged-in');
    if (adminSection) adminSection.classList.add('show');
  } else {
    loginBtn.textContent = 'Masuk';
    loginBtn.classList.remove('logged-in');
    if (adminSection) adminSection.classList.remove('show');
  }
}

// ─── Login Modal ───
function initLoginModal() {
  const form  = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (Auth.login(user, pass)) {
      AppUtils.closeModal('modal-login');
      form.reset();
      if (errEl) errEl.classList.remove('show');
      updateAuthUI();
      renderAdminEmbeds();
      refreshComments();
      AppUtils.toast(`Selamat datang, ${Auth.getUser()?.name}! 👋`);
    } else {
      if (errEl) { errEl.textContent = 'Username atau password salah.'; errEl.classList.add('show'); }
    }
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    Auth.logout();
    updateAuthUI();
    refreshComments();
    AppUtils.closeModal('modal-admin');
    AppUtils.toast('Berhasil keluar.');
  });
}

// ─── Admin Panel ───
function showAdminPanel() {
  AppUtils.openModal('modal-admin');
  renderAdminEmbeds();
}

function initAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel-content').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById(`panel-${target}`)?.classList.add('active');
    });
  });
}

function renderAdminEmbeds() {
  const list = Embeds.load();
  const container = document.getElementById('embed-list-admin');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div class="comment-empty">Belum ada tautan tertanam.</div>';
    return;
  }
  container.innerHTML = list.map(e => `
    <div class="embed-item">
      <div class="embed-item-info">
        <div class="embed-item-title">${escHtml(e.title)}</div>
        <div class="embed-item-url">${escHtml(e.url)}</div>
      </div>
      <div class="embed-item-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteEmbed(${e.id})">Hapus</button>
      </div>
    </div>
  `).join('');
}

window.deleteEmbed = function(id) {
  Embeds.delete(id);
  renderAdminEmbeds();
  AppUtils.toast('Tautan dihapus.');
};

function initEmbedForm() {
  const form = document.getElementById('embed-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title    = document.getElementById('embed-title').value;
    const url      = document.getElementById('embed-url').value;
    const category = document.getElementById('embed-category').value;
    if (!title || !url) return;
    Embeds.add(title, url, category);
    form.reset();
    renderAdminEmbeds();
    AppUtils.toast('Tautan berhasil ditambahkan!');
  });
}

// ─── Comments ───
function initCommentForm() {
  const form = document.getElementById('comment-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('comment-name').value;
    const role = document.getElementById('comment-role').value;
    const text = document.getElementById('comment-text').value;
    if (!name || !text) return;
    const list = Comments.add(name, role, text);
    form.reset();
    const container = document.getElementById('comment-list');
    Comments.render(list, container, Auth.isLoggedIn());
    AppUtils.toast('Terima kasih atas komentarnya! ✨');
  });
}

function refreshComments() {
  const container = document.getElementById('comment-list');
  if (!container) return;
  Comments.render(Comments.load(), container, Auth.isLoggedIn());
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

// ─── Close modals on backdrop click ───
function initModalBackdrop() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
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
  initScrollReveal();
  initModalBackdrop();
  refreshComments();

  // Close modal buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => AppUtils.closeModal(btn.dataset.closeModal));
  });
});

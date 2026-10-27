/**
 * CURRICULUM OS — Dashboard Claymorphism & Mobile Interaction Layer
 * Handles mobile off-canvas drawer, desktop collapsible sidebar,
 * Irsyads.com ecosystem launcher, bottom navigation, and accessible live alerts.
 */

(function () {
  'use strict';

  // 1. Toggle mobile off-canvas drawer
  window.toggleClayDrawer = function (open) {
    const body = document.body;
    if (typeof open === 'boolean') {
      body.classList.toggle('drawer-open', open);
    } else {
      body.classList.toggle('drawer-open');
    }

    const menuBtn = document.querySelector('.clay-mobile-menu-btn');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', body.classList.contains('drawer-open') ? 'true' : 'false');
    }
  };

  // 2. Toggle desktop collapsible sidebar (minimize/expand)
  window.toggleSidebarCollapse = function () {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem('maicn_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    } catch(e) {}
    updateCollapseButton();
  };

  function updateCollapseButton() {
    const btn = document.querySelector('.clay-collapse-btn');
    if (btn) {
      const isCollapsed = document.body.classList.contains('sidebar-collapsed');
      btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      btn.setAttribute('title', isCollapsed ? 'Lebarkan Menu (Tekan [)' : 'Ciutkan Menu (Tekan [)');
      btn.setAttribute('aria-label', isCollapsed ? 'Lebarkan menu' : 'Ciutkan menu');
      const label = btn.querySelector('.ui-collapse-label');
      if (label) label.textContent = isCollapsed ? 'Lebarkan menu' : 'Ciutkan menu';
      const icon = btn.querySelector('.clay-collapse-icon');
      if (icon) {
        icon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  }

  // 3. Initialize event listeners and ecosystem launcher on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    // Restore sidebar collapse state on desktop
    try {
      if (window.innerWidth > 1024 && localStorage.getItem('maicn_sidebar_collapsed') === 'true') {
        document.body.classList.add('sidebar-collapsed');
      }
    } catch(e) {}
    updateCollapseButton();

    // Keyboard shortcut: pressing '[' toggles sidebar collapse on desktop
    document.addEventListener('keydown', function (e) {
      if (e.key === '[' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (window.innerWidth > 1024) {
          window.toggleSidebarCollapse();
        }
      }
    });

    // Mobile drawer backdrop click listener
    const backdrop = document.querySelector('.clay-drawer-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        window.toggleClayDrawer(false);
      });
    }

    // Escape key listener
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) {
        window.toggleClayDrawer(false);
      }
    });

    // Close drawer when a nav link is clicked on mobile screens
    const navLinks = document.querySelectorAll('.clay-sidebar .clay-nav-item');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 1024) {
          window.toggleClayDrawer(false);
        }
      });
    });

    // Auto-mount Irsyads ecosystem service navigation if container exists
    const navContainer = document.getElementById('irsyads-service-nav');
    if (navContainer && window.IrsyadsServiceNavigation) {
      try {
        window.IrsyadsServiceNavigation.mount(navContainer, 'curriculum', 'Curriculum');
      } catch (err) {
        console.warn('IrsyadsServiceNavigation auto-mount:', err);
      }
    }
  });

  // 4. Accessible toast notification helper
  window.showClayToast = function (message, type) {
    type = type || 'info';
    let container = document.getElementById('clay-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'clay-toast-container';
      container.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:calc(100vw - 40px);';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.style.cssText = 'pointer-events:auto;padding:12px 18px;border-radius:14px;background:#FFFFFF;box-shadow:0 10px 25px rgba(0,0,0,0.12);border-left:4px solid ' +
      (type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#F07E5B') +
      ';font-size:0.86rem;font-weight:700;color:#1E293B;display:flex;align-items:center;gap:8px;transition:opacity 0.25s ease;';

    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = '<span>' + icon + '</span><span>' + message + '</span>';
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3200);
  };
  // 5. Language-Preserving Ecosystem Doors (Irsyads, Academy, Studio #kurikulum)
  function resolveVisitorLanguage() {
    if (window.IrsyadsPreferences && typeof window.IrsyadsPreferences.get === 'function') {
      const p = window.IrsyadsPreferences.get().language;
      if (['id', 'en', 'ar', 'zh'].includes(p)) return p;
    }
    try {
      const match = document.cookie.split(/;\s*/).find(c => c.startsWith('irsyads-language='));
      if (match) {
        const val = match.split('=')[1];
        if (['id', 'en', 'ar', 'zh'].includes(val)) return val;
      }
    } catch(e) {}
    try {
      const local = localStorage.getItem('irsyads-language');
      if (['id', 'en', 'ar', 'zh'].includes(local)) return local;
    } catch(e) {}
    return 'id';
  }

  window.updateEcosystemDoors = function (forcedLang) {
    const lang = forcedLang || resolveVisitorLanguage();
    
    // 1. Irsyads Home
    const siteLinks = document.querySelectorAll('a[data-door="site"], a.link-portal-site');
    siteLinks.forEach(function (el) {
      el.href = lang === 'en' ? 'https://irsyads.com/' : 'https://irsyads.com/' + lang + '/';
    });

    // 2. Irsyads Academy
    const academyLinks = document.querySelectorAll('a[data-door="academy"], a.link-portal-academy');
    academyLinks.forEach(function (el) {
      el.href = lang === 'id' ? 'https://academy.irsyads.com/' : 'https://academy.irsyads.com/?lang=' + lang;
    });

    // 3. Studio Kurikulum
    const studioLinks = document.querySelectorAll('a[data-door="studio"], a.link-portal-studio');
    studioLinks.forEach(function (el) {
      el.href = 'https://studio.irsyads.com/?lang=' + encodeURIComponent(lang) + '#kurikulum';
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.updateEcosystemDoors();

    // Restrained introductory scroll-craft: subtle movement for header plane only
    const introPlane = document.querySelector('.intro-scroll-plane');
    if (introPlane && window.matchMedia) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduce.addEventListener && reduce.addEventListener('change', function () { if (reduce.matches) introPlane.style.transform = ''; });
      let ticking = false;
      window.addEventListener('scroll', function () {
        if (!ticking) {
          window.requestAnimationFrame(function () {
            const top = window.scrollY || window.pageYOffset;
            if (!reduce.matches && top < 400) {
              introPlane.style.transform = 'translateY(' + (top * 0.04).toFixed(1) + 'px)';
            }
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    }
  });

  window.addEventListener('irsyads-language-change', function (e) {
    const d = e && e.detail;
    const newLang = ['id', 'en', 'ar', 'zh'].includes(d) ? d : resolveVisitorLanguage();
    window.updateEcosystemDoors(newLang);
  });

})();

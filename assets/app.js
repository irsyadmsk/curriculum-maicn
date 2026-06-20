// App UI Utilities - SaaS Edition
window.AppUtils = {
  // CountUp Animation
  countUp: (el) => {
    const target = parseFloat(el.getAttribute('data-target'));
    const isId = el.getAttribute('data-format') === 'id';
    const duration = 1500;
    const start = performance.now();

    const animate = (time) => {
      let progress = (time - start) / duration;
      if (progress > 1) progress = 1;
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      let current = Math.floor(target * ease);
      
      if (isId) {
        el.innerText = current.toLocaleString('id-ID');
      } else {
        el.innerText = current;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        el.innerText = isId ? target.toLocaleString('id-ID') : target;
      }
    };
    requestAnimationFrame(animate);
  },

  // Modal System
  openModal: (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },
  
  closeModal: (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // Mock Global Search
  initGlobalSearch: () => {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;
    
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        alert('Pencarian untuk: "' + e.target.value + '" sedang diproses... (Mockup)');
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Intersection Observer for 'Framer Motion' simulated animations
  const observerOptions = { root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.1 };
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        // If it's a number counter, start it when in view
        if (entry.target.classList.contains('stat-num') && window.AppUtils) {
          window.AppUtils.countUp(entry.target);
        }
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.motion-fade-up, .motion-scale').forEach(el => observer.observe(el));

  // 2. Sidebar Toggle (Mobile/Tablet)
  const sidebar = document.getElementById('app-sidebar');
  const menuBtn = document.getElementById('btn-mobile-menu');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // 3. Modal Close Triggers (Click outside & Close buttons)
  document.querySelectorAll('.btn-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

  // 4. Global Search Init
  if (window.AppUtils) window.AppUtils.initGlobalSearch();
  
  // Set Active Menu based on current URL
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item, .bnav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    }
  });
});

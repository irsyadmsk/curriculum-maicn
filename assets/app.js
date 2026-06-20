/**
 * Shared App Utilities
 */

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Active Navigation highlighting (kalau ada navbar)
  const navLinks = document.querySelectorAll('nav a');
  const currentUrl = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentUrl) {
      link.classList.add('active');
    }
  });

  // Reveal Animations on Scroll
  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });

    revealElements.forEach(el => observer.observe(el));
  } else {
    // Fallback kalau tidak dukung IntersectionObserver
    revealElements.forEach(el => el.classList.add('visible'));
  }

  // Count Up animation
  function countUp(el) {
    if (reduceMotion) {
      el.textContent = el.dataset.target;
      return;
    }
    
    const target = parseInt(el.dataset.target, 10);
    const isId = el.dataset.format === 'id';
    const duration = 1200;
    const startTime = performance.now();
    
    function update(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(target * ease);
      
      el.textContent = isId ? current.toLocaleString('id-ID') : current;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = isId ? target.toLocaleString('id-ID') : target;
      }
    }
    
    requestAnimationFrame(update);
  }

  // Expose global if needed
  window.AppUtils = {
    countUp
  };
});

// Hamburger menu toggle
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.hamburger');
  const navLinksMenu = document.querySelector('.nav-links');
  if (hamburger && navLinksMenu) {
    hamburger.addEventListener('click', () => {
      navLinksMenu.classList.toggle('open');
    });
  }
});

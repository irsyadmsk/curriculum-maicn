window.AppUtils = {
  // CountUp animation
  countUp: (el) => {
    const target = parseInt(el.getAttribute('data-target'), 10) || 0;
    const duration = 2000;
    const start = performance.now();
    
    const animate = (time) => {
      let progress = (time - start) / duration;
      if (progress > 1) progress = 1;
      // ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(target * ease);
      el.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        el.textContent = target; // Ensure exact finish
      }
    };
    requestAnimationFrame(animate);
  },

  // Generic Modal Control
  openModal: (id) => {
    const m = document.getElementById(id);
    if(m) m.classList.add('active');
  },
  closeModal: (id) => {
    const m = document.getElementById(id);
    if(m) m.classList.remove('active');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Navbar Scroll Effect
  const navbar = document.getElementById('navbar');
  if(navbar) {
    window.addEventListener('scroll', () => {
      if(window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // 2. Mobile Nav Toggle
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if(navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });
  }

  // 3. Scroll Reveal Animations (Intersection Observer)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          
          // Trigger countUp if it's a stat number
          if(entry.target.classList.contains('stat-num') && !entry.target.hasAttribute('data-counted')) {
            entry.target.setAttribute('data-counted', 'true');
            window.AppUtils.countUp(entry.target);
          }

          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });

    document.querySelectorAll('.animate-up, .stat-num').forEach(el => {
      observer.observe(el);
    });
  }
});

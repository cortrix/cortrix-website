/* ==========================================================================
   Cortrix.ai - Script (v3 - Magma Orange VI)
   ========================================================================== */

(function () {
  'use strict';

  // --- Mobile Nav Toggle ---
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => nav.classList.remove('open'));
    });
  }

  // --- Sticky Nav Background ---
  const onScroll = () => {
    if (window.scrollY > 20) {
      nav.style.borderBottomColor = 'rgba(30,41,59,.6)';
    } else {
      nav.style.borderBottomColor = 'rgba(30,41,59,.2)';
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Copy Buttons ---
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const code = document.getElementById(targetId);
      if (!code) return;

      const text = code.textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }).catch(() => {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
  });

  // --- Hero Canvas: Particle Network Animation (Orange theme) ---
  const canvas = document.getElementById('hero-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');

    let width, height, particles;
    const PARTICLE_COUNT = 60;
    const CONNECTION_DIST = 150;
    const MOUSE_DIST = 200;
    let mouse = { x: -1000, y: -1000 };

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = canvas.width = rect.width;
      height = canvas.height = rect.height;
    }

    function createParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 2 + 1,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // Draw connections (orange)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
            ctx.strokeStyle = `rgba(255, 107, 0, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles (orange)
      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let alpha = 0.4;
        if (dist < MOUSE_DIST) {
          alpha = 0.4 + (1 - dist / MOUSE_DIST) * 0.6;
        }

        ctx.fillStyle = `rgba(255, 107, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      requestAnimationFrame(draw);
    }

    canvas.parentElement.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });

    canvas.parentElement.addEventListener('mouseleave', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    resize();
    createParticles();
    draw();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        createParticles();
      }, 200);
    });
  }

  // --- Scroll Reveal ---
  const reveals = document.querySelectorAll('.feature-card, .problem-card, .usecase-card, .step, .arch-item, .content-card, .note-panel, .path-item');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    observer.observe(el);
  });
})();

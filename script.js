/* ==========================================================================
   cortrix.ai script
   ========================================================================== */

(function () {
  'use strict';

  // --- Mobile Nav Toggle ---
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  if (toggle && nav) {
    const links = document.getElementById('nav-links');
    const syncMobileNavigationHeight = () => {
      if (!links || !nav.classList.contains('open')) return;
      nav.style.setProperty('--mobile-nav-links-height', `${links.getBoundingClientRect().height}px`);
    };
    const setNavigationOpen = (open, returnFocus = false) => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) syncMobileNavigationHeight();
      else nav.style.removeProperty('--mobile-nav-links-height');
      if (!open && returnFocus) toggle.focus();
    };

    toggle.addEventListener('click', () => {
      setNavigationOpen(!nav.classList.contains('open'));
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => setNavigationOpen(false));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        setNavigationOpen(false, true);
      }
    });
    window.addEventListener('resize', syncMobileNavigationHeight, { passive: true });
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

  // --- GitHub Repository Stats ---
  const githubRepoStats = document.querySelector('[data-github-repo-stats]');
  const githubStarCount = document.getElementById('github-star-count');
  if (githubRepoStats && githubStarCount) {
    const cacheKey = 'cortrix-github-repo-stats';
    const cacheMaxAge = 15 * 60 * 1000;

    const formatRepoCount = count => new Intl.NumberFormat('en-US', {
      notation: count >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(count);

    const renderRepoStats = stars => {
      if (!Number.isInteger(stars) || stars < 0) return;

      const exactStars = new Intl.NumberFormat('en-US').format(stars);
      const starLabel = stars === 1 ? 'star' : 'stars';

      githubStarCount.textContent = formatRepoCount(stars);
      githubRepoStats.setAttribute(
        'aria-label',
        `Cortrix on GitHub, ${exactStars} ${starLabel}`,
      );
    };

    let cachedStats = null;
    try {
      cachedStats = JSON.parse(localStorage.getItem(cacheKey));
    } catch {
      cachedStats = null;
    }

    if (Number.isInteger(cachedStats?.stars)) {
      renderRepoStats(cachedStats.stars);
    }

    const cacheIsFresh = cachedStats
      && Number.isFinite(cachedStats.updatedAt)
      && Date.now() - cachedStats.updatedAt < cacheMaxAge;

    if (!cacheIsFresh) {
      fetch(githubRepoStats.dataset.githubApi, {
        headers: { Accept: 'application/vnd.github+json' },
      })
        .then(response => {
          if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
          return response.json();
        })
        .then(repo => {
          if (!Number.isInteger(repo.stargazers_count)) return;

          renderRepoStats(repo.stargazers_count);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              stars: repo.stargazers_count,
              updatedAt: Date.now(),
            }));
          } catch {
            // The displayed counts remain valid when storage is unavailable.
          }
        })
        .catch(() => {
          // Keep the rendered fallback counts if GitHub is unavailable.
        });
    }
  }

  // --- Copy Buttons ---
  const copyText = text => {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();

      const copied = document.execCommand('copy');
      textarea.remove();
      if (copied) resolve();
      else reject(new Error('Clipboard copy failed'));
    });
  };

  document.querySelectorAll('.copy-btn').forEach(btn => {
    const originalLabel = btn.textContent;
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const code = document.getElementById(targetId);
      if (!code) return;

      const text = code.textContent;
      copyText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = originalLabel; }, 2000);
      }).catch(() => {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = originalLabel; }, 2000);
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
            ctx.strokeStyle = `rgba(255, 100, 5, ${alpha})`;
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

        ctx.fillStyle = `rgba(255, 100, 5, ${alpha})`;
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
  const reveals = document.querySelectorAll('.feature-card, .problem-card, .usecase-card, .step, .arch-item, .content-card, .note-panel, .path-item, .benchmark-result-card, .benchmark-average-card, .benchmark-dataset-panel, .benchmark-assembly, .compare-block, .system-map, .proof-panel, .pipeline-panel, .terminal-panel');
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

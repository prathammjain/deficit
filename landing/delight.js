// The small things: numbers that settle like a scale, a floating bar whose
// logo fills as you read, the full stop in the headline, the grains in the
// closing card, and sources on demand. Everything plays once, uses only
// transform and opacity, and shows its finished state with reduced motion.

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  // ---- Numbers settle like a kitchen scale ----
  // A scale doesn't count up from zero. It jumps past the reading, swings
  // back, and steadies, and only the last digits move while it does.
  function settle(el, to, opts = {}) {
    const pre = opts.prefix || '';
    const suf = opts.suffix || '';
    const show = (n) => {
      el.textContent = pre + fmt(n) + suf;
    };
    if (reduced) return show(to);
    const swing = Math.max(2, Math.round(to * (opts.swing || 0.004)));
    const path = [1, -0.55, 0.3, -0.14, 0.05, 0].map((k) =>
      Math.round(to + swing * k),
    );
    // Something placed on a scale rises to the reading first.
    if (opts.rise) path.unshift(Math.round(to * 0.35), Math.round(to * 0.8));
    path.forEach((n, i) => setTimeout(() => show(n), i * (opts.step || 85)));
  }
  window.GrainMotion = { settle };

  // ---- A floating bar once the hero is behind you ----
  // Its g lights one dot at a time as you read down, the last at the end.
  const pill = document.querySelector('[data-pill]');
  const heroCta = document.querySelector('.gt-hero .cta');
  const endCard = document.querySelector('.end-card');
  if (pill && heroCta) {
    const dots = [...pill.querySelectorAll('circle')];
    let pastHero = false;
    let atEnd = false;
    const paint = () => {
      pill.classList.toggle('is-shown', pastHero && !atEnd);
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1;
      const lit = Math.round(p * dots.length);
      dots.forEach((d, i) => d.classList.toggle('on', i < lit));
    };
    new IntersectionObserver(([e]) => {
      pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
      paint();
    }).observe(heroCta);
    if (endCard) {
      new IntersectionObserver(
        ([e]) => {
          atEnd = e.isIntersecting;
          paint();
        },
        { threshold: 0.3 },
      ).observe(endCard);
    }
    let queued = false;
    addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          paint();
        });
      },
      { passive: true },
    );
    paint();
  }

  // ---- The full stop in the headline is a grain ----
  // Each one drops a moment after its headline comes into view.
  document.querySelectorAll('.h1-stop').forEach((stop) => {
    if (reduced || !('IntersectionObserver' in window)) return;
    stop.classList.add('is-waiting');
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setTimeout(() => {
        stop.classList.remove('is-waiting');
        stop.classList.add('is-dropped');
      }, 900);
    });
    io.observe(stop);
  });

  // ---- Grains pour into the g ----
  // Rice shaped grains fall into the logo, bottom row first like filling a
  // cup, and round into dots as they land.
  const pour = document.querySelector('[data-pour]');
  if (pour) {
    const grains = [...pour.querySelectorAll('circle')];
    const play = () => {
      if (reduced || pour.dataset.playing) return;
      pour.dataset.playing = '1';
      const order = grains
        .map((g, i) => ({ g, i, y: Number(g.getAttribute('cy')) }))
        .sort((a, b) => b.y - a.y || a.i - b.i);
      order.forEach(({ g }, n) => {
        const dx = (Math.random() - 0.5) * 3;
        const r = (Math.random() - 0.5) * 140;
        g.animate(
          [
            {
              transform: `translate(${dx}px, -9px) rotate(${r}deg) scale(1.7, 0.6)`,
              opacity: 0,
            },
            { opacity: 1, offset: 0.25 },
            {
              transform: 'translate(0, 0.25px) rotate(0deg) scale(1.2, 0.85)',
              offset: 0.8,
            },
            { transform: 'none', opacity: 1 },
          ],
          {
            duration: 760,
            delay: n * 55,
            easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)',
            fill: 'backwards',
          },
        );
      });
      setTimeout(
        () => delete pour.dataset.playing,
        order.length * 55 + 800,
      );
    };
    new IntersectionObserver(
      ([e], obs) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        play();
      },
      { threshold: 0.6 },
    ).observe(pour);
    pour.closest('.end-card')?.addEventListener('pointerenter', play);
  }

  // ---- Sources, when asked for ----
  // Hover the match card, or tap it on a phone, and each number names where
  // it came from.
  const proof = document.querySelector('.proof-card');
  if (proof) {
    proof.addEventListener('click', () => proof.classList.toggle('show-src'));
  }
})();

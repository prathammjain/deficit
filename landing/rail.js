// The strips of feature cards, and the honest numbers card.
//
// On a phone each strip sits side by side and moves on by itself, one card
// at a time, pausing for a while whenever it's touched. On a wider screen
// the same cards are a grid. A card plays its little screen when it comes
// into the middle of the strip, or into view on a wide screen.

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP = 4800; // how long each card stays, in ms
  const PAUSE = 9000; // how long a touch holds the strip still

  document.querySelectorAll('[data-rail]').forEach((rail) => {
    const track = rail.querySelector('[data-rail-track]');
    const dotsEl = rail.querySelector('[data-rail-dots]');
    const cards = [...track.children];
    let active = -1;
    let inView = false;
    let pauseUntil = 0;
    let shownAt = 0;
    let driving = false;

    const strip = () => track.scrollWidth > track.clientWidth + 4;

    const dots = cards.map((card, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Show card ${i + 1} of ${cards.length}`);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', () => {
        pauseUntil = Date.now() + PAUSE;
        go(i);
      });
      dotsEl.appendChild(b);
      return b;
    });

    function setActive(i) {
      if (i === active) return;
      active = i;
      shownAt = Date.now();
      // In a strip only the middle card plays, so each replays its screen
      // when it comes round again.
      if (strip())
        cards.forEach((c, j) => c.classList.toggle('is-on', j === i));
      dots.forEach((d, j) => {
        d.classList.toggle('is-active', j === i);
        d.setAttribute('aria-current', j === i ? 'true' : 'false');
      });
    }

    // The card nearest the middle of the strip is the one showing.
    function nearest() {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let dist = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (d < dist) [best, dist] = [i, d];
      });
      return best;
    }

    let drove = 0;
    function go(i) {
      const card = cards[i];
      const left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
      driving = true;
      setActive(i);
      track.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
      // Cards passed on the way don't play; once settled, whichever card
      // is in the middle is the one showing.
      clearTimeout(drove);
      drove = setTimeout(() => {
        driving = false;
        setActive(nearest());
      }, 900);
    }

    let raf = 0;
    track.addEventListener(
      'scroll',
      () => {
        if (driving) return;
        pauseUntil = Date.now() + PAUSE;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setActive(nearest()));
      },
      { passive: true },
    );
    ['pointerdown', 'touchstart', 'wheel'].forEach((ev) =>
      track.addEventListener(ev, () => (pauseUntil = Date.now() + PAUSE), {
        passive: true,
      }),
    );

    new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        rail.classList.toggle('is-visible', inView);
        if (inView && !strip()) cards.forEach((c) => c.classList.add('is-on'));
        if (inView && active < 0) setActive(0);
      },
      { threshold: 0.45 },
    ).observe(rail);

    // Moving on: only on a strip, only on screen, and never while touched.
    if (!reduced) {
      setInterval(() => {
        const paused = Date.now() < pauseUntil;
        rail.classList.toggle('is-paused', paused);
        if (!strip() || !inView || paused) {
          shownAt = Math.max(shownAt, Date.now() - STEP + 1200);
          return;
        }
        if (Date.now() - shownAt >= STEP) go((active + 1) % cards.length);
      }, 200);
    } else {
      cards.forEach((c) => c.classList.add('is-on'));
    }

    rail.style.setProperty('--step', `${STEP}ms`);
  });

  // ---- Numbers that don't flatter: three example months ----
  const card = document.querySelector('[data-honest]');
  if (!card) return;

  const MAINT = 2740;
  const TARGET = 2600;
  const full = (k) => k >= TARGET / 2;
  // 30 days, oldest first: a day's intake, 0 when nothing was logged.
  const STEADY = [
    2210, 2380, 2290, 0, 2150, 2460, 2320, 2280, 2190, 2410, 2350, 0, 2240,
    2120, 2390, 2300, 2420, 2260, 2330, 2310, 2180, 2440, 2270, 0, 2330, 2200,
    2360, 2250, 2410, 2290,
  ];
  const HALF = STEADY.map((k, i) => (i === 18 ? 610 : k));
  const BREAK = [
    2210, 2380, 2290, 2150, 2460, 2320, 2280, 2190, 2410, 2350, 2240, 2120,
    2390, 2300, 2420, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2180, 2440, 2270, 2330,
    2200,
  ];

  const MODES = {
    steady: {
      series: STEADY,
      from: 0,
      note: "Three days weren't logged. They add nothing, so the total is what you really did.",
    },
    half: {
      series: HALF,
      from: 0,
      note: `One day has only breakfast logged. Counting it would add a fake ${(MAINT - 610).toLocaleString('en-US')} kcal, so it stays out until you finish it or confirm it.`,
    },
    break: {
      series: BREAK,
      from: 25,
      note: "Ten days weren't logged. They count as nothing, and the numbers start again from your return.",
    },
  };

  const totalEl = card.querySelector('[data-h-total]');
  let shown = Number(totalEl.textContent.replace(/,/g, '')) || 0;

  function countTo(to) {
    const from = shown;
    shown = to;
    if (reduced) {
      totalEl.textContent = to.toLocaleString('en-US');
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 700);
      const v = from + (to - from) * (1 - Math.pow(1 - t, 3));
      totalEl.textContent = Math.round(v).toLocaleString('en-US');
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function paint(mode) {
    const m = MODES[mode];
    const counted = m.series.slice(m.from).filter(full);
    const total = counted.reduce((t, k) => t + (MAINT - k), 0);
    countTo(total);
    card.querySelector('[data-h-sub]').textContent =
      `About ${(total / 7700).toFixed(1)} kg of fat, across the ${counted.length} full days ${mode === 'break' ? 'since you came back' : 'you logged'}`;
    card.querySelector('[data-h-note]').textContent = m.note;
    card.querySelector('[data-h-bars]').innerHTML = m.series
      .map((k, i) => {
        const cls = [
          k === 0 ? 'off' : full(k) ? '' : 'half',
          i < m.from ? 'dim' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const h =
          k === 0 ? 0 : full(k) ? Math.max(0.15, (MAINT - k) / 650) : 0.7;
        return `<i class="${cls}" style="--h:${h.toFixed(2)};--i:${i}"></i>`;
      })
      .join('');
    card.classList.toggle('is-break', mode === 'break');
    card
      .querySelectorAll('[data-h-mode]')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.hMode === mode)),
      );
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-h-mode]');
    if (b) paint(b.dataset.hMode);
  });
  paint('steady');
})();

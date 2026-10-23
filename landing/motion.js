// Page motion: each block rises once as it scrolls in, and the app screens
// inside the cards play what they do in the app. Without JS, or with reduced
// motion, everything shows its finished state from the HTML and CSS.

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  function countTo(el, from, to, ms) {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- What Grain does: describe, match, logged ----
  async function playFlow(card) {
    if (card.dataset.playing) return;
    card.dataset.playing = '1';
    const steps = card.querySelectorAll('.step');
    const text = card.querySelector('[data-flow-text]');
    const full = text.dataset.full || (text.dataset.full = text.textContent);
    const left = card.querySelector('[data-flow-left]');
    const parts = card.querySelectorAll(
      '.ui-row, .ui-total, .ui-chips, .ui-bar',
    );
    const match = card.querySelector('.ui-match');

    steps.forEach((s) => s.classList.remove('is-on'));
    parts.forEach((p) => p.classList.remove('is-on'));
    left.textContent = '2,600';
    text.textContent = '';

    steps[0].classList.add('is-on');
    card.classList.add('is-typing');
    for (const ch of full) {
      text.textContent += ch;
      await wait(26);
    }
    await wait(300);
    match.classList.add('is-pressed');
    await wait(160);
    match.classList.remove('is-pressed');
    card.classList.remove('is-typing');

    steps[1].classList.add('is-on');
    for (const row of card.querySelectorAll('.ui-row, .ui-total')) {
      await wait(260);
      row.classList.add('is-on');
    }

    await wait(400);
    steps[2].classList.add('is-on');
    card.querySelector('.ui-bar').classList.add('is-on');
    countTo(left, 2600, 1958, 900);
    await wait(500);
    card.querySelector('.ui-chips').classList.add('is-on');
    await wait(400);
    delete card.dataset.playing;
  }

  // ---- Calendar: step through a few past days ----
  const DAYS = {
    21: ['Wednesday, 21 October', '2,180', '162 g', '420', 'deficit'],
    17: ['Saturday, 17 October', '2,640', '141 g', '40', 'over'],
    9: ['Friday, 9 October', '2,050', '170 g', '550', 'deficit'],
  };

  function pickDay(card, day) {
    const [date, kcal, protein, deficit, word] = DAYS[day];
    card
      .querySelectorAll('.cal-days .sel')
      .forEach((d) => d.classList.remove('sel'));
    card.querySelector(`[data-day="${day}"]`).classList.add('sel');
    card.querySelector('[data-cal-date]').textContent = date;
    card.querySelector('[data-cal-kcal]').textContent = kcal;
    card.querySelector('[data-cal-protein]').textContent = protein;
    card.querySelector('[data-cal-deficit]').textContent = deficit;
    card.querySelector('[data-cal-word]').textContent = word;
  }

  function runCalendar(card) {
    const order = [21, 17, 9];
    let i = 0;
    let timer = null;
    new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !timer) {
        timer = setInterval(() => {
          i = (i + 1) % order.length;
          pickDay(card, order[i]);
        }, 2600);
      } else if (!visible && timer) {
        clearInterval(timer);
        timer = null;
      }
    }).observe(card);
  }

  // ---- What happens when each block first comes into view ----
  async function onReveal(el) {
    el.classList.add('is-in');
    if (reduced) return;
    if (el.matches('[data-flow]')) playFlow(el);
    if (el.matches('.feat-deficit')) {
      const n = el.querySelector('[data-count-to]');
      countTo(n, 0, Number(n.dataset.countTo), 1400);
    }
    if (el.matches('.feat-target')) {
      await wait(2000);
      el.classList.add('is-learned');
    }
    if (el.matches('.feat-home')) {
      const add = el.querySelector('.home-add');
      await wait(700);
      add.classList.add('is-pressed');
      await wait(160);
      add.classList.remove('is-pressed');
      el.classList.add('is-placed');
    }
  }

  const blocks = document.querySelectorAll('[data-reveal]');
  if (reduced) {
    blocks.forEach((el) => el.classList.add('is-in'));
    document
      .querySelectorAll('.feat-target')
      .forEach((el) => el.classList.add('is-learned'));
    document
      .querySelectorAll('.feat-home')
      .forEach((el) => el.classList.add('is-placed'));
    document
      .querySelectorAll(
        '[data-flow] .ui-row, [data-flow] .ui-total, [data-flow] .ui-chips, [data-flow] .ui-bar, [data-flow] .step',
      )
      .forEach((el) => el.classList.add('is-on'));
    return;
  }

  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        seen.unobserve(e.target);
        onReveal(e.target);
      }
    },
    { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
  );
  blocks.forEach((el) => seen.observe(el));

  document.querySelectorAll('.feat-calendar').forEach(runCalendar);

  // The flow plays again when someone points at it once it has finished.
  document.querySelectorAll('[data-flow]').forEach((card) => {
    card.addEventListener('pointerenter', () => {
      if (card.classList.contains('is-in')) playFlow(card);
    });
  });
})();

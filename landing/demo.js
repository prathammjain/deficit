// The phone demo: the app's Log screen, played as a short loop.
//
// Every number here comes from USDA FoodData Central, so the demo never shows
// a result the data can't back up:
//   chicken breast, roasted (FDC 171477)  165 kcal, 31 g protein per 100 g -> 200 g = 330 kcal, 62 g
//   white rice, cooked (FDC 168878)        130 kcal, 2.7 g protein per 100 g -> 150 g = 195 kcal, 4 g
//   ghee (FDC 171314)                      900 kcal per 100 g, 1 tbsp = 13 g  -> 117 kcal
//   meal total                             642 kcal, 66 g protein

(function () {
  const screen = document.querySelector('.screen');
  if (!screen) return;

  const $ = (sel) => screen.querySelector(sel);
  const typed = $('[data-typed]');
  const caret = $('.caret');
  const matchBtn = $('[data-match]');
  const logBtn = $('[data-log]');
  const rows = $('[data-rows]');
  const reveal = [...rows.querySelectorAll('.row, .row-total, .app-btn-wide')];
  const gauge = $('[data-gauge]');

  const MEAL = '200 g chicken breast, 150 g rice, 1 tbsp ghee';
  const TARGET = 2600;
  const CIRC = 263.9; // 2 * pi * r, r = 42
  const BEFORE = { left: 2080, consumed: 520, protein: 38, carbs: 64, fat: 14 };
  const AFTER = { left: 1438, consumed: 1162, protein: 104, carbs: 106, fat: 34 };
  const fields = {
    left: $('[data-left]'),
    consumed: $('[data-consumed]'),
    protein: $('[data-protein]'),
    carbs: $('[data-carbs]'),
    fat: $('[data-fat]'),
  };

  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  function setNumbers(v) {
    for (const k in fields) fields[k].textContent = fmt(v[k]);
    gauge.style.strokeDashoffset = String(CIRC * (1 - v.consumed / TARGET));
  }

  // Only advance while the phone is on screen, so it never plays to nobody
  // and always starts from the top when someone scrolls back to it.
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
    threshold: 0.35,
  }).observe(screen);

  const wait = (ms) =>
    new Promise((resolve) => {
      const tick = () => (visible ? setTimeout(resolve, ms) : setTimeout(tick, 200));
      tick();
    });

  async function press(btn) {
    btn.classList.add('is-pressed');
    await wait(140);
    btn.classList.remove('is-pressed');
  }

  function countTo(from, to, ms) {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, Math.max(0, (now - start) / ms));
        const e = 1 - Math.pow(1 - t, 3);
        const v = {};
        for (const k in from) v[k] = from[k] + (to[k] - from[k]) * e;
        setNumbers(v);
        t < 1 ? requestAnimationFrame(step) : resolve();
      };
      requestAnimationFrame(step);
    });
  }

  function reset() {
    screen.classList.remove('is-logged');
    typed.textContent = '';
    caret.style.display = '';
    rows.classList.remove('is-open');
    reveal.forEach((el) => el.classList.remove('is-in'));
    matchBtn.classList.remove('is-busy');
    setNumbers(BEFORE);
  }

  async function play() {
    for (;;) {
      reset();
      await wait(800);

      for (const ch of MEAL) {
        typed.textContent += ch;
        await wait(ch === ' ' ? 30 : 38 + Math.random() * 34);
      }
      await wait(500);

      await press(matchBtn);
      matchBtn.classList.add('is-busy');
      await wait(750);
      matchBtn.classList.remove('is-busy');
      caret.style.display = 'none';

      rows.classList.add('is-open');
      await wait(200);
      for (const el of reveal) {
        el.classList.add('is-in');
        await wait(240);
      }
      await wait(1500);

      await press(logBtn);
      screen.classList.add('is-logged');
      await wait(250);
      await countTo(BEFORE, AFTER, 1000);
      await wait(2800);

      screen.classList.add('is-fading');
      await wait(550);
      screen.classList.remove('is-fading');
    }
  }

  // With reduced motion, show the one frame that tells the story: the meal as
  // typed, and what Grain made of it.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setNumbers(BEFORE);
    typed.textContent = MEAL;
    caret.style.display = 'none';
    rows.classList.add('is-open');
    reveal.forEach((el) => el.classList.add('is-in'));
    return;
  }

  play();
})();

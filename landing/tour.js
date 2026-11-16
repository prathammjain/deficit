// The hero tour: a phone that walks through Grain one chapter at a time,
// food, targets, training, HYROX, progress and programs. It moves on by
// itself, holds still while someone points at it or touches it, and jumps to
// a chapter from the tabs under it or the "Show me the part for" chips. Each
// screen plays what it does in the app. With reduced motion it doesn't move
// on by itself and every screen shows its finished state.

(function () {
  const stage = document.querySelector('[data-gt]');
  if (!stage) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP = 6500; // how long each chapter stays, in ms
  const HOLD = 14000; // how long a chosen chapter stays before moving on
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  const slides = [...stage.querySelectorAll('.t-slide')];
  const tabs = [...stage.querySelectorAll('[data-go]')];
  const caption = stage.querySelector('[data-gt-caption]');
  const appTabs = [...stage.querySelectorAll('.t-tabbar span')];
  const chips = [...document.querySelectorAll('[data-persona]')];
  const tilt = stage.querySelector('[data-gt-tilt]');
  const order = slides.map((s) => s.dataset.slide);

  const CAPTIONS = {
    food: 'Type or say what you ate. GrainAI looks up each food and adds up the calories and macros.',
    targets:
      'Once a week Grain compares what you ate with your weight, then adjusts your targets.',
    train:
      'Last session’s weights are filled in. Tick a set and the rest timer starts.',
    hyrox:
      'Log HYROX sims one segment at a time, with the loads for your division.',
    progress:
      'Food, training and bodyweight in one place, including the weeks that went badly.',
    programs:
      'Coaches share a program with a code. Followers get each day’s session.',
  };
  const APP_TAB = {
    food: 'log',
    targets: 'home',
    train: 'train',
    hyrox: 'train',
    progress: 'history',
    programs: 'train',
  };

  stage.style.setProperty('--gt-step', `${STEP}ms`);

  let index = -1;
  let token = 0; // bumps on every change, so a screen's play stops when left
  let timer = null;
  let holdUntil = 0;
  let pointerIn = false;
  let visible = true;

  function setCaption(text) {
    if (!caption) return;
    if (reduced) {
      caption.textContent = text;
      return;
    }
    caption.classList.add('is-swapping');
    setTimeout(() => {
      caption.textContent = text;
      caption.classList.remove('is-swapping');
    }, 180);
  }

  function show(i) {
    if (i === index) return;
    const prev = slides[index];
    index = i;
    const slide = slides[i];
    const name = order[i];
    token++;

    if (prev) {
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      setTimeout(() => prev.classList.remove('is-leaving'), 700);
      resetSlide(prev);
    }
    slide.classList.add('is-active');
    tabs.forEach((t) =>
      t.setAttribute('aria-selected', String(t.dataset.go === name)),
    );
    appTabs.forEach((t) =>
      t.classList.toggle('is-on', t.dataset.tab === APP_TAB[name]),
    );
    setCaption(CAPTIONS[name]);
    // Restart the progress line under the chosen tab.
    stage.classList.remove('is-paused');
    play(slide, name, token);
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (reduced) return;
    const held = Date.now() < holdUntil;
    stage.classList.toggle('is-held', held);
    const delay = held ? holdUntil - Date.now() : STEP;
    timer = setTimeout(next, delay);
  }

  function next() {
    if (pointerIn || !visible) {
      timer = setTimeout(next, 600);
      return;
    }
    stage.classList.remove('is-held');
    show((index + 1) % slides.length);
  }

  function go(name, hold) {
    const i = order.indexOf(name);
    if (i < 0) return;
    if (hold) holdUntil = Date.now() + HOLD;
    if (i === index) {
      schedule();
      return;
    }
    show(i);
  }

  // ---- What each screen does ----

  function resetSlide(slide) {
    slide.classList.remove('is-logged', 'is-ticked');
  }

  function countDown(el, from, to, ms, live) {
    const start = performance.now();
    const step = (now) => {
      if (!live()) return;
      const t = Math.min(1, (now - start) / ms);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function play(slide, name, my) {
    const live = () => my === token;
    if (reduced) {
      finish(slide, name);
      return;
    }

    if (name === 'food') {
      const type = slide.querySelector('[data-t-type]');
      const full = type.dataset.full || (type.dataset.full = type.textContent);
      const left = slide.querySelector('[data-t-left]');
      const ask = slide.querySelector('.t-askbtn');
      type.textContent = '';
      left.textContent = '2,287';
      await wait(500);
      for (const ch of full) {
        if (!live()) return;
        type.textContent += ch;
        await wait(34);
      }
      await wait(260);
      if (!live()) return;
      ask.classList.add('is-pressed');
      await wait(170);
      ask.classList.remove('is-pressed');
      slide.classList.add('is-logged');
      countDown(left, 2287, 1991, 900, live);
    }

    if (name === 'targets') {
      slide.querySelectorAll('[data-t-count]').forEach((el) => {
        const to = Number(el.dataset.tCount);
        countDown(el, to + 250, to, 1300, live);
      });
    }

    if (name === 'train') {
      const rest = slide.querySelector('[data-t-rest]');
      rest.textContent = '1:30';
      await wait(250);
      if (!live()) return;
      slide.classList.add('is-ticked');
      await wait(1800);
      for (let s = 90; s >= 84 && live(); s--) {
        rest.textContent = `1:${String(s - 60).padStart(2, '0')}`;
        await wait(1000);
      }
    }

    if (name === 'hyrox') {
      const clock = slide.querySelector('[data-t-clock]');
      for (let s = 252; s < 252 + 60 && live(); s++) {
        clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        await wait(1000);
      }
    }

    if (name === 'programs') {
      const code = slide.querySelector('[data-t-code]');
      const full = code.dataset.full || (code.dataset.full = code.textContent);
      code.textContent = '';
      await wait(450);
      for (const ch of full) {
        if (!live()) return;
        code.textContent += ch;
        await wait(120);
      }
    }
  }

  function finish(slide, name) {
    if (name === 'food') slide.classList.add('is-logged');
    if (name === 'train') slide.classList.add('is-ticked');
    if (name === 'food') {
      slide.querySelector('[data-t-left]').textContent = '1,991';
    }
  }

  // ---- Controls ----

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
      go(t.dataset.go, true);
    }),
  );

  chips.forEach((c) => {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', () => {
      chips.forEach((x) =>
        x.setAttribute('aria-pressed', String(x === c)),
      );
      go(c.dataset.persona, true);
      // On a phone the tour sits under the text: bring it into view.
      if (window.innerWidth < 960) {
        stage.scrollIntoView({
          behavior: reduced ? 'auto' : 'smooth',
          block: 'center',
        });
      }
    });
  });

  // Hold still while someone is looking closely.
  stage.addEventListener('pointerenter', () => {
    pointerIn = true;
    stage.classList.add('is-paused');
  });
  stage.addEventListener('pointerleave', () => {
    pointerIn = false;
    stage.classList.remove('is-paused');
    if (tilt) {
      tilt.style.setProperty('--rx', '0deg');
      tilt.style.setProperty('--ry', '0deg');
    }
  });

  // The phone leans toward a mouse pointer, a few degrees at most.
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (tilt && fine && !reduced) {
    stage.addEventListener('pointermove', (e) => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      tilt.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    });
  }

  // Off screen or in a background tab, the tour waits.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }).observe(stage);
  }
  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible';
  });

  show(0);
})();

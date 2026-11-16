// The hero: one week in Grain, Monday to Sunday, in about twenty seconds.
// A playhead moves across the week by itself. Each day logs food and
// training, the weigh-ins land on a chart, and the trend line draws behind
// them. On Sunday the check-in compares what was eaten with the trend and
// moves the daily target. Drag the scrubber or tap a day to take over; it
// carries on by itself a few seconds after you let go. With reduced motion
// it opens on the finished week and only moves when you move it.

(function () {
  const root = document.querySelector('[data-wk]');
  if (!root) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TARGET = 2287;
  const NEW_TARGET = 2037;
  const EATEN = [2110, 1980, 2060, 1940, 2350, 2120, 1720];
  const PROTEIN = [168, 155, 171, 149, 162, 158, 140];
  const WEIGHT = [82.4, 82.9, 82.1, 82.3, 82.6, 81.9, 81.8];
  const TREND = [82.45, 82.4, 82.3, 82.25, 82.15, 82.05, 81.95];
  const TRAIN = [
    { kind: 'lift', name: 'Push', detail: 'Bench press 82.5 kg × 6', tag: 'Record' },
    { kind: 'run', name: 'Easy run', detail: '5.0 km · 26:10 · zone 2', tag: '26 min' },
    { kind: 'lift', name: 'Pull', detail: 'Deadlift 140 kg × 5', tag: '6 sets' },
    { kind: 'rest', name: 'Rest day', detail: 'Nothing to log', tag: '' },
    { kind: 'lift', name: 'Legs', detail: 'Back squat 110 kg × 5', tag: '5 sets' },
    { kind: 'hyrox', name: 'HYROX sim', detail: '8 runs, 8 stations · Open', tag: '1:24:30' },
  ];
  const CAPTIONS = [
    'Log food in one line. Grain looks up each food and keeps the day’s total.',
    'Cardio counts in minutes and zones, never calories, so it can’t inflate what you eat.',
    'Lifts sit next to food: every set, rest and record in the same log.',
    'Weigh in when you like. One morning is noise, so Grain follows the trend line.',
    'A day over target doesn’t break anything. The week is what counts.',
    'HYROX sims log station by station, with the loads for your division.',
    'Sunday: Grain compares what you ate with your trend and moves your target to your real burn.',
  ];

  const DAY_MS = 2600; // one day of autoplay
  const HOLD_MS = 6000; // the finished week stays up this long
  const IDLE_MS = 5000; // back to autoplay this long after a touch
  const CHECK_AT = 6.35; // where on Sunday the check-in lands
  const END = 6.999;

  const $ = (s) => root.querySelector(s);
  const targetEl = $('[data-wk-target]');
  const targetBox = $('.wk-target');
  const dayEl = $('[data-wk-day]');
  const feed = $('[data-wk-feed]');
  const caption = $('[data-wk-caption]');
  const scrub = $('[data-wk-scrub]');
  const fill = $('.wk-fill');
  const knob = $('.wk-knob');
  const dayBtns = [...root.querySelectorAll('[data-wk-go]')];
  const statEaten = $('[data-wk-eaten]');
  const statSessions = $('[data-wk-sessions]');
  const statTrend = $('[data-wk-trend]');
  const svg = $('.wk-chart svg');
  const weighTag = $('[data-wk-weigh]');

  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  // ---- Chart ----
  const W = 320;
  const H = 112;
  const LO = 81.5;
  const HI = 83.1;
  const x = (i) => 16 + (i * (W - 32)) / 6;
  const y = (kg) => 10 + ((HI - kg) / (HI - LO)) * (H - 26);
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    svg.appendChild(el);
    return el;
  };
  for (let i = 0; i < 7; i++) {
    make('line', { class: 'wk-grid', x1: x(i), x2: x(i), y1: 6, y2: H - 14 });
  }
  const pts = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = make('polygon', {
    class: 'wk-area',
    points: `${x(0)},${H - 14} ${pts(TREND)} ${x(6)},${H - 14}`,
  });
  const raw = make('polyline', { class: 'wk-raw', points: pts(WEIGHT) });
  const trend = make('polyline', { class: 'wk-trendline', points: pts(TREND) });
  const dots = WEIGHT.map((v, i) =>
    make('circle', { class: 'wk-dot', cx: x(i), cy: y(v), r: 3.2 }),
  );
  const head = make('circle', { class: 'wk-head', r: 4.5, cx: x(0), cy: y(TREND[0]) });
  const clipId = 'wk-clip';
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<clipPath id="${clipId}"><rect x="0" y="0" height="${H}" width="0"/></clipPath><linearGradient id="wk-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4511e" stop-opacity=".22"/><stop offset="1" stop-color="#f4511e" stop-opacity="0"/></linearGradient>`;
  svg.prepend(defs);
  const clipRect = defs.querySelector('rect');
  [area, raw, trend].forEach((el) => el.setAttribute('clip-path', `url(#${clipId})`));

  // ---- Feed: what the current day holds ----
  const icon = {
    food: '<svg viewBox="0 0 24 24"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 6s1 4 3 4v8"/></svg>',
    lift: '<svg viewBox="0 0 24 24"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>',
    run: '<svg viewBox="0 0 24 24"><path d="M13 4a1.5 1.5 0 1 0 0 .1M9 20l3-6 3 3v4M7 12l3-4 4 1 3 4"/></svg>',
    hyrox: '<svg viewBox="0 0 24 24"><path d="M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18"/></svg>',
    rest: '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l4 4l10-10"/></svg>',
  };

  let shownDay = -1;
  let foodNum;
  let foodBar;
  let proteinNum;

  function buildDay(d) {
    shownDay = d;
    if (d < 6) {
      const t = TRAIN[d];
      feed.innerHTML = `
        <div class="wk-card wk-food" data-at="0.08">
          <span class="wk-ico">${icon.food}</span>
          <div class="wk-body">
            <p class="wk-row"><b>Food</b><span><em data-n>0</em> / ${fmt(TARGET)} kcal</span></p>
            <p class="wk-bar"><i data-bar></i></p>
            <p class="wk-sub">Protein <span data-p>0</span> g</p>
          </div>
        </div>
        <div class="wk-card wk-train wk-${t.kind}" data-at="0.42">
          <span class="wk-ico">${icon[t.kind]}</span>
          <div class="wk-body">
            <p class="wk-row"><b>${t.name}</b>${t.tag ? `<span class="wk-tag">${t.tag}</span>` : ''}</p>
            <p class="wk-sub">${t.detail}</p>
          </div>
        </div>`;
      foodNum = feed.querySelector('[data-n]');
      foodBar = feed.querySelector('[data-bar]');
      proteinNum = feed.querySelector('[data-p]');
    } else {
      feed.innerHTML = `
        <div class="wk-card wk-check" data-at="${CHECK_AT - 6}">
          <span class="wk-ico">${icon.check}</span>
          <div class="wk-body">
            <p class="wk-row"><b>Weekly check in</b><span class="wk-tag">Target moved</span></p>
            <p class="wk-sub">You averaged 2,040 kcal and your trend fell 0.5 kg, so you burn less than the first estimate.</p>
            <p class="wk-move"><span>Maintenance</span><s>2,837</s><b>2,587</b></p>
            <p class="wk-move"><span>Daily target</span><s>${fmt(TARGET)}</s><b>${fmt(NEW_TARGET)}</b></p>
          </div>
        </div>`;
      foodNum = foodBar = proteinNum = null;
    }
    caption.classList.add('is-swapping');
    setTimeout(() => {
      caption.textContent = CAPTIONS[d];
      caption.classList.remove('is-swapping');
    }, 180);
  }

  // ---- Target number, rolled when the check-in lands ----
  let targetShown = TARGET;
  let roll = 0;
  function setTarget(v, animate) {
    if (v === targetShown) return;
    cancelAnimationFrame(roll);
    const from = targetShown;
    targetShown = v;
    targetBox.classList.toggle('is-new', v !== TARGET);
    if (!animate) {
      targetEl.textContent = fmt(v);
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const k = clamp((now - t0) / 900, 0, 1);
      targetEl.textContent = fmt(from + (v - from) * ease(k));
      if (k < 1) roll = requestAnimationFrame(step);
    };
    roll = requestAnimationFrame(step);
  }

  // ---- Draw the whole board for a point in the week ----
  function render(t, animate = true) {
    t = clamp(t, 0, END);
    const d = Math.floor(t);
    const f = t - d;
    if (d !== shownDay) buildDay(d);

    dayEl.textContent = DAYS[d];
    feed.querySelectorAll('[data-at]').forEach((c) => {
      c.classList.toggle('is-in', f >= Number(c.dataset.at));
    });

    if (foodNum) {
      const k = ease(clamp((f - 0.08) / 0.5, 0, 1));
      foodNum.textContent = fmt(EATEN[d] * k);
      foodBar.style.transform = `scaleX(${Math.min(1, (EATEN[d] * k) / TARGET)})`;
      foodBar.classList.toggle('is-over', EATEN[d] * k > TARGET);
      proteinNum.textContent = Math.round(PROTEIN[d] * k);
    }

    // Weigh-ins land each morning; the trend draws up to the playhead.
    dots.forEach((c, i) => c.classList.toggle('is-in', i < d || (i === d && f > 0.04)));
    const px = x(0) + (t / 6) * (x(6) - x(0));
    clipRect.setAttribute('width', Math.min(W, px + 2));
    const ti = Math.min(5, d);
    const tk = d >= 6 ? 1 : f;
    const tv = d >= 6 ? TREND[6] : TREND[ti] + (TREND[ti + 1] - TREND[ti]) * tk;
    head.setAttribute('cx', Math.min(px, x(6)));
    head.setAttribute('cy', y(tv));
    weighTag.textContent = `${WEIGHT[d].toFixed(1)} kg`;
    weighTag.style.left = `${clamp((x(d) / W) * 100, 9, 91)}%`;
    weighTag.style.top = `${(y(WEIGHT[d]) / H) * 100}%`;
    weighTag.classList.toggle('is-in', f > 0.04);

    // Running week stats.
    const done = EATEN.filter((_, i) => i < d || (i === d && f >= 0.6));
    statEaten.textContent = done.length
      ? fmt(done.reduce((a, b) => a + b, 0) / done.length)
      : '·';
    const sessions = TRAIN.filter(
      (s, i) => s.kind !== 'rest' && (i < d || (i === d && f >= 0.42)),
    ).length;
    statSessions.textContent = String(sessions);
    const change = tv - TREND[0];
    statTrend.textContent = `${change <= 0 ? '−' : '+'}${Math.abs(change).toFixed(1)} kg`;

    setTarget(t >= CHECK_AT ? NEW_TARGET : TARGET, animate);

    // Scrubber.
    const p = t / END;
    fill.style.transform = `scaleX(${p})`;
    knob.style.left = `${p * 100}%`;
    scrub.setAttribute('aria-valuenow', String(d));
    scrub.setAttribute('aria-valuetext', DAYS[d]);
    dayBtns.forEach((b, i) => {
      b.classList.toggle('is-past', i < d);
      b.classList.toggle('is-on', i === d);
    });
  }

  // ---- Playback ----
  let t = 0;
  let playing = !reduced;
  let visible = false;
  let last = 0;
  let raf = 0;
  let holdUntil = 0;
  let idleTimer = 0;

  function loop(now) {
    raf = 0;
    if (!playing || !visible) return;
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    if (holdUntil) {
      if (now >= holdUntil) {
        holdUntil = 0;
        root.classList.add('is-rewinding');
        setTimeout(() => {
          t = 0;
          render(t, false);
          root.classList.remove('is-rewinding');
        }, 350);
      }
    } else {
      t += dt / DAY_MS;
      if (t >= END) {
        t = END;
        holdUntil = now + HOLD_MS;
      }
      render(t);
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (raf || reduced) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }

  function takeOver() {
    playing = false;
    holdUntil = 0;
    root.classList.add('is-held');
    clearTimeout(idleTimer);
  }

  function letGo() {
    clearTimeout(idleTimer);
    if (reduced) return;
    idleTimer = setTimeout(() => {
      playing = true;
      root.classList.remove('is-held');
      if (t >= END) holdUntil = performance.now() + 1500;
      start();
    }, IDLE_MS);
  }

  // Drag along the track.
  const track = $('.wk-track');
  const fromX = (clientX) => {
    const r = track.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * END;
  };
  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    takeOver();
    t = fromX(e.clientX);
    render(t);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    t = fromX(e.clientX);
    render(t);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    letGo();
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  dayBtns.forEach((b, i) =>
    b.addEventListener('click', () => {
      takeOver();
      t = i === 6 ? END : i + 0.75;
      render(t);
      letGo();
    }),
  );

  scrub.addEventListener('keydown', (e) => {
    const d = Math.floor(t);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(6, d + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, d - 1);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = 6;
    if (next === null) return;
    e.preventDefault();
    takeOver();
    t = next === 6 ? END : next + 0.75;
    render(t);
    letGo();
  });

  // Only play while on screen.
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    },
    { threshold: 0.25 },
  ).observe(root);

  t = reduced ? END : 0;
  render(t, false);
})();

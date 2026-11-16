// The working demos further down the page: GrainAI's lookup, the weekly
// check in, the HYROX sim and race countdown, and the invite form. Each one
// starts when it scrolls into view. With reduced motion they show their
// finished state and only move when used.

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    );

  /** Run `fn` once, the first time `el` is mostly on screen. */
  function whenSeen(el, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        fn();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
  }

  /** Count a number in an element toward `to`, from whatever it shows. */
  function tween(el, to, ms = 500, suffix = '') {
    const from = Number(el.dataset.v ?? to);
    el.dataset.v = to;
    if (reduced || from === to) {
      el.textContent = fmt(to) + suffix;
      return;
    }
    const start = performance.now();
    const step = (now) => {
      if (Number(el.dataset.v) !== to) return;
      const t = Math.min(1, (now - start) / ms);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - t, 3))) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // =================================================== GrainAI's lookup

  // Values per 100 g from USDA FoodData Central, except Grain's home recipe
  // dishes, which are per serving and marked as estimates.
  const MEALS = [
    {
      text: '200 g chicken breast, 150 g rice, 1 tbsp olive oil',
      foods: [
        {
          said: 'chicken breast',
          cands: [
            ['Chicken breast, cooked', '165 kcal per 100 g', 'USDA'],
            ['Chicken breast, raw', '120 kcal per 100 g', 'USDA'],
            ['Chicken thigh, cooked', '209 kcal per 100 g', 'USDA'],
          ],
          why: 'A weight on your plate means cooked, so the cooked entry wins.',
          name: 'Chicken breast',
          amount: '200 g cooked',
          kcal: 330,
          p: 62,
          tag: 'ok',
        },
        {
          said: 'rice',
          cands: [
            ['White rice, cooked', '130 kcal per 100 g', 'USDA'],
            ['White rice, raw', '365 kcal per 100 g', 'USDA'],
            ['Brown rice, cooked', '123 kcal per 100 g', 'USDA'],
          ],
          why: 'Raw rice has almost three times the calories, so this choice matters.',
          name: 'White rice',
          amount: '150 g cooked',
          kcal: 195,
          p: 4,
          tag: 'ok',
        },
        {
          said: 'olive oil',
          cands: [['Olive oil', '884 kcal per 100 g', 'USDA']],
          why: 'One tablespoon of oil is 13.5 g.',
          name: 'Olive oil',
          amount: '1 tbsp, 13.5 g',
          kcal: 119,
          p: 0,
          tag: 'ok',
        },
      ],
      total: 644,
      protein: 66,
    },
    {
      text: '2 eggs, 2 slices of toast, black coffee',
      foods: [
        {
          said: 'eggs',
          cands: [
            ['Egg, whole', '143 kcal per 100 g', 'USDA'],
            ['Egg white', '52 kcal per 100 g', 'USDA'],
            ['Egg, fried', '196 kcal per 100 g', 'USDA'],
          ],
          why: 'You said eggs, not egg whites. Two large eggs weigh about 100 g.',
          name: 'Egg',
          amount: '2 large, 100 g',
          kcal: 143,
          p: 13,
          tag: 'ok',
        },
        {
          said: 'toast',
          cands: [
            ['Bread, whole wheat', '252 kcal per 100 g', 'USDA'],
            ['Bread, white', '266 kcal per 100 g', 'USDA'],
          ],
          why: 'Toast is bread. Two slices weigh about 60 g.',
          name: 'Toast',
          amount: '2 slices, 60 g',
          kcal: 151,
          p: 7,
          tag: 'ok',
        },
        {
          said: 'black coffee',
          cands: [
            ['Coffee, brewed', '1 kcal per 100 g', 'USDA'],
            ['Espresso', '9 kcal per 100 g', 'USDA'],
          ],
          why: 'Black means no milk or sugar.',
          name: 'Black coffee',
          amount: '1 cup, 240 ml',
          kcal: 2,
          p: 0,
          tag: 'ok',
        },
      ],
      total: 296,
      protein: 20,
    },
    {
      text: '1 bowl dal, 2 roti, 1 bowl rice',
      foods: [
        {
          said: 'dal',
          cands: [
            ['Dal tadka, home recipe', '150 kcal per bowl', 'Grain'],
            ['Lentils, boiled', '116 kcal per 100 g', 'USDA'],
          ],
          why: 'Cooked dal is a dish, not plain lentils. Recipes vary, so it is marked as an estimate.',
          name: 'Dal tadka',
          amount: '1 bowl',
          kcal: 150,
          p: 8,
          tag: 'est',
        },
        {
          said: 'roti',
          cands: [
            ['Roti, whole wheat', '299 kcal per 100 g', 'Grain'],
            ['Bread, whole wheat', '252 kcal per 100 g', 'USDA'],
          ],
          why: 'A roti weighs about 40 g. Home recipes vary, so this is an estimate.',
          name: 'Roti',
          amount: '2 roti, 80 g',
          kcal: 239,
          p: 9,
          tag: 'est',
        },
        {
          said: 'rice',
          cands: [['White rice, cooked', '130 kcal per 100 g', 'USDA']],
          why: 'A bowl of cooked rice is about 150 g.',
          name: 'White rice',
          amount: '1 bowl, 150 g',
          kcal: 195,
          p: 4,
          tag: 'ok',
        },
      ],
      total: 584,
      protein: 21,
    },
  ];

  function engine(card) {
    const buttons = [...card.querySelectorAll('[data-meal]')];
    const steps = [...card.querySelectorAll('.e-step')];
    const input = card.querySelector('[data-e-input]');
    const foods = card.querySelector('[data-e-foods]');
    const look = card.querySelector('[data-e-look]');
    const sum = card.querySelector('[data-e-sum]');
    let token = 0;
    let auto = !reduced;

    const cand = (c) =>
      `<span class="e-cand"><span>${esc(c[0])}<i class="src">${esc(c[2])}</i></span><small>${esc(c[1])}</small></span>`;

    function on(n) {
      steps.forEach((s, i) => {
        s.classList.toggle('is-on', i < n);
        s.classList.toggle('is-now', i === n - 1);
      });
    }

    function finished(meal) {
      input.textContent = meal.text;
      foods.innerHTML = meal.foods
        .map((f) => `<span class="e-food">${esc(f.said)}</span>`)
        .join('');
      look.innerHTML = meal.foods
        .map(
          (f) =>
            `<div class="e-item"><p>“${esc(f.said)}”</p><div class="e-cands">${f.cands
              .map((c, i) =>
                cand(c).replace('e-cand', i ? 'e-cand is-out' : 'e-cand is-picked'),
              )
              .join('')}</div><p class="e-why">${esc(f.why)}</p></div>`,
        )
        .join('');
      sum.innerHTML =
        meal.foods.map(row).join('') +
        `<p class="e-total"><span>Total</span><span>${fmt(meal.total)} kcal, ${meal.protein} g protein</span></p>`;
      on(4);
      steps.forEach((s) => s.classList.remove('is-now'));
    }

    function row(f) {
      const tag =
        f.tag === 'ok'
          ? '<span class="tag ok">good match</span>'
          : '<span class="tag est">estimate</span>';
      return `<p><span><b>${esc(f.name)}</b>${tag}<em>${esc(f.amount)}</em></span><b>${fmt(f.kcal)}</b></p>`;
    }

    async function play(i) {
      const my = ++token;
      const live = () => my === token;
      const meal = MEALS[i];
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      if (reduced) return finished(meal);

      input.textContent = '';
      foods.innerHTML = '';
      look.innerHTML = '';
      sum.innerHTML = '';
      on(1);
      for (const ch of meal.text) {
        if (!live()) return;
        input.textContent += ch;
        await wait(22);
      }
      await wait(350);

      on(2);
      for (const f of meal.foods) {
        if (!live()) return;
        foods.insertAdjacentHTML('beforeend', `<span class="e-food">${esc(f.said)}</span>`);
        await wait(220);
      }
      await wait(300);

      on(3);
      for (const f of meal.foods) {
        if (!live()) return;
        const item = document.createElement('div');
        item.className = 'e-item';
        item.innerHTML = `<p>Looking up “${esc(f.said)}”</p><div class="e-cands">${f.cands
          .map(cand)
          .join('')}</div>`;
        look.appendChild(item);
        await wait(650);
        if (!live()) return;
        const cs = item.querySelectorAll('.e-cand');
        cs.forEach((c, j) => c.classList.add(j ? 'is-out' : 'is-picked'));
        item.querySelector('p').textContent = `“${f.said}”`;
        item.insertAdjacentHTML('beforeend', `<p class="e-why">${esc(f.why)}</p>`);
        await wait(700);
      }

      on(4);
      for (const f of meal.foods) {
        if (!live()) return;
        sum.insertAdjacentHTML('beforeend', row(f));
        await wait(260);
      }
      sum.insertAdjacentHTML(
        'beforeend',
        `<p class="e-total"><span>Total</span><span><b data-e-total>0</b> kcal, ${meal.protein} g protein</span></p>`,
      );
      const total = sum.querySelector('[data-e-total]');
      total.dataset.v = 0;
      tween(total, meal.total, 900);
      await wait(1400);
      steps.forEach((s) => s.classList.remove('is-now'));

      // Move on to the next example by itself until someone picks one.
      await wait(5200);
      if (live() && auto) play((i + 1) % MEALS.length);
    }

    buttons.forEach((b) =>
      b.addEventListener('click', () => {
        auto = false;
        play(Number(b.dataset.meal));
      }),
    );
    if (reduced) finished(MEALS[0]);
    whenSeen(card, () => play(0));
  }

  // ==================================================== Weekly check in

  function adapt(card) {
    const FORMULA = 2837; // Mifflin St Jeor x activity for the example person
    const BMR = 1830;
    const DEFICIT = 550; // 0.5 kg a week
    const TRUST = 0.85; // a high confidence week, as in the app
    const STEP = 250;
    const LO = 1600;
    const HI = 4200;

    const intake = card.querySelector('[data-a-intake]');
    const trend = card.querySelector('[data-a-trend]');
    const intakeOut = card.querySelector('[data-a-intake-out]');
    const trendOut = card.querySelector('[data-a-trend-out]');
    const title = card.querySelector('[data-a-title]');
    const burnEl = card.querySelector('[data-a-burn]');
    const maintEl = card.querySelector('[data-a-maint]');
    const targetEl = card.querySelector('[data-a-target]');
    const note = card.querySelector('[data-a-note]');
    const formulaMark = card.querySelector('[data-a-formula]');
    const measuredMark = card.querySelector('[data-a-measured]');
    const fill = card.querySelector('[data-a-fill]');

    const pct = (v) =>
      `${(Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO) * 100}%`;

    function update() {
      const eat = Number(intake.value);
      const kg = Number(trend.value);
      // Losing weight means burning more than you eat: 7,700 kcal a kg.
      const burn = Math.round(eat - (kg * 7700) / 7);
      const pulled = FORMULA + TRUST * (burn - FORMULA);
      const stepped = Math.min(FORMULA + STEP, Math.max(FORMULA - STEP, pulled));
      const maint = Math.round(Math.min(BMR * 2.5, Math.max(BMR, stepped)));
      const target = Math.max(BMR, maint - DEFICIT);

      intakeOut.textContent = `${fmt(eat)} kcal`;
      trendOut.textContent =
        Math.abs(kg) < 0.025
          ? 'steady'
          : `${Math.abs(kg).toFixed(2).replace(/0$/, '')} kg ${kg < 0 ? 'down' : 'up'}`;
      title.textContent =
        burn < FORMULA - 40
          ? 'You burn less than we thought'
          : burn > FORMULA + 40
            ? 'You burn more than we thought'
            : 'The formula was close';
      tween(burnEl, burn, 450, ' kcal');
      tween(maintEl, maint, 450);
      tween(targetEl, target, 450);
      const moved = maint - FORMULA;
      note.textContent =
        Math.abs(pulled - FORMULA) > STEP
          ? `Your measured burn is far from the formula, so Grain moves ${STEP} kcal this week and keeps going next week.`
          : Math.abs(moved) < 5
            ? 'No change this week.'
            : `A step of ${fmt(Math.abs(moved))} kcal toward your measured burn.`;

      formulaMark.style.setProperty('--at', pct(FORMULA));
      measuredMark.style.setProperty('--at', pct(burn));
      const a = Math.min(FORMULA, maint);
      const b = Math.max(FORMULA, maint);
      fill.style.setProperty('--from', pct(a));
      fill.style.setProperty(
        '--w',
        `${((b - a) / (HI - LO)) * 100}%`,
      );
    }

    burnEl.dataset.v = 2550;
    maintEl.dataset.v = 2593;
    targetEl.dataset.v = 2043;
    intake.addEventListener('input', update);
    trend.addEventListener('input', update);
    update();
  }

  // ======================================================== HYROX sim

  function hyroxSim(card) {
    const PUSH = { ow: 102, om: 152, pw: 152, pm: 202 };
    const SEGS = [
      { name: 'Run 1', pos: 'Run 1 of 2', work: () => '1 km' },
      { name: 'SkiErg', pos: 'Station 1 of 2', work: () => '1,000 m' },
      { name: 'Run 2', pos: 'Run 2 of 2', work: () => '1 km' },
      {
        name: 'Sled push',
        pos: 'Station 2 of 2',
        work: (d) => `50 m at ${PUSH[d]} kg`,
      },
    ];
    const BEST = [300, 270, 305, 190]; // an earlier sim, in seconds
    const AUTO = [295, 272, 308, 205]; // what the demo taps when left alone
    const SPEED = 30; // the demo clock runs this many times faster

    const live = card.querySelector('[data-hx-live]');
    const result = card.querySelector('[data-hx-result]');
    const pos = card.querySelector('[data-hx-pos]');
    const name = card.querySelector('[data-hx-name]');
    const work = card.querySelector('[data-hx-work]');
    const clock = card.querySelector('[data-hx-clock]');
    const done = card.querySelector('[data-hx-done]');
    const splitsEl = card.querySelector('[data-hx-splits]');
    const divs = [...card.querySelectorAll('[data-div]')];

    let div = 'om';
    let seg = 0;
    let segStart = 0;
    let splits = [];
    let auto = !reduced;
    let running = false;
    let frame = 0;

    const clockText = (s) =>
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const elapsed = () => ((performance.now() - segStart) / 1000) * SPEED;

    function paint() {
      const s = SEGS[seg];
      pos.textContent = s.pos;
      name.textContent = s.name;
      work.textContent = s.work(div);
      done.textContent = seg === SEGS.length - 1 ? 'Finish' : `Done: ${s.name}`;
    }

    function tick() {
      if (!running) return;
      const s = elapsed();
      clock.textContent = clockText(s);
      if (auto && s >= AUTO[seg]) {
        lap(AUTO[seg]);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      seg = 0;
      splits = [];
      splitsEl.innerHTML = '';
      result.hidden = true;
      live.hidden = false;
      paint();
      segStart = performance.now();
      running = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    }

    function lap(forced) {
      const s = Math.round(forced ?? elapsed());
      splits.push(s);
      splitsEl.insertAdjacentHTML(
        'afterbegin',
        `<p><span>${SEGS[seg].name}</span><b>${clockText(s)}</b></p>`,
      );
      seg++;
      if (seg === SEGS.length) return finish();
      paint();
      segStart = performance.now();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    }

    function finish() {
      running = false;
      cancelAnimationFrame(frame);
      const total = splits.reduce((a, b) => a + b, 0);
      const runs = splits[0] + splits[2];
      card.querySelector('[data-hx-total]').textContent = clockText(total);
      card.querySelector('[data-hx-sub]').textContent =
        `Running ${clockText(runs)} · Stations ${clockText(total - runs)}`;
      const lost = splits
        .map((s, i) => ({ name: SEGS[i].name, d: s - BEST[i] }))
        .filter((x) => x.d > 0)
        .sort((a, b) => b.d - a.d);
      const max = lost.length ? lost[0].d : 1;
      card.querySelector('[data-hx-lost]').innerHTML = lost.length
        ? lost
            .map(
              (x, i) =>
                `<p><span>${x.name}</span><i style="--s:${(x.d / max).toFixed(2)};animation-delay:${i * 120}ms"></i><b>+${clockText(x.d)}</b></p>`,
            )
            .join('')
        : '<p class="hx-clean">Every split matched or beat your best.</p>';
      live.hidden = true;
      result.hidden = false;
      if (auto) setTimeout(() => auto && start(), 6500);
    }

    done.addEventListener('click', () => {
      auto = false;
      if (running) lap();
    });
    card.querySelector('[data-hx-again]').addEventListener('click', () => {
      auto = false;
      start();
    });
    divs.forEach((b) =>
      b.addEventListener('click', () => {
        div = b.dataset.div;
        divs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (running) work.textContent = SEGS[seg].work(div);
      }),
    );

    paint();
    whenSeen(card, start);
  }

  function countdown(el) {
    const race = new Date();
    race.setDate(race.getDate() + 27);
    el.querySelector('[data-hx-date]').textContent = race.toLocaleDateString(
      'en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' },
    );
    el.querySelector('[data-hx-days]').textContent = '27';
    el.querySelector('[data-hx-weeks]').textContent = '3 weeks and 6 days';
  }

  // ===================================================== Invite requests

  // The app's public Supabase URL and anon key (safe in a web page: the
  // invite_requests table only lets anyone insert, see supabase/schema.sql).
  const SUPABASE_URL = 'https://lemgnnlavzblbahoehpm.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_HITrYfdeNL47xx6qx4lzlg_wRFeIRxU';

  function invite(form) {
    const status = form.querySelector('[data-invite-status]');
    const button = form.querySelector('button[type="submit"]');
    const say = (text, kind) => {
      status.textContent = text;
      status.className = `invite-status ${kind ? `is-${kind}` : ''}`;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const email = String(data.get('email') || '').trim();
      const field = form.querySelector('input[name="email"]');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
        return say('Please enter a valid email address.', 'err');
      }
      field.removeAttribute('aria-invalid');

      const done = (text) => {
        form.classList.add('is-sent');
        say(text, 'ok');
      };
      // A filled hidden field means a bot: thank it and send nothing.
      if (String(data.get('company') || '')) {
        return done('Thanks. You’re on the list.');
      }
      if (SUPABASE_URL.startsWith('__')) {
        return say('Invites open soon. Please try again later.', 'err');
      }

      const clean = (k) => {
        const v = String(data.get(k) || '').trim();
        return v || null;
      };
      button.disabled = true;
      say('Sending…');
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/invite_requests`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            // Older anon keys are JWTs and also go in Authorization; the
            // newer publishable keys go in apikey only.
            ...(SUPABASE_ANON_KEY.startsWith('eyJ')
              ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
              : {}),
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            email,
            name: clean('name'),
            goal: clean('goal'),
            instagram: clean('instagram')?.replace(/^@/, '') ?? null,
          }),
        });
        if (res.ok) {
          done(
            'Thanks. You’re on the list. Sign up in Grain with this email and we’ll turn GrainAI on when your turn comes.',
          );
        } else if (res.status === 409) {
          done('You’re already on the list. We’ll turn GrainAI on soon.');
        } else {
          say('That didn’t go through. Please try again.', 'err');
        }
      } catch {
        say('No connection. Please try again.', 'err');
      } finally {
        button.disabled = false;
      }
    });
  }

  // ============================================================= Start

  const engineCard = document.querySelector('[data-engine]');
  if (engineCard) engine(engineCard);
  const adaptCard = document.querySelector('[data-adapt]');
  if (adaptCard) adapt(adaptCard);
  const sim = document.querySelector('[data-hxsim]');
  if (sim) hyroxSim(sim);
  const count = document.querySelector('.hx-count');
  if (count) countdown(count);
  const form = document.querySelector('[data-invite]');
  if (form) invite(form);
})();

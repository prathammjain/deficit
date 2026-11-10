// The hero phone: a small Grain that works. Type a meal and log it, tick
// sets with last time's numbers already in, and see how History counts a
// break. It all runs in this page: no account, nothing sent anywhere.
//
// Food numbers are per 100 g (or 100 ml) from USDA FoodData Central, except
// where marked: Indian dishes use the app's home recipe estimates (recipes
// vary, so they show as estimates), and whey uses a typical label.

(function () {
  const root = document.querySelector('[data-proto]');
  if (!root) return;

  const $ = (sel, el = root) => el.querySelector(sel);
  const $$ = (sel, el = root) => [...el.querySelectorAll(sel)];
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nb = (s) => s.replace(/ /g, ' ');

  // ---------------------------------------------------------------- Foods

  // [kcal, protein, carbs, fat] per 100 g (or ml). `piece` is grams per
  // piece (`pn` names it), `def` the portion assumed when no amount is given.
  const FOODS = [
    {
      n: 'Chicken breast',
      a: ['chicken breast', 'chicken', 'grilled chicken', 'chicken breasts'],
      m: [165, 31, 0, 3.6],
      def: 150,
    },
    {
      n: 'Chicken thigh',
      a: ['chicken thigh', 'thigh', 'chicken thighs'],
      m: [209, 26, 0, 10.9],
      def: 150,
    },
    {
      n: 'White rice',
      a: ['rice', 'white rice', 'chawal', 'basmati rice', 'basmati'],
      m: [130, 2.7, 28.2, 0.3],
      def: 150,
    },
    { n: 'Brown rice', a: ['brown rice'], m: [123, 2.7, 25.6, 1], def: 150 },
    {
      n: 'Egg',
      a: [
        'egg',
        'eggs',
        'boiled egg',
        'boiled eggs',
        'anda',
        'whole egg',
        'whole eggs',
      ],
      m: [143, 12.6, 0.7, 9.5],
      piece: 50,
      def: 100,
      pn: ['large', 'large'],
    },
    {
      n: 'Egg white',
      a: ['egg white', 'egg whites'],
      m: [52, 10.9, 0.7, 0.2],
      piece: 33,
      def: 99,
    },
    {
      n: 'Roti',
      a: ['roti', 'rotis', 'chapati', 'chapatis', 'phulka', 'phulkas'],
      m: [299, 11.3, 46.4, 9.2],
      piece: 40,
      def: 80,
      pn: ['roti', 'roti'],
    },
    {
      n: 'Paneer',
      a: ['paneer', 'cottage cheese'],
      m: [265, 18.3, 1.2, 20.8],
      def: 100,
    },
    {
      n: 'Oats',
      a: ['oats', 'oatmeal', 'rolled oats', 'porridge'],
      m: [389, 16.9, 66.3, 6.9],
      def: 40,
    },
    {
      n: 'Whey protein',
      a: [
        'whey',
        'whey protein',
        'protein shake',
        'protein powder',
        'scoop whey',
      ],
      m: [400, 80, 10, 5],
      scoop: 30,
      def: 30,
      label: true,
    },
    {
      n: 'Milk',
      a: ['milk', 'whole milk', 'doodh'],
      m: [62, 3.2, 4.8, 3.3],
      ml: true,
      def: 250,
    },
    {
      n: 'Curd',
      a: ['curd', 'dahi', 'yogurt', 'yoghurt', 'plain yogurt'],
      m: [61, 3.5, 4.7, 3.3],
      def: 150,
    },
    {
      n: 'Greek yogurt',
      a: ['greek yogurt', 'greek yoghurt', 'hung curd'],
      m: [59, 10.2, 3.6, 0.4],
      def: 170,
    },
    {
      n: 'Banana',
      a: ['banana', 'bananas', 'kela'],
      m: [89, 1.1, 22.8, 0.3],
      piece: 118,
      def: 118,
    },
    {
      n: 'Apple',
      a: ['apple', 'apples', 'seb'],
      m: [52, 0.3, 13.8, 0.2],
      piece: 182,
      def: 182,
    },
    {
      n: 'Orange',
      a: ['orange', 'oranges'],
      m: [47, 0.9, 11.8, 0.1],
      piece: 131,
      def: 131,
    },
    {
      n: 'Mango',
      a: ['mango', 'mangoes', 'aam'],
      m: [60, 0.8, 15, 0.4],
      piece: 200,
      def: 200,
    },
    { n: 'Ghee', a: ['ghee'], m: [900, 0, 0, 100], tbsp: 13, def: 13 },
    {
      n: 'Oil',
      a: ['oil', 'olive oil', 'cooking oil', 'mustard oil', 'sunflower oil'],
      m: [884, 0, 0, 100],
      tbsp: 13.6,
      def: 13.6,
    },
    {
      n: 'Butter',
      a: ['butter'],
      m: [717, 0.9, 0.1, 81],
      tbsp: 14.2,
      def: 14.2,
    },
    {
      n: 'Peanut butter',
      a: ['peanut butter', 'pb'],
      m: [588, 25.1, 20, 50.4],
      tbsp: 16,
      def: 32,
    },
    {
      n: 'Almonds',
      a: ['almonds', 'almond', 'badam'],
      m: [579, 21.2, 21.6, 49.9],
      piece: 1.2,
      def: 28,
      pn: ['almond', 'almonds'],
    },
    {
      n: 'Peanuts',
      a: ['peanuts', 'peanut', 'moongphali'],
      m: [567, 25.8, 16.1, 49.2],
      def: 30,
    },
    {
      n: 'Bread',
      a: ['bread', 'toast', 'brown bread', 'whole wheat bread', 'slice bread'],
      m: [252, 12.4, 42.7, 3.5],
      piece: 30,
      def: 60,
      pn: ['slice', 'slices'],
    },
    {
      n: 'Potato',
      a: ['potato', 'potatoes', 'aloo', 'boiled potato'],
      m: [86, 1.7, 20, 0.1],
      def: 150,
    },
    {
      n: 'Sweet potato',
      a: ['sweet potato', 'shakarkandi'],
      m: [90, 2, 20.7, 0.2],
      def: 150,
    },
    { n: 'Broccoli', a: ['broccoli'], m: [35, 2.4, 7.2, 0.4], def: 100 },
    { n: 'Salmon', a: ['salmon'], m: [206, 22.1, 0, 12.4], def: 150 },
    { n: 'Tuna', a: ['tuna', 'canned tuna'], m: [116, 25.5, 0, 0.8], def: 100 },
    { n: 'Tofu', a: ['tofu'], m: [144, 17.3, 2.8, 8.7], def: 100 },
    { n: 'Mutton', a: ['mutton', 'goat'], m: [143, 27.1, 0, 3], def: 150 },
    {
      n: 'Chickpeas',
      a: ['chickpeas', 'boiled chana', 'kabuli chana'],
      m: [164, 8.9, 27.4, 2.6],
      def: 150,
    },
    {
      n: 'Soya chunks',
      a: ['soya chunks', 'soya', 'soy chunks', 'nutrela'],
      m: [345, 52, 33, 0.5],
      def: 50,
      label: true,
    },
    {
      n: 'Pasta',
      a: ['pasta', 'spaghetti', 'penne'],
      m: [158, 5.8, 30.9, 0.9],
      def: 200,
    },
    { n: 'Quinoa', a: ['quinoa'], m: [120, 4.4, 21.3, 1.9], def: 150 },
    {
      n: 'Avocado',
      a: ['avocado'],
      m: [160, 2, 8.5, 14.7],
      piece: 150,
      def: 75,
    },
    {
      n: 'Sugar',
      a: ['sugar', 'cheeni'],
      m: [387, 0, 100, 0],
      tbsp: 12.5,
      def: 4.2,
    },
    {
      n: 'Honey',
      a: ['honey', 'shahad'],
      m: [304, 0.3, 82.4, 0],
      tbsp: 21,
      def: 21,
    },
    // Dishes: the app's home recipe estimates, one serving each.
    {
      n: 'Dal tadka',
      a: ['dal', 'daal', 'dal tadka', 'yellow dal', 'toor dal', 'arhar dal'],
      s: ['1 katori', 150, 8, 20, 4],
    },
    { n: 'Dal makhani', a: ['dal makhani'], s: ['1 katori', 280, 9, 20, 18] },
    {
      n: 'Rajma',
      a: ['rajma', 'rajma chawal curry', 'kidney beans'],
      s: ['1 katori', 210, 9, 30, 6],
    },
    {
      n: 'Chole',
      a: ['chole', 'chana masala', 'chana', 'chickpea curry'],
      s: ['1 katori', 230, 10, 28, 9],
    },
    { n: 'Sambar', a: ['sambar', 'sambhar'], s: ['1 katori', 110, 5, 15, 3] },
    {
      n: 'Paneer butter masala',
      a: ['paneer butter masala', 'paneer makhani', 'shahi paneer'],
      s: ['1 katori', 320, 12, 12, 25],
    },
    {
      n: 'Palak paneer',
      a: ['palak paneer'],
      s: ['1 katori', 250, 12, 10, 18],
    },
    {
      n: 'Butter chicken',
      a: ['butter chicken', 'murgh makhani'],
      s: ['1 katori', 330, 22, 10, 22],
    },
    {
      n: 'Chicken curry',
      a: ['chicken curry'],
      s: ['1 katori', 250, 22, 8, 15],
    },
    {
      n: 'Chicken biryani',
      a: ['biryani', 'chicken biryani'],
      s: ['1 plate', 450, 22, 50, 18],
    },
    {
      n: 'Khichdi',
      a: ['khichdi', 'dal khichdi'],
      s: ['1 katori', 200, 7, 35, 4],
    },
    {
      n: 'Idli',
      a: ['idli', 'idlis', 'idly'],
      s: ['1 piece', 70, 2, 14, 0.5],
      count: true,
    },
    {
      n: 'Dosa',
      a: ['dosa', 'dosas', 'plain dosa'],
      s: ['1 piece', 170, 4, 26, 6],
      count: true,
    },
    {
      n: 'Masala dosa',
      a: ['masala dosa'],
      s: ['1 piece', 250, 6, 36, 9],
      count: true,
    },
    { n: 'Poha', a: ['poha'], s: ['1 plate', 270, 6, 45, 7] },
    { n: 'Upma', a: ['upma'], s: ['1 katori', 250, 6, 38, 8] },
    {
      n: 'Aloo paratha',
      a: ['aloo paratha', 'potato paratha'],
      s: ['1 piece', 260, 6, 36, 10],
      count: true,
    },
    {
      n: 'Paratha',
      a: ['paratha', 'parathas', 'plain paratha'],
      s: ['1 piece', 200, 4, 28, 8],
      count: true,
    },
    {
      n: 'Naan',
      a: ['naan', 'butter naan'],
      s: ['1 piece', 260, 8, 45, 5],
      count: true,
    },
    {
      n: 'Samosa',
      a: ['samosa', 'samosas'],
      s: ['1 piece', 260, 4, 28, 15],
      count: true,
    },
    {
      n: 'Masala chai',
      a: ['chai', 'tea', 'masala chai', 'chaai'],
      s: ['1 cup', 90, 3, 12, 3],
      count: true,
    },
    {
      n: 'Sweet lassi',
      a: ['lassi', 'sweet lassi'],
      s: ['1 glass', 220, 6, 35, 6],
      count: true,
    },
    {
      n: 'Gulab jamun',
      a: ['gulab jamun', 'gulab jamuns'],
      s: ['1 piece', 150, 2, 25, 5],
      count: true,
    },
  ];

  const NUMBER_WORDS = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    half: 0.5,
  };
  // Grams in one of each household measure (ml for drinks).
  const MEASURES = {
    katori: 150,
    katoris: 150,
    bowl: 200,
    bowls: 200,
    cup: 240,
    cups: 240,
    glass: 250,
    glasses: 250,
    plate: 250,
    plates: 250,
  };

  function score(food, q) {
    let best = 0;
    for (const alias of food.a) {
      if (alias === q) best = Math.max(best, 100);
      else if (q.startsWith(alias + ' ') || q.endsWith(' ' + alias))
        best = Math.max(best, 70 + alias.length);
      else if (alias.startsWith(q) && q.length >= 3) best = Math.max(best, 60);
      else if (q.includes(alias) && alias.length >= 4)
        best = Math.max(best, 50 + alias.length);
    }
    return best;
  }

  function findFood(q) {
    let pick = null;
    let top = 0;
    for (const f of FOODS) {
      const s = score(f, q);
      if (s > top) [pick, top] = [f, s];
    }
    return top >= 50 ? pick : null;
  }

  /** One segment ("2 roti", "200 g chicken", "1 tbsp ghee") read into an item. */
  function readSegment(seg) {
    let text = ` ${seg.toLowerCase()} `
      .replace(/(\d)\s*(kg|g|gm|gms|grams?|ml|l)\b/g, '$1$2 ')
      .replace(/[^a-z0-9. ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    let count = null;
    let grams = null;
    let unit = null;
    const words = [];
    for (const tok of text.split(' ')) {
      const weight = /^(\d+(?:\.\d+)?)(kg|g|gm|gms|grams?|ml|l)$/.exec(tok);
      if (weight) {
        const v = Number(weight[1]);
        grams = weight[2] === 'kg' || weight[2] === 'l' ? v * 1000 : v;
        continue;
      }
      if (count == null && /^\d+(\.\d+)?$/.test(tok)) {
        count = Number(tok);
        continue;
      }
      if (count == null && tok in NUMBER_WORDS) {
        count = NUMBER_WORDS[tok];
        continue;
      }
      if (
        [
          'tbsp',
          'tablespoon',
          'tablespoons',
          'tsp',
          'teaspoon',
          'teaspoons',
          'scoop',
          'scoops',
          'slice',
          'slices',
          'piece',
          'pieces',
          'pc',
          'pcs',
        ].includes(tok) ||
        tok in MEASURES
      ) {
        unit = tok;
        continue;
      }
      if (
        ['of', 'with', 'some', 'cooked', 'boiled', 'grilled'].includes(tok) &&
        words.length === 0
      )
        continue;
      words.push(tok);
    }
    const name = words
      .join(' ')
      .replace(/\b(of|with)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!name) return null;
    const food = findFood(name);
    if (!food) return { miss: seg.trim() };
    return portion(food, { count, grams, unit });
  }

  const PLURAL = {
    piece: 'pieces',
    cup: 'cups',
    plate: 'plates',
    glass: 'glasses',
  };
  const plural = (w) => PLURAL[w] ?? w;

  /** How much of a food, its macros, and how sure the portion is. */
  function portion(food, amount) {
    const { grams, unit } = amount;
    // "banana" on its own means one banana.
    const single =
      amount.count == null &&
      grams == null &&
      !unit &&
      food.piece &&
      food.def === food.piece;
    const count = single ? 1 : amount.count;
    const n = count ?? 1;
    // A dish: so many servings of the home recipe estimate. A weight counts
    // only against a serving that has one (a katori or a plate).
    if (food.s) {
      const [label, kcal, p, c, f] = food.s;
      const per = /katori/.test(label) ? 150 : /plate/.test(label) ? 250 : 0;
      const servings = grams && per ? grams / per : n;
      return {
        name: food.n,
        sub: grams
          ? `${fmt(grams)} g`
          : servings === 1
            ? label
            : `${+servings.toFixed(1)} ${plural(label.replace(/^1 /, ''))}`,
        kcal: kcal * servings,
        p: p * servings,
        c: c * servings,
        f: f * servings,
        tag: 'estimate',
      };
    }
    let g = grams;
    let assumed = false;
    const spoon = unit && /^(tbsp|tablespoons?|tsp|teaspoons?)$/.test(unit);
    const scoop = unit && /^scoops?$/.test(unit);
    if (g == null) {
      if (spoon && food.tbsp)
        g = (n * food.tbsp) / (/^t(sp|easpoons?)$/.test(unit) ? 3 : 1);
      else if (scoop && food.scoop) g = n * food.scoop;
      else if (unit && unit in MEASURES) g = n * MEASURES[unit];
      else if (count != null && (food.piece || food.scoop || food.tbsp)) {
        g = n * (food.piece ?? food.scoop ?? food.tbsp);
      } else {
        g = food.def * n;
        assumed = true;
      }
    }
    const k = g / 100;
    const what =
      count != null &&
      food.piece &&
      grams == null &&
      (!unit || /^(slices?|pieces?|pcs?)$/.test(unit))
        ? `${n} ${(food.pn ?? ['piece', 'pieces'])[n === 1 ? 0 : 1]}, `
        : spoon || scoop
          ? `${n} ${unit
              .replace(/(oons?|s)$/, '')
              .replace(/^tablesp$/, 'tbsp')
              .replace(/^teasp$/, 'tsp')}, `
          : unit && unit in MEASURES
            ? `${n} ${unit.replace(/(e?s)$/, '')}, `
            : '';
    return {
      name: food.n,
      sub: `${what}${fmt(g)} ${food.ml ? 'ml' : 'g'}${assumed ? ', amount assumed' : ''}`,
      kcal: food.m[0] * k,
      p: food.m[1] * k,
      c: food.m[2] * k,
      f: food.m[3] * k,
      tag: assumed ? 'check' : food.label ? 'label' : 'good',
    };
  }

  // Commas, "and", "with", "+" and full stops split a meal into foods. A
  // full stop between digits is a decimal point, so "1.5 roti" stays whole.
  // (No lookbehind in the regex: older Safari can't parse one.)
  function readMeal(text) {
    return text
      .replace(/(\d)\.(\d)/g, '$1\u2024$2')
      .split(/,|\band\b|\bwith\b|\+|;|&|\n|\./i)
      .map((s) => s.replace(/\u2024/g, '.').trim())
      .filter(Boolean)
      .map(readSegment)
      .filter(Boolean);
  }

  // ---------------------------------------------------------------- Log tab

  const TARGET = 2600;
  const CIRC = 263.9;
  const day = { kcal: 520, p: 38, c: 64, f: 14 };
  const eaten = [{ name: 'Oats with whey and banana', kcal: 520 }];

  const log = $('[data-p-log]');
  const input = $('[data-p-input]', log);
  const matchBtn = $('[data-p-match]', log);
  const results = $('[data-p-results]', log);
  const suggest = $('[data-p-suggest]', log);
  const eatenList = $('[data-p-eaten]', log);
  const gauge = $('[data-p-gauge]', log);
  let current = [];

  function paintDay(from) {
    const to = { ...day };
    const set = (v) => {
      $('[data-p-left]', log).textContent = fmt(Math.max(0, TARGET - v.kcal));
      $('[data-p-consumed]', log).textContent = fmt(v.kcal);
      $('[data-p-p]', log).textContent = fmt(v.p);
      $('[data-p-c]', log).textContent = fmt(v.c);
      $('[data-p-f]', log).textContent = fmt(v.f);
      gauge.style.strokeDashoffset = String(
        CIRC * (1 - Math.min(1, v.kcal / TARGET)),
      );
    };
    if (!from || reduced) return set(to);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 900);
      const e = 1 - Math.pow(1 - t, 3);
      const v = {};
      for (const k in to) v[k] = from[k] + (to[k] - from[k]) * e;
      set(v);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function paintEaten() {
    const shown = eaten.slice(-2).reverse();
    eatenList.innerHTML =
      shown
        .map((e) => `<li><span>${esc(e.name)}</span><b>${fmt(e.kcal)}</b></li>`)
        .join('') +
      (eaten.length > 2
        ? `<li class="p-more">and ${eaten.length - 2} earlier today</li>`
        : '');
  }

  const esc = (s) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    );

  const TAGS = {
    good: '<em class="p-ok">✓ good match</em>',
    label: '<em class="p-ok">✓ typical label</em>',
    estimate: '<em class="p-warn">estimate</em>',
    check: '<em class="p-warn">check amount</em>',
  };

  function showResults(items) {
    current = items.filter((i) => !i.miss);
    const misses = items.filter((i) => i.miss);
    const total = current.reduce(
      (t, i) => ({ kcal: t.kcal + i.kcal, p: t.p + i.p }),
      { kcal: 0, p: 0 },
    );
    results.innerHTML =
      current
        .slice(0, 4)
        .map(
          (i, n) =>
            `<div class="p-row" style="--n:${n}"><div class="p-row-main"><div class="p-row-name">${esc(i.name)} ${TAGS[i.tag]}</div><div class="p-row-sub">${esc(i.sub)}</div></div><b>${fmt(i.kcal)}</b></div>`,
        )
        .join('') +
      (current.length > 4
        ? `<p class="p-note">and ${current.length - 4} more</p>`
        : '') +
      (misses.length
        ? `<p class="p-note">Not in this demo’s list: ${esc(misses.map((m) => m.miss).join(', '))}. The app knows thousands more.</p>`
        : '') +
      (current.length
        ? `<div class="p-total" style="--n:${Math.min(4, current.length)}"><span>Total</span><b>${fmt(total.kcal)} kcal · ${fmt(total.p)} g protein</b></div>
           <div class="p-actions" style="--n:${Math.min(4, current.length) + 1}"><button type="button" class="app-btn" data-p-add>Log ${current.length} ${current.length === 1 ? 'item' : 'items'}</button><button type="button" class="p-link" data-p-clear>Clear</button></div>`
        : `<div class="p-actions"><button type="button" class="p-link" data-p-clear>Try another meal</button></div>`);
    log.classList.add('is-matched');
  }

  function clearLog() {
    current = [];
    results.innerHTML = '';
    log.classList.remove('is-matched');
  }

  async function match() {
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    matchBtn.classList.add('is-busy');
    await sleep(reduced ? 0 : 420);
    matchBtn.classList.remove('is-busy');
    showResults(readMeal(text));
  }

  function addCurrent() {
    if (!current.length) return;
    const before = { ...day };
    for (const i of current) {
      day.kcal += i.kcal;
      day.p += i.p;
      day.c += i.c;
      day.f += i.f;
    }
    const total = current.reduce((t, i) => t + i.kcal, 0);
    eaten.push({
      name:
        current.length === 1
          ? current[0].name
          : current.map((i) => i.name).join(', '),
      kcal: total,
    });
    input.value = '';
    clearLog();
    paintEaten();
    paintDay(before);
    root.dispatchEvent(
      new CustomEvent('proto:logged', { detail: { kcal: total } }),
    );
  }

  matchBtn.addEventListener('click', match);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      match();
    }
  });
  input.addEventListener('input', () => {
    if (log.classList.contains('is-matched')) clearLog();
  });
  log.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.matches('[data-p-add]')) addCurrent();
    if (t.matches('[data-p-clear]')) {
      clearLog();
      input.value = '';
      input.focus();
    }
    if (t.matches('[data-p-try]')) {
      input.value = t.dataset.pTry;
      match();
    }
  });

  // ---------------------------------------------------------------- Train tab

  const train = $('[data-p-train]');
  const sets = [
    { prev: [80, 8], kg: 80, reps: 8, done: false },
    { prev: [80, 8], kg: 80, reps: 8, done: false },
    { prev: [80, 7], kg: 80, reps: 7, done: false },
  ];
  const e1rm = (kg, reps) => (reps === 1 ? kg : kg * (1 + reps / 30));
  let best = Math.max(...sets.map((s) => e1rm(...s.prev)));
  let restTimer = null;
  let restEnds = 0;
  const started = Date.now() - 14 * 60 * 1000;

  const clock = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const nextSet = () => sets.findIndex((s) => !s.done);

  function paintSets() {
    const next = nextSet();
    $('[data-p-sets]', train).innerHTML = sets
      .map(
        (
          s,
          i,
        ) => `<div class="p-set${s.done ? ' is-done' : ''}${i === next ? ' is-next' : ''}">
          <span class="p-set-n">${s.record ? '<i class="p-pr" title="Record">PR</i>' : i + 1}</span>
          <span class="p-set-prev">${s.prev[0]} × ${s.prev[1]}</span>
          <span class="p-set-v${s.done || i === next ? '' : ' is-ghost'}">${fmtKg(s.kg)}</span>
          <span class="p-set-v${s.done || i === next ? '' : ' is-ghost'}">${s.reps}</span>
          <button type="button" class="p-tick" data-p-tick="${i}" aria-label="${s.done ? 'Undo' : 'Done'} set ${i + 1}" aria-pressed="${s.done}">
            <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
        </div>`,
      )
      .join('');
    const adj = $('[data-p-adjust]', train);
    if (next < 0) {
      adj.hidden = true;
      $('[data-p-finish]', train).hidden = false;
    } else {
      adj.hidden = false;
      $('[data-p-finish]', train).hidden = true;
      $('[data-p-adj-kg]', train).textContent = `${fmtKg(sets[next].kg)} kg`;
      $('[data-p-adj-reps]', train).textContent = `${sets[next].reps} reps`;
    }
  }

  const fmtKg = (kg) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1));

  function toast(text) {
    const t = $('[data-p-toast]', train);
    t.textContent = text;
    t.classList.remove('is-on');
    void t.offsetWidth;
    t.classList.add('is-on');
  }

  function startRest() {
    restEnds = Date.now() + 90 * 1000;
    const bar = $('[data-p-rest]', train);
    bar.hidden = false;
    clearInterval(restTimer);
    const paint = () => {
      const left = restEnds - Date.now();
      $('[data-p-rest-time]', bar).textContent = clock(left);
      $('[data-p-rest-fill]', bar).style.transform =
        `scaleX(${Math.max(0, left / 90000)})`;
      if (left <= 0) {
        clearInterval(restTimer);
        bar.classList.add('is-over');
        $('[data-p-rest-time]', bar).textContent = 'Go';
      }
    };
    bar.classList.remove('is-over');
    paint();
    restTimer = setInterval(paint, 250);
  }

  function stopRest() {
    clearInterval(restTimer);
    $('[data-p-rest]', train).hidden = true;
  }

  train.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const next = nextSet();
    if (b.dataset.pTick != null) {
      const s = sets[Number(b.dataset.pTick)];
      s.done = !s.done;
      if (s.done) {
        const score = e1rm(s.kg, s.reps);
        if (score > best + 0.05) {
          s.record = true;
          toast(
            `New record: ${fmtKg(s.kg)} × ${s.reps}, estimated max ${fmtKg(Math.round(score * 10) / 10)} kg`,
          );
          best = score;
        }
        startRest();
      } else {
        s.record = false;
        best = Math.max(
          ...sets.filter((x) => x.done).map((x) => e1rm(x.kg, x.reps)),
          ...sets.map((x) => e1rm(...x.prev)),
        );
      }
      paintSets();
    }
    if (next >= 0 && b.dataset.pStep) {
      const s = sets[next];
      if (b.dataset.pStep === 'kg+') s.kg += 2.5;
      if (b.dataset.pStep === 'kg-') s.kg = Math.max(2.5, s.kg - 2.5);
      if (b.dataset.pStep === 'reps+') s.reps = Math.min(30, s.reps + 1);
      if (b.dataset.pStep === 'reps-') s.reps = Math.max(1, s.reps - 1);
      paintSets();
    }
    if (b.matches('[data-p-skip]')) stopRest();
    if (b.matches('[data-p-finish]')) {
      stopRest();
      const volume = sets.reduce((v, s) => v + s.kg * s.reps, 0);
      const prs = sets.filter((s) => s.record).length;
      $('[data-p-summary-text]', train).textContent =
        `3 sets · ${fmt(volume)} kg moved${prs ? ` · ${prs} ${prs === 1 ? 'record' : 'records'}` : ''}`;
      train.classList.add('is-finished');
    }
    if (b.matches('[data-p-again]')) {
      sets.forEach((s) => {
        s.prev = [s.kg, s.reps];
        s.done = false;
        s.record = false;
      });
      best = Math.max(...sets.map((s) => e1rm(...s.prev)));
      train.classList.remove('is-finished');
      paintSets();
    }
  });

  setInterval(() => {
    const el = $('[data-p-clock]', train);
    if (el) el.textContent = clock(Date.now() - started);
  }, 1000);

  // ---------------------------------------------------------------- History tab

  const hist = $('[data-p-history]');
  const MAINT = 2740;
  const TODAY = new Date();
  const dayName = (back) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - back);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };
  // 30 days, oldest first: a full day's intake, 0 for nothing logged, or a
  // small number for a day logged at under half the target.
  const STEADY = [
    2210, 2380, 2290, 0, 2150, 2460, 2320, 2280, 2190, 2410, 2350, 0, 2240,
    2120, 2390, 2300, 2420, 2260, 610, 2310, 2180, 2440, 2270, 0, 2330, 2200,
    2360, 2250, 2410, 2290,
  ];
  const BREAK = [
    2210, 2380, 2290, 2150, 2460, 2320, 2280, 2190, 2410, 2350, 2240, 2120,
    2390, 2300, 2420, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2180, 2440, 2270, 2330,
    2200,
  ];

  function paintHistory(mode) {
    const series = mode === 'break' ? BREAK : STEADY;
    const full = (k) => k >= TARGET * 0.5;
    let from = 0;
    if (mode === 'break') from = 25;
    const shown = series.slice(from);
    const counted = shown.filter(full);
    const total = counted.reduce((t, k) => t + (MAINT - k), 0);
    let streak = 0;
    for (let i = series.length - 1; i >= 0 && full(series[i]); i--) streak++;
    $('[data-p-h-total]', hist).textContent = fmt(total);
    $('[data-p-h-sub]', hist).textContent =
      `About ${(total / 7700).toFixed(1)} kg of fat, across the ${counted.length} full days you logged`;
    $('[data-p-h-days]', hist).textContent =
      `${counted.length} of ${shown.length}`;
    $('[data-p-h-streak]', hist).textContent = String(streak);
    $('[data-p-h-avg]', hist).textContent = fmt(total / counted.length);
    $('[data-p-h-bars]', hist).innerHTML = series
      .map((k, i) => {
        const cls = k === 0 ? 'off' : full(k) ? '' : 'half';
        const dim = mode === 'break' && i < from ? ' dim' : '';
        const h =
          k === 0 ? 0 : full(k) ? Math.max(0.15, (MAINT - k) / 650) : 0.7;
        return `<i class="${cls}${dim}" style="--h:${h.toFixed(2)}"></i>`;
      })
      .join('');
    hist.classList.toggle('is-break', mode === 'break');
    $('[data-p-fresh-when]', hist).textContent =
      `FRESH START · SINCE ${dayName(4).toUpperCase()}`;
    $$('[data-p-mode]', hist).forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.pMode === mode)),
    );
    const note = $('[data-p-h-note]', hist);
    note.textContent =
      mode === 'break'
        ? 'Those 10 days count as nothing, not as a deficit. The numbers start again from your return.'
        : 'Missed days add nothing. The day logged at under half your target isn’t counted until you finish it.';
  }

  hist.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p-mode]');
    if (b) paintHistory(b.dataset.pMode);
  });

  // ---------------------------------------------------------------- Tabs

  const tabs = $$('[data-p-tab]');
  const panels = { log, train, history: hist };
  function show(name) {
    tabs.forEach((t) => {
      const on = t.dataset.pTab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== name;
    root.dataset.tab = name;
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.pTab)));

  // ---------------------------------------------------------------- Start

  paintDay();
  paintEaten();
  paintSets();
  paintHistory('steady');
  show('log');
  root.classList.add('is-live');

  // Once, when the phone first comes into view: type a meal and match it,
  // so it's clear the phone works. Any touch takes over at once.
  let touched = false;
  const takeOver = () => {
    if (touched) return;
    touched = true;
    root.classList.remove('is-demo');
  };
  ['pointerdown', 'keydown', 'focusin', 'wheel'].forEach((ev) =>
    root.addEventListener(ev, takeOver, { passive: true }),
  );

  async function attract() {
    const text = '2 roti, 1 katori dal, 150 g paneer';
    await sleep(900);
    if (touched) return;
    root.classList.add('is-demo');
    for (const ch of text) {
      if (touched) return;
      input.value += ch;
      await sleep(ch === ' ' ? 28 : 34 + Math.random() * 30);
    }
    await sleep(350);
    if (touched) return;
    matchBtn.classList.add('is-pressed');
    await sleep(140);
    matchBtn.classList.remove('is-pressed');
    if (touched) return;
    await match();
    root.classList.remove('is-demo');
  }

  if (!reduced) {
    const seen = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        seen.disconnect();
        attract();
      },
      { threshold: 0.6 },
    );
    seen.observe(root);
  }
})();

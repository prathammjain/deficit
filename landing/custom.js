// The Custom demo: types a food someone already knows the numbers for, adds
// it, and moves on to the next, the way the app's Custom form works. Without
// JS, or with reduced motion, the card shows its finished state from the HTML.

(function () {
  const card = document.querySelector('[data-custom]');
  if (!card) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // In the order they were added: the last three are already in the HTML
  // list, so the loop picks up after them and each entry has left the list by
  // the time it comes round again.
  const foods = [
    ["Mom's rajma, worked out once", 320, 14],
    ['Cafe chicken wrap, from the menu', 480, 36],
    ['Protein bar, from the label', 210, 20],
    ['Greek yogurt cup, from the pack', 120, 10],
    ['Overnight oats, my usual', 350, 22],
  ];
  const el = (k) => card.querySelector(`[data-c="${k}"]`);
  const name = el('name');
  const kcal = el('kcal');
  const protein = el('protein');
  const list = el('list');
  const add = card.querySelector('.c-add');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function type(target, text, speed) {
    target.textContent = '';
    for (const ch of String(text)) {
      target.textContent += ch;
      await wait(speed);
    }
  }

  function row([label, k]) {
    const li = document.createElement('li');
    li.className = 'c-new';
    li.innerHTML = '<span></span><em>Custom</em><b></b>';
    li.querySelector('span').textContent = label;
    li.querySelector('b').textContent = k;
    return li;
  }

  async function loop() {
    for (let i = 3; ; i = (i + 1) % foods.length) {
      const [label, k, p] = foods[i];
      card.classList.add('is-typing');
      await type(name, label, 45);
      await wait(250);
      await type(kcal, k, 110);
      await wait(200);
      await type(protein, p, 110);
      await wait(450);
      add.classList.add('is-pressed');
      await wait(180);
      add.classList.remove('is-pressed');
      list.prepend(row(foods[i]));
      while (list.children.length > 3) list.lastElementChild.remove();
      card.classList.remove('is-typing');
      name.textContent = '';
      kcal.textContent = '';
      protein.textContent = '';
      await wait(1600);
    }
  }

  // Start once it's on screen, so the first entry isn't typed unseen.
  const seen = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      loop();
    },
    { threshold: 0.4 },
  );
  seen.observe(card);
})();

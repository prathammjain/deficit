// On a phone, related sections share one place so the page is shorter to
// scroll. Each group uses its own control, so they don't read the same:
//
//   accordion  rows with a one line summary; one opens at a time
//   steps      numbered steps across the top, Next and Back underneath
//   tabs       a row of tabs with a pill that slides to the chosen one
//
// Nothing here is sticky, so nothing can overlap the floating bar. On a
// wider screen every section shows in full and the controls aren't there.

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = window.matchMedia('(max-width: 899px)');
  const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  const sets = [];

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /** The box eases from one height to the next while the panel rises in. */
  function morph(stage, from, panel) {
    if (reduced || !phone.matches) return;
    const to = stage.offsetHeight;
    stage.classList.add('is-morphing');
    stage
      .animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: 420,
        easing: EASE,
      })
      .finished.finally(() => stage.classList.remove('is-morphing'));
    if (panel) {
      panel.animate(
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 460, easing: EASE },
      );
    }
  }

  /** Someone deep in a long panel switches: take them to the group's top. */
  function toTop(set) {
    const top = set.getBoundingClientRect().top;
    if (top < 0) {
      window.scrollTo({
        top: window.scrollY + top - 72,
        behavior: reduced ? 'auto' : 'smooth',
      });
    }
  }

  document.querySelectorAll('[data-tabset]').forEach((set) => {
    const panels = [...set.querySelectorAll(':scope > [data-tab]')];
    if (panels.length < 2) return;
    const style = set.dataset.tabsetStyle || 'tabs';
    set.classList.add(`tabset-${style}`);
    panels.forEach((p, i) => {
      if (!p.id) p.id = `${set.dataset.tabset}-${i + 1}`;
    });

    const stage = el('div', 'tabset-stage');
    set.append(stage);
    panels.forEach((p) => stage.appendChild(p));

    let at = 0;
    let apply = () => {};
    let show = () => {};

    if (style === 'accordion') {
      // A header before each panel: number, title, one line summary.
      const heads = panels.map((p, i) => {
        const h = el('button', 'acc-head');
        h.type = 'button';
        h.id = `${p.id}-head`;
        h.setAttribute('aria-controls', p.id);
        const n = el('span', 'acc-num', String(i + 1));
        const words = el('span', 'acc-words');
        words.append(el('span', 'acc-title', p.dataset.tab));
        if (p.dataset.summary) {
          words.append(el('span', 'acc-sum', p.dataset.summary));
        }
        const chev = el('span', 'acc-chev');
        chev.setAttribute('aria-hidden', 'true');
        h.append(n, words, chev);
        h.addEventListener('click', () => show(at === i ? -1 : i, true));
        stage.insertBefore(h, p);
        return h;
      });
      apply = () => {
        const on = phone.matches;
        panels.forEach((p, j) => {
          p.classList.toggle('is-tab-off', on && j !== at);
          heads[j].setAttribute('aria-expanded', String(j === at));
        });
      };
      show = (i, byUser) => {
        if (i === at) return;
        const from = stage.offsetHeight;
        at = i;
        apply();
        if (!phone.matches) return;
        if (byUser && i >= 0) {
          const top = heads[i].getBoundingClientRect().top;
          if (top < 0) window.scrollBy({ top: top - 72, behavior: 'auto' });
        }
        morph(stage, from, i >= 0 ? panels[i] : null);
      };
    } else if (style === 'steps') {
      // Numbered steps on top, Next and Back under the open panel.
      const bar = el('ol', 'steps-bar');
      bar.setAttribute('aria-label', set.dataset.tabsetLabel || 'Steps');
      const dots = panels.map((p, i) => {
        const li = el('li', 'steps-item');
        const b = el('button', 'steps-btn');
        b.type = 'button';
        b.setAttribute('aria-controls', p.id);
        b.append(el('span', 'steps-num', String(i + 1)));
        b.append(el('span', 'steps-name', p.dataset.tab));
        b.addEventListener('click', () => show(i, true));
        li.append(b);
        bar.append(li);
        return b;
      });
      set.insertBefore(bar, stage);
      const foot = el('div', 'steps-foot');
      const back = el('button', 'steps-back', 'Back');
      back.type = 'button';
      const next = el('button', 'steps-next');
      next.type = 'button';
      back.addEventListener('click', () => show(at - 1, true));
      next.addEventListener('click', () =>
        show(at + 1 < panels.length ? at + 1 : 0, true),
      );
      foot.append(back, next);
      set.append(foot);
      apply = () => {
        const on = phone.matches;
        panels.forEach((p, j) =>
          p.classList.toggle('is-tab-off', on && j !== at),
        );
        dots.forEach((d, j) => {
          d.parentElement.classList.toggle('is-done', j < at);
          d.parentElement.classList.toggle('is-now', j === at);
          d.setAttribute('aria-current', j === at ? 'step' : 'false');
        });
        back.disabled = at === 0;
        next.textContent =
          at + 1 < panels.length
            ? `Next: ${panels[at + 1].dataset.tab}`
            : `Back to ${panels[0].dataset.tab}`;
      };
      show = (i, byUser) => {
        if (i === at || i < 0 || i >= panels.length) return;
        const from = stage.offsetHeight;
        at = i;
        apply();
        if (!phone.matches) return;
        if (byUser) toTop(set);
        morph(stage, from, panels[i]);
      };
    } else {
      // Tabs with a sliding pill.
      const bar = el('div', 'tabbar');
      bar.setAttribute('role', 'tablist');
      bar.setAttribute('aria-label', set.dataset.tabsetLabel || 'Sections');
      const glide = el('i', 'tabbar-glide');
      glide.setAttribute('aria-hidden', 'true');
      bar.append(glide);
      const tabs = panels.map((p, i) => {
        const b = el('button', 'tabbar-tab', p.dataset.tab);
        b.type = 'button';
        b.id = `${p.id}-tab`;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-controls', p.id);
        b.addEventListener('click', () => show(i, true));
        b.addEventListener('keydown', (e) => {
          const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
          if (!step) return;
          e.preventDefault();
          const j = (at + step + panels.length) % panels.length;
          show(j, true);
          tabs[j].focus();
        });
        bar.append(b);
        return b;
      });
      set.insertBefore(bar, stage);
      const glideTo = () => {
        const t = tabs[at];
        glide.style.width = `${t.offsetWidth}px`;
        glide.style.transform = `translateX(${t.offsetLeft}px)`;
      };
      apply = () => {
        const on = phone.matches;
        panels.forEach((p, j) => {
          p.classList.toggle('is-tab-off', on && j !== at);
          if (on) {
            p.setAttribute('role', 'tabpanel');
            p.setAttribute('aria-labelledby', tabs[j].id);
          } else {
            p.removeAttribute('role');
            p.removeAttribute('aria-labelledby');
          }
        });
        tabs.forEach((t, j) => {
          t.setAttribute('aria-selected', String(j === at));
          t.tabIndex = j === at ? 0 : -1;
        });
        if (on) glideTo();
      };
      show = (i, byUser) => {
        if (i === at) return;
        const from = stage.offsetHeight;
        at = i;
        apply();
        if (!phone.matches) return;
        if (byUser) toTop(set);
        morph(stage, from, panels[i]);
      };
      addEventListener('resize', () => phone.matches && glideTo());
      if (document.fonts)
        document.fonts.ready.then(() => phone.matches && glideTo());
    }

    // A link straight to a section (or something in it) opens it.
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = id && document.getElementById(id);
      const i = target ? panels.findIndex((p) => p.contains(target)) : -1;
      if (i >= 0) show(i, false);
    };

    sets.push({ apply: () => apply(), fromHash });
    apply();
  });

  if (!sets.length) return;
  phone.addEventListener('change', () => sets.forEach((s) => s.apply()));
  addEventListener('hashchange', () => sets.forEach((s) => s.fromHash()));
  sets.forEach((s) => s.fromHash());
})();

// Phones get less to read at once: long intros stop after three lines with
// a More link, and the questions show the first few with the rest one tap
// away. Nothing is removed; it's all still there.
(function () {
  if (!window.matchMedia('(max-width: 640px)').matches) return;

  document
    .querySelectorAll(
      '.section-lede, .hero.food .lede, .split-copy > p:not([class])',
    )
    .forEach((p) => {
      // About three lines on a phone. Judged by length, so intros inside
      // hidden panels are handled too.
      if (p.textContent.trim().length <= 150) return;
      p.classList.add('is-clamped');
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'more-link';
      more.textContent = 'More';
      more.addEventListener('click', () => {
        p.classList.remove('is-clamped');
        more.remove();
      });
      p.after(more);
    });

  const list = document.querySelector('.faq-list');
  const items = list ? [...list.querySelectorAll('.faq-item')] : [];
  const SHOWN = 5;
  if (items.length > SHOWN + 1) {
    items.slice(SHOWN).forEach((i) => i.classList.add('is-extra'));
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'more-link more-faq';
    all.textContent = `Show all ${items.length} questions`;
    all.addEventListener('click', () => {
      items.forEach((i) => i.classList.remove('is-extra'));
      all.remove();
    });
    list.after(all);
  }
})();

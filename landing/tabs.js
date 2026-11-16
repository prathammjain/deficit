// On a phone, related sections share one place with a row of tabs above
// them, so the page is shorter to scroll. The row names every section in
// the group, so nothing is out of sight. On a wider screen every section
// shows in full and the tabs are not there.

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = window.matchMedia('(max-width: 899px)');
  const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  const sets = [];

  document.querySelectorAll('[data-tabset]').forEach((set) => {
    const panels = [...set.querySelectorAll(':scope > [data-tab]')];
    if (panels.length < 2) return;

    const bar = document.createElement('div');
    bar.className = 'tabbar';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', set.dataset.tabsetLabel || 'Sections');
    const glide = document.createElement('i');
    glide.className = 'tabbar-glide';
    glide.setAttribute('aria-hidden', 'true');
    bar.appendChild(glide);

    const stage = document.createElement('div');
    stage.className = 'tabset-stage';
    set.prepend(bar);
    bar.after(stage);
    panels.forEach((p) => stage.appendChild(p));

    let at = 0;
    const tabs = panels.map((p, i) => {
      if (!p.id) p.id = `${set.dataset.tabset}-${i + 1}`;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tabbar-tab';
      b.id = `${p.id}-tab`;
      b.textContent = p.dataset.tab;
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
      bar.appendChild(b);
      return b;
    });

    function glideTo() {
      const t = tabs[at];
      glide.style.width = `${t.offsetWidth}px`;
      glide.style.transform = `translateX(${t.offsetLeft}px)`;
    }

    function apply() {
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
    }

    function show(i, byUser) {
      if (i === at) return;
      const from = stage.offsetHeight;
      at = i;
      apply();
      if (!phone.matches) return;

      // Someone deep in a long panel taps a tab: take them to its top.
      const top = set.getBoundingClientRect().top;
      if (byUser && top < 0) {
        window.scrollTo({
          top: window.scrollY + top - 8,
          behavior: reduced ? 'auto' : 'smooth',
        });
      }
      if (reduced) return;

      // The box eases to its new height while the new panel rises in.
      const to = stage.offsetHeight;
      stage.classList.add('is-morphing');
      stage
        .animate([{ height: `${from}px` }, { height: `${to}px` }], {
          duration: 460,
          easing: EASE,
        })
        .finished.finally(() => stage.classList.remove('is-morphing'));
      panels[at].animate(
        [
          { opacity: 0, transform: 'translateY(18px) scale(0.985)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
        ],
        { duration: 520, easing: EASE },
      );
    }

    // A link straight to a section (or something in it) opens its tab.
    function fromHash() {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id && document.getElementById(id);
      const i = el ? panels.findIndex((p) => p.contains(el)) : -1;
      if (i >= 0) show(i, false);
    }

    sets.push({ apply, glideTo, fromHash });
    apply();
  });

  if (!sets.length) return;
  const all = (k) => sets.forEach((s) => s[k]());
  phone.addEventListener('change', () => all('apply'));
  addEventListener('resize', () => phone.matches && all('glideTo'));
  if (document.fonts) document.fonts.ready.then(() => phone.matches && all('glideTo'));
  addEventListener('hashchange', () => all('fromHash'));
  all('fromHash');
})();

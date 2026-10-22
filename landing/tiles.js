// Plays each illustrated tile once as it scrolls into view, and again when
// someone hovers or taps it. The motion lives in styles.css under .is-playing;
// this only adds the class and runs the number counters.

(function () {
  const tiles = document.querySelectorAll('[data-tile]');
  if (!tiles.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (el, n) =>
    (el.dataset.prefix || '') +
    Math.round(n).toLocaleString('en-US') +
    (el.dataset.suffix || '');

  function count(el, delay) {
    const to = Number(el.dataset.countTo);
    if (reduced) {
      el.textContent = fmt(el, to);
      return;
    }
    el.textContent = fmt(el, 0);
    setTimeout(() => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, Math.max(0, (now - start) / 900));
        el.textContent = fmt(el, to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  }

  function play(tile) {
    tile.classList.remove('is-playing');
    void tile.offsetWidth; // restart the CSS animations from their first frame
    tile.classList.add('is-playing');
    // The oil tile counts once the drop lands; the scales count straight away.
    const delay = tile.classList.contains('tile-oil') ? 1100 : 250;
    tile.querySelectorAll('[data-count-to]').forEach((el) => count(el, delay));
  }

  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        play(e.target);
        seen.unobserve(e.target);
      }
    },
    { threshold: 0.45 },
  );

  tiles.forEach((tile) => {
    seen.observe(tile);
    if (reduced) return;
    let last = 0;
    const replay = () => {
      // Ignore a hover that lands while the tile is still mid-play.
      if (performance.now() - last < 2200) return;
      last = performance.now();
      play(tile);
    };
    tile.addEventListener('pointerenter', replay);
    tile.addEventListener('click', replay);
  });
})();

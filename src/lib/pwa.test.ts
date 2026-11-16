import { canReloadNow, entryBundle, onResume } from './pwa';

describe('entryBundle', () => {
  it('finds the hashed entry bundle in the page', () => {
    const html =
      '<script src="/_expo/static/js/web/entry-8d81baefa9dc42d352deecb95cc04d90.js" defer></script>';
    expect(entryBundle(html)).toBe(
      '/_expo/static/js/web/entry-8d81baefa9dc42d352deecb95cc04d90.js',
    );
    expect(entryBundle('<html></html>')).toBeNull();
  });
});

describe('canReloadNow', () => {
  it('never interrupts typing or a live workout, sim or program', () => {
    expect(canReloadNow({ path: '/', typing: false })).toBe(true);
    expect(canReloadNow({ path: '/log', typing: true })).toBe(false);
    expect(canReloadNow({ path: '/workout', typing: false })).toBe(false);
    expect(canReloadNow({ path: '/hyrox', typing: false })).toBe(false);
    expect(canReloadNow({ path: '/history', typing: false })).toBe(true);
  });
});

describe('onResume', () => {
  const base = {
    updateReady: false,
    dayChanged: false,
    path: '/',
    typing: false,
  };

  it('does nothing when nothing changed', () => {
    expect(onResume(base)).toBe('none');
  });

  it('reloads quietly for a new version or a new day when it is safe', () => {
    expect(onResume({ ...base, updateReady: true })).toBe('reload');
    expect(onResume({ ...base, dayChanged: true })).toBe('reload');
  });

  it('offers the update instead during a live session', () => {
    expect(onResume({ ...base, updateReady: true, path: '/hyrox' })).toBe(
      'offer',
    );
    // A new day alone waits quietly until the session ends.
    expect(onResume({ ...base, dayChanged: true, path: '/workout' })).toBe(
      'none',
    );
  });
});

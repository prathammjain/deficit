/**
 * The engine's caches: what it keeps, for how long, and that a cached USDA
 * answer is exactly the one USDA gave.
 */
import {
  TtlCache,
  tokenExpiry,
  usdaLookups,
  type LookupIO,
} from '../../../supabase/functions/food/caches';

describe('TtlCache', () => {
  it('forgets an entry once it expires', () => {
    let now = 1000;
    const c = new TtlCache<string>(10, 500, () => now);
    c.set('a', 'x');
    expect(c.get('a')).toBe('x');
    now = 1499;
    expect(c.get('a')).toBe('x');
    now = 1500;
    expect(c.get('a')).toBeUndefined();
  });

  it('takes a shorter lifetime for one entry, never a longer one', () => {
    let now = 0;
    const c = new TtlCache<string>(10, 500, () => now);
    c.set('short', 'x', 100);
    c.set('long', 'y', 10_000);
    now = 150;
    expect(c.get('short')).toBeUndefined();
    now = 499;
    expect(c.get('long')).toBe('y');
    now = 500;
    expect(c.get('long')).toBeUndefined();
  });

  it('keeps nothing with no time left', () => {
    const c = new TtlCache<string>(10, 500);
    c.set('a', 'x', 0);
    c.set('b', 'x', -5);
    expect(c.size).toBe(0);
  });

  it('drops the oldest entry when full, counting a refresh as new', () => {
    const c = new TtlCache<number>(2, 10_000);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 3); // refreshed: now the newest
    c.set('c', 4);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(3);
    expect(c.get('c')).toBe(4);
  });
});

describe('usdaLookups', () => {
  type Rows = { name: string }[];
  const rows = (q: string): Rows => [{ name: `USDA ${q}` }];
  const later = <T>(ms: number, v: T) =>
    new Promise<T>((r) => setTimeout(() => r(v), ms));

  function io(over: Partial<LookupIO<Rows>> = {}) {
    const asked: string[] = [];
    const aborted: string[] = [];
    const saved: Map<string, Rows>[] = [];
    const base: LookupIO<Rows> = {
      memory: new TtlCache<Rows>(100, 60_000),
      load: async () => new Map(),
      fetch: (q, signal) => {
        asked.push(q);
        signal.addEventListener('abort', () => aborted.push(q));
        return later(20, rows(q));
      },
      save: (found) => void saved.push(found),
    };
    return { io: { ...base, ...over }, asked, aborted, saved };
  }

  it('asks USDA once per distinct query and answers in the order asked', async () => {
    const t = io();
    const out = await usdaLookups(['rice', 'egg', 'rice'], t.io);
    expect(out).toEqual([rows('rice'), rows('egg'), rows('rice')]);
    expect(t.asked).toEqual(['rice', 'egg']);
    expect(t.saved).toEqual([
      new Map([
        ['rice', rows('rice')],
        ['egg', rows('egg')],
      ]),
    ]);
  });

  it('answers from memory with no request at all', async () => {
    const t = io();
    await usdaLookups(['rice'], t.io);
    t.asked.length = 0;
    expect(await usdaLookups(['rice'], t.io)).toEqual([rows('rice')]);
    expect(t.asked).toEqual([]);
    expect(t.saved).toHaveLength(1); // nothing new to store the second time
  });

  it('takes a stored answer and cancels its USDA search', async () => {
    const stored: Rows = [{ name: 'stored rice' }];
    const t = io({ load: async () => new Map([['rice', stored]]) });
    const started = Date.now();
    const out = await usdaLookups(['rice', 'egg'], t.io);
    expect(out).toEqual([stored, rows('egg')]);
    expect(t.aborted).toEqual(['rice']);
    expect(t.saved).toEqual([new Map([['egg', rows('egg')]])]);
    expect(Date.now() - started).toBeLessThan(200);
    // And the stored answer is now in memory.
    t.asked.length = 0;
    expect(await usdaLookups(['rice'], t.io)).toEqual([stored]);
    expect(t.asked).toEqual([]);
  });

  it('reads a store that fails as having nothing', async () => {
    const t = io({ load: async () => Promise.reject(new Error('down')) });
    expect(await usdaLookups(['rice'], t.io)).toEqual([rows('rice')]);
  });

  it('stops waiting for a slow store and uses USDA', async () => {
    const t = io({
      load: () => later(5_000, new Map([['rice', [{ name: 'late' }]]])),
      storedWaitMs: 30,
    });
    const started = Date.now();
    expect(await usdaLookups(['rice'], t.io)).toEqual([rows('rice')]);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('returns null for USDA unavailable and never keeps it', async () => {
    const t = io({
      fetch: async (q) => {
        t.asked.push(q);
        return q === 'down' ? null : rows(q);
      },
    });
    expect(await usdaLookups(['down', 'egg'], t.io)).toEqual([
      null,
      rows('egg'),
    ]);
    expect(t.saved).toEqual([new Map([['egg', rows('egg')]])]);
    t.asked.length = 0;
    await usdaLookups(['down'], t.io);
    expect(t.asked).toEqual(['down']); // asked again next time
  });

  it('reads a search that throws as unavailable', async () => {
    const t = io({ fetch: async () => Promise.reject(new Error('net')) });
    expect(await usdaLookups(['rice'], t.io)).toEqual([null]);
    expect(t.saved).toEqual([]);
  });

  it('keeps an empty answer: USDA answering "no match" is an answer', async () => {
    const t = io({
      fetch: async (q) => {
        t.asked.push(q);
        return [];
      },
    });
    expect(await usdaLookups(['zzz'], t.io)).toEqual([[]]);
    t.asked.length = 0;
    expect(await usdaLookups(['zzz'], t.io)).toEqual([[]]);
    expect(t.asked).toEqual([]);
  });

  it('does nothing for no queries', async () => {
    const t = io();
    expect(await usdaLookups([], t.io)).toEqual([]);
    expect(t.saved).toEqual([]);
  });
});

describe('tokenExpiry', () => {
  const jwt = (payload: object) =>
    `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

  it('reads exp from a JWT', () => {
    expect(tokenExpiry(jwt({ exp: 1_800_000_000, sub: 'u' }))).toBe(
      1_800_000_000,
    );
  });

  it('is null for anything else', () => {
    expect(tokenExpiry('scorer')).toBeNull();
    expect(tokenExpiry('a.!!!.c')).toBeNull();
    expect(tokenExpiry(jwt({ sub: 'u' }))).toBeNull();
  });
});

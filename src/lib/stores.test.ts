import { gatherDailyRecords, gatherRange, toDailyData } from './history';
import {
  createMemoryStore,
  getJSON,
  getMany,
  getManyJSON,
  setJSON,
  type KVStore,
} from './kv';
import {
  clearProfile,
  hasProfile,
  loadProfile,
  saveProfile,
} from './profile-store';
import {
  addEntry,
  loadDay,
  loadDays,
  portionedEntry,
  remaining,
  removeEntry,
  summarize,
  todayKey,
  updateEntryQuantity,
  type LogEntry,
} from './log-store';
import type { ProfileInput } from './targets';
import { setWeight } from './weight-store';

const SAMPLE: ProfileInput = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 85,
  activityLevel: 'moderate',
  goalRateKgWeek: 0.5,
};

/** Wrap a store so every operation takes a tick — mimics a network round trip. */
function slowStore(inner: KVStore, ms = 20): KVStore {
  const wait = () => new Promise((r) => setTimeout(r, ms));
  return {
    async get(k) {
      await wait();
      return inner.get(k);
    },
    async set(k, v) {
      await wait();
      return inner.set(k, v);
    },
    async remove(k) {
      await wait();
      return inner.remove(k);
    },
  };
}

/** A store that reads many keys in one go, and counts its round trips. */
function batchStore(inner: KVStore = createMemoryStore(), ms = 0) {
  const calls = { get: 0, getMany: 0 };
  const wait = () => new Promise((r) => setTimeout(r, ms));
  const store: KVStore = {
    async get(k) {
      calls.get++;
      await wait();
      return inner.get(k);
    },
    async getMany(keys) {
      calls.getMany++;
      await wait();
      return Promise.all(keys.map((k) => inner.get(k)));
    },
    async set(k, v) {
      await wait();
      return inner.set(k, v);
    },
    async remove(k) {
      await wait();
      return inner.remove(k);
    },
  };
  return { store, calls };
}

describe('kv batched reads', () => {
  it('reads key by key from a store that has no batched read', async () => {
    const s = createMemoryStore({ a: '1', c: '3' });
    expect(await getMany(s, ['a', 'b', 'c'])).toEqual(['1', null, '3']);
  });

  it('uses the store’s batched read when it has one', async () => {
    const { store, calls } = batchStore(createMemoryStore({ a: '{"x":1}' }));
    expect(await getManyJSON(store, ['a', 'b'])).toEqual([{ x: 1 }, null]);
    expect(calls).toEqual({ get: 0, getMany: 1 });
  });

  it('reads corrupt json in a batch as null', async () => {
    const s = createMemoryStore({ bad: '{not json', ok: '2' });
    expect(await getManyJSON(s, ['bad', 'ok'])).toEqual([null, 2]);
  });
});

describe('kv json helpers', () => {
  it('round-trips a value', async () => {
    const s = createMemoryStore();
    await setJSON(s, 'k', { a: 1 });
    expect(await getJSON<{ a: number }>(s, 'k')).toEqual({ a: 1 });
  });

  it('returns null for a missing key', async () => {
    const s = createMemoryStore();
    expect(await getJSON(s, 'nope')).toBeNull();
  });

  it('returns null (not throw) on corrupt json', async () => {
    const s = createMemoryStore({ bad: '{not json' });
    expect(await getJSON(s, 'bad')).toBeNull();
  });
});

describe('profile-store', () => {
  it('saves and reloads a profile', async () => {
    const s = createMemoryStore();
    expect(await hasProfile(s)).toBe(false);
    const saved = await saveProfile(SAMPLE, s);
    expect(saved.weightKg).toBe(85);
    expect(saved.version).toBe(1);
    expect(await hasProfile(s)).toBe(true);
    expect((await loadProfile(s))?.age).toBe(30);
  });

  it('preserves createdAt across edits but moves updatedAt', async () => {
    const s = createMemoryStore();
    const first = await saveProfile(SAMPLE, s);
    await new Promise((r) => setTimeout(r, 2));
    const second = await saveProfile({ ...SAMPLE, weightKg: 83 }, s);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt >= first.updatedAt).toBe(true);
    expect(second.weightKg).toBe(83);
  });

  it('clears a profile', async () => {
    const s = createMemoryStore();
    await saveProfile(SAMPLE, s);
    await clearProfile(s);
    expect(await loadProfile(s)).toBeNull();
  });
});

describe('log-store', () => {
  it('todayKey formats as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 5, 6))).toBe('2026-06-06');
  });

  it('adds, lists and removes entries for a day', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    await addEntry(date, { label: 'Eggs', kcal: 200, proteinG: 18 }, s);
    const after = await addEntry(
      date,
      { label: 'Rice', kcal: 300, carbsG: 65 },
      s,
    );
    expect(after).toHaveLength(2);

    const loaded = await loadDay(date, s);
    expect(loaded.map((e) => e.label)).toEqual(['Eggs', 'Rice']);

    const pruned = await removeEntry(date, loaded[0].id, s);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].label).toBe('Rice');
  });

  it('keeps days independent', async () => {
    const s = createMemoryStore();
    await addEntry('2026-06-06', { label: 'A', kcal: 100 }, s);
    expect(await loadDay('2026-06-07', s)).toEqual([]);
  });

  it('does not drop the previous entry when adds overlap', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    // The UI fires several un-awaited adds in the same tick (rapid taps, or a
    // duplicated press event). Without serialization the last write wins and
    // the earlier entry is silently lost.
    await Promise.all([
      addEntry(date, { label: 'A', kcal: 100 }, s),
      addEntry(date, { label: 'B', kcal: 200 }, s),
      addEntry(date, { label: 'C', kcal: 300 }, s),
    ]);
    const stored = (await loadDay(date, s)).map((e) => e.label);
    expect(stored).toHaveLength(3);
    expect(stored.sort()).toEqual(['A', 'B', 'C']);
  });

  it('keeps an earlier entry when a later add overlaps an update', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    const food = {
      name: 'Dal Tadka',
      serving: '1 katori',
      kcal: 150,
      proteinG: 8,
      carbsG: 20,
      fatG: 4,
    };
    await addEntry(date, portionedEntry(food, 1), s);
    const [existing] = await loadDay(date, s);

    await Promise.all([
      addEntry(date, { label: 'Chai', kcal: 80 }, s),
      updateEntryQuantity(date, existing.id, 2, s),
    ]);
    const stored = (await loadDay(date, s)).map((e) => e.label);
    expect(stored).toEqual(['Dal Tadka', 'Chai']);
    expect((await loadDay(date, s))[0].quantity).toBe(2);
  });

  it('a read during an in-flight write sees the post-write state', async () => {
    // The log screen reloads the day on every focus. Against a slow store (a
    // Supabase round trip is ~1s) a tab switch moments after a tap fires that
    // read mid-write; unqueued, it returned the pre-write snapshot and its
    // setMeals wiped the just-added meal from the list while the store still
    // held it — the next add then made everything reappear.
    const s = slowStore(createMemoryStore());
    const date = '2026-06-06';

    const writing = addEntry(date, { label: 'Dal', kcal: 150 }, s);
    await new Promise((r) => setTimeout(r, 5));
    const reloaded = await loadDay(date, s);

    expect(await writing).toHaveLength(1);
    expect(reloaded.map((e) => e.label)).toEqual(['Dal']);
  });

  it('reads many days in one round trip, in the order asked', async () => {
    const { store, calls } = batchStore();
    await addEntry('2026-06-05', { label: 'A', kcal: 100 }, store);
    await addEntry('2026-06-07', { label: 'B', kcal: 200 }, store);
    calls.get = 0;

    const days = await loadDays(
      ['2026-06-07', '2026-06-06', '2026-06-05'],
      store,
    );
    expect(days.map((d) => d.map((e) => e.label))).toEqual([['B'], [], ['A']]);
    expect(calls).toEqual({ get: 0, getMany: 1 });
  });

  it('a batched read during an in-flight write sees the post-write state', async () => {
    const { store } = batchStore(createMemoryStore(), 20);
    const date = '2026-06-06';

    const writing = addEntry(date, { label: 'Dal', kcal: 150 }, store);
    await new Promise((r) => setTimeout(r, 5));
    const [day, other] = await loadDays([date, '2026-06-05'], store);

    expect(await writing).toHaveLength(1);
    expect(day.map((e) => e.label)).toEqual(['Dal']);
    expect(other).toEqual([]);
  });

  it('a write issued during a read resolves after it, with nothing lost', async () => {
    // Resolution order has to match issue order: a slow read that resolved
    // after a later write would hand the screen the day from before it.
    const { store } = batchStore(createMemoryStore(), 20);
    const date = '2026-06-06';
    await addEntry(date, { label: 'A', kcal: 100 }, store);

    const order: string[] = [];
    const reading = loadDays([date], store).then((d) => {
      order.push('read');
      return d;
    });
    const writing = addEntry(date, { label: 'B', kcal: 200 }, store).then(
      (d) => {
        order.push('write');
        return d;
      },
    );

    expect((await reading)[0].map((e) => e.label)).toEqual(['A']);
    expect((await writing).map((e) => e.label)).toEqual(['A', 'B']);
    expect(order).toEqual(['read', 'write']);
  });

  it('overlapping reads run side by side instead of in a line', async () => {
    const { store } = batchStore(createMemoryStore(), 30);
    const started = Date.now();
    await Promise.all([
      loadDays(['2026-06-05', '2026-06-06'], store),
      loadDays(['2026-06-06', '2026-06-07'], store),
      loadDay('2026-06-06', store),
    ]);
    // Three reads of 30 ms each: about 30 ms together, 90 ms in a line.
    expect(Date.now() - started).toBeLessThan(75);
  });

  it('a failed read does not hold up the writes after it', async () => {
    const inner = createMemoryStore();
    let down = true;
    const store: KVStore = {
      get: (k) => inner.get(k),
      set: (k, v) => inner.set(k, v),
      remove: (k) => inner.remove(k),
      async getMany(keys) {
        if (down) throw new Error('offline');
        return Promise.all(keys.map((k) => inner.get(k)));
      },
    };
    const date = '2026-06-06';
    await expect(loadDays([date], store)).rejects.toThrow('offline');
    down = false;
    expect(await addEntry(date, { label: 'A', kcal: 100 }, store)).toHaveLength(
      1,
    );
  });
});

describe('history', () => {
  /** Day keys for the `n` days ending today, oldest first. */
  const lastDays = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      return todayKey(d);
    });

  it('gathers a range of days in one read of the log', async () => {
    const { store, calls } = batchStore();
    const [dayBefore, yesterday, today] = lastDays(3);
    await addEntry(dayBefore, { label: 'A', kcal: 500, proteinG: 30 }, store);
    await addEntry(today, { label: 'B', kcal: 700, carbsG: 80 }, store);
    await addEntry(today, { label: 'C', kcal: 100, fatG: 5 }, store);
    await setWeight(yesterday, 81.5, store);
    calls.get = 0;

    const recs = await gatherDailyRecords(45, store);
    expect(recs).toHaveLength(45);
    expect(recs.slice(-3)).toEqual([
      {
        date: dayBefore,
        logged: true,
        kcal: 500,
        proteinG: 30,
        carbsG: 0,
        fatG: 0,
        weightKg: null,
      },
      {
        date: yesterday,
        logged: false,
        kcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        weightKg: 81.5,
      },
      {
        date: today,
        logged: true,
        kcal: 800,
        proteinG: 0,
        carbsG: 80,
        fatG: 5,
        weightKg: null,
      },
    ]);
    // 45 days of meals in one round trip, and one for the weigh ins.
    expect(calls).toEqual({ get: 1, getMany: 1 });
  });

  it('gathers between two day keys, both included', async () => {
    const s = createMemoryStore();
    await addEntry('2026-03-01', { label: 'A', kcal: 400 }, s);
    const recs = await gatherRange('2026-02-27', '2026-03-01', s);
    expect(recs.map((r) => r.date)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
    expect(recs.map((r) => r.kcal)).toEqual([0, 0, 400]);
  });

  it('turns day records into the intake and weight series', () => {
    const base = { logged: true, proteinG: 0, carbsG: 0, fatG: 0 };
    expect(
      toDailyData([
        { ...base, date: '2026-06-05', kcal: 2100, weightKg: 80 },
        { ...base, date: '2026-06-06', kcal: 0, logged: false, weightKg: null },
      ]),
    ).toEqual([
      { date: '2026-06-05', intakeKcal: 2100, weightKg: 80 },
      { date: '2026-06-06', intakeKcal: null, weightKg: null },
    ]);
  });
});

describe('portioned entries', () => {
  const dal = {
    name: 'Dal Tadka',
    serving: '1 katori',
    kcal: 150,
    proteinG: 8,
    carbsG: 20,
    fatG: 4,
  };

  it('builds an entry scaled by quantity, keeping the per-unit macros', () => {
    const e = portionedEntry(dal, 2);
    expect(e.kcal).toBe(300);
    expect(e.proteinG).toBe(16);
    expect(e.quantity).toBe(2);
    expect(e.unitKcal).toBe(150);
  });

  it('carries the engine trust signal (source + confidence) onto the entry', () => {
    const e = portionedEntry({ ...dal, source: 'usda' }, 1, 'low');
    expect(e.source).toBe('usda');
    expect(e.confidence).toBe('low');
    // A direct pick (no confidence arg) leaves it unflagged.
    expect(
      portionedEntry({ ...dal, source: 'local' }, 1).confidence,
    ).toBeUndefined();
  });

  it('re-scales a logged entry when the quantity changes', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    await addEntry(date, portionedEntry(dal, 1), s);
    const [entry] = await loadDay(date, s);
    expect(entry.kcal).toBe(150);

    const next = await updateEntryQuantity(date, entry.id, 2.5, s);
    expect(next[0].kcal).toBe(375); // 150 × 2.5
    expect(next[0].quantity).toBe(2.5);
  });

  it('ignores a non-positive quantity instead of inventing one', async () => {
    // This used to floor 0 UP to 0.5 — for a weighed food that is 50 g.
    const s = createMemoryStore();
    const date = '2026-06-06';
    await addEntry(date, portionedEntry(dal, 1), s);
    const [entry] = await loadDay(date, s);
    for (const bad of [0, -1, NaN]) {
      const next = await updateEntryQuantity(date, entry.id, bad, s);
      expect(next[0].quantity).toBe(1);
      expect(next[0].kcal).toBe(150);
    }
  });

  // Half a tablespoon of sugar against a USDA per-100g row: the composer
  // showed 0.07 -> 27 kcal, and tapping Log saved 0.5 -> 193 kcal and 50 g of
  // carbs, because the quantity was floored to 0.5 on the way into the log.
  const sugar = {
    name: 'sugar',
    serving: '100g',
    kcal: 386,
    proteinG: 0,
    carbsG: 100,
    fatG: 0,
  };

  it('logs a weighed quantity exactly, not floored to 0.5', () => {
    const e = portionedEntry(sugar, 0.07);
    expect(e.quantity).toBe(0.07);
    expect(e.kcal).toBe(27); // what the composer showed — not 193
    expect(e.carbsG).toBe(7); // not 50
  });

  it('saves an edited weighed quantity exactly', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    await addEntry(date, portionedEntry(sugar, 0.1), s);
    const [entry] = await loadDay(date, s);
    const next = await updateEntryQuantity(date, entry.id, 0.05, s);
    expect(next[0].quantity).toBe(0.05);
    expect(next[0].kcal).toBe(19); // 386 x 0.05, not rounded up to 0.5
  });

  it('leaves custom (non-portioned) entries untouched', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    await addEntry(date, { label: 'Mystery', kcal: 200 }, s);
    const [entry] = await loadDay(date, s);
    const next = await updateEntryQuantity(date, entry.id, 3, s);
    expect(next[0].kcal).toBe(200); // unchanged, no unit macros
  });
});

describe('summarize / remaining', () => {
  const entries: LogEntry[] = [
    { id: '1', label: 'Eggs', kcal: 200, proteinG: 18, at: '' },
    { id: '2', label: 'Rice', kcal: 300, carbsG: 65, fatG: 1, at: '' },
  ];

  it('sums calories and macros, ignoring undefined', () => {
    const s = summarize(entries);
    expect(s.kcal).toBe(500);
    expect(s.proteinG).toBe(18);
    expect(s.carbsG).toBe(65);
    expect(s.fatG).toBe(1);
    expect(s.count).toBe(2);
  });

  it('computes remaining (and goes negative when over)', () => {
    expect(remaining(2287, 500)).toBe(1787);
    expect(remaining(2287, 2400)).toBe(-113);
  });
});

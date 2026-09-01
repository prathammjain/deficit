import { createMemoryStore, getJSON, setJSON } from './kv';
import {
  clearProfile,
  hasProfile,
  loadProfile,
  saveProfile,
} from './profile-store';
import {
  addEntry,
  loadDay,
  portionedEntry,
  remaining,
  removeEntry,
  summarize,
  todayKey,
  updateEntryQuantity,
  type LogEntry,
} from './log-store';
import type { ProfileInput } from './targets';

const SAMPLE: ProfileInput = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 85,
  activityLevel: 'moderate',
  goalRateKgWeek: 0.5,
};

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
    expect(portionedEntry({ ...dal, source: 'local' }, 1).confidence).toBeUndefined();
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

  it('clamps quantity to a 0.5 minimum and half-step', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    await addEntry(date, portionedEntry(dal, 1), s);
    const [entry] = await loadDay(date, s);
    const next = await updateEntryQuantity(date, entry.id, 0, s);
    expect(next[0].quantity).toBe(0.5);
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

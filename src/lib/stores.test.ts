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
  remaining,
  removeEntry,
  summarize,
  todayKey,
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

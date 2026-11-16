import { createMemoryStore } from '../kv';
import {
  clearLive,
  deleteSim,
  loadLive,
  loadSettings,
  loadSims,
  newSim,
  saveDivision,
  saveLive,
  saveSim,
} from './store';

describe('hyrox store', () => {
  it('remembers the division', async () => {
    const s = createMemoryStore();
    expect((await loadSettings(s)).division).toBeNull();
    await saveDivision('pro_women', s);
    expect((await loadSettings(s)).division).toBe('pro_women');
  });

  it('keeps finished sims newest first, and deletes them', async () => {
    const s = createMemoryStore();
    const a = newSim('open_men', 'full', 1_000);
    const b = newSim('open_men', 'first', 5_000);
    await saveSim(a, s);
    await saveSim(b, s);
    expect((await loadSims(s)).map((x) => x.id)).toEqual([b.id, a.id]);
    // Saving again replaces rather than duplicates.
    await saveSim({ ...a, laps: [2_000] }, s);
    expect(await loadSims(s)).toHaveLength(2);
    expect(await deleteSim(a.id, s)).toEqual([b]);
  });

  it('holds the running sim until it is cleared', async () => {
    const s = createMemoryStore();
    const live = newSim('open_women', 'second', 1_000);
    await saveLive(live, s);
    expect(await loadLive(s)).toEqual(live);
    await clearLive(s);
    expect(await loadLive(s)).toBeNull();
  });
});

import { createMemoryStore } from '../kv';
import {
  deleteCardio,
  loadCardio,
  loadCardioSettings,
  markNearTipSeen,
  newCardio,
  saveCardio,
} from './store';

describe('cardio store', () => {
  const at = (iso: string) => Date.parse(iso);

  it('keeps sessions newest first, replaces by id, and deletes', async () => {
    const s = createMemoryStore();
    const a = newCardio(
      {
        kind: 'run',
        startedAt: at('2026-11-10T06:00:00'),
        ms: 1_800_000,
        km: 5,
        effort: 'moderate',
      },
      'a',
    );
    const b = newCardio(
      {
        kind: 'row',
        startedAt: at('2026-11-12T06:00:00'),
        ms: 480_000,
        km: 2,
        effort: 'vigorous',
      },
      'b',
    );
    await saveCardio(a, s);
    await saveCardio(b, s);
    expect((await loadCardio(s)).map((x) => x.id)).toEqual(['b', 'a']);
    expect(a.date).toBe('2026-11-10');

    await saveCardio({ ...a, km: 5.2 }, s);
    const all = await loadCardio(s);
    expect(all).toHaveLength(2);
    expect(all.find((x) => x.id === 'a')?.km).toBe(5.2);

    expect((await deleteCardio('b', s)).map((x) => x.id)).toEqual(['a']);
  });

  it('remembers that the lifting note was shown', async () => {
    const s = createMemoryStore();
    expect((await loadCardioSettings(s)).nearTipSeen).toBeUndefined();
    await markNearTipSeen(s);
    expect((await loadCardioSettings(s)).nearTipSeen).toBe(true);
  });
});

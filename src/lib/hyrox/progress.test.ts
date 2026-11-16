import {
  hyroxRecords,
  partsDone,
  recordsSetBetween,
  series,
  simsBetween,
  stationBoard,
  trend,
} from './progress';
import type { Sim } from './race';

let n = 0;
/** A sim on `date` whose segment times are given in seconds. */
function sim(date: string, secs: number[], over: Partial<Sim> = {}): Sim {
  const startedAt = Date.parse(`${date}T10:00:00Z`);
  let t = startedAt;
  const laps = secs.map((s) => (t += s * 1000));
  return {
    id: `s${n++}`,
    date,
    division: 'open_men',
    part: 'first',
    startedAt,
    laps,
    ...over,
  };
}

// First half: run, ski, run, push, run, pull, run, burpees.
const a = sim('2026-10-01', [300, 270, 300, 200, 310, 240, 320, 300]);
const b = sim('2026-10-15', [290, 260, 300, 180, 300, 250, 310, 290]);
const c = sim('2026-11-01', [295, 265, 305, 190, 300, 245, 315, 295]);

describe('series and trend', () => {
  it('keeps one division and part, oldest first, finished only', () => {
    const half = sim('2026-11-05', [300, 200]);
    const pro = sim('2026-10-20', [280, 250, 290, 170, 290, 230, 300, 280], {
      division: 'pro_men',
    });
    expect(series([c, half, a, pro, b], 'open_men', 'first')).toEqual([
      a,
      b,
      c,
    ]);
  });

  it('needs two sims for a trend', () => {
    expect(trend([a], 'open_men', 'first')).toBeNull();
  });

  it('measures since the first sim and since the last, so dips show', () => {
    const t = trend([a, b, c], 'open_men', 'first')!;
    expect(t.count).toBe(3);
    expect(t.totals).toEqual([2_240_000, 2_180_000, 2_210_000]);
    expect(t.bestMs).toBe(2_180_000);
    expect(t.sinceFirstMs).toBe(-30_000); // faster overall
    expect(t.sinceLastMs).toBe(30_000); // a dip on the last one
  });

  it('lists the parts a division has done, full first', () => {
    const full = sim('2026-11-10', new Array(16).fill(200), { part: 'full' });
    expect(partsDone([a, full], 'open_men')).toEqual(['full', 'first']);
    expect(partsDone([a], 'pro_men')).toEqual([]);
  });
});

describe('stationBoard', () => {
  it('gives each station its best, latest and last change, in race order', () => {
    const rows = stationBoard([a, b, c], 'open_men');
    expect(rows.map((r) => r.key)).toEqual([
      'ski',
      'sled_push',
      'sled_pull',
      'burpee_broad_jumps',
    ]);
    const push = rows[1];
    expect(push.times).toEqual([200_000, 180_000, 190_000]);
    expect(push.bestMs).toBe(180_000);
    expect(push.latestMs).toBe(190_000);
    expect(push.changeMs).toBe(10_000);
  });
});

describe('hyroxRecords', () => {
  it('keeps the best total per part and the fastest run in the format', () => {
    const doubles = sim('2026-11-02', [250, 200], {
      division: 'doubles_open_men',
    });
    const r = hyroxRecords([a, b, c, doubles], 'open_men');
    expect(r.totals.first).toEqual({ ms: 2_180_000, date: '2026-10-15' });
    expect(r.totals.full).toBeUndefined();
    // The 250 s doubles run doesn't count for singles.
    expect(r.fastestRun).toEqual({ ms: 290_000, date: '2026-10-15' });
  });
});

describe('simsBetween', () => {
  it('picks sims by day', () => {
    expect(simsBetween([a, b, c], '2026-10-10', '2026-10-31')).toEqual([b]);
  });
});

describe('recordsSetBetween', () => {
  it('counts new best totals inside the dates, never a first sim', () => {
    expect(recordsSetBetween([a, b, c], '2026-10-01', '2026-11-30')).toBe(1);
    expect(recordsSetBetween([a, b, c], '2026-10-20', '2026-11-30')).toBe(0);
    expect(recordsSetBetween([a], '2026-10-01', '2026-10-31')).toBe(0);
  });
});

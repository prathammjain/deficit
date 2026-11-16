import {
  bests,
  isFinished,
  raceClock,
  segmentKey,
  segmentName,
  segments,
  segmentWork,
  splits,
  STATIONS,
  summarize,
  whereYouLostTime,
  type Sim,
} from './race';

/** A sim whose segment times are given in seconds. */
function sim(secs: number[], over: Partial<Sim> = {}): Sim {
  const startedAt = 1_000_000;
  let t = startedAt;
  const laps = secs.map((s) => (t += s * 1000));
  return {
    id: 'x',
    date: '2026-11-16',
    division: 'open_men',
    part: 'full',
    startedAt,
    laps,
    ...over,
  };
}

describe('the race', () => {
  it('has eight stations in the official order', () => {
    expect(STATIONS.map((s) => s.name)).toEqual([
      'SkiErg',
      'Sled push',
      'Sled pull',
      'Burpee broad jumps',
      'Row',
      'Farmers carry',
      'Sandbag lunges',
      'Wall balls',
    ]);
  });

  it('alternates a 1 km run and a station, 16 segments in all', () => {
    const s = segments('full');
    expect(s).toHaveLength(16);
    expect(s[0]).toEqual({ kind: 'run', n: 1 });
    expect(s[1]).toEqual({ kind: 'station', n: 1, id: 'ski' });
    expect(s[15]).toEqual({ kind: 'station', n: 8, id: 'wall_balls' });
  });

  it('splits into halves of four runs and four stations', () => {
    expect(segments('first').map(segmentKey)).toEqual([
      'run1',
      'ski',
      'run2',
      'sled_push',
      'run3',
      'sled_pull',
      'run4',
      'burpee_broad_jumps',
    ]);
    expect(segments('second').map(segmentKey)).toEqual([
      'run5',
      'row',
      'run6',
      'farmers_carry',
      'run7',
      'sandbag_lunges',
      'run8',
      'wall_balls',
    ]);
  });

  it('gives each division its own loads', () => {
    const push = segments('full')[3];
    expect(segmentName(push)).toBe('Sled push');
    expect(segmentWork(push, 'open_women')).toBe('50 m at 102 kg');
    expect(segmentWork(push, 'pro_men')).toBe('50 m at 202 kg');
    // Pro women carry the open men's loads but throw to the women's target.
    const wb = segments('full')[15];
    expect(segmentWork(wb, 'pro_women')).toBe('100 reps, 6 kg to 2.70 m');
    expect(segmentWork(segments('full')[0], 'pro_men')).toBe('1 km');
  });
});

describe('a sim', () => {
  it('turns lap times into splits', () => {
    const s = sim([300, 240, 310]);
    expect(splits(s).map((x) => x.ms)).toEqual([300_000, 240_000, 310_000]);
    expect(isFinished(s)).toBe(false);
    expect(isFinished(sim(new Array(16).fill(60)))).toBe(true);
  });

  it('adds up runs and stations, and measures how the runs faded', () => {
    // Runs: 300, 300, 330, 330 seconds; stations 200 each.
    const s = sim([300, 200, 300, 200, 330, 200, 330, 200], { part: 'first' });
    const sum = summarize(s);
    expect(sum.totalMs).toBe(2_060_000);
    expect(sum.runMs).toBe(1_260_000);
    expect(sum.stationMs).toBe(800_000);
    expect(sum.runFade).toBeCloseTo(0.1);
  });

  it('has no run fade before there are two runs', () => {
    expect(summarize(sim([300, 200])).runFade).toBeNull();
  });
});

describe('where you lost time', () => {
  const a = sim([300, 240, 300, 180]);
  const b = sim([290, 270, 330, 180]);

  it('compares with your bests, biggest loss first', () => {
    const gaps = whereYouLostTime(b, [a]);
    expect(gaps.map((g) => [g.key, g.lostMs])).toEqual([
      ['ski', 30_000],
      ['run2', 30_000],
    ]);
  });

  it('is empty on a first sim', () => {
    expect(whereYouLostTime(a, [])).toEqual([]);
  });

  it('only compares stations within the same division', () => {
    const pro = sim([300, 100], { division: 'pro_men' });
    const best = bests([pro], 'open_men');
    expect(best.get('run1')).toBe(300_000);
    expect(best.has('ski')).toBe(false);
  });
});

describe('raceClock', () => {
  it('reads like a race clock', () => {
    expect(raceClock(754_000)).toBe('12:34');
    expect(raceClock(3_754_000)).toBe('1:02:34');
    expect(raceClock(5_000)).toBe('0:05');
  });
});

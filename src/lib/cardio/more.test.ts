import { periodOf } from '../train/progress';
import {
  effortFromHr,
  fastestLap,
  intervals,
  kindRecords,
  lapLive,
  lapTotals,
  liveLaps,
  maxHr,
  movingMs,
  pauseLive,
  predictRaces,
  recordSessions,
  resumeLive,
  riegel,
  startLive,
  zoneFrom,
  zoneMinutes,
  zoneOf,
  type CardioSession,
} from './cardio';

const MIN = 60_000;
let n = 0;
const run = (
  date: string,
  km: number | null,
  mins: number,
  over: Partial<CardioSession> = {},
): CardioSession => ({
  id: `r${++n}`,
  kind: 'run',
  date,
  startedAt: Date.parse(`${date}T06:00:00Z`) + n,
  ms: mins * MIN,
  km,
  effort: 'moderate',
  ...over,
});

describe('laps', () => {
  it('adds up laps and builds intervals', () => {
    expect(
      lapTotals([
        { ms: 200_000, km: 0.8 },
        { ms: 190_000, km: 0.8 },
      ]),
    ).toEqual({
      ms: 390_000,
      km: 1.6,
    });
    expect(lapTotals([{ ms: 60_000 }])).toEqual({ ms: 60_000, km: null });
    expect(intervals(6, 0.8)).toHaveLength(6);
    expect(
      fastestLap([
        { ms: 200_000, km: 0.8 },
        { ms: 190_000, km: 0.8 },
      ]),
    ).toBe(1);
  });

  it('counts a fast lap as a best time at its distance', () => {
    const reps = run('2026-11-10', 8, 40, {
      laps: [
        { ms: 230_000, km: 1 },
        { ms: 225_000, km: 1 },
      ],
    });
    const r = kindRecords([reps], 'run');
    expect(r.marks.find((m) => m.km === 1)?.best.ms).toBe(225_000);
    const later = run('2026-11-12', 1, 3.6); // 3:36 for 1 km
    expect(recordSessions([reps, later]).has(later.id)).toBe(true);
  });
});

describe('live timer', () => {
  it('leaves pauses out and keeps lap marks', () => {
    let l = startLive('run', 0);
    l = lapLive(l, 240_000); // lap 1 at 4:00
    l = pauseLive(l, 300_000);
    l = resumeLive(l, 360_000); // a minute paused
    l = lapLive(l, 660_000); // lap 2 at 10:00 moving
    l = { ...l, lapKm: 1 };
    expect(movingMs(l, 660_000)).toBe(600_000);
    expect(liveLaps(l, 600_000)).toEqual([
      { ms: 240_000, km: 1 },
      { ms: 360_000, km: 1 },
    ]);
    // A part lap after the last press, with no distance.
    expect(liveLaps(l, 630_000)[2]).toEqual({ ms: 30_000, km: null });
  });

  it('ignores a double tap on lap', () => {
    const l = lapLive(lapLive(startLive('run', 0), 60_000), 60_400);
    expect(l.laps).toEqual([60_000]);
  });
});

describe('heart rate zones', () => {
  it('estimates max from age (Tanaka), and a measured max wins', () => {
    expect(maxHr(30)).toBe(187);
    expect(maxHr(30, 195)).toBe(195);
    expect(maxHr(null)).toBeNull();
  });

  it('uses the ACSM bands', () => {
    const max = 200;
    expect(zoneOf(110, max)).toBe(1); // 55%
    expect(zoneOf(120, max)).toBe(2); // 60%
    expect(zoneOf(140, max)).toBe(3); // 70%
    expect(zoneOf(170, max)).toBe(4); // 85%
    expect(zoneOf(195, max)).toBe(5); // 97.5%
    expect(zoneFrom(4, max)).toBe(154);
    expect(effortFromHr(140, max)).toBe('moderate');
    expect(effortFromHr(170, max)).toBe('vigorous');
  });

  it('splits minutes by lap heart rate where it can', () => {
    const week = periodOf('week', '2026-11-18');
    const z = zoneMinutes(
      [
        run('2026-11-16', 5, 30, { avgHr: 140 }),
        run('2026-11-17', 5, 20, {
          laps: [
            { ms: 10 * MIN, hr: 170 },
            { ms: 10 * MIN, hr: 120 },
          ],
        }),
        run('2026-11-18', 5, 25),
      ],
      week,
      200,
    );
    expect(z.zones).toEqual([0, 10, 30, 10, 0]);
    expect(z.untracked).toBe(25);
  });
});

describe('race predictor', () => {
  it('follows Riegel', () => {
    expect(riegel(25 * MIN, 5, 10) / MIN).toBeCloseTo(52.12, 1);
  });

  it('uses the strongest recent effort of 3 km or more', () => {
    const p = predictRaces(
      [
        run('2026-11-01', 5, 25),
        run('2026-11-08', 10, 55), // weaker than the 5 km
        run('2026-11-10', 1, 3.5), // too short
        run('2026-06-01', 5, 20), // too old
      ],
      '2026-11-16',
    );
    expect(p?.from).toMatchObject({ km: 5, date: '2026-11-01' });
    expect(p?.times.map((t) => Math.round(t.ms / MIN))).toEqual([
      25, 52, 115, 240,
    ]);
  });

  it('leaves out interval sessions, and their totals from best times', () => {
    const reps = run('2026-11-10', 3.2, 12.1, {
      intervals: true,
      laps: Array.from({ length: 4 }, () => ({ ms: 181_500, km: 0.8 })),
    });
    expect(predictRaces([reps], '2026-11-16')).toBeNull();
    // A rep still counts as its own distance; the 3.2 km total doesn't.
    const r = kindRecords([reps], 'run');
    expect(r.marks.map((m) => m.km)).toEqual([]);
  });

  it('is null with no recent run of 3 km', () => {
    expect(predictRaces([run('2026-11-10', 2, 10)], '2026-11-16')).toBeNull();
  });
});

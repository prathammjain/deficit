import type { Sim } from '../hyrox/race';
import { periodOf } from '../train/progress';
import type { Workout } from '../train/workout';
import {
  cardioJump,
  checkSession,
  clock,
  distanceText,
  kindRecords,
  kindsDone,
  markName,
  minutes,
  nearLifting,
  paceText,
  paceTrend,
  recordSessions,
  sessionPace,
  strengthDays,
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
  id: `c${++n}`,
  kind: 'run',
  date,
  startedAt: Date.parse(`${date}T06:00:00Z`) + n,
  ms: mins * MIN,
  km,
  effort: 'moderate',
  ...over,
});

const workout = (date: string, hour = 7, minutes = 60): Workout => {
  const startedAt = `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  return {
    id: `w${date}${hour}`,
    name: 'Push',
    date,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + minutes * MIN).toISOString(),
    exercises: [],
    source: 'live',
  };
};

const sim = (date: string, laps = 8): Sim => {
  const startedAt = Date.parse(`${date}T18:00:00Z`);
  return {
    id: `s${date}`,
    date,
    division: 'open_men',
    part: 'first',
    startedAt,
    laps: Array.from({ length: laps }, (_, i) => startedAt + (i + 1) * 300_000),
  };
};

describe('clocks, distances and pace', () => {
  it('formats clocks with and without hours', () => {
    expect(clock(45 * MIN + 7000)).toBe('45:07');
    expect(clock(62.5 * MIN)).toBe('1:02:30');
  });

  it('shows each kind in its own unit', () => {
    expect(distanceText(5, 'run')).toBe('5 km');
    expect(distanceText(21.0975, 'run')).toBe('21.1 km');
    expect(distanceText(2, 'row')).toBe('2,000 m');
    expect(markName(21.0975, 'run')).toBe('Half marathon');
    expect(markName(0.5, 'ski')).toBe('500 m');
  });

  it('gives pace per km, per 500 m, per 100 m, or speed', () => {
    const perKm = 5 * MIN; // 5:00 a km
    expect(paceText(perKm, 'run')).toBe('5:00 /km');
    expect(paceText(4 * MIN, 'row')).toBe('2:00 /500 m');
    expect(paceText(20 * MIN, 'swim')).toBe('2:00 /100 m');
    expect(paceText(2 * MIN, 'ride')).toBe('30.0 km/h');
    expect(paceText(perKm, 'stairs')).toBe('');
  });

  it('has no pace without a distance', () => {
    expect(sessionPace(run('2026-11-16', null, 30))).toBe('');
    expect(sessionPace(run('2026-11-16', 5, 25))).toBe('5:00 /km');
  });
});

describe('checkSession', () => {
  it('needs a time under a day', () => {
    expect(checkSession({ kind: 'run', ms: 0 })).toMatch(/how long/);
    expect(checkSession({ kind: 'run', ms: 25 * 60 * MIN })).toMatch(/day/);
  });

  it('catches a distance typo that beats the world record', () => {
    expect(checkSession({ kind: 'run', ms: 20 * MIN, km: 50 })).toMatch(
      /world record/,
    );
    expect(checkSession({ kind: 'run', ms: 20 * MIN, km: 5 })).toBeNull();
  });

  it('catches a heart rate that is not beats a minute', () => {
    expect(checkSession({ kind: 'ride', ms: 60 * MIN, avgHr: 12 })).toMatch(
      /Heart rate/,
    );
  });
});

describe('weekly minutes (WHO)', () => {
  const week = periodOf('week', '2026-11-18'); // Mon 16 to Sun 22 Nov

  it('counts a vigorous minute as two, and light minutes not at all', () => {
    const m = minutes(
      [
        run('2026-11-16', 5, 30), // moderate
        run('2026-11-17', 8, 40, { effort: 'vigorous' }),
        run('2026-11-18', 3, 50, { kind: 'walk', effort: 'light' }),
        run('2026-11-10', 5, 30), // last week
      ],
      [],
      week,
    );
    expect(m).toEqual({
      moderate: 30,
      vigorous: 40,
      light: 50,
      equivalent: 110,
    });
  });

  it('counts a finished HYROX sim as vigorous, and not an unfinished one', () => {
    const m = minutes([], [sim('2026-11-19'), sim('2026-11-20', 3)], week);
    expect(m.vigorous).toBe(40);
    expect(m.equivalent).toBe(80);
  });

  it('counts strength days, not workouts', () => {
    expect(
      strengthDays(
        [
          workout('2026-11-16', 7),
          workout('2026-11-16', 18),
          workout('2026-11-19'),
        ],
        week,
      ),
    ).toBe(2);
  });
});

describe('records', () => {
  it('keeps the best time at each mark the user covered', () => {
    const r = kindRecords(
      [
        run('2026-10-01', 5, 30),
        run('2026-10-15', 5.1, 28.56), // 28:00 at 5 km
        run('2026-11-01', 12, 66), // too long to count for 10 km
        run('2026-11-05', 10.2, 58.14), // 57:00 at 10 km
      ],
      'run',
    );
    expect(r.count).toBe(4);
    expect(r.marks.map((m) => [m.km, Math.round(m.best.ms / 1000)])).toEqual([
      [5, 28 * 60],
      [10, 57 * 60],
    ]);
    expect(r.longestKm?.km).toBe(12);
    expect(r.longestMs?.ms).toBe(66 * MIN);
  });

  it('marks a session that beat an earlier best, but not a first time', () => {
    const a = run('2026-10-01', 5, 30);
    const b = run('2026-10-08', 5, 31);
    const c = run('2026-10-15', 5, 29);
    const ids = recordSessions([c, b, a]);
    expect([...ids]).toEqual([c.id]);
  });

  it('keeps records across a long break', () => {
    const old = run('2024-03-01', 5, 24);
    const back = run('2026-11-10', 5, 27);
    expect(recordSessions([old, back]).size).toBe(0);
    expect(kindRecords([old, back], 'run').marks[0].best.date).toBe(
      '2024-03-01',
    );
  });

  it('lists kinds with the most sessions first', () => {
    expect(
      kindsDone([
        run('2026-11-01', 5, 30, { kind: 'row' }),
        run('2026-11-02', 5, 30),
        run('2026-11-03', 5, 30),
      ]),
    ).toEqual(['run', 'row']);
  });
});

describe('paceTrend', () => {
  it('pools the last 28 days against the 28 before, and keeps the first', () => {
    const t = paceTrend(
      [
        run('2026-09-01', 5, 35), // first: 7:00
        run('2026-10-01', 5, 30), // before window: 6:00
        run('2026-10-10', 10, 60), // before: 6:00
        run('2026-11-01', 5, 27.5), // recent
        run('2026-11-10', 5, 27.5), // recent: 5:30
        run('2026-11-11', null, 20), // no distance: left out
      ],
      'run',
      '2026-11-16',
    );
    expect(t?.firstMsPerKm).toBe(7 * MIN);
    expect(t?.recentMsPerKm).toBe(5.5 * MIN);
    expect(t?.beforeMsPerKm).toBe(6 * MIN);
    expect(t?.recentCount).toBe(2);
    expect(t?.paces).toHaveLength(5);
  });

  it('is null with no distances', () => {
    expect(
      paceTrend([run('2026-11-01', null, 30)], 'run', '2026-11-16'),
    ).toBeNull();
  });
});

describe('cardioJump', () => {
  const today = '2026-11-16';

  it('notices a week with far more than usual', () => {
    const usual = ['2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04'].map(
      (d) => run(d, 5, 30),
    );
    const recent = ['2026-11-10', '2026-11-12', '2026-11-14'].map((d) =>
      run(d, 8, 45),
    );
    expect(cardioJump([...usual, ...recent], [], today)).toEqual({
      recent: 135,
      usual: 30,
    });
  });

  it('counts HYROX sims as aerobic training too', () => {
    expect(
      cardioJump([], [sim('2026-11-12'), sim('2026-11-14')], today),
    ).toEqual({ recent: 80, usual: 0 });
  });

  it('stays quiet for an ordinary week', () => {
    const weeks = [
      '2026-10-14',
      '2026-10-21',
      '2026-10-28',
      '2026-11-04',
      '2026-11-12',
    ].map((d) => run(d, 8, 45));
    expect(cardioJump(weeks, [], today)).toBeNull();
  });
});

describe('nearLifting', () => {
  it('is true within 3 hours either side, end to start', () => {
    const lift = workout('2026-11-16', 7); // 07:00 to 08:00 UTC
    const after = run('2026-11-16', 5, 30, {
      startedAt: Date.parse('2026-11-16T10:30:00Z'),
    });
    const later = run('2026-11-16', 5, 30, {
      startedAt: Date.parse('2026-11-16T11:30:00Z'),
    });
    const before = run('2026-11-16', 5, 30, {
      startedAt: Date.parse('2026-11-16T03:00:00Z'), // ends 03:30
    });
    expect(nearLifting(after, [lift])).toBe(true);
    expect(nearLifting(later, [lift])).toBe(false);
    expect(nearLifting(before, [lift])).toBe(false);
  });
});

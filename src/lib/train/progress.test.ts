import type { DayRecord } from '../history-stats';
import { LIBRARY, exerciseMap } from './exercises';
import {
  addDays,
  bodySummary,
  changeText,
  exerciseHistory,
  foodSummary,
  liftBoard,
  periodDays,
  periodLabel,
  periodOf,
  periodRead,
  periodTick,
  recordCounts,
  records,
  shiftPeriod,
  trainingSeries,
  trainingSummary,
  trend,
  type ReadInput,
} from './progress';
import type { SetType, WorkSet, Workout } from './workout';

const byId = exerciseMap(LIBRARY);
const bench = byId.get('bench_press')!;
const pullUp = byId.get('pull_up')!;

let n = 0;
const s = (
  kg: number | null,
  reps: number,
  type: SetType = 'working',
): WorkSet => ({
  id: `s${n++}`,
  kg,
  reps,
  type,
  done: true,
});

const w = (
  date: string,
  blocks: [string, WorkSet[]][],
  minutes = 60,
): Workout => ({
  id: `w${n++}`,
  name: 'W',
  date,
  startedAt: `${date}T08:00:00.000Z`,
  endedAt: new Date(
    Date.parse(`${date}T08:00:00.000Z`) + minutes * 60000,
  ).toISOString(),
  exercises: blocks.map(([exerciseId, sets]) => ({
    id: `e${n++}`,
    exerciseId,
    sets,
  })),
  source: 'live',
});

describe('periods', () => {
  it('finds Monday to Sunday weeks and calendar months', () => {
    expect(periodOf('week', '2026-11-09')).toEqual({
      kind: 'week',
      start: '2026-11-09',
      end: '2026-11-15',
    });
    expect(periodOf('week', '2026-11-08')).toMatchObject({
      start: '2026-11-02',
      end: '2026-11-08',
    });
    expect(periodOf('month', '2026-02-14')).toMatchObject({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('steps back and forward', () => {
    const week = periodOf('week', '2026-11-09');
    expect(shiftPeriod(week, -1).start).toBe('2026-11-02');
    const month = periodOf('month', '2026-01-20');
    expect(shiftPeriod(month, -1)).toMatchObject({
      start: '2025-12-01',
      end: '2025-12-31',
    });
    expect(shiftPeriod(month, 1).end).toBe('2026-02-28');
  });

  it('labels periods the way people say them', () => {
    const today = '2026-11-11';
    expect(periodLabel(periodOf('week', today), today)).toBe('This week');
    expect(periodLabel(periodOf('week', '2026-11-04'), today)).toBe(
      'Last week',
    );
    expect(periodLabel(periodOf('week', '2026-10-20'), today)).toBe(
      '19 to 25 Oct',
    );
    expect(periodLabel(periodOf('week', '2026-10-01'), today)).toBe(
      '28 Sep to 4 Oct',
    );
    expect(periodLabel(periodOf('week', '2025-12-31'), today)).toBe(
      '29 Dec 2025 to 4 Jan 2026',
    );
    expect(periodLabel(periodOf('week', '2025-06-11'), today)).toBe(
      '9 to 15 Jun 2025',
    );
    expect(periodLabel(periodOf('month', today), today)).toBe('November');
    expect(periodLabel(periodOf('month', '2025-03-03'), today)).toBe(
      'March 2025',
    );
    expect(periodTick(periodOf('week', today))).toBe('9 Nov');
    expect(periodTick(periodOf('month', today))).toBe('Nov');
    expect(periodDays(periodOf('week', today))).toHaveLength(7);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('training numbers', () => {
  const workouts = [
    w('2026-11-02', [
      ['bench_press', [s(40, 10, 'warmup'), s(80, 8), s(80, 8)]],
    ]),
    w('2026-11-04', [
      ['squat', [s(100, 5), s(100, 5), s(100, 5)]],
      ['bench_press', [s(82.5, 6)]],
    ]),
    w('2026-11-10', [['bench_press', [s(85, 6), s(85, 5)]]], 45),
  ];
  const lastWeek = periodOf('week', '2026-11-02');

  it('sums hard sets, volume, time and muscles for a period', () => {
    const t = trainingSummary(workouts, byId, lastWeek);
    expect(t).toMatchObject({
      sessions: 2,
      sets: 6,
      volume: 80 * 8 * 2 + 100 * 5 * 3 + 82.5 * 6,
      minutes: 120,
      days: ['2026-11-02', '2026-11-04'],
    });
    expect(t.muscles).toEqual([
      { muscle: 'chest', label: 'Chest', sets: 3 },
      { muscle: 'quads', label: 'Quads', sets: 3 },
    ]);
  });

  it('builds a series oldest first', () => {
    const series = trainingSeries(
      workouts,
      byId,
      periodOf('week', '2026-11-10'),
      3,
    );
    expect(series.map((x) => [x.period.start, x.summary.sessions])).toEqual([
      ['2026-10-26', 0],
      ['2026-11-02', 2],
      ['2026-11-09', 1],
    ]);
  });

  it('ranks lifts and compares them with the period before', () => {
    const board = liftBoard(workouts, byId, 80, periodOf('week', '2026-11-10'));
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({
      sessions: 1,
      sets: 2,
      best: { kg: 85, reps: 6 },
      score: 102,
      before: 101.3,
    });
    expect(board[0].change).toBeCloseTo(102 / 101.3 - 1, 5);
  });

  it('compares with the last session before after a break', () => {
    const later = [...workouts, w('2026-11-30', [['squat', [s(105, 5)]]])];
    const row = liftBoard(later, byId, 80, periodOf('week', '2026-11-30'))[0];
    expect(row.before).toBe(116.7);
    expect(row.score).toBe(122.5);
  });

  it('keeps each exercise’s history, records and rep maxes', () => {
    const history = exerciseHistory(workouts, bench, 80);
    expect(history.map((h) => [h.date, h.best])).toEqual([
      ['2026-11-10', 102],
      ['2026-11-04', 99],
      ['2026-11-02', 101.3],
    ]);
    const r = records(history, bench, 80);
    expect(r.best).toMatchObject({ score: 102, date: '2026-11-10' });
    expect(r.heaviest).toMatchObject({ set: { kg: 85, reps: 6 } });
    expect(r.mostReps).toMatchObject({
      set: { kg: 80, reps: 8 },
      date: '2026-11-02',
    });
    expect(r.bestVolume).toEqual({ volume: 1280, date: '2026-11-02' });
    // 85 x 6 covers 1, 2 and 3 reps; 80 x 8 is the only heavier 8.
    expect(r.repMaxes).toEqual([
      { reps: 5, kg: 85, date: '2026-11-10' },
      { reps: 8, kg: 80, date: '2026-11-02' },
    ]);
  });

  it('judges bodyweight lifts on bodyweight plus load', () => {
    const pulls = [
      w('2026-11-02', [['pull_up', [s(null, 8)]]]),
      w('2026-11-09', [['pull_up', [s(null, 10), s(10, 6)]]]),
    ];
    const history = exerciseHistory(pulls, pullUp, 80);
    expect(history[0].best).toBe(108);
    expect(trend(history, '2026-11-09', 7)).toBeCloseTo(108 / 101.3 - 1, 5);
  });

  it('counts records per workout against everything before it', () => {
    const counts = recordCounts(workouts, byId, 80);
    // First bench and first squat set nothing; 85 x 6 beats 80 x 8.
    expect([...counts.values()]).toEqual([0, 0, 1]);
  });

  it('trends the last four weeks against the four before', () => {
    const history = exerciseHistory(workouts, bench, 80);
    expect(trend(history, '2026-11-10', 7)).toBeCloseTo(102 / 101.3 - 1, 5);
    expect(trend(history, '2026-12-31')).toBeNull();
  });
});

describe('food and the scale', () => {
  const day = (date: string, kcal: number, proteinG: number): DayRecord => ({
    date,
    logged: true,
    kcal,
    proteinG,
    carbsG: 0,
    fatG: 0,
    weightKg: null,
  });

  it('averages logged days, counting only days so far', () => {
    const week = periodOf('week', '2026-11-11');
    const f = foodSummary(
      [
        day('2026-11-09', 2000, 140),
        day('2026-11-10', 2200, 160),
        day('2026-11-02', 9999, 0),
      ],
      week,
      '2026-11-11',
      { targetKcal: 2300, proteinG: 150 },
    );
    expect(f).toEqual({
      days: 3,
      daysLogged: 2,
      avgKcal: 2100,
      avgProtein: 150,
      targetKcal: 2300,
      proteinTarget: 150,
    });
  });

  it('reads the scale against the last weigh in before the period', () => {
    const weights = [
      { date: '2026-11-01', kg: 82, at: '' },
      { date: '2026-11-04', kg: 81.8, at: '' },
      { date: '2026-11-07', kg: 81.4, at: '' },
    ];
    expect(bodySummary(weights, periodOf('week', '2026-11-04'))).toEqual({
      endKg: 81.4,
      changeKg: -0.6,
    });
    expect(bodySummary(weights, periodOf('week', '2026-11-12'))).toEqual({
      endKg: null,
      changeKg: null,
    });
  });
});

describe('the read', () => {
  const base: ReadInput = {
    kind: 'week',
    current: true,
    training: {
      sessions: 3,
      sets: 40,
      volume: 20000,
      minutes: 180,
      days: [],
      muscles: [],
    },
    previous: {
      sessions: 3,
      sets: 38,
      volume: 19000,
      minutes: 170,
      days: [],
      muscles: [],
    },
    lifts: [],
    food: {
      days: 7,
      daysLogged: 6,
      avgKcal: 2200,
      avgProtein: 150,
      targetKcal: 2300,
      proteinTarget: 150,
    },
    body: { endKg: 80, changeKg: 0 },
  };
  const lift = (change: number) => ({ change }) as ReadInput['lifts'][number];

  it('says when nothing was trained', () => {
    expect(
      periodRead({ ...base, training: { ...base.training, sessions: 0 } }),
    ).toBe('No workouts logged yet this week.');
    expect(
      periodRead({
        ...base,
        kind: 'month',
        current: false,
        training: { ...base.training, sessions: 0 },
      }),
    ).toBe('No workouts logged that month.');
  });

  it('joins strength and bodyweight', () => {
    expect(
      periodRead({
        ...base,
        lifts: [lift(0.03), lift(0.01), lift(0.05)],
        body: { endKg: 80, changeKg: -0.6 },
      }),
    ).toBe('Lifts up 3.0% while bodyweight fell 0.6 kg.');
    expect(
      periodRead({
        ...base,
        lifts: [lift(0)],
        body: { endKg: 80, changeKg: -0.4 },
      }),
    ).toBe('Strength held while bodyweight fell 0.4 kg.');
  });

  it('ties a slide in strength to eating well under target', () => {
    expect(
      periodRead({
        ...base,
        lifts: [lift(-0.04)],
        food: { ...base.food, avgKcal: 1800 },
      }),
    ).toBe('Lifts slipped 4.0% on 1,800 kcal a day, 21.7% under target.');
  });

  it('flags low protein', () => {
    expect(
      periodRead({ ...base, food: { ...base.food, avgProtein: 100 } }),
    ).toBe('Protein averaged 100 g a day, short of your 150 g target.');
  });

  it('falls back to progress, more work, steadiness, then counts', () => {
    expect(periodRead({ ...base, lifts: [lift(0.025)] })).toBe(
      'Lifts up 2.5% on the week before.',
    );
    expect(
      periodRead({ ...base, training: { ...base.training, sets: 48 } }),
    ).toBe('10 more hard sets than the same days last week.');
    expect(
      periodRead({
        ...base,
        current: false,
        training: { ...base.training, sets: 48 },
      }),
    ).toBe('10 more hard sets than the week before.');
    expect(periodRead({ ...base, lifts: [lift(0.004)] })).toBe(
      'Lifts holding steady across 3 workouts.',
    );
    expect(periodRead(base)).toBe('3 workouts, 40 hard sets.');
  });

  it('writes changes in words, never signs', () => {
    expect(changeText(0.032)).toBe('up 3.2%');
    expect(changeText(-0.014)).toBe('down 1.4%');
    expect(changeText(0.002)).toBe('level');
    expect(changeText(null)).toBe('new');
    expect(changeText(10.023)).toBe('up 1,002%');
  });
});

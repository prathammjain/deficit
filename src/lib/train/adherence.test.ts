import type { DayRecord } from '../history-stats';
import {
  adherence,
  isStale,
  readAdherence,
  windowStart,
  workoutRate,
} from './adherence';
import { blankProgram, programExercise, type Program } from './program';
import type { Workout } from './workout';

const program: Program = {
  ...blankProgram('Aarav'),
  id: 'p1',
  title: 'Upper Lower',
  weeks: 6,
  days: [
    { id: 'a', name: 'Upper', exercises: [programExercise('bench_press')] },
    { id: 'b', name: 'Lower', exercises: [programExercise('squat')] },
    { id: 'c', name: 'Upper 2', exercises: [programExercise('barbell_row')] },
  ],
};

function workout(date: string, day: number, programId = 'p1'): Workout {
  const at = `${date}T09:00:00.000Z`;
  return {
    id: at,
    name: 'x',
    date,
    startedAt: at,
    endedAt: at,
    exercises: [],
    source: 'live',
    programId,
    programDay: day,
  };
}

function day(date: string, kcal: number, proteinG: number): DayRecord {
  return {
    date,
    logged: kcal > 0,
    kcal,
    proteinG,
    carbsG: 0,
    fatG: 0,
    weightKg: null,
  };
}

const TODAY = '2026-11-28';

describe('windowStart', () => {
  it('looks back four weeks, or to the day they followed', () => {
    expect(windowStart('2026-10-01T10:00:00.000Z', TODAY)).toBe('2026-10-31');
    expect(windowStart('2026-11-20T10:00:00.000Z', TODAY)).toBe('2026-11-20');
  });
});

describe('adherence', () => {
  it('counts program workouts against the plan and summarises food and weight', () => {
    const a = adherence({
      program,
      since: '2026-10-01T00:00:00.000Z',
      workouts: [
        workout('2026-10-20', 0),
        workout('2026-11-03', 1),
        workout('2026-11-05', 2),
        workout('2026-11-10', 0),
        workout('2026-11-12', 1, 'other'),
      ],
      records: [
        day('2026-11-02', 2400, 170),
        day('2026-11-03', 2600, 190),
        day('2026-11-04', 0, 0),
      ],
      weights: [
        { date: '2026-10-30', kg: 82, at: '' },
        { date: '2026-11-27', kg: 80.6, at: '' },
      ],
      today: TODAY,
      now: new Date('2026-11-28T12:00:00.000Z'),
    });
    expect(a).toEqual({
      week: 2,
      weeks: 6,
      done: 4,
      doneRecent: 3,
      plannedRecent: 12,
      lastWorkout: '2026-11-10',
      days: 28,
      foodDays: 2,
      avgKcal: 2500,
      avgProteinG: 180,
      weightKg: 80.6,
      weightChangeKg: -1.4,
      at: '2026-11-28T12:00:00.000Z',
    });
    expect(workoutRate(a)).toBe(0.25);
  });

  it('starts empty on the day they follow, since today is still open', () => {
    const a = adherence({
      program,
      since: '2026-11-28T08:00:00.000Z',
      workouts: [],
      records: [],
      weights: [],
      today: TODAY,
    });
    expect(a.days).toBe(0);
    expect(a.plannedRecent).toBe(0);
    expect(a.lastWorkout).toBeNull();
    expect(a.avgKcal).toBeNull();
    expect(a.weightChangeKg).toBeNull();
  });

  it('caps the rate at all done', () => {
    const a = adherence({
      program,
      since: '2026-11-26T08:00:00.000Z',
      workouts: [workout('2026-11-26', 0), workout('2026-11-27', 1)],
      records: [],
      weights: [],
      today: TODAY,
    });
    expect(workoutRate(a)).toBe(1);
  });
});

describe('isStale', () => {
  it('refreshes after six hours or when never sent', () => {
    const now = Date.parse('2026-11-28T12:00:00.000Z');
    expect(isStale(null, now)).toBe(true);
    expect(isStale('2026-11-28T07:00:00.000Z', now)).toBe(false);
    expect(isStale('2026-11-28T05:00:00.000Z', now)).toBe(true);
  });
});

describe('readAdherence', () => {
  const good = adherence({
    program,
    since: '2026-11-01T00:00:00.000Z',
    workouts: [],
    records: [],
    weights: [],
    today: TODAY,
  });

  it('accepts a real summary', () => {
    expect(readAdherence(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it('turns away anything else', () => {
    expect(readAdherence(null)).toBeNull();
    expect(readAdherence('hello')).toBeNull();
    expect(readAdherence({ ...good, done: '4' })).toBeNull();
    expect(readAdherence({ ...good, avgKcal: 'lots' })).toBeNull();
    expect(readAdherence({ ...good, lastWorkout: '<b>' })).toBeNull();
    expect(readAdherence({ ...good, at: 'yesterday' })).toBeNull();
    expect(readAdherence({ ...good, foodDays: -1 })).toBeNull();
  });
});

describe('adherence food days', () => {
  it('counts only full days once the target is known', () => {
    const a = adherence({
      program,
      since: '2026-11-20T00:00:00.000Z',
      workouts: [],
      records: [
        day('2026-11-21', 2200, 160),
        day('2026-11-22', 350, 20),
        day('2026-11-23', 2100, 150),
      ],
      weights: [],
      today: TODAY,
      targetKcal: 2000,
    });
    expect(a.foodDays).toBe(2);
    expect(a.avgKcal).toBe(2150);
  });
});

import type { CardioSession } from '../cardio/cardio';
import type { Sim } from '../hyrox/race';
import { trainingLoad } from './load';
import { periodOf } from './progress';
import type { Workout } from './workout';

const workout = (date: string, rpe?: number): Workout => ({
  id: `w${date}`,
  name: 'Push',
  date,
  startedAt: `${date}T07:00:00.000Z`,
  endedAt: `${date}T08:00:00.000Z`,
  exercises: [],
  source: 'live',
  ...(rpe ? { sessionRpe: rpe } : {}),
});

const sim = (date: string, rpe?: number): Sim => {
  const startedAt = Date.parse(`${date}T18:00:00Z`);
  return {
    id: `s${date}`,
    date,
    division: 'open_men',
    part: 'first',
    startedAt,
    laps: Array.from({ length: 8 }, (_, i) => startedAt + (i + 1) * 300_000),
    ...(rpe ? { rpe } : {}),
  };
};

const cardio = (date: string, rpe: number | null): CardioSession => ({
  id: `c${date}`,
  kind: 'run',
  date,
  startedAt: Date.parse(`${date}T12:00:00Z`),
  ms: 30 * 60000,
  km: 5,
  effort: 'moderate',
  rpe,
});

describe('trainingLoad', () => {
  it('is session RPE times minutes across every kind, rated sessions only', () => {
    const week = periodOf('week', '2026-11-18');
    const l = trainingLoad(
      [workout('2026-11-16', 7), workout('2026-11-17')],
      [sim('2026-11-18', 8)],
      [cardio('2026-11-19', 4), cardio('2026-11-25', 9)],
      week,
    );
    // 7 × 60 + 8 × 40 + 4 × 30
    expect(l).toEqual({ load: 860, rated: 3, unrated: 1 });
  });
});

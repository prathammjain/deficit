import type { Sim } from '../hyrox/race';
import { activity, activityText } from './activity';
import { periodOf } from './progress';
import type { Workout } from './workout';

const workout = (date: string, minutes = 60): Workout => ({
  id: `w${date}`,
  name: 'Push',
  date,
  startedAt: `${date}T07:00:00.000Z`,
  endedAt: new Date(
    Date.parse(`${date}T07:00:00.000Z`) + minutes * 60000,
  ).toISOString(),
  exercises: [],
  source: 'live',
});

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

describe('activity', () => {
  const week = periodOf('week', '2026-11-18'); // Mon 16 to Sun 22 Nov

  it('counts a morning workout and an evening sim as two sessions on one day', () => {
    const a = activity([workout('2026-11-16')], [sim('2026-11-16')], week);
    expect(a.sessions).toBe(2);
    expect(a.days).toEqual(['2026-11-16']);
    expect(a.minutes).toBe(60 + 40);
  });

  it('keeps a week of only HYROX from reading as no training', () => {
    const a = activity([], [sim('2026-11-17'), sim('2026-11-20')], week);
    expect(a).toMatchObject({ sessions: 2, workouts: 0, sims: 2 });
    expect(a.days).toEqual(['2026-11-17', '2026-11-20']);
  });

  it('ignores unfinished sims and days outside the period', () => {
    const a = activity(
      [workout('2026-11-10')],
      [sim('2026-11-18', 3), sim('2026-11-23')],
      week,
    );
    expect(a.sessions).toBe(0);
  });
});

describe('activityText', () => {
  it('names each kind that happened', () => {
    const week = periodOf('week', '2026-11-18');
    expect(
      activityText(
        activity([workout('2026-11-16')], [sim('2026-11-17')], week),
      ),
    ).toBe('1 workout and 1 HYROX sim');
    expect(activityText(activity([], [sim('2026-11-17')], week))).toBe(
      '1 HYROX sim',
    );
    expect(activityText(activity([], [], week))).toBe('No training');
  });
});

/**
 * weekly-prediction.test.ts — the "This week" math (spec:
 * docs/superpowers/specs/2026-07-09-weekly-prediction-design.md).
 * Window is the 7 days ending YESTERDAY; ≥5 logged days → prediction;
 * 1–4 → building; 0 → fresh (the 7-missed-days reset, stateless).
 */

import type { DailyDatum } from './adaptive-tdee';
import { predictWeeklyLoss } from './weekly-prediction';

const TODAY = '2026-07-09'; // window = 2026-07-02 .. 2026-07-08
const MAINT = 2500;

const WINDOW = [
  '2026-07-02',
  '2026-07-03',
  '2026-07-04',
  '2026-07-05',
  '2026-07-06',
  '2026-07-07',
  '2026-07-08',
];

const day = (date: string, intakeKcal: number | null): DailyDatum => ({
  date,
  intakeKcal,
});

/** The full window at a constant intake, with optional unlogged dates. */
const week = (intake: number, skip: string[] = []): DailyDatum[] =>
  WINDOW.map((d) => day(d, skip.includes(d) ? null : intake));

describe('predictWeeklyLoss', () => {
  it('predicts from a fully logged week', () => {
    // deficit 700/day → avg 700, weekly 4900, 4900/7700 = 0.64 kg
    const p = predictWeeklyLoss(week(1800), MAINT, TODAY);
    expect(p.state).toBe('ready');
    expect(p.loggedDays).toBe(7);
    expect(p.missedDays).toBe(0);
    expect(p.avgDailyDeficitKcal).toBe(700);
    expect(p.weeklyDeficitKcal).toBe(4900);
    expect(p.predictedKgPerWeek).toBe(0.64);
  });

  it('fills up to 2 missed days with the logged-day average', () => {
    const p = predictWeeklyLoss(
      week(1800, ['2026-07-03', '2026-07-05']),
      MAINT,
      TODAY,
    );
    expect(p.state).toBe('ready');
    expect(p.loggedDays).toBe(5);
    expect(p.missedDays).toBe(2);
    // avg unchanged → same weekly prediction as the full week
    expect(p.avgDailyDeficitKcal).toBe(700);
    expect(p.weeklyDeficitKcal).toBe(4900);
    expect(p.predictedKgPerWeek).toBe(0.64);
  });

  it('is building with fewer than 5 logged days', () => {
    const p = predictWeeklyLoss(
      week(1800, ['2026-07-03', '2026-07-05', '2026-07-07']),
      MAINT,
      TODAY,
    );
    expect(p.state).toBe('building');
    expect(p.loggedDays).toBe(4);
    expect(p.avgDailyDeficitKcal).toBeNull();
    expect(p.weeklyDeficitKcal).toBeNull();
    expect(p.predictedKgPerWeek).toBeNull();
  });

  it('starts fresh on an empty window (the 7-missed-days reset)', () => {
    // No data at all, and zero-intake days both count as unlogged.
    const empty = predictWeeklyLoss([], MAINT, TODAY);
    expect(empty.state).toBe('fresh');
    expect(empty.loggedDays).toBe(0);
    expect(empty.predictedKgPerWeek).toBeNull();

    const zeros = predictWeeklyLoss(week(0), MAINT, TODAY);
    expect(zeros.state).toBe('fresh');
  });

  it('reports a surplus week as a predicted gain (negative kg)', () => {
    // intake 2900 vs maintenance 2500 → avg −400, weekly −2800 → −0.36 kg
    const p = predictWeeklyLoss(week(2900), MAINT, TODAY);
    expect(p.state).toBe('ready');
    expect(p.avgDailyDeficitKcal).toBe(-400);
    expect(p.predictedKgPerWeek).toBe(-0.36);
  });

  it('excludes today from the window', () => {
    const withToday = predictWeeklyLoss(
      [...week(1800), day(TODAY, 100)], // extreme partial day
      MAINT,
      TODAY,
    );
    const without = predictWeeklyLoss(week(1800), MAINT, TODAY);
    expect(withToday).toEqual(without);
  });

  it('returns the 7 window days oldest → newest with logged flags', () => {
    const p = predictWeeklyLoss(week(1800, ['2026-07-04']), MAINT, TODAY);
    expect(p.days.map((d) => d.date)).toEqual(WINDOW);
    expect(p.days.map((d) => d.logged)).toEqual([
      true,
      true,
      false,
      true,
      true,
      true,
      true,
    ]);
  });
});

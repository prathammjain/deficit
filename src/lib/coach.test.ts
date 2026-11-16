import type { AdaptiveTdee } from './adaptive-tdee';
import {
  checkIn,
  COACH_MAX_STEP_KCAL,
  daysUntilCheckIn,
  isCheckInDue,
  keepLastWeek,
  type CoachState,
} from './coach';

const estimate = (
  kcal: number | null,
  confidence: AdaptiveTdee['confidence'] = 'high',
): AdaptiveTdee => ({
  confidence: kcal == null ? 'none' : confidence,
  intakeDays: 18,
  weighIns: 12,
  spanDays: 18,
  trendKgPerWeek: -0.5,
  avgIntakeKcal: 1900,
  coverage: 0.9,
  estimatedTdeeKcal: kcal,
});

describe('isCheckInDue', () => {
  it('is due the first time there is an estimate', () => {
    expect(isCheckInDue(undefined, '2026-11-16')).toBe(true);
  });

  it('waits seven days after the last check in', () => {
    const coach: CoachState = { maintenanceKcal: 2400, on: '2026-11-10' };
    expect(isCheckInDue(coach, '2026-11-16')).toBe(false);
    expect(isCheckInDue(coach, '2026-11-17')).toBe(true);
    expect(isCheckInDue(coach, '2026-12-30')).toBe(true);
  });
});

describe('daysUntilCheckIn', () => {
  it('counts down to the next weekly check in, never below zero', () => {
    const coach: CoachState = { maintenanceKcal: 2400, on: '2026-11-10' };
    expect(daysUntilCheckIn(coach, '2026-11-10')).toBe(7);
    expect(daysUntilCheckIn(coach, '2026-11-15')).toBe(2);
    expect(daysUntilCheckIn(coach, '2026-11-20')).toBe(0);
  });
});

describe('checkIn', () => {
  const base = { formulaKcal: 2400, bmr: 1700, today: '2026-11-16' };

  it('changes nothing when there is no estimate (a quiet week)', () => {
    expect(checkIn({ ...base, coach: undefined, adaptive: null })).toBeNull();
    expect(
      checkIn({ ...base, coach: undefined, adaptive: estimate(null) }),
    ).toBeNull();
  });

  it('eases in from the formula instead of jumping to the estimate', () => {
    const next = checkIn({
      ...base,
      coach: undefined,
      adaptive: estimate(2300, 'low'),
    });
    expect(next).not.toBeNull();
    expect(next!.maintenanceKcal).toBeGreaterThan(2300);
    expect(next!.maintenanceKcal).toBeLessThan(2400);
    expect(next!.previousKcal).toBe(2400);
    expect(next!.on).toBe('2026-11-16');
  });

  it('trusts the data more as confidence grows', () => {
    const move = (c: AdaptiveTdee['confidence']) =>
      2400 -
      checkIn({ ...base, coach: undefined, adaptive: estimate(2300, c) })!
        .maintenanceKcal;
    expect(move('low')).toBeLessThan(move('medium'));
    expect(move('medium')).toBeLessThan(move('high'));
  });

  it('starts from last week, not the formula, once coached', () => {
    const coach: CoachState = { maintenanceKcal: 2600, on: '2026-11-09' };
    const next = checkIn({ ...base, coach, adaptive: estimate(2600) })!;
    expect(next.maintenanceKcal).toBe(2600);
    expect(next.previousKcal).toBe(2600);
  });

  it('caps one week of change, so a bad week of logging cannot whiplash', () => {
    const next = checkIn({
      ...base,
      coach: undefined,
      adaptive: estimate(1800),
    })!;
    expect(next.maintenanceKcal).toBe(2400 - COACH_MAX_STEP_KCAL);
  });

  it('never sets maintenance below resting burn or absurdly high', () => {
    const low = checkIn({
      ...base,
      coach: { maintenanceKcal: 1750, on: '2026-11-09' },
      adaptive: estimate(1200),
    })!;
    expect(low.maintenanceKcal).toBe(1700);
    const high = checkIn({
      ...base,
      coach: { maintenanceKcal: 4200, on: '2026-11-09' },
      adaptive: estimate(6000),
    })!;
    expect(high.maintenanceKcal).toBe(1700 * 2.5);
  });
});

describe('keepLastWeek', () => {
  it('puts back the previous maintenance and holds it until next week', () => {
    const kept = keepLastWeek({
      maintenanceKcal: 2300,
      on: '2026-11-16',
      previousKcal: 2400,
    });
    expect(kept).toEqual({ maintenanceKcal: 2400, on: '2026-11-16' });
  });

  it('does nothing when there is nothing to go back to', () => {
    const coach: CoachState = { maintenanceKcal: 2300, on: '2026-11-16' };
    expect(keepLastWeek(coach)).toEqual(coach);
  });
});

import type { DayRecord, HistoryTargets } from './history-stats';
import { formatWeekRange, weekReport } from './week-report';

const t: HistoryTargets = {
  targetKcal: 2000,
  maintenanceKcal: 2500,
  proteinG: 140,
};

const day = (
  date: string,
  kcal: number,
  proteinG = 0,
  weightKg: number | null = null,
): DayRecord => ({
  date,
  logged: kcal > 0,
  kcal,
  proteinG,
  carbsG: 0,
  fatG: 0,
  weightKg,
});

describe('weekReport', () => {
  const days = [
    day('2026-10-20', 1800, 150), // outside the week
    day('2026-10-21', 2000, 140, 80),
    day('2026-10-22', 0),
    day('2026-10-23', 2100, 120),
    day('2026-10-24', 1900, 145),
    day('2026-10-25', 0),
    day('2026-10-26', 2600, 160),
    day('2026-10-27', 2000, 139, 79.4),
  ];
  const r = weekReport(days, t);

  it('covers the last seven days only', () => {
    expect(r.from).toBe('2026-10-21');
    expect(r.to).toBe('2026-10-27');
    expect(r.daysLogged).toBe(5);
  });

  it('sums the deficit over logged days, a surplus day counting against it', () => {
    // 500 + 400 + 600 + (-100) + 500
    expect(r.totalDeficitKcal).toBe(1900);
  });

  it('counts protein days at or over the target', () => {
    expect(r.proteinDays).toBe(3); // 140, 145, 160; not 120 or 139
  });

  it('reports the weight change within the week', () => {
    expect(r.weightChangeKg).toBe(-0.6);
  });

  it('handles a week with nothing logged', () => {
    const empty = weekReport([day('2026-10-27', 0)], t);
    expect(empty.daysLogged).toBe(0);
    expect(empty.avgKcal).toBeNull();
    expect(empty.proteinDays).toBe(0);
  });
});

describe('formatWeekRange', () => {
  it('names the month once inside a month', () => {
    expect(formatWeekRange('2026-10-22', '2026-10-28')).toBe('22 to 28 Oct');
  });
  it('names both months across a boundary', () => {
    expect(formatWeekRange('2026-09-29', '2026-10-05')).toBe('29 Sep to 5 Oct');
  });
});

describe('weekReport with unfinished days', () => {
  it('leaves a half logged day out instead of calling it a big deficit', () => {
    const days = [
      day('2026-10-21', 2000, 140),
      day('2026-10-22', 400, 30), // only breakfast logged
      day('2026-10-23', 1900, 150),
    ];
    const r = weekReport(days, t);
    expect(r.daysLogged).toBe(2);
    expect(r.totalDeficitKcal).toBe(1100);
    expect(weekReport(days, t, new Set(['2026-10-22'])).totalDeficitKcal).toBe(
      3200,
    );
  });
});

describe('weekReport follows the goal', () => {
  const week = [
    day('2026-11-01', 3100, 150),
    day('2026-11-02', 2900, 150),
    day('2026-11-03', 0),
    day('2026-11-04', 3300, 150),
    day('2026-11-05', 2600, 150),
    day('2026-11-06', 3000, 150),
    day('2026-11-07', 3200, 150),
  ];
  const gain: HistoryTargets = {
    targetKcal: 3080,
    maintenanceKcal: 2800,
    proteinG: 140,
    goal: 'gain',
  };

  it('a plan without a goal reports as a loss', () => {
    expect(weekReport(week, t).goal).toBe('lose');
  });

  it('gaining: carries the goal and counts days at or over the target', () => {
    const r = weekReport(week, gain);
    expect(r.goal).toBe('gain');
    expect(r.daysLogged).toBe(6);
    expect(r.daysOnTarget).toBe(3); // 3100, 3300, 3200
    expect(r.totalDeficitKcal).toBe(-1300);
  });

  it('maintaining: counts days within 10% of maintenance', () => {
    const r = weekReport(week, {
      ...gain,
      targetKcal: 2800,
      goal: 'maintain',
    });
    expect(r.goal).toBe('maintain');
    expect(r.daysOnTarget).toBe(3); // 3100, 3300 and 3200 are past 3080
  });
});

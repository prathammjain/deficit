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

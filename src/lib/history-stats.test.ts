import {
  cumulativeDeficit,
  dayDeficit,
  summarizeHistory,
  toCsv,
  type DayRecord,
  type HistoryTargets,
} from './history-stats';

const T: HistoryTargets = {
  targetKcal: 2000,
  maintenanceKcal: 2500,
  proteinG: 150,
};

function day(date: string, kcal: number | null, weightKg: number | null = null): DayRecord {
  const logged = kcal != null;
  return {
    date,
    logged,
    kcal: logged ? (kcal as number) : 0,
    proteinG: logged ? 100 : 0,
    carbsG: logged ? 200 : 0,
    fatG: logged ? 50 : 0,
    weightKg,
  };
}

describe('dayDeficit', () => {
  it('is maintenance minus intake', () => {
    expect(dayDeficit(day('2026-06-01', 1800), T)).toBe(700);
  });
});

describe('cumulativeDeficit', () => {
  it('runs a sum and skips unlogged days', () => {
    const days = [day('2026-06-01', 2000), day('2026-06-02', null), day('2026-06-03', 2300)];
    expect(cumulativeDeficit(days, T)).toEqual([500, 500, 700]);
  });
});

describe('summarizeHistory', () => {
  const days = [
    day('2026-06-01', 2000, 84),
    day('2026-06-02', 1800, 83.8),
    day('2026-06-03', null), // missed
    day('2026-06-04', 2600, 83.5), // over target
  ];
  const s = summarizeHistory(days, T);

  it('counts logged days and range', () => {
    expect(s.daysInRange).toBe(4);
    expect(s.daysLogged).toBe(3);
  });

  it('averages over logged days only', () => {
    expect(s.avgKcal).toBe(Math.round((2000 + 1800 + 2600) / 3));
  });

  it('totals the deficit across logged days', () => {
    // (2500-2000)+(2500-1800)+(2500-2600) = 500+700-100 = 1100
    expect(s.totalDeficitKcal).toBe(1100);
  });

  it('tracks weight change start→end', () => {
    expect(s.weightStartKg).toBe(84);
    expect(s.weightEndKg).toBe(83.5);
    expect(s.weightChangeKg).toBe(-0.5);
  });

  it('computes on-target rate (kcal <= target)', () => {
    // 2 of 3 logged days at/under 2000
    expect(s.onTargetRate).toBeCloseTo(2 / 3, 5);
  });

  it('current streak counts back from the last day (broken by the gap)', () => {
    expect(s.currentStreak).toBe(1); // only 06-04 logged after the 06-03 gap
    expect(s.longestStreak).toBe(2); // 06-01..06-02
  });
});

describe('toCsv', () => {
  it('emits a header and one row per day with blanks for missed days', () => {
    const csv = toCsv([day('2026-06-01', 2000, 84), day('2026-06-02', null)], T);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'date,logged,calories_kcal,protein_g,carbs_g,fat_g,target_kcal,maintenance_kcal,deficit_kcal,weight_kg',
    );
    expect(lines[1]).toBe('2026-06-01,yes,2000,100,200,50,2000,2500,500,84');
    expect(lines[2]).toBe('2026-06-02,no,,,,,2000,2500,,');
  });
});

import {
  continuity,
  cumulativeDeficit,
  dayDeficit,
  dayStatus,
  fullDaysOnly,
  summarizeHistory,
  type DayRecord,
  type HistoryTargets,
} from './history-stats';

const T: HistoryTargets = {
  targetKcal: 2000,
  maintenanceKcal: 2500,
  proteinG: 150,
};

function day(
  date: string,
  kcal: number | null,
  weightKg: number | null = null,
): DayRecord {
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
    const days = [
      day('2026-06-01', 2000),
      day('2026-06-02', null),
      day('2026-06-03', 2300),
    ];
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

describe('only full days count', () => {
  // Target 2000: under 1000 kcal reads as unfinished.
  const days = [
    day('2026-06-01', 1900),
    day('2026-06-02', 450), // breakfast only, the rest forgotten
    day('2026-06-03', null),
    day('2026-06-04', 2100),
  ];

  it('classifies each day', () => {
    expect(days.map((d) => dayStatus(d, T.targetKcal))).toEqual([
      'counted',
      'unfinished',
      'missing',
      'counted',
    ]);
  });

  it('leaves unfinished and missing days out of every total', () => {
    const s = summarizeHistory(days, T);
    expect(s.daysLogged).toBe(3);
    expect(s.daysCounted).toBe(2);
    expect(s.unfinishedDates).toEqual(['2026-06-02']);
    // 600 + 400: the 450 kcal day would have added a fake 2050.
    expect(s.totalDeficitKcal).toBe(1000);
    expect(s.avgKcal).toBe(2000);
    expect(s.onTargetRate).toBe(0.5);
  });

  it('counts a low day once the user confirms it was complete', () => {
    const s = summarizeHistory(days, T, new Set(['2026-06-02']));
    expect(s.daysCounted).toBe(3);
    expect(s.totalDeficitKcal).toBe(3050);
  });

  it('keeps the running total flat across days that do not count', () => {
    expect(cumulativeDeficit(days, T)).toEqual([600, 600, 600, 1000]);
  });

  it('does not show a zero streak while today is still open', () => {
    const s = summarizeHistory(
      [
        day('2026-06-01', 1900),
        day('2026-06-02', 2000),
        day('2026-06-03', 300),
      ],
      T,
    );
    expect(s.currentStreak).toBe(2);
  });
});

describe('continuity', () => {
  // Builds consecutive days from a pattern: F full, u unfinished, . nothing.
  function series(start: string, pattern: string): DayRecord[] {
    const base = Date.parse(`${start}T00:00:00Z`);
    return [...pattern].map((c, i) => {
      const date = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
      return day(date, c === 'F' ? 1900 : c === 'u' ? 300 : null);
    });
  }
  const at = (days: DayRecord[]) => days[days.length - 1].date;

  it('sees nothing unusual in steady logging with the odd missed day', () => {
    const d = series('2026-10-01', 'FFF.FF..FFFF');
    expect(continuity(d, T.targetKcal, undefined, at(d))).toEqual({
      away: null,
      restart: null,
      breaks: [],
    });
  });

  it('knows when logging has stopped, without counting today against them', () => {
    // Last full day the 3rd; the 4th to 9th empty; today (10th) has a coffee.
    const d = series('2026-10-01', 'FFF......u');
    const c = continuity(d, T.targetKcal, undefined, at(d));
    expect(c.away).toEqual({ lastCounted: '2026-10-03', days: 6 });
    expect(c.restart).toBeNull();
  });

  it('treats a stray snack during a break as part of the break', () => {
    const d = series('2026-10-01', 'FF....u....F');
    const c = continuity(d, T.targetKcal, undefined, at(d));
    expect(c.breaks).toEqual([
      { from: '2026-10-03', to: '2026-10-11', days: 9 },
    ]);
    expect(c.restart?.since).toBe('2026-10-12');
  });

  it('starts fresh from the first full day after a break, for two weeks', () => {
    const d = series('2026-10-01', 'FFFF..........FFF');
    const c = continuity(d, T.targetKcal, undefined, at(d));
    expect(c.away).toBeNull();
    expect(c.restart).toEqual({
      since: '2026-10-15',
      brk: { from: '2026-10-05', to: '2026-10-14', days: 10 },
    });
    const later = series('2026-10-01', `FFFF..........${'F'.repeat(15)}`);
    expect(
      continuity(later, T.targetKcal, undefined, at(later)).restart,
    ).toBeNull();
  });

  it('counts coming back today as a fresh start once today is a full day', () => {
    const d = series('2026-10-01', 'FF.....F');
    expect(continuity(d, T.targetKcal, undefined, at(d)).restart?.since).toBe(
      '2026-10-08',
    );
  });

  it('does not call the days before someone started logging a break', () => {
    const d = series('2026-10-01', '........FF');
    const c = continuity(d, T.targetKcal, undefined, at(d));
    expect(c).toEqual({ away: null, restart: null, breaks: [] });
  });

  it('two missed days are just missed days', () => {
    const d = series('2026-10-01', 'FFF..u');
    expect(continuity(d, T.targetKcal, undefined, at(d)).away).toBeNull();
  });
});

describe('fullDaysOnly', () => {
  it('blanks unfinished intake and keeps the rest', () => {
    const data = [
      { date: '2026-06-01', intakeKcal: 1900, weightKg: 80 },
      { date: '2026-06-02', intakeKcal: 400, weightKg: 79.8 },
      { date: '2026-06-03', intakeKcal: null, weightKg: null },
      { date: '2026-06-04', intakeKcal: 300, weightKg: null },
    ];
    expect(
      fullDaysOnly(data, 2000, new Set(['2026-06-04'])).map(
        (d) => d.intakeKcal,
      ),
    ).toEqual([1900, null, null, 300]);
  });
});

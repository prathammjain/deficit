import {
  balanceNote,
  continuity,
  onTarget,
  cumulativeDeficit,
  dayDeficit,
  dayStatus,
  fullDaysOnly,
  slipped,
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

describe('onTarget', () => {
  const t = { targetKcal: 2000, maintenanceKcal: 2500, proteinG: 150 };
  it('losing: at or under the target', () => {
    expect(onTarget(1900, t)).toBe(true);
    expect(onTarget(2100, t)).toBe(false);
    expect(onTarget(1900, { ...t, goal: 'lose' })).toBe(true);
  });
  it('gaining: at or over the target', () => {
    expect(onTarget(2100, { ...t, goal: 'gain' })).toBe(true);
    expect(onTarget(1900, { ...t, goal: 'gain' })).toBe(false);
  });
  it('maintaining: within 10% either way', () => {
    const m = { ...t, goal: 'maintain' as const };
    expect(onTarget(2190, m)).toBe(true);
    expect(onTarget(1810, m)).toBe(true);
    expect(onTarget(2300, m)).toBe(false);
    expect(onTarget(1700, m)).toBe(false);
  });
});

describe('balanceNote', () => {
  it('losing keeps its own wording', () => {
    expect(balanceNote(undefined, 3000, 5, 6)).toBeNull();
    expect(balanceNote('lose', -800, 2, 6)).toBeNull();
  });
  it('gaining: a surplus is the plan, never turned into kilograms', () => {
    expect(balanceNote('gain', -1750, 6, 7)).toBe(
      'Over maintenance, as planned',
    );
    expect(balanceNote('gain', 400, 2, 7)).toBe(
      'Under maintenance, short of the plan',
    );
    expect(balanceNote('gain', 0, 0, 7)).toBe(
      'At maintenance, short of the plan',
    );
  });
  it('maintaining: which side overall, and the days within 10%', () => {
    expect(balanceNote('maintain', 600, 5, 6)).toBe(
      'Under maintenance overall, 5 of 6 full days within 10%',
    );
    expect(balanceNote('maintain', -90, 1, 1)).toBe(
      'Over maintenance overall, 1 of 1 full day within 10%',
    );
  });
});

describe('summarizeHistory counts days on target by goal', () => {
  const rec = (date: string, kcal: number): DayRecord => ({
    date,
    logged: true,
    kcal,
    proteinG: 150,
    carbsG: 0,
    fatG: 0,
    weightKg: null,
  });
  const days = [2400, 2600, 2700, 2900, 3100, 3200].map((kcal, i) =>
    rec(`2026-11-0${i + 1}`, kcal),
  );
  const base = { maintenanceKcal: 2800, proteinG: 150 };
  it('losing: at or under the target', () => {
    const s = summarizeHistory(days, { ...base, targetKcal: 2400 });
    expect(s.daysOnTarget).toBe(1);
    expect(s.onTargetRate).toBeCloseTo(1 / 6);
  });
  it('gaining: at or over the target', () => {
    const s = summarizeHistory(days, {
      ...base,
      targetKcal: 3080,
      goal: 'gain',
    });
    expect(s.daysOnTarget).toBe(2);
    // Maintenance minus intake, summed: a net surplus of 100 kcal.
    expect(s.totalDeficitKcal).toBe(-100);
  });
  it('maintaining: within 10% of maintenance', () => {
    const s = summarizeHistory(days, {
      ...base,
      targetKcal: 2800,
      goal: 'maintain',
    });
    expect(s.daysOnTarget).toBe(3);
  });
});

describe('slipped', () => {
  const today = '2026-10-04';
  const days = (a: number | null, b: number | null, y: number | null) => [
    day('2026-10-01', a),
    day('2026-10-02', b),
    day('2026-10-03', y),
    day(today, null),
  ];

  it('says nothing when yesterday was a full day', () => {
    expect(slipped(days(1900, 1900, 1900), 2000, undefined, today)).toBeNull();
  });

  it('offers a yesterday that was started and never finished', () => {
    expect(slipped(days(null, null, 300), 2000, undefined, today)).toEqual({
      date: '2026-10-03',
      status: 'unfinished',
      kcal: 300,
    });
  });

  it('leaves a low yesterday alone once it is confirmed as a full day', () => {
    const marked = new Set(['2026-10-03']);
    expect(slipped(days(1900, 1900, 300), 2000, marked, today)).toBeNull();
  });

  it('offers the first blank day after a full one', () => {
    expect(slipped(days(1900, 1900, null), 2000, undefined, today)).toEqual({
      date: '2026-10-03',
      status: 'missing',
      kcal: 0,
    });
  });

  it('does not nag through a quiet stretch, or before anything was logged', () => {
    expect(slipped(days(1900, null, null), 2000, undefined, today)).toBeNull();
    expect(slipped(days(null, null, null), 2000, undefined, today)).toBeNull();
  });
});

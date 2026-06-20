/**
 * history-stats.ts — pure aggregation for the History dashboard. No storage.
 *
 * Turns a per-day series (intake macros + weigh-in) plus the user's current
 * targets into the trends, totals, and CSV the dashboard renders. Kept pure so
 * the numbers are unit-tested without touching React Native or the KV store.
 *
 * Note: targets aren't versioned per day, so "deficit maintained" uses the
 * user's *current* maintenance as the reference line — a fair approximation for
 * a journey view.
 */

import { KCAL_PER_KG_FAT } from './targets';

export interface DayRecord {
  /** YYYY-MM-DD (local calendar day). */
  date: string;
  /** Any meal logged that day. */
  logged: boolean;
  /** Calories eaten (0 when nothing logged). */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Morning weigh-in that day, if any. */
  weightKg: number | null;
}

export interface HistoryTargets {
  targetKcal: number;
  maintenanceKcal: number;
  proteinG: number;
}

export interface HistorySummary {
  daysInRange: number;
  daysLogged: number;
  /** Consecutive logged days ending on the most recent day in range. */
  currentStreak: number;
  longestStreak: number;
  /** Averages over *logged* days only (null when nothing logged). */
  avgKcal: number | null;
  avgProteinG: number | null;
  avgCarbsG: number | null;
  avgFatG: number | null;
  /** maintenance − intake, averaged over logged days (positive = deficit). */
  avgDeficitKcal: number | null;
  /** Sum of (maintenance − intake) across logged days. */
  totalDeficitKcal: number;
  /** totalDeficit / 7700 kcal-per-kg — rough fat-loss estimate. */
  estFatLossKg: number;
  /** Fraction of logged days at or under the calorie target (0..1). */
  onTargetRate: number | null;
  weightStartKg: number | null;
  weightEndKg: number | null;
  weightChangeKg: number | null;
}

/** maintenance − intake for a logged day (positive = ate under maintenance). */
export function dayDeficit(rec: DayRecord, t: HistoryTargets): number {
  return t.maintenanceKcal - rec.kcal;
}

/** Running sum of daily deficit across the series (logged days contribute). */
export function cumulativeDeficit(
  days: DayRecord[],
  t: HistoryTargets,
): number[] {
  let run = 0;
  return days.map((d) => {
    if (d.logged) run += dayDeficit(d, t);
    return run;
  });
}

function mean(nums: number[]): number | null {
  return nums.length
    ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length)
    : null;
}

export function summarizeHistory(
  days: DayRecord[],
  t: HistoryTargets,
): HistorySummary {
  const logged = days.filter((d) => d.logged);
  const weights = days
    .filter((d) => typeof d.weightKg === 'number')
    .map((d) => d.weightKg as number);

  const totalDeficitKcal = logged.reduce((s, d) => s + dayDeficit(d, t), 0);
  const atTarget = logged.filter((d) => d.kcal <= t.targetKcal).length;

  const weightStartKg = weights.length ? weights[0] : null;
  const weightEndKg = weights.length ? weights[weights.length - 1] : null;

  return {
    daysInRange: days.length,
    daysLogged: logged.length,
    currentStreak: currentStreak(days),
    longestStreak: longestStreak(days),
    avgKcal: mean(logged.map((d) => d.kcal)),
    avgProteinG: mean(logged.map((d) => d.proteinG)),
    avgCarbsG: mean(logged.map((d) => d.carbsG)),
    avgFatG: mean(logged.map((d) => d.fatG)),
    avgDeficitKcal: mean(logged.map((d) => dayDeficit(d, t))),
    totalDeficitKcal,
    estFatLossKg: Math.round((totalDeficitKcal / KCAL_PER_KG_FAT) * 10) / 10,
    onTargetRate: logged.length ? atTarget / logged.length : null,
    weightStartKg,
    weightEndKg,
    weightChangeKg:
      weightStartKg != null && weightEndKg != null
        ? Math.round((weightEndKg - weightStartKg) * 10) / 10
        : null,
  };
}

/** Consecutive logged days counting back from the last day in the series. */
function currentStreak(days: DayRecord[]): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (!days[i].logged) break;
    n++;
  }
  return n;
}

function longestStreak(days: DayRecord[]): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = d.logged ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** CSV with one row per day. Stable column order; safe for empty values. */
export function toCsv(days: DayRecord[], t: HistoryTargets): string {
  const header = [
    'date',
    'logged',
    'calories_kcal',
    'protein_g',
    'carbs_g',
    'fat_g',
    'target_kcal',
    'maintenance_kcal',
    'deficit_kcal',
    'weight_kg',
  ];
  const rows = days.map((d) =>
    [
      d.date,
      d.logged ? 'yes' : 'no',
      d.logged ? d.kcal : '',
      d.logged ? d.proteinG : '',
      d.logged ? d.carbsG : '',
      d.logged ? d.fatG : '',
      t.targetKcal,
      t.maintenanceKcal,
      d.logged ? dayDeficit(d, t) : '',
      d.weightKg ?? '',
    ].join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

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
 *
 * Only full days count. A day nobody logged is unknown, not a zero and not a
 * deficit, so it adds nothing either way. A day logged at under half the
 * target is almost always unfinished (breakfast logged, the rest forgotten)
 * and would read as a huge deficit, so it is left out too until the user
 * finishes it or confirms it was really a full day. Nothing is ever guessed
 * to fill a gap.
 */

import { KCAL_PER_KG_FAT, type Goal } from './targets';

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
  /** Missing means lose. */
  goal?: Goal;
}

/**
 * Whether a full day hit the plan: under the target when losing, at or over
 * it when gaining, within 10% of it when maintaining.
 */
export function onTarget(kcal: number, t: HistoryTargets): boolean {
  if (t.goal === 'gain') return kcal >= t.targetKcal;
  if (t.goal === 'maintain')
    return Math.abs(kcal - t.targetKcal) <= t.targetKcal * 0.1;
  return kcal <= t.targetKcal;
}

/**
 * What a total means when gaining or maintaining, in a few words. A surplus is
 * never turned into kilograms: gained weight is part muscle and part fat, so no
 * single kcal per kg is honest (the scale shows what was gained). Null when
 * losing, where the kilograms of fat stay.
 */
export function balanceNote(
  goal: Goal | undefined,
  totalDeficitKcal: number,
  daysOnTarget: number,
  fullDays: number,
): string | null {
  const side =
    totalDeficitKcal > 0 ? 'Under' : totalDeficitKcal < 0 ? 'Over' : 'At';
  if (goal === 'gain') {
    return totalDeficitKcal < 0
      ? 'Over maintenance, as planned'
      : `${side} maintenance, short of the plan`;
  }
  if (goal === 'maintain') {
    return `${side} maintenance overall, ${daysOnTarget} of ${fullDays} full ${fullDays === 1 ? 'day' : 'days'} within 10%`;
  }
  return null;
}

/** Under this share of the calorie target, a logged day reads as unfinished. */
export const UNFINISHED_SHARE = 0.5;

/** This many days in a row without a full day is a break, not a missed day. */
export const BREAK_DAYS = 3;

/** How long after coming back History leads with the fresh start. */
export const RESTART_DAYS = 14;

/**
 * counted: a full day, in every total. unfinished: something logged, but
 * under half the target and not confirmed. missing: nothing logged.
 */
export type DayStatus = 'counted' | 'unfinished' | 'missing';

export function dayStatus(
  rec: Pick<DayRecord, 'date' | 'logged' | 'kcal'>,
  targetKcal: number,
  complete?: ReadonlySet<string>,
): DayStatus {
  if (!rec.logged) return 'missing';
  if (rec.kcal < targetKcal * UNFINISHED_SHARE && !complete?.has(rec.date)) {
    return 'unfinished';
  }
  return 'counted';
}

/**
 * An intake series with unfinished days blanked out, for the adaptive
 * maintenance estimate and the weekly prediction, so neither reads a
 * forgotten dinner as a deficit.
 */
export function fullDaysOnly<
  T extends { date: string; intakeKcal?: number | null },
>(data: T[], targetKcal: number, complete?: ReadonlySet<string>): T[] {
  return data.map((d) => {
    const kcal = d.intakeKcal ?? 0;
    if (kcal <= 0) return d;
    const status = dayStatus(
      { date: d.date, logged: true, kcal },
      targetKcal,
      complete,
    );
    return status === 'unfinished' ? { ...d, intakeKcal: null } : d;
  });
}

export interface HistorySummary {
  daysInRange: number;
  /** Days with anything logged. */
  daysLogged: number;
  /** Full days: the only days the totals and averages use. */
  daysCounted: number;
  /** Logged, but under half the target and not confirmed. */
  unfinishedDates: string[];
  /** Full days in a row, up to today (or yesterday, while today is open). */
  currentStreak: number;
  longestStreak: number;
  /** Averages over full days only (null when there are none). */
  avgKcal: number | null;
  avgProteinG: number | null;
  avgCarbsG: number | null;
  avgFatG: number | null;
  /** maintenance − intake, averaged over full days (positive = deficit). */
  avgDeficitKcal: number | null;
  /** Sum of (maintenance − intake) across full days. */
  totalDeficitKcal: number;
  /** totalDeficit / 7700 kcal-per-kg — rough fat-loss estimate. */
  estFatLossKg: number;
  /** Fraction of full days on target for the goal (see onTarget), 0..1. */
  onTargetRate: number | null;
  /** Full days on target for the goal (see onTarget). */
  daysOnTarget: number;
  weightStartKg: number | null;
  weightEndKg: number | null;
  weightChangeKg: number | null;
}

/** maintenance − intake for a logged day (positive = ate under maintenance). */
export function dayDeficit(rec: DayRecord, t: HistoryTargets): number {
  return t.maintenanceKcal - rec.kcal;
}

/** Running sum of daily deficit across the series (full days contribute). */
export function cumulativeDeficit(
  days: DayRecord[],
  t: HistoryTargets,
  complete?: ReadonlySet<string>,
): number[] {
  let run = 0;
  return days.map((d) => {
    if (dayStatus(d, t.targetKcal, complete) === 'counted')
      run += dayDeficit(d, t);
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
  complete?: ReadonlySet<string>,
): HistorySummary {
  const status = days.map((d) => dayStatus(d, t.targetKcal, complete));
  const counted = days.filter((_, i) => status[i] === 'counted');
  const weights = days
    .filter((d) => typeof d.weightKg === 'number')
    .map((d) => d.weightKg as number);

  const totalDeficitKcal = counted.reduce((s, d) => s + dayDeficit(d, t), 0);
  const atTarget = counted.filter((d) => onTarget(d.kcal, t)).length;

  const weightStartKg = weights.length ? weights[0] : null;
  const weightEndKg = weights.length ? weights[weights.length - 1] : null;

  return {
    daysInRange: days.length,
    daysLogged: days.filter((d) => d.logged).length,
    daysCounted: counted.length,
    unfinishedDates: days
      .filter((_, i) => status[i] === 'unfinished')
      .map((d) => d.date),
    currentStreak: currentStreak(status),
    longestStreak: longestStreak(status),
    avgKcal: mean(counted.map((d) => d.kcal)),
    avgProteinG: mean(counted.map((d) => d.proteinG)),
    avgCarbsG: mean(counted.map((d) => d.carbsG)),
    avgFatG: mean(counted.map((d) => d.fatG)),
    avgDeficitKcal: mean(counted.map((d) => dayDeficit(d, t))),
    totalDeficitKcal,
    estFatLossKg: Math.round((totalDeficitKcal / KCAL_PER_KG_FAT) * 10) / 10,
    onTargetRate: counted.length ? atTarget / counted.length : null,
    daysOnTarget: atTarget,
    weightStartKg,
    weightEndKg,
    weightChangeKg:
      weightStartKg != null && weightEndKg != null
        ? Math.round((weightEndKg - weightStartKg) * 10) / 10
        : null,
  };
}

/**
 * Full days in a row, counting back from the last day in the series. The
 * last day is usually today, which is still open: if it isn't full yet the
 * count starts from the day before, so the morning never reads as zero.
 */
function currentStreak(status: DayStatus[]): number {
  let i = status.length - 1;
  if (i >= 0 && status[i] !== 'counted') i--;
  let n = 0;
  for (; i >= 0 && status[i] === 'counted'; i--) n++;
  return n;
}

function longestStreak(status: DayStatus[]): number {
  let best = 0;
  let run = 0;
  for (const s of status) {
    run = s === 'counted' ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

// Breaks, being away, and starting again

export interface Break {
  /** First and last day without a full day, inclusive. */
  from: string;
  to: string;
  days: number;
}

export interface Continuity {
  /**
   * Set while logging has stopped: no full day for BREAK_DAYS or more,
   * up to yesterday, and none yet today.
   */
  away: { lastCounted: string; days: number } | null;
  /** Set for RESTART_DAYS after the first full day following a break. */
  restart: { since: string; brk: Break } | null;
  /** Every finished break in the series, oldest first. */
  breaks: Break[];
}

const dayIndex = (d: string) =>
  Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/**
 * Where the user stands with logging, from a series ending today. Only a
 * stretch after a full day can be a break: the days before someone ever
 * logged are not a lapse.
 */
export function continuity(
  days: DayRecord[],
  targetKcal: number,
  complete: ReadonlySet<string> | undefined,
  today: string,
): Continuity {
  const status = days.map((d) => dayStatus(d, targetKcal, complete));
  const last = days.length - 1;
  // Today is still open: it can end a break, never start or lengthen one.
  const todayOpen = days[last]?.date === today && status[last] !== 'counted';
  const end = todayOpen ? last - 1 : last;

  const breaks: Break[] = [];
  let seenCounted = false;
  let runStart = -1;
  for (let i = 0; i <= end; i++) {
    if (status[i] === 'counted') {
      if (runStart >= 0 && i - runStart >= BREAK_DAYS) {
        breaks.push({
          from: days[runStart].date,
          to: days[i - 1].date,
          days: i - runStart,
        });
      }
      runStart = -1;
      seenCounted = true;
    } else if (seenCounted && runStart < 0) {
      runStart = i;
    }
  }

  let away: Continuity['away'] = null;
  if (runStart >= 0 && end - runStart + 1 >= BREAK_DAYS) {
    away = { lastCounted: days[runStart - 1].date, days: end - runStart + 1 };
  }

  let restart: Continuity['restart'] = null;
  const lastBreak = breaks[breaks.length - 1];
  if (!away && lastBreak) {
    const since = days[days.findIndex((d) => d.date === lastBreak.to) + 1];
    if (since && dayIndex(today) - dayIndex(since.date) < RESTART_DAYS) {
      restart = { since: since.date, brk: lastBreak };
    }
  }

  return { away, restart, breaks };
}

// Catching up

/** Yesterday, when it is worth offering to fix. */
export interface Slip {
  date: string;
  status: 'unfinished' | 'missing';
  kcal: number;
}

/**
 * Whether yesterday slipped, from a series ending today. A day started and
 * left under half the target is almost always a forgotten dinner, so it is
 * always offered. A blank day is offered only when the day before it was
 * full: the first day missed, not every day of a quiet stretch, which would
 * nag exactly the people who log now and then.
 */
export function slipped(
  days: DayRecord[],
  targetKcal: number,
  complete: ReadonlySet<string> | undefined,
  today: string,
): Slip | null {
  const i = days.findIndex((d) => d.date === today);
  if (i < 1) return null;
  const y = days[i - 1];
  const status = dayStatus(y, targetKcal, complete);
  if (status === 'counted') return null;
  if (status === 'missing') {
    const before = days[i - 2];
    if (!before || dayStatus(before, targetKcal, complete) !== 'counted') {
      return null;
    }
  }
  return { date: y.date, status, kcal: y.kcal };
}

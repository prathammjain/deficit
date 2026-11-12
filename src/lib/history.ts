/**
 * history.ts — assemble the per-day datasets the dashboards and the adaptive
 * engine need.
 *
 * Pulls each day's logged intake (sum of meals) and weigh-in into a single
 * series keyed by date, however many days, in one read of the log. IO lives
 * here; the math in adaptive-tdee.ts stays pure.
 */

import { kv, type KVStore } from './kv';
import { loadDays, summarize, todayKey } from './log-store';
import { loadWeights } from './weight-store';
import type { DailyDatum } from './adaptive-tdee';
import type { DayRecord } from './history-stats';

/** YYYY-MM-DD for `offset` days before `from` (offset 0 = from). */
function dateMinus(offset: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - offset);
  return todayKey(d);
}

/**
 * Macros and weigh in for each of `dates`, in two round trips side by side:
 * one for every day's meals, one for the weigh ins.
 */
async function recordsFor(
  dates: string[],
  store: KVStore,
): Promise<DayRecord[]> {
  const [weights, days] = await Promise.all([
    loadWeights(store),
    loadDays(dates, store),
  ]);
  const weightByDate = new Map(weights.map((w) => [w.date, w.kg]));
  return dates.map((date, i): DayRecord => {
    const s = summarize(days[i]);
    return {
      date,
      logged: s.count > 0,
      kcal: s.kcal,
      proteinG: s.proteinG,
      carbsG: s.carbsG,
      fatG: s.fatG,
      weightKg: weightByDate.get(date) ?? null,
    };
  });
}

/**
 * Day records as the intake and weight series the adaptive engine and the
 * weekly prediction read. Pure.
 */
export function toDailyData(records: DayRecord[]): DailyDatum[] {
  return records.map((r) => ({
    date: r.date,
    intakeKcal: r.kcal > 0 ? r.kcal : null,
    weightKg: r.weightKg,
  }));
}

/**
 * The last `days` calendar days (inclusive of today) with full macro
 * breakdown + weigh-in — the series the dashboards chart and export.
 */
export function gatherDailyRecords(
  days = 90,
  store: KVStore = kv,
): Promise<DayRecord[]> {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dateMinus(i));
  return recordsFor(dates, store);
}

/**
 * Every day from `start` to `end` (day keys, both included) with macros and
 * weigh ins. The training Progress view joins these with workouts.
 */
export function gatherRange(
  start: string,
  end: string,
  store: KVStore = kv,
): Promise<DayRecord[]> {
  const [y, m, d] = start.split('-').map(Number);
  const dates: string[] = [];
  for (let day = new Date(y, m - 1, d); todayKey(day) <= end; ) {
    dates.push(todayKey(day));
    day.setDate(day.getDate() + 1);
  }
  return recordsFor(dates, store);
}

/**
 * Every calendar day of the month containing `anchor` (day 1 → month end), in
 * order, with full macro breakdown + weigh-in. Powers the History calendar,
 * which lets the user pick any day and see that day's totals and deficit.
 */
export function gatherMonthRecords(
  anchor: Date,
  store: KVStore = kv,
): Promise<DayRecord[]> {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(todayKey(new Date(year, month, d)));
  }
  return recordsFor(dates, store);
}

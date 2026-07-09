/**
 * history.ts — assemble the trailing-window dataset the adaptive engine needs.
 *
 * Pulls each day's logged intake (sum of meals) and weigh-in into a single
 * series keyed by date. IO lives here; the math in adaptive-tdee.ts stays pure.
 */

import { kv, type KVStore } from './kv';
import { loadDay, summarize, todayKey } from './log-store';
import { loadWeights } from './weight-store';
import type { DailyDatum } from './adaptive-tdee';
import type { DayRecord } from './history-stats';

/** YYYY-MM-DD for `offset` days before `from` (offset 0 = from). */
function dateMinus(offset: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - offset);
  return todayKey(d);
}

/** The last `days` calendar days (inclusive of today), with intake + weight. */
export async function gatherHistory(
  days = 21,
  store: KVStore = kv,
): Promise<DailyDatum[]> {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dateMinus(i));

  const weights = await loadWeights(store);
  const weightByDate = new Map(weights.map((w) => [w.date, w.kg]));

  const data = await Promise.all(
    dates.map(async (date): Promise<DailyDatum> => {
      const meals = await loadDay(date, store);
      const kcal = summarize(meals).kcal;
      return {
        date,
        intakeKcal: kcal > 0 ? kcal : null,
        weightKg: weightByDate.get(date) ?? null,
      };
    }),
  );

  return data;
}

/**
 * The last `days` calendar days with full macro breakdown + weigh-in — the
 * richer series the History dashboard charts and exports.
 */
export async function gatherDailyRecords(
  days = 90,
  store: KVStore = kv,
): Promise<DayRecord[]> {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dateMinus(i));

  const weights = await loadWeights(store);
  const weightByDate = new Map(weights.map((w) => [w.date, w.kg]));

  return Promise.all(
    dates.map(async (date): Promise<DayRecord> => {
      const s = summarize(await loadDay(date, store));
      return {
        date,
        logged: s.count > 0,
        kcal: s.kcal,
        proteinG: s.proteinG,
        carbsG: s.carbsG,
        fatG: s.fatG,
        weightKg: weightByDate.get(date) ?? null,
      };
    }),
  );
}

/**
 * Every calendar day of the month containing `anchor` (day 1 → month end), in
 * order, with full macro breakdown + weigh-in. Powers the History calendar,
 * which lets the user pick any day and see that day's totals and deficit.
 */
export async function gatherMonthRecords(
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

  const weights = await loadWeights(store);
  const weightByDate = new Map(weights.map((w) => [w.date, w.kg]));

  return Promise.all(
    dates.map(async (date): Promise<DayRecord> => {
      const s = summarize(await loadDay(date, store));
      return {
        date,
        logged: s.count > 0,
        kcal: s.kcal,
        proteinG: s.proteinG,
        carbsG: s.carbsG,
        fatG: s.fatG,
        weightKg: weightByDate.get(date) ?? null,
      };
    }),
  );
}

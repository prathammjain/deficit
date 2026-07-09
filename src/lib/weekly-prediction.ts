/**
 * weekly-prediction.ts — turn the trailing week of logged deficits into one
 * motivating number: the weight the user is on pace to lose this week
 * (spec: docs/superpowers/specs/2026-07-09-weekly-prediction-design.md).
 *
 * Pure math, no storage. The window is the 7 days ending YESTERDAY — a
 * half-eaten today looks like a huge deficit and would swing the prediction
 * all morning. Missing 1–2 days are implicitly filled with the logged-day
 * average (that's what avg × 7 does); below 5 logged days we don't pretend
 * ('building'), and an empty window starts over ('fresh') — which is exactly
 * the "7 missed days resets the prediction, never the history" rule, with
 * no stored state to manage.
 */

import type { DailyDatum } from './adaptive-tdee';
import { todayKey } from './log-store';
import { KCAL_PER_KG_FAT } from './targets';

export interface WeeklyPrediction {
  state: 'ready' | 'building' | 'fresh';
  /** Days with a real intake log, 0..7. */
  loggedDays: number;
  missedDays: number;
  /** maintenance − intake, averaged over logged days (ready only). */
  avgDailyDeficitKcal: number | null;
  /** avgDailyDeficitKcal × 7 (ready only). */
  weeklyDeficitKcal: number | null;
  /** weeklyDeficit / 7700. Positive = loss, negative = gain (ready only). */
  predictedKgPerWeek: number | null;
  /** The 7 window days, oldest → newest — for the dot strip. */
  days: { date: string; logged: boolean }[];
}

/** Below this many logged days we show progress, not a prediction. */
const MIN_READY_DAYS = 5;

export function predictWeeklyLoss(
  data: DailyDatum[],
  maintenanceKcal: number,
  today: string = todayKey(),
): WeeklyPrediction {
  const intakeByDate = new Map(data.map((d) => [d.date, d.intakeKcal]));
  const base = new Date(`${today}T00:00:00`);

  // Offsets 7..1 = the 7 days ending yesterday, oldest first.
  const window: { date: string; logged: boolean; intake: number }[] = [];
  for (let offset = 7; offset >= 1; offset--) {
    const d = new Date(base);
    d.setDate(d.getDate() - offset);
    const date = todayKey(d);
    const intake = intakeByDate.get(date);
    const logged = typeof intake === 'number' && intake > 0;
    window.push({ date, logged, intake: logged ? (intake as number) : 0 });
  }

  const logged = window.filter((d) => d.logged);
  const loggedDays = logged.length;
  const missedDays = 7 - loggedDays;
  const days = window.map(({ date, logged: l }) => ({ date, logged: l }));

  if (loggedDays < MIN_READY_DAYS) {
    return {
      state: loggedDays === 0 ? 'fresh' : 'building',
      loggedDays,
      missedDays,
      avgDailyDeficitKcal: null,
      weeklyDeficitKcal: null,
      predictedKgPerWeek: null,
      days,
    };
  }

  const sum = logged.reduce((s, d) => s + (maintenanceKcal - d.intake), 0);
  const avg = Math.round(sum / loggedDays);
  const weekly = avg * 7;
  return {
    state: 'ready',
    loggedDays,
    missedDays,
    avgDailyDeficitKcal: avg,
    weeklyDeficitKcal: weekly,
    predictedKgPerWeek: Math.round((weekly / KCAL_PER_KG_FAT) * 100) / 100,
    days,
  };
}

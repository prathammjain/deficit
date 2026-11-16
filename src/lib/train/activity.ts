/**
 * activity.ts: every kind of training as one record. A lifting session in
 * the morning and a HYROX sim in the evening are two sessions on one
 * training day, wherever the app counts training. Pure.
 */

import { isFinished, summarize, type Sim } from '../hyrox/race';
import { inPeriod, type Period } from './progress';
import type { Workout } from './workout';

export interface Activity {
  /** Workouts plus finished sims. */
  sessions: number;
  workouts: number;
  sims: number;
  /** Days with any training, sorted. */
  days: string[];
  /** Time spent training, from workout clocks and sim totals. */
  minutes: number;
}

export function activity(
  workouts: Workout[],
  sims: Sim[],
  p: Period,
): Activity {
  const w = workouts.filter((x) => inPeriod(x.date, p));
  const s = sims.filter((x) => isFinished(x) && inPeriod(x.date, p));
  const ms =
    w.reduce(
      (t, x) =>
        t + Math.max(0, Date.parse(x.endedAt) - Date.parse(x.startedAt)),
      0,
    ) + s.reduce((t, x) => t + summarize(x).totalMs, 0);
  return {
    sessions: w.length + s.length,
    workouts: w.length,
    sims: s.length,
    days: [
      ...new Set([...w.map((x) => x.date), ...s.map((x) => x.date)]),
    ].sort(),
    minutes: Math.round(ms / 60000),
  };
}

/** "2 workouts and 1 HYROX sim", leaving out a kind with none. */
export function activityText(a: Activity): string {
  const parts = [
    a.workouts
      ? `${a.workouts} ${a.workouts === 1 ? 'workout' : 'workouts'}`
      : '',
    a.sims ? `${a.sims} HYROX ${a.sims === 1 ? 'sim' : 'sims'}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' and ') : 'No training';
}

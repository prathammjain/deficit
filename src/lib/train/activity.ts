/**
 * activity.ts: every kind of training as one record. A lifting session in
 * the morning and a HYROX sim or a run in the evening are two sessions on
 * one training day, wherever the app counts training. Pure.
 */

import type { CardioSession } from '../cardio/cardio';
import { isFinished, summarize, type Sim } from '../hyrox/race';
import { inPeriod, type Period } from './progress';
import type { Workout } from './workout';

export interface Activity {
  /** Workouts, finished sims and cardio sessions. */
  sessions: number;
  workouts: number;
  sims: number;
  cardio: number;
  /** Days with any training, sorted. */
  days: string[];
  /** Time spent training: workout clocks, sim totals, cardio times. */
  minutes: number;
}

export function activity(
  workouts: Workout[],
  sims: Sim[],
  p: Period,
  cardio: CardioSession[] = [],
): Activity {
  const w = workouts.filter((x) => inPeriod(x.date, p));
  const s = sims.filter((x) => isFinished(x) && inPeriod(x.date, p));
  const c = cardio.filter((x) => inPeriod(x.date, p));
  const ms =
    w.reduce(
      (t, x) =>
        t + Math.max(0, Date.parse(x.endedAt) - Date.parse(x.startedAt)),
      0,
    ) +
    s.reduce((t, x) => t + summarize(x).totalMs, 0) +
    c.reduce((t, x) => t + x.ms, 0);
  return {
    sessions: w.length + s.length + c.length,
    workouts: w.length,
    sims: s.length,
    cardio: c.length,
    days: [
      ...new Set([
        ...w.map((x) => x.date),
        ...s.map((x) => x.date),
        ...c.map((x) => x.date),
      ]),
    ].sort(),
    minutes: Math.round(ms / 60000),
  };
}

/** "2 workouts, 1 HYROX sim and 3 cardio sessions", leaving out a kind with none. */
export function activityText(a: Activity): string {
  const parts = [
    a.workouts
      ? `${a.workouts} ${a.workouts === 1 ? 'workout' : 'workouts'}`
      : '',
    a.sims ? `${a.sims} HYROX ${a.sims === 1 ? 'sim' : 'sims'}` : '',
    a.cardio
      ? `${a.cardio} cardio ${a.cardio === 1 ? 'session' : 'sessions'}`
      : '',
  ].filter(Boolean);
  if (!parts.length) return 'No training';
  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

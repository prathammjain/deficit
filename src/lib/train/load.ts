/**
 * load.ts: training load across lifting, HYROX and cardio, by session RPE.
 * Pure.
 *
 * Foster et al. 2001: rate the whole session from 0 to 10 about half an hour
 * after it, then load is that rating times the minutes. It is one of the
 * most studied ways to track load, it works for any kind of training, and
 * it needs no watch. Only rated sessions count; the screen says how many
 * weren't rated rather than guessing for them.
 */

import type { CardioSession } from '../cardio/cardio';
import { isFinished, summarize, type Sim } from '../hyrox/race';
import { inPeriod, type Period } from './progress';
import type { Workout } from './workout';

/** Foster's 0 to 10 scale; the empty steps sit between named ones. */
export const SESSION_RPE: { v: number; label: string }[] = [
  { v: 1, label: 'Very, very easy' },
  { v: 2, label: 'Easy' },
  { v: 3, label: 'Moderate' },
  { v: 4, label: 'Somewhat hard' },
  { v: 5, label: 'Hard' },
  { v: 6, label: 'Hard' },
  { v: 7, label: 'Very hard' },
  { v: 8, label: 'Very hard' },
  { v: 9, label: 'Very hard' },
  { v: 10, label: 'Maximal' },
];

export const rpeLabel = (v: number) =>
  SESSION_RPE.find((x) => x.v === v)?.label ?? '';

export interface Load {
  /** Session RPE times minutes, summed. */
  load: number;
  rated: number;
  unrated: number;
}

export function trainingLoad(
  workouts: Workout[],
  sims: Sim[],
  cardio: CardioSession[],
  p: Period,
): Load {
  let load = 0;
  let rated = 0;
  let unrated = 0;
  const add = (rpe: number | null | undefined, ms: number) => {
    if (rpe != null && rpe > 0 && ms > 0) {
      load += rpe * (ms / 60000);
      rated++;
    } else unrated++;
  };
  for (const w of workouts) {
    if (!inPeriod(w.date, p)) continue;
    add(w.sessionRpe, Date.parse(w.endedAt) - Date.parse(w.startedAt));
  }
  for (const s of sims) {
    if (isFinished(s) && inPeriod(s.date, p)) add(s.rpe, summarize(s).totalMs);
  }
  for (const c of cardio) {
    if (inPeriod(c.date, p)) add(c.rpe, c.ms);
  }
  return { load: Math.round(load), rated, unrated };
}

/**
 * adherence.ts: the summary a follower can choose to share with the author
 * of the program they follow. How much of the plan got done, and how eating
 * and the scale went, over the last four weeks. Pure.
 *
 * Only this summary is shared: never meals, sets or notes.
 */

import type { DayRecord } from '../history-stats';
import { todayKey } from '../log-store';
import type { WeightEntry } from '../weight-store';
import { position, programWorkouts, type Program } from './program';
import { addDays, bodySummary, foodSummary } from './progress';
import type { Workout } from './workout';

/** Days the summary looks back over. */
export const WINDOW = 28;

/** How often a sharing follower's summary is refreshed. */
export const FRESH_MS = 6 * 60 * 60 * 1000;

export interface Adherence {
  /** Program week, by workouts done (see position). */
  week: number;
  weeks: number;
  /** Program workouts done since following. */
  done: number;
  /** Program workouts in the window, and how many the plan had in it. */
  doneRecent: number;
  plannedRecent: number;
  /** Day key of the last program workout. */
  lastWorkout: string | null;
  /** Days in the window, which ends yesterday: 0 on the day they follow. */
  days: number;
  foodDays: number;
  avgKcal: number | null;
  avgProteinG: number | null;
  /** Latest weigh in, and the change over the window. */
  weightKg: number | null;
  weightChangeKg: number | null;
  /** When the summary was made (ISO). */
  at: string;
}

/**
 * First day the summary covers: four weeks back, or the day they followed.
 * The summary ends yesterday: today is still open, so a morning never reads
 * as a missed day.
 */
export function windowStart(since: string, today: string): string {
  const back = addDays(today, -WINDOW);
  const followed = todayKey(new Date(since));
  return followed > back ? followed : back;
}

export function adherence(x: {
  program: Program;
  /** When the follow started (ISO). */
  since: string;
  workouts: Workout[];
  records: DayRecord[];
  weights: WeightEntry[];
  today: string;
  /** With the calorie target known, only full days count as food logged. */
  targetKcal?: number | null;
  complete?: ReadonlySet<string>;
  now?: Date;
}): Adherence {
  const start = windowStart(x.since, x.today);
  const end = addDays(x.today, -1);
  const window = { kind: 'week' as const, start, end };
  const all = programWorkouts(x.workouts, x.program.id, x.since);
  const recent = all.filter((w) => w.date >= start && w.date <= end);
  const pos = position(x.program, x.workouts, x.since);
  const food = foodSummary(
    x.records,
    window,
    x.today,
    x.targetKcal ? { targetKcal: x.targetKcal, proteinG: 0 } : null,
    x.complete,
  );
  const body = bodySummary(x.weights, window);
  const perWeek = Math.max(1, x.program.days.length);
  return {
    week: pos.week,
    weeks: x.program.weeks,
    done: all.length,
    doneRecent: recent.length,
    plannedRecent: food.days
      ? Math.max(1, Math.round((perWeek * food.days) / 7))
      : 0,
    lastWorkout: all.length ? all[all.length - 1].date : null,
    days: food.days,
    foodDays: food.daysLogged,
    avgKcal: food.avgKcal,
    avgProteinG: food.avgProtein,
    weightKg: body.endKg,
    weightChangeKg: body.changeKg,
    at: (x.now ?? new Date()).toISOString(),
  };
}

/** Share of planned workouts done in the window, 0 to 1. */
export const workoutRate = (a: Adherence) =>
  Math.min(1, a.doneRecent / Math.max(1, a.plannedRecent));

/** Whether a sharing follower's summary is due a refresh. */
export function isStale(statsAt: string | null, now: number = Date.now()) {
  return !statsAt || now - Date.parse(statsAt) > FRESH_MS;
}

const num = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown) => (v === null || num(v) ? v : undefined);

/**
 * Reads a summary that came from someone else's device. Anything that
 * isn't the expected shape reads as no summary rather than breaking the
 * coach's screen.
 */
export function readAdherence(v: unknown): Adherence | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const counts = [
    'week',
    'weeks',
    'done',
    'doneRecent',
    'plannedRecent',
    'days',
    'foodDays',
  ] as const;
  if (!counts.every((k) => num(o[k]) && (o[k] as number) >= 0)) return null;
  const optional = [
    'avgKcal',
    'avgProteinG',
    'weightKg',
    'weightChangeKg',
  ] as const;
  if (!optional.every((k) => numOrNull(o[k]) !== undefined)) return null;
  const day = o.lastWorkout;
  if (
    day !== null &&
    !(typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))
  )
    return null;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  return o as unknown as Adherence;
}

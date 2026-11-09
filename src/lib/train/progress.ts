/**
 * progress.ts: the numbers behind progressive overload, week by week and
 * month by month, joined with what was eaten and what the scale said.
 * Pure: the screens fetch, this file counts.
 *
 * Strength is tracked as the best estimated one rep max per exercise (see
 * workout.ts), compared with the period before. Volume is hard sets and
 * kilograms moved; warmups never count.
 */

import type { DayRecord } from '../history-stats';
import type { WeightEntry } from '../weight-store';
import { MUSCLE_LABEL, type Exercise, type Muscle } from './exercises';
import {
  bestsFrom,
  isHard,
  prSets,
  setScore,
  setVolume,
  type Bests,
  type SetValues,
  type WorkSet,
  type Workout,
} from './workout';

// Days and periods
/** A day key plus some days, in plain calendar math (no time zones). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 for Monday through 6 for Sunday. */
function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export type PeriodKind = 'week' | 'month';

export interface Period {
  kind: PeriodKind;
  /** First and last day, inclusive. */
  start: string;
  end: string;
}

/** The Monday to Sunday week, or the calendar month, holding a day. */
export function periodOf(kind: PeriodKind, day: string): Period {
  if (kind === 'week') {
    const start = addDays(day, -weekday(day));
    return { kind, start, end: addDays(start, 6) };
  }
  const [y, m] = day.split('-').map(Number);
  const start = `${day.slice(0, 7)}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    kind,
    start,
    end: `${day.slice(0, 7)}-${String(last).padStart(2, '0')}`,
  };
}

/** The period n steps away: shiftPeriod(p, -1) is the one before. */
export function shiftPeriod(p: Period, n: number): Period {
  if (p.kind === 'week') return periodOf('week', addDays(p.start, 7 * n));
  const [y, m] = p.start.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return periodOf('month', d.toISOString().slice(0, 10));
}

export const inPeriod = (day: string, p: Period) =>
  day >= p.start && day <= p.end;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const dayMonth = (day: string) =>
  `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

/** "This week", "Last week", "2 to 8 Nov", "November", "March 2025". */
export function periodLabel(p: Period, today: string): string {
  const now = periodOf(p.kind, today);
  if (p.kind === 'week') {
    if (p.start === now.start) return 'This week';
    if (p.start === shiftPeriod(now, -1).start) return 'Last week';
    const y1 = p.start.slice(0, 4);
    const y2 = p.end.slice(0, 4);
    if (y1 !== y2)
      return `${dayMonth(p.start)} ${y1} to ${dayMonth(p.end)} ${y2}`;
    const sameMonth = p.start.slice(0, 7) === p.end.slice(0, 7);
    const from = sameMonth
      ? String(Number(p.start.slice(8)))
      : dayMonth(p.start);
    const year = y2 !== today.slice(0, 4) ? ` ${y2}` : '';
    return `${from} to ${dayMonth(p.end)}${year}`;
  }
  const name = MONTHS_LONG[Number(p.start.slice(5, 7)) - 1];
  return p.start.slice(0, 4) === today.slice(0, 4)
    ? name
    : `${name} ${p.start.slice(0, 4)}`;
}

/** A short label for a chart column: "2 Nov" for weeks, "Nov" for months. */
export function periodTick(p: Period): string {
  return p.kind === 'week'
    ? dayMonth(p.start)
    : MONTHS[Number(p.start.slice(5, 7)) - 1];
}

/** Every day in a period, in order. */
export function periodDays(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.start; d <= p.end; d = addDays(d, 1)) out.push(d);
  return out;
}

// Training
export interface TrainingSummary {
  sessions: number;
  /** Hard sets: ticked, not warmups. */
  sets: number;
  /** Kilograms moved. */
  volume: number;
  minutes: number;
  /** Days with a workout. */
  days: string[];
  /** Hard sets per muscle, most first. */
  muscles: { muscle: Muscle; label: string; sets: number }[];
}

export function trainingSummary(
  workouts: Workout[],
  exById: Map<string, Exercise>,
  p: Period,
): TrainingSummary {
  const within = workouts.filter((w) => inPeriod(w.date, p));
  const perMuscle = new Map<Muscle, number>();
  let sets = 0;
  let volume = 0;
  let ms = 0;
  for (const w of within) {
    ms += Math.max(0, Date.parse(w.endedAt) - Date.parse(w.startedAt));
    for (const we of w.exercises) {
      const hard = we.sets.filter(isHard).length;
      sets += hard;
      volume += we.sets.reduce((v, s) => v + setVolume(s), 0);
      const m = exById.get(we.exerciseId)?.muscle;
      if (m && hard) perMuscle.set(m, (perMuscle.get(m) ?? 0) + hard);
    }
  }
  return {
    sessions: within.length,
    sets,
    volume: Math.round(volume),
    minutes: Math.round(ms / 60000),
    days: [...new Set(within.map((w) => w.date))].sort(),
    muscles: [...perMuscle.entries()]
      .map(([muscle, n]) => ({ muscle, label: MUSCLE_LABEL[muscle], sets: n }))
      .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label)),
  };
}

/** Training per period for the last `count` periods, oldest first. */
export function trainingSeries(
  workouts: Workout[],
  exById: Map<string, Exercise>,
  last: Period,
  count: number,
): { period: Period; summary: TrainingSummary }[] {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const period = shiftPeriod(last, -i);
    out.push({ period, summary: trainingSummary(workouts, exById, period) });
  }
  return out;
}

/** One exercise's appearance in one workout. */
export interface ExerciseSession {
  workoutId: string;
  date: string;
  startedAt: string;
  sets: WorkSet[];
  /** Best estimated max that day. */
  best: number;
  volume: number;
}

/** Every session of one exercise, newest first. */
export function exerciseHistory(
  workouts: Workout[],
  ex: Exercise,
  bodyKg: number,
): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of workouts) {
    const sets = w.exercises
      .filter((we) => we.exerciseId === ex.id)
      .flatMap((we) => we.sets)
      .filter((s) => s.done && (s.reps ?? 0) > 0);
    if (!sets.length) continue;
    out.push({
      workoutId: w.id,
      date: w.date,
      startedAt: w.startedAt,
      sets,
      best: Math.max(
        0,
        ...sets.filter(isHard).map((s) => setScore(s, ex, bodyKg)),
      ),
      volume: Math.round(sets.reduce((v, s) => v + setVolume(s), 0)),
    });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

const bestIn = (sessions: ExerciseSession[]) =>
  sessions.reduce((m, s) => Math.max(m, s.best), 0);

/** Fractional change, or null when there is nothing fair to compare. */
const change = (now: number, before: number | null) =>
  before && before > 0 && now > 0 ? now / before - 1 : null;

export interface LiftRow {
  exercise: Exercise;
  sessions: number;
  sets: number;
  /** The best set in the period and its estimated max. */
  best: SetValues;
  score: number;
  /** What it is compared with: the period before, else the last session before. */
  before: number | null;
  change: number | null;
}

/** Every exercise trained in a period, most worked first. */
export function liftBoard(
  workouts: Workout[],
  exById: Map<string, Exercise>,
  bodyKg: number,
  p: Period,
): LiftRow[] {
  const ids = new Set(
    workouts
      .filter((w) => inPeriod(w.date, p))
      .flatMap((w) => w.exercises.map((we) => we.exerciseId)),
  );
  const prev = shiftPeriod(p, -1);
  const rows: LiftRow[] = [];
  for (const id of ids) {
    const ex = exById.get(id);
    if (!ex) continue;
    const history = exerciseHistory(workouts, ex, bodyKg);
    const now = history.filter((s) => inPeriod(s.date, p));
    let bestSet: WorkSet | null = null;
    let score = 0;
    for (const s of now.flatMap((x) => x.sets).filter(isHard)) {
      const sc = setScore(s, ex, bodyKg);
      if (!bestSet || sc > score) {
        bestSet = s;
        score = sc;
      }
    }
    const inPrev = history.filter((s) => inPeriod(s.date, prev));
    const earlier = history.find((s) => s.date < p.start);
    const before = inPrev.length ? bestIn(inPrev) : (earlier?.best ?? null);
    rows.push({
      exercise: ex,
      sessions: now.length,
      sets: now.reduce((n, s) => n + s.sets.filter(isHard).length, 0),
      best: bestSet
        ? { kg: bestSet.kg, reps: bestSet.reps }
        : { kg: null, reps: null },
      score,
      before: before || null,
      change: change(score, before),
    });
  }
  return rows.sort(
    (a, b) => b.sets - a.sets || a.exercise.name.localeCompare(b.exercise.name),
  );
}

/**
 * How an exercise is trending: the best estimated max over the last
 * `days` against the best over the same stretch before (or the last
 * session before that, after a break).
 */
export function trend(
  sessions: ExerciseSession[],
  today: string,
  days = 28,
): number | null {
  const from = addDays(today, -(days - 1));
  const recent = sessions.filter((s) => s.date >= from && s.date <= today);
  if (!recent.length) return null;
  const priorFrom = addDays(from, -days);
  const prior = sessions.filter((s) => s.date >= priorFrom && s.date < from);
  const before = prior.length
    ? bestIn(prior)
    : (sessions.find((s) => s.date < from)?.best ?? null);
  return change(bestIn(recent), before);
}

export interface Records {
  best: { score: number; set: SetValues; date: string } | null;
  heaviest: { set: SetValues; date: string } | null;
  mostReps: { set: SetValues; date: string } | null;
  bestVolume: { volume: number; date: string } | null;
  /** Heaviest load for a rep count, where it beats every higher count. */
  repMaxes: { reps: number; kg: number; date: string }[];
}

const REP_MAXES = [1, 2, 3, 5, 8, 10, 12];

export function records(
  sessions: ExerciseSession[],
  ex: Exercise,
  bodyKg: number,
): Records {
  const r: Records = {
    best: null,
    heaviest: null,
    mostReps: null,
    bestVolume: null,
    repMaxes: [],
  };
  const maxes = new Map<number, { kg: number; date: string }>();
  // Oldest first, so a tie keeps the first time it was done.
  for (const s of [...sessions].reverse()) {
    if (!r.bestVolume || s.volume > r.bestVolume.volume) {
      if (s.volume > 0) r.bestVolume = { volume: s.volume, date: s.date };
    }
    for (const set of s.sets.filter(isHard)) {
      const v = { kg: set.kg, reps: set.reps };
      const kg = set.kg ?? 0;
      const reps = set.reps ?? 0;
      const score = setScore(set, ex, bodyKg);
      if (score > 0 && (!r.best || score > r.best.score)) {
        r.best = { score, set: v, date: s.date };
      }
      const h = r.heaviest?.set;
      if (
        !h ||
        kg > (h.kg ?? 0) ||
        (kg === (h.kg ?? 0) && reps > (h.reps ?? 0))
      ) {
        r.heaviest = { set: v, date: s.date };
      }
      const m = r.mostReps?.set;
      if (
        !m ||
        reps > (m.reps ?? 0) ||
        (reps === (m.reps ?? 0) && kg > (m.kg ?? 0))
      ) {
        r.mostReps = { set: v, date: s.date };
      }
      for (const n of REP_MAXES) {
        if (reps >= n && kg > 0 && kg > (maxes.get(n)?.kg ?? 0)) {
          maxes.set(n, { kg, date: s.date });
        }
      }
    }
  }
  const all = REP_MAXES.filter((n) => maxes.has(n)).map((n) => ({
    reps: n,
    ...maxes.get(n)!,
  }));
  // A rep count earns a line only when it beats every higher count:
  // 95 x 8 already says 95 kg for 5, 3, 2 and 1.
  r.repMaxes = all.filter((m, i) => all.slice(i + 1).every((h) => m.kg > h.kg));
  return r;
}

// Food and the scale
export interface FoodSummary {
  /** Days in the period so far (future days don't count). */
  days: number;
  daysLogged: number;
  avgKcal: number | null;
  avgProtein: number | null;
  targetKcal: number | null;
  proteinTarget: number | null;
}

export function foodSummary(
  records: DayRecord[],
  p: Period,
  today: string,
  targets: { targetKcal: number; proteinG: number } | null,
): FoodSummary {
  const end = p.end < today ? p.end : today;
  const days = end < p.start ? 0 : periodDays({ ...p, end }).length;
  const logged = records.filter(
    (r) => r.logged && r.date >= p.start && r.date <= end,
  );
  const avg = (f: (r: DayRecord) => number) =>
    logged.length
      ? Math.round(logged.reduce((s, r) => s + f(r), 0) / logged.length)
      : null;
  return {
    days,
    daysLogged: logged.length,
    avgKcal: avg((r) => r.kcal),
    avgProtein: avg((r) => r.proteinG),
    targetKcal: targets?.targetKcal ?? null,
    proteinTarget: targets?.proteinG ?? null,
  };
}

export interface BodySummary {
  /** Last weigh in within the period. */
  endKg: number | null;
  /** Against the last weigh in before the period, else the first in it. */
  changeKg: number | null;
}

export function bodySummary(weights: WeightEntry[], p: Period): BodySummary {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const within = sorted.filter((w) => inPeriod(w.date, p));
  if (!within.length) return { endKg: null, changeKg: null };
  const end = within[within.length - 1];
  const before = [...sorted].reverse().find((w) => w.date < p.start);
  const start = before ?? (within.length > 1 ? within[0] : null);
  return {
    endKg: end.kg,
    changeKg: start ? Math.round((end.kg - start.kg) * 10) / 10 : null,
  };
}

// The one line read
/** "up 3.2%", "down 1.4%", "level". */
export function changeText(c: number | null): string {
  if (c == null) return 'new';
  const pct = Math.abs(c * 100);
  if (pct < 0.5) return 'level';
  // A first full month after a half one can double; tenths stop mattering.
  const shown =
    pct >= 100 ? Math.round(pct).toLocaleString('en-US') : pct.toFixed(1);
  return `${c > 0 ? 'up' : 'down'} ${shown}%`;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export interface ReadInput {
  kind: PeriodKind;
  /** The period holds today. */
  current: boolean;
  training: TrainingSummary;
  previous: TrainingSummary;
  lifts: LiftRow[];
  food: FoodSummary;
  body: BodySummary;
}

/**
 * One sentence on the period, joining training, food and the scale. Only
 * Grain sees all three, so this is the line no single purpose app can write.
 */
export function periodRead(x: ReadInput): string {
  const span = x.kind === 'week' ? 'week' : 'month';
  if (x.training.sessions === 0) {
    return x.current
      ? `No workouts logged yet this ${span}.`
      : `No workouts logged that ${span}.`;
  }
  const changes = x.lifts
    .map((l) => l.change)
    .filter((c): c is number => c != null);
  const strength = changes.length ? median(changes) : null;
  const pct = (c: number) => `${Math.abs(c * 100).toFixed(1)}%`;
  const lost = x.body.changeKg != null && x.body.changeKg <= -0.2;
  const fedEnough = x.food.days > 0 && x.food.daysLogged * 2 >= x.food.days;

  if (lost && strength != null && strength >= 0.02) {
    return `Lifts up ${pct(strength)} while bodyweight fell ${Math.abs(x.body.changeKg!)} kg.`;
  }
  if (lost && strength != null && strength > -0.005) {
    return `Strength held while bodyweight fell ${Math.abs(x.body.changeKg!)} kg.`;
  }
  if (
    strength != null &&
    strength <= -0.02 &&
    fedEnough &&
    x.food.avgKcal != null &&
    x.food.targetKcal &&
    x.food.avgKcal < x.food.targetKcal * 0.85
  ) {
    const under = 1 - x.food.avgKcal / x.food.targetKcal;
    return `Lifts slipped ${pct(strength)} on ${x.food.avgKcal.toLocaleString('en-US')} kcal a day, ${pct(under)} under target.`;
  }
  if (
    x.food.daysLogged >= 3 &&
    x.food.avgProtein != null &&
    x.food.proteinTarget &&
    x.food.avgProtein < x.food.proteinTarget * 0.8
  ) {
    return `Protein averaged ${x.food.avgProtein} g a day, short of your ${x.food.proteinTarget} g target.`;
  }
  if (strength != null && strength >= 0.02) {
    return `Lifts up ${pct(strength)} on the ${span} before.`;
  }
  if (x.previous.sets > 0 && x.training.sets >= x.previous.sets * 1.1) {
    // A running period is compared with the same days of the one before.
    const than = x.current
      ? `the same days last ${span}`
      : `the ${span} before`;
    return `${x.training.sets - x.previous.sets} more hard sets than ${than}.`;
  }
  if (strength != null && strength > -0.02) {
    return `Lifts holding steady across ${x.training.sessions} ${x.training.sessions === 1 ? 'workout' : 'workouts'}.`;
  }
  return `${x.training.sessions} ${x.training.sessions === 1 ? 'workout' : 'workouts'}, ${x.training.sets} hard sets.`;
}

/**
 * Records set in each workout, judged against everything before it. One
 * pass, oldest first, so a long history stays quick.
 */
export function recordCounts(
  workouts: Workout[],
  exById: Map<string, Exercise>,
  bodyKg: number,
): Map<string, number> {
  const bests = new Map<string, Bests>();
  const out = new Map<string, number>();
  const ordered = [...workouts].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  for (const w of ordered) {
    let count = 0;
    for (const we of w.exercises) {
      const ex = exById.get(we.exerciseId);
      if (!ex) continue;
      count += prSets(we.sets, ex, bodyKg, bests.get(ex.id)).size;
      bests.set(ex.id, bestsFrom(we.sets, ex, bodyKg, bests.get(ex.id)));
    }
    out.set(w.id, count);
  }
  return out;
}

/**
 * workout.ts: what a workout is, and the set math the logger runs on every
 * tap. Pure: no storage, no React, so every number here is unit tested.
 *
 * Load is always kilograms. For bodyweight movements a set's kg is the load
 * added on top (a belt, a vest), and strength is judged on bodyweight plus
 * that load, so 10 pull ups at 80 kg bodyweight compare fairly with 6 pull
 * ups carrying 10 kg.
 */

import { todayKey } from '../log-store';
import { newId, type Exercise, type Muscle } from './exercises';

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export const SET_TYPES: { id: SetType; label: string }[] = [
  { id: 'warmup', label: 'Warmup' },
  { id: 'working', label: 'Working' },
  { id: 'drop', label: 'Drop' },
  { id: 'failure', label: 'Failure' },
];

export interface WorkSet {
  id: string;
  kg: number | null;
  reps: number | null;
  type: SetType;
  done: boolean;
  /** How hard it felt, 6 to 10, where 10 left nothing in the tank. */
  rpe?: number;
}

/** RPE choices offered on a set. */
export const RPE_CHOICES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: WorkSet[];
  note?: string;
  /** Rest after each ticked set, in seconds. 0 turns the timer off. */
  restSec?: number;
  /** The rep range a program asks for. */
  target?: { repsMin: number; repsMax: number };
}

/** Which program day a workout was, when it was one. */
export interface ProgramLink {
  programId?: string;
  /** Index of the program day. */
  programDay?: number;
}

export interface Workout extends ProgramLink {
  id: string;
  name: string;
  /** Local day it started, as a day key (see todayKey). */
  date: string;
  startedAt: string;
  endedAt: string;
  exercises: WorkoutExercise[];
  note?: string;
  /** Logged set by set in the gym, written up afterwards, or imported. */
  source: 'live' | 'described' | 'imported';
  /** Where an imported workout came from. */
  importedFrom?: 'strong' | 'hevy' | 'csv' | 'notes';
  routineId?: string;
}

/** A workout still being logged. */
export interface Session extends ProgramLink {
  id: string;
  name: string;
  /** True once the user names it, so finishing keeps their name. */
  named: boolean;
  startedAt: string;
  exercises: WorkoutExercise[];
  routineId?: string;
  /** The running rest timer: when it ends (epoch ms) and its length. */
  rest: { endsAt: number; total: number } | null;
  /** Epoch ms of the last change, to pick the newer of two copies. */
  updatedAt: number;
}

export interface Routine {
  id: string;
  name: string;
  exercises: { exerciseId: string; sets: SetType[]; restSec?: number }[];
  updatedAt: string;
}

/** Set values without the bookkeeping. */
export interface SetValues {
  kg: number | null;
  reps: number | null;
}

export const DEFAULT_REST = 90;

/** Rest choices offered on an exercise, in seconds. */
export const REST_CHOICES = [0, 45, 60, 90, 120, 180, 240, 300];

// Set math
/** Rounds to a tenth, the precision every displayed estimate uses. */
const tenth = (n: number) => Math.round(n * 10) / 10;

/**
 * Estimated one rep max (Epley). One rep is the lift itself. Above 15 reps
 * the estimate stops meaning much, so those sets don't get one.
 */
export function e1rm(kg: number, reps: number): number {
  if (!(kg > 0) || !(reps >= 1) || reps > 15) return 0;
  if (reps === 1) return tenth(kg);
  return tenth(kg * (1 + reps / 30));
}

/** The load a set moved: the bar, or bodyweight plus anything added. */
export function setLoad(
  s: SetValues,
  ex: Pick<Exercise, 'kind'>,
  bodyKg: number,
): number {
  return ex.kind === 'bodyweight' ? bodyKg + (s.kg ?? 0) : (s.kg ?? 0);
}

/** A set's strength score: the estimated max of the load it moved. */
export function setScore(
  s: SetValues,
  ex: Pick<Exercise, 'kind'>,
  bodyKg: number,
): number {
  return e1rm(setLoad(s, ex, bodyKg), s.reps ?? 0);
}

/** Done, not a warmup, with reps: a set that counts. */
export function isHard(s: WorkSet): boolean {
  return s.done && s.type !== 'warmup' && (s.reps ?? 0) > 0;
}

/** Kilograms moved in a set (logged load times reps). Warmups move none. */
export function setVolume(s: WorkSet): number {
  return isHard(s) ? (s.kg ?? 0) * (s.reps ?? 0) : 0;
}

/** True when a set has what it needs to be ticked. */
export function canTick(s: SetValues, ex: Pick<Exercise, 'kind'>): boolean {
  return (s.reps ?? 0) > 0 && (ex.kind === 'bodyweight' || s.kg != null);
}

// Formatting
/** 80 reads "80", 62.5 reads "62.5", never trailing zeros. */
export function formatKg(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}

/**
 * A set the way lifters write it: "80 × 8", "BW × 12", "BW+10 × 6", with
 * its RPE when there is one: "100 × 5 @8.5".
 */
export function setText(
  s: SetValues & { rpe?: number },
  ex: Pick<Exercise, 'kind'>,
): string {
  const reps = s.reps ?? 0;
  const base =
    ex.kind === 'bodyweight'
      ? s.kg
        ? `BW+${formatKg(s.kg)} × ${reps}`
        : `BW × ${reps}`
      : `${s.kg == null ? '0' : formatKg(s.kg)} × ${reps}`;
  return s.rpe ? `${base} @${s.rpe}` : base;
}

/** The label in a set's first column: W, D, F, or its working number. */
export function setLabel(sets: WorkSet[], index: number): string {
  const t = sets[index].type;
  if (t === 'warmup') return 'W';
  if (t === 'drop') return 'D';
  if (t === 'failure') return 'F';
  let n = 0;
  for (let i = 0; i <= index; i++) if (sets[i].type === 'working') n++;
  return String(n);
}

/** Running clock: "4:05", "32:10", "1:05:12". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** A duration for summaries: "48 min", "1 h 12 min". */
export function durationText(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** A rest length: "1:30", "45s", "Off". */
export function restText(sec: number): string {
  if (sec <= 0) return 'Off';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// History lookups
/** Workouts newest first, optionally only those before a moment. */
function newestFirst(workouts: Workout[], before?: string, skipId?: string) {
  return workouts
    .filter((w) => w.id !== skipId && (!before || w.startedAt < before))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * The sets each exercise got the last time it was done, keyed by exercise
 * id. This is what fills the PREVIOUS column and the empty inputs.
 */
export function lastSets(
  workouts: Workout[],
  before?: string,
  skipId?: string,
): Map<string, WorkSet[]> {
  const map = new Map<string, WorkSet[]>();
  for (const w of newestFirst(workouts, before, skipId)) {
    for (const we of w.exercises) {
      if (map.has(we.exerciseId)) continue;
      const done = we.sets.filter((s) => s.done && (s.reps ?? 0) > 0);
      if (done.length) map.set(we.exerciseId, done);
    }
  }
  return map;
}

const group = (s: { type: SetType }) => (s.type === 'warmup' ? 'w' : 'n');

/**
 * The previous set that lines up with this one: warmups against warmups,
 * the rest against the rest, in order.
 */
export function previousFor(
  sets: WorkSet[],
  index: number,
  previous: WorkSet[] | undefined,
): WorkSet | null {
  if (!previous?.length) return null;
  const g = group(sets[index]);
  let k = 0;
  for (let i = 0; i < index; i++) if (group(sets[i]) === g) k++;
  return previous.filter((s) => group(s) === g)[k] ?? null;
}

/**
 * What an empty input should suggest: last time's matching set, else the
 * nearest set above it today, else the last set from last time. Weight and
 * reps are looked up separately, so a half typed set above still helps.
 */
export function placeholderFor(
  sets: WorkSet[],
  index: number,
  previous: WorkSet[] | undefined,
): SetValues {
  const prev = previousFor(sets, index, previous);
  if (prev) return { kg: prev.kg, reps: prev.reps };
  const g = group(sets[index]);
  const above = sets
    .slice(0, index)
    .filter((s) => group(s) === g)
    .reverse();
  const same = previous?.filter((s) => group(s) === g) ?? [];
  const last = same[same.length - 1];
  return {
    kg: above.find((s) => s.kg != null)?.kg ?? last?.kg ?? null,
    reps: above.find((s) => s.reps != null)?.reps ?? last?.reps ?? null,
  };
}

/** A set's values with any gaps filled from its placeholder. */
export function filled(s: WorkSet, ph: SetValues): SetValues {
  return { kg: s.kg ?? ph.kg, reps: s.reps ?? ph.reps };
}

/** The best an exercise has ever done, to judge new sets against. */
export interface Bests {
  score: number;
  /** Heaviest logged load in a counted set. */
  kg: number;
  /** Most reps in a counted set. */
  reps: number;
  /** False until the exercise has at least one counted set. */
  any: boolean;
}

const NO_BESTS: Bests = { score: 0, kg: 0, reps: 0, any: false };

export function bestsFrom(
  sets: WorkSet[],
  ex: Pick<Exercise, 'kind'>,
  bodyKg: number,
  start: Bests = NO_BESTS,
): Bests {
  let b = start;
  for (const s of sets) {
    if (!isHard(s)) continue;
    b = {
      score: Math.max(b.score, setScore(s, ex, bodyKg)),
      kg: Math.max(b.kg, s.kg ?? 0),
      reps: Math.max(b.reps, s.reps ?? 0),
      any: true,
    };
  }
  return b;
}

/** Bests per exercise across history (before a moment, if given). */
export function allBests(
  workouts: Workout[],
  exById: Map<string, Exercise>,
  bodyKg: number,
  before?: string,
  skipId?: string,
): Map<string, Bests> {
  const map = new Map<string, Bests>();
  for (const w of newestFirst(workouts, before, skipId)) {
    for (const we of w.exercises) {
      const ex = exById.get(we.exerciseId);
      if (!ex) continue;
      map.set(
        we.exerciseId,
        bestsFrom(we.sets, ex, bodyKg, map.get(we.exerciseId)),
      );
    }
  }
  return map;
}

/**
 * Which sets of one exercise set a record: a better estimated max than
 * anything before, history first, then earlier sets today. A first ever
 * session sets no records; there is nothing to beat.
 */
export function prSets(
  sets: WorkSet[],
  ex: Pick<Exercise, 'kind'>,
  bodyKg: number,
  history: Bests | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!history?.any) return out;
  let best = history.score;
  for (const s of sets) {
    if (!isHard(s)) continue;
    const score = setScore(s, ex, bodyKg);
    if (score > best + 0.05) {
      out.add(s.id);
      best = score;
    }
  }
  return out;
}

// Sessions
/** "Morning workout" and friends, from the hour it started. */
export function defaultName(at: Date): string {
  const h = at.getHours();
  if (h >= 5 && h < 12) return 'Morning workout';
  if (h >= 12 && h < 17) return 'Afternoon workout';
  if (h >= 17 && h < 22) return 'Evening workout';
  return 'Night workout';
}

const PUSH: Muscle[] = ['chest', 'shoulders', 'triceps'];
const PULL: Muscle[] = ['back', 'biceps', 'forearms'];
const LEGS: Muscle[] = ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'];

/** A name from what was trained: Push, Pull, Legs, Upper body, Full body. */
export function autoName(
  exercises: WorkoutExercise[],
  exById: Map<string, Exercise>,
): string | null {
  const count = { push: 0, pull: 0, legs: 0, core: 0 };
  for (const we of exercises) {
    const m = exById.get(we.exerciseId)?.muscle;
    if (!m) continue;
    const n = we.sets.filter(isHard).length;
    if (PUSH.includes(m)) count.push += n;
    else if (PULL.includes(m)) count.pull += n;
    else if (LEGS.includes(m)) count.legs += n;
    else count.core += n;
  }
  const total = count.push + count.pull + count.legs + count.core;
  if (total === 0) return null;
  const share = (n: number) => n / total;
  if (share(count.core) >= 0.6) return 'Core';
  if (share(count.legs) >= 0.6) return 'Legs';
  if (share(count.push) >= 0.6) return 'Push';
  if (share(count.pull) >= 0.6) return 'Pull';
  if (share(count.legs) < 0.2) return 'Upper body';
  return 'Full body';
}

export function newSet(after?: WorkSet): WorkSet {
  return {
    id: newId('s_'),
    kg: null,
    reps: null,
    type: after?.type === 'drop' ? 'drop' : 'working',
    done: false,
  };
}

function blankSets(types: SetType[]): WorkSet[] {
  return types.map((type) => ({ ...newSet(), type }));
}

export function newSession(now: Date = new Date()): Session {
  return {
    id: newId('w_'),
    name: defaultName(now),
    named: false,
    startedAt: now.toISOString(),
    exercises: [],
    rest: null,
    updatedAt: now.getTime(),
  };
}

function laidOut(
  name: string,
  layout: Routine['exercises'],
  now: Date,
): Session {
  return {
    ...newSession(now),
    name,
    named: true,
    exercises: layout.map((e) => ({
      id: newId('e_'),
      exerciseId: e.exerciseId,
      restSec: e.restSec,
      sets: blankSets(e.sets.length ? e.sets : ['working']),
    })),
  };
}

/** A session laid out like a routine: same lifts, same sets, empty values. */
export function sessionFromRoutine(
  r: Routine,
  now: Date = new Date(),
): Session {
  return { ...laidOut(r.name, r.exercises, now), routineId: r.id };
}

/** Do that workout again: its layout, with last time's numbers suggested. */
export function sessionFromWorkout(
  w: Workout,
  now: Date = new Date(),
): Session {
  const s = laidOut(w.name, routineFromWorkout(w, w.name).exercises, now);
  return w.routineId ? { ...s, routineId: w.routineId } : s;
}

export function routineFromWorkout(w: Workout, name: string): Routine {
  return {
    id: w.routineId ?? newId('r_'),
    name: name.trim() || w.name,
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets.map((s) => s.type),
      restSec: e.restSec,
    })),
    updatedAt: new Date().toISOString(),
  };
}

/** New exercise blocks, three empty working sets each. */
export function exerciseBlocks(
  ids: string[],
  restFor: (id: string) => number | undefined,
): WorkoutExercise[] {
  return ids.map((exerciseId) => ({
    id: newId('e_'),
    exerciseId,
    restSec: restFor(exerciseId),
    sets: blankSets(['working', 'working', 'working']),
  }));
}

/** Sets ticked, sets in total, and kilograms moved so far. */
export function tally(exercises: WorkoutExercise[]) {
  let done = 0;
  let total = 0;
  let volume = 0;
  for (const we of exercises) {
    for (const s of we.sets) {
      total++;
      if (s.done) done++;
      volume += setVolume(s);
    }
  }
  return { done, total, volume };
}

/**
 * Ticks every unticked set that has numbers (typed, or suggested from last
 * time). Sets with nothing to go on stay as they are.
 */
export function tickRemaining(
  exercises: WorkoutExercise[],
  previous: Map<string, WorkSet[]>,
  exById: Map<string, Exercise>,
): WorkoutExercise[] {
  return exercises.map((we) => {
    const ex = exById.get(we.exerciseId);
    if (!ex) return we;
    return {
      ...we,
      sets: we.sets.map((s, i) => {
        if (s.done) return s;
        const v = filled(
          s,
          placeholderFor(we.sets, i, previous.get(we.exerciseId)),
        );
        return canTick(v, ex) ? { ...s, ...v, done: true } : s;
      }),
    };
  });
}

/** Unticked sets that tickRemaining would tick. */
export function tickable(
  exercises: WorkoutExercise[],
  previous: Map<string, WorkSet[]>,
  exById: Map<string, Exercise>,
): number {
  const before = tally(exercises).done;
  return tally(tickRemaining(exercises, previous, exById)).done - before;
}

/**
 * The finished workout: only ticked sets, only exercises that have one.
 * Null when nothing was ticked.
 */
export function finishSession(
  s: Session,
  exById: Map<string, Exercise>,
  now: Date = new Date(),
): Workout | null {
  const exercises = s.exercises
    .map((we) => ({
      ...we,
      sets: we.sets.filter((x) => x.done && (x.reps ?? 0) > 0),
    }))
    .filter((we) => we.sets.length > 0);
  if (!exercises.length) return null;
  const start = new Date(s.startedAt);
  return {
    id: s.id,
    name: s.named ? s.name : (autoName(exercises, exById) ?? s.name),
    date: todayKey(start),
    startedAt: s.startedAt,
    endedAt: now.toISOString(),
    exercises,
    source: 'live',
    ...(s.routineId ? { routineId: s.routineId } : {}),
    ...(s.programId
      ? { programId: s.programId, programDay: s.programDay }
      : {}),
  };
}

/** The numbers a finished workout card shows. */
export function workoutStats(w: Workout) {
  const t = tally(w.exercises);
  return {
    sets: w.exercises.reduce((n, we) => n + we.sets.filter(isHard).length, 0),
    volume: Math.round(t.volume),
    exercises: w.exercises.length,
    ms: Math.max(0, Date.parse(w.endedAt) - Date.parse(w.startedAt)),
  };
}

// Editing
// Small immutable updates the logger makes on every tap.

type Blocks = WorkoutExercise[];

const mapBlock = (
  blocks: Blocks,
  blockId: string,
  f: (b: WorkoutExercise) => WorkoutExercise,
): Blocks => blocks.map((b) => (b.id === blockId ? f(b) : b));

export function patchSet(
  blocks: Blocks,
  blockId: string,
  setId: string,
  patch: Partial<WorkSet>,
): Blocks {
  return mapBlock(blocks, blockId, (b) => ({
    ...b,
    sets: b.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
  }));
}

export function addSet(blocks: Blocks, blockId: string): Blocks {
  return mapBlock(blocks, blockId, (b) => ({
    ...b,
    sets: [...b.sets, newSet(b.sets[b.sets.length - 1])],
  }));
}

export function removeSet(
  blocks: Blocks,
  blockId: string,
  setId: string,
): Blocks {
  return mapBlock(blocks, blockId, (b) => ({
    ...b,
    sets: b.sets.filter((s) => s.id !== setId),
  }));
}

export function patchBlock(
  blocks: Blocks,
  blockId: string,
  patch: Partial<WorkoutExercise>,
): Blocks {
  return mapBlock(blocks, blockId, (b) => ({ ...b, ...patch }));
}

export function removeBlock(blocks: Blocks, blockId: string): Blocks {
  return blocks.filter((b) => b.id !== blockId);
}

/** Moves an exercise one place up (-1) or down (1). */
export function moveBlock(blocks: Blocks, blockId: string, by: -1 | 1): Blocks {
  const i = blocks.findIndex((b) => b.id === blockId);
  const j = i + by;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const next = [...blocks];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

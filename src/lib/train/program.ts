/**
 * program.ts: training programs (with an optional meal plan) that athletes
 * write and followers run. Pure: storage is in supabase/programs.ts.
 *
 * A program is a few named days repeated for some weeks. Following one, the
 * next day to train is the one after the last program day done, so a missed
 * day shifts the plan instead of skipping it.
 */

import { newId, type Exercise } from './exercises';
import { newSession, newSet, type Session, type Workout } from './workout';

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec?: number;
  note?: string;
}

export interface ProgramDay {
  id: string;
  name: string;
  exercises: ProgramExercise[];
}

export interface PlanMeal {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG?: number;
  fatG?: number;
}

export interface MealPlan {
  kcal: number | null;
  proteinG: number | null;
  meals: PlanMeal[];
}

export interface Program {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  authorName: string;
  description: string;
  weeks: number;
  days: ProgramDay[];
  nutrition: MealPlan | null;
  /** The author's own exercises the program uses, so followers have them. */
  exercises: Exercise[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Follow {
  id: string;
  programId: string;
  coachId: string;
  displayName: string;
  shareStats: boolean;
  stats: unknown;
  statsAt: string | null;
  startedAt: string;
}

/** Share codes avoid letters and digits that read alike (O and 0, I and 1). */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
  }
  return code;
}

/** Cleans what someone typed into a code: "abc 123" reads ABC123. */
export const cleanCode = (text: string) =>
  text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

export function newDay(index: number): ProgramDay {
  return { id: newId('d_'), name: `Day ${index + 1}`, exercises: [] };
}

export function blankProgram(authorName: string): Program {
  const now = new Date().toISOString();
  return {
    id: '',
    ownerId: '',
    code: newCode(),
    title: '',
    authorName,
    description: '',
    weeks: 8,
    days: [newDay(0)],
    nutrition: null,
    exercises: [],
    published: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const programExercise = (exerciseId: string): ProgramExercise => ({
  exerciseId,
  sets: 3,
  repsMin: 8,
  repsMax: 12,
});

/** "3 × 8 to 12", or "3 × 5" when the range is one number. */
export function prescription(pe: ProgramExercise): string {
  const reps =
    pe.repsMin === pe.repsMax
      ? `${pe.repsMin}`
      : `${pe.repsMin} to ${pe.repsMax}`;
  return `${pe.sets} × ${reps}`;
}

/** "8 to 12 reps", "5 reps". */
export function repsText(r: { repsMin: number; repsMax: number }): string {
  return r.repsMin === r.repsMax
    ? `${r.repsMin} ${r.repsMin === 1 ? 'rep' : 'reps'}`
    : `${r.repsMin} to ${r.repsMax} reps`;
}

/** What still stops a program from being saved, in plain words. */
export function programProblems(p: Program): string[] {
  const out: string[] = [];
  if (!p.title.trim()) out.push('Give it a title.');
  if (!p.days.some((d) => d.exercises.length))
    out.push('Add at least one exercise.');
  return out;
}

/** Clamps every number into range and drops empty days, ready to save. */
export function tidyProgram(p: Program, custom: Exercise[]): Program {
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(n || lo)));
  const days = p.days
    .filter((d) => d.exercises.length)
    .map((d, i) => ({
      ...d,
      name: d.name.trim() || `Day ${i + 1}`,
      exercises: d.exercises.map((e) => {
        const repsMin = clamp(e.repsMin, 1, 50);
        return {
          ...e,
          sets: clamp(e.sets, 1, 10),
          repsMin,
          repsMax: Math.max(repsMin, clamp(e.repsMax, 1, 50)),
        };
      }),
    }));
  const used = new Set(
    days.flatMap((d) => d.exercises.map((e) => e.exerciseId)),
  );
  const meals =
    p.nutrition?.meals.filter((m) => m.name.trim() && m.kcal > 0) ?? [];
  return {
    ...p,
    title: p.title.trim().slice(0, 80),
    authorName: p.authorName.trim().slice(0, 60),
    description: p.description.trim().slice(0, 2000),
    weeks: clamp(p.weeks, 1, 52),
    days,
    nutrition:
      p.nutrition && (p.nutrition.kcal || p.nutrition.proteinG || meals.length)
        ? { ...p.nutrition, meals }
        : null,
    exercises: custom.filter((e) => used.has(e.id)),
  };
}

export interface Position {
  /** Program workouts done since following. */
  done: number;
  /** The day to train next. */
  dayIndex: number;
  /** 1 based week, from workouts done. */
  week: number;
  complete: boolean;
}

/** Program workouts done since the follow started, oldest first. */
export function programWorkouts(
  workouts: Workout[],
  programId: string,
  since: string,
): Workout[] {
  const from = Date.parse(since);
  return workouts
    .filter((w) => w.programId === programId && Date.parse(w.startedAt) >= from)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Where a follower is: the next day is the one after the last day done. */
export function position(
  p: Program,
  workouts: Workout[],
  since: string,
): Position {
  const done = programWorkouts(workouts, p.id, since);
  const n = Math.max(1, p.days.length);
  const last = done[done.length - 1];
  const dayIndex = last?.programDay != null ? (last.programDay + 1) % n : 0;
  const week = Math.floor(done.length / n) + 1;
  return {
    done: done.length,
    dayIndex,
    week: Math.min(week, p.weeks),
    complete: week > p.weeks,
  };
}

/** A session laid out as a program day, with its rep ranges as targets. */
export function sessionFromProgramDay(
  p: Program,
  dayIndex: number,
  now: Date = new Date(),
): Session {
  const day = p.days[dayIndex];
  return {
    ...newSession(now),
    name: day.name,
    named: true,
    programId: p.id,
    programDay: dayIndex,
    exercises: day.exercises.map((e) => ({
      id: newId('e_'),
      exerciseId: e.exerciseId,
      restSec: e.restSec,
      target: { repsMin: e.repsMin, repsMax: e.repsMax },
      ...(e.note ? { note: e.note } : {}),
      sets: Array.from({ length: e.sets }, () => newSet()),
    })),
  };
}

/** Program days built from routines, for a quick start in the editor. */
export function dayFromRoutine(
  name: string,
  exercises: { exerciseId: string; sets: unknown[] }[],
): ProgramDay {
  return {
    id: newId('d_'),
    name,
    exercises: exercises.map((e) => ({
      ...programExercise(e.exerciseId),
      sets: Math.max(1, Math.min(10, e.sets.length || 3)),
    })),
  };
}

export const shareLink = (code: string) =>
  `https://app.getgrain.fit/program?code=${code}`;

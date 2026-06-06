/**
 * workout-store.ts — workout / activity logging (white paper §10).
 *
 * Each workout records an estimated calorie burn. The daily budget credits
 * these back (see budget.ts), so logging a session immediately raises how much
 * you can eat. Same per-day storage model as the food log.
 */

import { getJSON, kv, type KVStore, setJSON } from './kv';

export interface WorkoutEntry {
  id: string;
  label: string;
  /** Estimated kcal burned. */
  kcalBurned: number;
  /** Optional duration in minutes, for display. */
  minutes?: number;
  at: string;
}

const dayKey = (date: string) => `deficit.workout.v1.${date}`;

/** Sum kcal burned across a day's workouts. Pure. */
export function sumBurned(entries: WorkoutEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.kcalBurned || 0), 0);
}

export async function loadWorkouts(
  date: string,
  store: KVStore = kv,
): Promise<WorkoutEntry[]> {
  return (await getJSON<WorkoutEntry[]>(store, dayKey(date))) ?? [];
}

export async function addWorkout(
  date: string,
  entry: Omit<WorkoutEntry, 'id' | 'at'>,
  store: KVStore = kv,
): Promise<WorkoutEntry[]> {
  const entries = await loadWorkouts(date, store);
  const full: WorkoutEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const next = [...entries, full];
  await setJSON(store, dayKey(date), next);
  return next;
}

export async function removeWorkout(
  date: string,
  id: string,
  store: KVStore = kv,
): Promise<WorkoutEntry[]> {
  const entries = await loadWorkouts(date, store);
  const next = entries.filter((e) => e.id !== id);
  await setJSON(store, dayKey(date), next);
  return next;
}

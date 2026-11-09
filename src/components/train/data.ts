/**
 * data.ts: everything the training screens read, loaded in one go and
 * refreshed whenever a screen comes back into focus.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadProfile } from '@/lib/profile-store';
import { LIBRARY, exerciseMap, type Exercise } from '@/lib/train/exercises';
import {
  loadCustomExercises,
  loadRoutines,
  loadTrainSettings,
  loadWorkouts,
  pendingCount,
  type TrainSettings,
} from '@/lib/train/store';
import type { Routine, Workout } from '@/lib/train/workout';
import { latestWeight } from '@/lib/weight-store';

export interface Training {
  /** Oldest first. */
  workouts: Workout[];
  /** The library plus the user's own. */
  exercises: Exercise[];
  exById: Map<string, Exercise>;
  routines: Routine[];
  settings: TrainSettings;
  /** Latest weigh in, else the profile weight: the base for bodyweight lifts. */
  bodyKg: number;
  /** Changes made offline that haven't reached the account yet. */
  pending: number;
}

export async function loadTraining(): Promise<Training> {
  const [workouts, custom, routines, settings, weight, profile] =
    await Promise.all([
      loadWorkouts(),
      loadCustomExercises(),
      loadRoutines(),
      loadTrainSettings(),
      latestWeight().catch(() => null),
      loadProfile().catch(() => null),
    ]);
  const exercises = [...LIBRARY, ...custom];
  return {
    workouts,
    exercises,
    exById: exerciseMap(exercises),
    routines,
    settings,
    bodyKg: weight?.kg ?? profile?.weightKg ?? 75,
    pending: await pendingCount(),
  };
}

export function useTraining() {
  const [data, setData] = useState<Training | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadTraining().then((d) => {
        if (alive) setData(d);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const reload = useCallback(() => loadTraining().then(setData), []);
  return { data, setData, reload };
}

/** Exercise ids by when they were last done, most recent first. */
export function recentIds(workouts: Workout[]): string[] {
  const seen = new Set<string>();
  for (let i = workouts.length - 1; i >= 0; i--) {
    for (const we of workouts[i].exercises) seen.add(we.exerciseId);
  }
  return [...seen];
}

/**
 * follow.ts: the program someone follows, for the screens that show it,
 * and keeping the summary their coach sees up to date when they share it.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadCompleteDays } from '@/lib/fulldays';
import { gatherRange } from '@/lib/history';
import { todayKey } from '@/lib/log-store';
import { useAuth } from '@/lib/supabase/auth';
import {
  cachedFollowing,
  loadFollowing,
  updateFollow,
  type Following,
} from '@/lib/supabase/programs';
import { adherence, isStale, windowStart } from '@/lib/train/adherence';
import type { Exercise } from '@/lib/train/exercises';
import { sessionFromProgramDay, type Program } from '@/lib/train/program';
import { addCustomExercises, saveSession } from '@/lib/train/store';
import type { Workout } from '@/lib/train/workout';
import { loadProfile } from '@/lib/profile-store';
import { computeTargets } from '@/lib/targets';
import { loadWeights } from '@/lib/weight-store';

/** The followed program: the device copy at once, the account copy on focus. */
export function useFollowing() {
  const { enabled, session } = useAuth();
  const signedIn = enabled && !!session;
  const [following, setFollowing] = useState<Following | null>(() =>
    signedIn ? cachedFollowing() : null,
  );

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      let alive = true;
      loadFollowing()
        .then((f) => {
          if (alive) setFollowing(f);
        })
        .catch(() => {
          // Offline: the device copy stands.
        });
      return () => {
        alive = false;
      };
    }, [signedIn]),
  );

  return { following, setFollowing, signedIn };
}

/** The name Google gave the account, as a default the user can change. */
export function useAccountName(): string {
  const { session } = useAuth();
  const meta = session?.user.user_metadata as
    | { full_name?: unknown; name?: unknown }
    | undefined;
  const name = meta?.full_name ?? meta?.name;
  return typeof name === 'string' ? name.trim().slice(0, 60) : '';
}

/**
 * Whether the coach's copy of the summary is behind: never sent, older than
 * the refresh window, or older than a program workout since.
 */
export function shareDue(f: Following, workouts: Workout[]): boolean {
  if (!f.follow.shareStats) return false;
  if (isStale(f.follow.statsAt)) return true;
  const sent = Date.parse(f.follow.statsAt!);
  return workouts.some(
    (w) => w.programId === f.program.id && Date.parse(w.endedAt) > sent,
  );
}

/**
 * Starts a program day: the author's own exercises are added to the user's
 * list first (so names and history work), then the session opens.
 */
export async function startProgramDay(
  program: Program,
  dayIndex: number,
  exById: Map<string, Exercise>,
): Promise<void> {
  const missing = program.exercises.filter((e) => !exById.has(e.id));
  if (missing.length) {
    // Offline, the day still starts; names fill in once this goes through.
    await addCustomExercises(
      missing.map((e) => ({ ...e, custom: true })),
    ).catch(() => undefined);
  }
  await saveSession(sessionFromProgramDay(program, dayIndex));
  router.navigate('/workout');
}

/** Works out the summary from this device's data and sends it. */
export async function shareProgress(
  f: Following,
  workouts: Workout[],
): Promise<void> {
  const today = todayKey();
  const start = windowStart(f.follow.startedAt, today);
  const [records, weights, profile, complete] = await Promise.all([
    gatherRange(start, today),
    loadWeights(),
    loadProfile().catch(() => null),
    loadCompleteDays().catch(() => undefined),
  ]);
  const stats = adherence({
    program: f.program,
    since: f.follow.startedAt,
    workouts,
    records,
    weights,
    today,
    targetKcal: profile ? computeTargets(profile).targetKcal : null,
    complete,
  });
  await updateFollow(f.follow.id, { stats });
}

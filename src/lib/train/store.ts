/**
 * store.ts: where training data lives.
 *
 * Gyms are basements with no signal, so nothing here may depend on the
 * network to keep a set. Every change lands on the device first:
 *
 *   the workout in progress  a device copy plus a synced copy; the newer wins
 *   finished workouts        an outbox on the device, pushed to the account
 *                            whenever it can be, shown in history meanwhile
 *   history                  cached on the device after every load, so last
 *                            session's numbers are there with no signal
 *   custom exercises         kept on the device and in the account, merged
 *
 * Finished workouts are stored one key per month (deficit.workouts.v1 plus
 * the month) so saving one never rewrites years of history.
 */

import {
  deviceKey,
  getJSON,
  kv,
  localStore,
  setJSON,
  usingDeviceStore,
  type KVStore,
} from '../kv';
import { newId, type Exercise } from './exercises';
import type { Routine, Session, Workout } from './workout';

// Synced to the account (the deficit. prefix also moves local data up on
// first sign in).
const SESSION = 'deficit.session.v1';
const MONTHS = 'deficit.workouts.months.v1';
const EXERCISES = 'deficit.exercises.v1';
const ROUTINES = 'deficit.routines.v1';
const SETTINGS = 'deficit.train.v1';

// This device only, named per account.
const SESSION_DEVICE = () => deviceKey('session.v1');
const OUTBOX = () => deviceKey('outbox.v1');
const CACHE = () => deviceKey('workouts.cache.v1');
const EXERCISES_DEVICE = () => deviceKey('exercises.v1');

const monthKey = (month: string) => `deficit.workouts.v1.${month}`;
const monthOf = (date: string) => date.slice(0, 7);

/** Reads that fall back instead of throwing when the account is out of reach. */
async function safeGet<T>(store: KVStore, key: string): Promise<T | null> {
  try {
    return await getJSON<T>(store, key);
  } catch {
    return null;
  }
}

// The workout in progress
type DeviceCopy = Session | { cleared: number };

export async function loadSession(
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<Session | null> {
  const local = await safeGet<DeviceCopy>(device, SESSION_DEVICE());
  let remote = await safeGet<Session>(cloud, SESSION);
  const mine = local && 'id' in local ? local : null;
  const clearedAt = local && 'cleared' in local ? local.cleared : 0;
  if (remote && remote.updatedAt <= clearedAt) {
    // Finished or discarded on this device while the account was out of
    // reach; that synced copy is stale.
    cloud.remove(SESSION).catch(() => {});
    remote = null;
  }
  if (mine && remote) return mine.updatedAt >= remote.updatedAt ? mine : remote;
  return mine ?? remote;
}

export async function saveSession(
  s: Session,
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<void> {
  const json = JSON.stringify(s);
  await device.set(SESSION_DEVICE(), json);
  try {
    await cloud.set(SESSION, json);
  } catch {
    // The device copy holds it until the next save gets through.
  }
}

export async function clearSession(
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<void> {
  await setJSON(device, SESSION_DEVICE(), { cleared: Date.now() });
  try {
    await cloud.remove(SESSION);
  } catch {
    // loadSession ignores the stale copy and removes it later.
  }
}

// Finished workouts
type Op =
  | { id: string; op: 'put'; workout: Workout; prevDate?: string }
  | { id: string; op: 'delete'; workoutId: string; date: string };

async function putInMonth(w: Workout, store: KVStore) {
  const month = monthOf(w.date);
  const list = (await getJSON<Workout[]>(store, monthKey(month))) ?? [];
  const next = [...list.filter((x) => x.id !== w.id), w].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  await setJSON(store, monthKey(month), next);
  const months = (await getJSON<string[]>(store, MONTHS)) ?? [];
  if (!months.includes(month)) {
    await setJSON(store, MONTHS, [...months, month].sort());
  }
}

async function removeFromMonth(id: string, month: string, store: KVStore) {
  const list = (await getJSON<Workout[]>(store, monthKey(month))) ?? [];
  const next = list.filter((x) => x.id !== id);
  if (next.length === list.length) return;
  if (next.length) {
    await setJSON(store, monthKey(month), next);
    return;
  }
  await store.remove(monthKey(month));
  const months = (await getJSON<string[]>(store, MONTHS)) ?? [];
  await setJSON(
    store,
    MONTHS,
    months.filter((m) => m !== month),
  );
}

async function apply(op: Op, store: KVStore) {
  if (op.op === 'delete') {
    await removeFromMonth(op.workoutId, monthOf(op.date), store);
    return;
  }
  const w = op.workout;
  if (op.prevDate && monthOf(op.prevDate) !== monthOf(w.date)) {
    await removeFromMonth(w.id, monthOf(op.prevDate), store);
  }
  await putInMonth(w, store);
}

async function queue(op: Op, device: KVStore) {
  const ops = (await getJSON<Op[]>(device, OUTBOX())) ?? [];
  await setJSON(device, OUTBOX(), [...ops, op]);
}

/**
 * Pushes waiting changes to the account, oldest first, stopping at the
 * first that fails. Returns how many are still waiting.
 */
export async function flushOutbox(
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<number> {
  const ops = (await getJSON<Op[]>(device, OUTBOX())) ?? [];
  const sent = new Set<string>();
  for (const op of ops) {
    try {
      await apply(op, cloud);
      sent.add(op.id);
    } catch {
      break;
    }
  }
  if (sent.size) {
    const now = (await getJSON<Op[]>(device, OUTBOX())) ?? [];
    await setJSON(
      device,
      OUTBOX(),
      now.filter((op) => !sent.has(op.id)),
    );
  }
  return ops.length - sent.size;
}

/** Changes made on this device that haven't reached the account yet. */
export async function pendingCount(device: KVStore = localStore) {
  return ((await getJSON<Op[]>(device, OUTBOX())) ?? []).length;
}

/** Every finished workout, oldest first, including ones still waiting to sync. */
export async function loadWorkouts(
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<Workout[]> {
  await flushOutbox(cloud, device);
  // Without an account the history already lives on the device.
  const cache = !(cloud === kv && usingDeviceStore());
  let synced: Workout[] | null = null;
  try {
    const months = (await getJSON<string[]>(cloud, MONTHS)) ?? [];
    const lists = await Promise.all(
      months.map((m) => getJSON<Workout[]>(cloud, monthKey(m))),
    );
    synced = lists.flatMap((list) => list ?? []);
    if (cache) await setJSON(device, CACHE(), synced);
  } catch {
    // Out of reach: history is what this device saw last.
    synced = cache ? await safeGet<Workout[]>(device, CACHE()) : null;
  }
  const byId = new Map<string, Workout>();
  for (const w of synced ?? []) byId.set(w.id, w);
  for (const op of (await getJSON<Op[]>(device, OUTBOX())) ?? []) {
    if (op.op === 'put') byId.set(op.workout.id, op.workout);
    else byId.delete(op.workoutId);
  }
  return [...byId.values()].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
}

/** Saves a finished or edited workout. Pass the old date if it moved. */
export async function saveWorkout(
  w: Workout,
  prevDate?: string,
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<void> {
  await queue({ id: newId('op_'), op: 'put', workout: w, prevDate }, device);
  await flushOutbox(cloud, device);
}

export async function deleteWorkout(
  w: Pick<Workout, 'id' | 'date'>,
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<void> {
  await queue(
    { id: newId('op_'), op: 'delete', workoutId: w.id, date: w.date },
    device,
  );
  await flushOutbox(cloud, device);
}

/**
 * Saves many workouts at once, for an import: one read and one write per
 * month, the month index first so nothing written goes missing. Needs the
 * account to be reachable and throws if it isn't; an import can simply be
 * run again, since workout ids make it update rather than double.
 */
export async function importWorkouts(
  list: Workout[],
  onProgress?: (done: number, total: number) => void,
  cloud: KVStore = kv,
): Promise<void> {
  const byMonth = new Map<string, Workout[]>();
  for (const w of list) {
    const m = monthOf(w.date);
    byMonth.set(m, [...(byMonth.get(m) ?? []), w]);
  }
  const months = (await getJSON<string[]>(cloud, MONTHS)) ?? [];
  await setJSON(
    cloud,
    MONTHS,
    [...new Set([...months, ...byMonth.keys()])].sort(),
  );
  let done = 0;
  for (const [month, items] of byMonth) {
    const existing = (await getJSON<Workout[]>(cloud, monthKey(month))) ?? [];
    const merged = new Map(existing.map((w) => [w.id, w]));
    for (const w of items) merged.set(w.id, w);
    await setJSON(
      cloud,
      monthKey(month),
      [...merged.values()].sort((a, b) =>
        a.startedAt.localeCompare(b.startedAt),
      ),
    );
    done += items.length;
    onProgress?.(done, list.length);
  }
}

// Custom exercises
export async function loadCustomExercises(
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<Exercise[]> {
  const mine = (await safeGet<Exercise[]>(device, EXERCISES_DEVICE())) ?? [];
  let synced: Exercise[] | null = null;
  try {
    synced = (await getJSON<Exercise[]>(cloud, EXERCISES)) ?? [];
  } catch {
    // Out of reach: this device's list is all there is for now.
  }
  const byId = new Map<string, Exercise>();
  for (const e of [...(synced ?? []), ...mine]) byId.set(e.id, e);
  const all = [...byId.values()];
  // One made while out of reach goes up the next time the account answers.
  if (synced && all.length > synced.length) {
    setJSON(cloud, EXERCISES, all).catch(() => {});
  }
  return all;
}

export async function addCustomExercise(
  ex: Exercise,
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<Exercise[]> {
  return addCustomExercises([ex], cloud, device);
}

/** Adds several at once; ones already there (same id) are kept as they are. */
export async function addCustomExercises(
  list: Exercise[],
  cloud: KVStore = kv,
  device: KVStore = localStore,
): Promise<Exercise[]> {
  const current = await loadCustomExercises(cloud, device);
  const known = new Set(current.map((e) => e.id));
  const all = [...current, ...list.filter((e) => !known.has(e.id))];
  await setJSON(device, EXERCISES_DEVICE(), all);
  try {
    await setJSON(cloud, EXERCISES, all);
  } catch {
    // Merged up later by loadCustomExercises.
  }
  return all;
}

// Routines
export async function loadRoutines(store: KVStore = kv): Promise<Routine[]> {
  return (await safeGet<Routine[]>(store, ROUTINES)) ?? [];
}

export async function saveRoutine(
  r: Routine,
  store: KVStore = kv,
): Promise<Routine[]> {
  const list = (await getJSON<Routine[]>(store, ROUTINES)) ?? [];
  const next = [...list.filter((x) => x.id !== r.id), r];
  await setJSON(store, ROUTINES, next);
  return next;
}

export async function deleteRoutine(
  id: string,
  store: KVStore = kv,
): Promise<Routine[]> {
  const list = (await getJSON<Routine[]>(store, ROUTINES)) ?? [];
  const next = list.filter((x) => x.id !== id);
  await setJSON(store, ROUTINES, next);
  return next;
}

// Settings
export interface TrainSettings {
  /** Rest per exercise, remembered from the last time it was changed. */
  rest: Record<string, number>;
}

export async function loadTrainSettings(
  store: KVStore = kv,
): Promise<TrainSettings> {
  return (await safeGet<TrainSettings>(store, SETTINGS)) ?? { rest: {} };
}

export async function rememberRest(
  exerciseId: string,
  sec: number,
  store: KVStore = kv,
): Promise<void> {
  const s = await loadTrainSettings(store);
  try {
    await setJSON(store, SETTINGS, {
      ...s,
      rest: { ...s.rest, [exerciseId]: sec },
    });
  } catch {
    // A preference; the next change tries again.
  }
}

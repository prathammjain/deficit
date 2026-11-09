import { createMemoryStore, getJSON, type KVStore } from '../kv';
import { customExercise } from './exercises';
import {
  addCustomExercise,
  clearSession,
  deleteRoutine,
  deleteWorkout,
  flushOutbox,
  loadCustomExercises,
  loadRoutines,
  loadSession,
  loadTrainSettings,
  loadWorkouts,
  pendingCount,
  rememberRest,
  saveRoutine,
  saveSession,
  saveWorkout,
} from './store';
import { newSession, type Routine, type Workout } from './workout';

/** A store that can lose its connection, like the account in a basement gym. */
function flaky() {
  const inner = createMemoryStore();
  const state = { down: false };
  const guard = () => {
    if (state.down) throw new Error('offline');
  };
  const store: KVStore = {
    async get(k) {
      guard();
      return inner.get(k);
    },
    async set(k, v) {
      guard();
      return inner.set(k, v);
    },
    async remove(k) {
      guard();
      return inner.remove(k);
    },
  };
  return { store, state };
}

const workout = (id: string, date: string, hour = 8): Workout => ({
  id,
  name: id,
  date,
  startedAt: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`,
  endedAt: `${date}T${String(hour + 1).padStart(2, '0')}:00:00.000Z`,
  exercises: [
    {
      id: `${id}e`,
      exerciseId: 'squat',
      sets: [{ id: `${id}s`, kg: 100, reps: 5, type: 'working', done: true }],
    },
  ],
  source: 'live',
});

describe('the workout in progress', () => {
  it('keeps a device copy and a synced copy', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    const s = newSession(new Date(2026, 10, 9, 7));
    await saveSession(s, cloud.store, device);
    expect((await loadSession(cloud.store, device))?.id).toBe(s.id);
    expect(await getJSON(cloud.store, 'deficit.session.v1')).toEqual(s);
  });

  it('never loses a set when the account is out of reach', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    cloud.state.down = true;
    const s = { ...newSession(), name: 'Basement' };
    await expect(saveSession(s, cloud.store, device)).resolves.toBeUndefined();
    expect((await loadSession(cloud.store, device))?.name).toBe('Basement');
  });

  it('takes the newer of the two copies', async () => {
    const cloud = flaky();
    const phone = createMemoryStore();
    const laptop = createMemoryStore();
    const s = { ...newSession(), updatedAt: 1000 };
    await saveSession(s, cloud.store, phone);
    await saveSession(
      { ...s, name: 'Later', updatedAt: 2000 },
      cloud.store,
      laptop,
    );
    expect((await loadSession(cloud.store, phone))?.name).toBe('Later');
  });

  it('stays cleared even if the synced copy could not be removed', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    const s = { ...newSession(), updatedAt: Date.now() - 1000 };
    await saveSession(s, cloud.store, device);
    cloud.state.down = true;
    await clearSession(cloud.store, device);
    cloud.state.down = false;
    expect(await loadSession(cloud.store, device)).toBeNull();
    // A workout started later somewhere else still shows up.
    const next = { ...newSession(), updatedAt: Date.now() + 1000 };
    await saveSession(next, cloud.store, createMemoryStore());
    expect((await loadSession(cloud.store, device))?.id).toBe(next.id);
  });
});

describe('finished workouts', () => {
  it('stores one key per month and lists everything oldest first', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    await saveWorkout(
      workout('b', '2026-11-04'),
      undefined,
      cloud.store,
      device,
    );
    await saveWorkout(
      workout('a', '2026-10-30'),
      undefined,
      cloud.store,
      device,
    );
    await saveWorkout(
      workout('c', '2026-11-04', 18),
      undefined,
      cloud.store,
      device,
    );
    expect(await getJSON(cloud.store, 'deficit.workouts.months.v1')).toEqual([
      '2026-10',
      '2026-11',
    ]);
    const all = await loadWorkouts(cloud.store, device);
    expect(all.map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves an edited workout to its new month and drops empty months', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    const w = workout('a', '2026-10-30');
    await saveWorkout(w, undefined, cloud.store, device);
    await saveWorkout(
      { ...w, date: '2026-11-01' },
      w.date,
      cloud.store,
      device,
    );
    expect(
      await getJSON(cloud.store, 'deficit.workouts.v1.2026-10'),
    ).toBeNull();
    expect(await getJSON(cloud.store, 'deficit.workouts.months.v1')).toEqual([
      '2026-11',
    ]);
    await deleteWorkout({ id: 'a', date: '2026-11-01' }, cloud.store, device);
    expect(await loadWorkouts(cloud.store, device)).toEqual([]);
  });

  it('queues workouts finished offline and syncs them later', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    cloud.state.down = true;
    await saveWorkout(
      workout('a', '2026-11-09'),
      undefined,
      cloud.store,
      device,
    );
    expect(await pendingCount(device)).toBe(1);
    expect((await loadWorkouts(cloud.store, device)).map((w) => w.id)).toEqual([
      'a',
    ]);
    cloud.state.down = false;
    expect(await flushOutbox(cloud.store, device)).toBe(0);
    expect(await pendingCount(device)).toBe(0);
    expect(
      (
        await getJSON<Workout[]>(cloud.store, 'deficit.workouts.v1.2026-11')
      )?.[0].id,
    ).toBe('a');
  });

  it('keeps last time’s numbers on the device for training offline', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    await saveWorkout(
      workout('a', '2026-11-02'),
      undefined,
      cloud.store,
      device,
    );
    await loadWorkouts(cloud.store, device);
    cloud.state.down = true;
    await deleteWorkout({ id: 'a', date: '2026-11-02' }, cloud.store, device);
    await saveWorkout(
      workout('b', '2026-11-09'),
      undefined,
      cloud.store,
      device,
    );
    // History is the cache, minus the delete, plus the new one.
    expect((await loadWorkouts(cloud.store, device)).map((w) => w.id)).toEqual([
      'b',
    ]);
    cloud.state.down = false;
    expect((await loadWorkouts(cloud.store, device)).map((w) => w.id)).toEqual([
      'b',
    ]);
  });
});

describe('custom exercises', () => {
  it('keeps ones made offline and merges them up later', async () => {
    const cloud = flaky();
    const device = createMemoryStore();
    const sled = customExercise('sled push', 'quads', 'weighted');
    cloud.state.down = true;
    await addCustomExercise(sled, cloud.store, device);
    expect(
      (await loadCustomExercises(cloud.store, device)).map((e) => e.id),
    ).toEqual([sled.id]);
    cloud.state.down = false;
    await loadCustomExercises(cloud.store, device);
    await new Promise((r) => setTimeout(r, 0));
    expect(await getJSON(cloud.store, 'deficit.exercises.v1')).toEqual([sled]);
  });
});

describe('routines and settings', () => {
  it('saves, replaces and deletes routines', async () => {
    const store = createMemoryStore();
    const r: Routine = {
      id: 'r1',
      name: 'Push',
      exercises: [{ exerciseId: 'bench_press', sets: ['working', 'working'] }],
      updatedAt: '2026-11-09T00:00:00.000Z',
    };
    await saveRoutine(r, store);
    await saveRoutine({ ...r, name: 'Push A' }, store);
    expect((await loadRoutines(store)).map((x) => x.name)).toEqual(['Push A']);
    expect(await deleteRoutine('r1', store)).toEqual([]);
  });

  it('remembers rest per exercise', async () => {
    const store = createMemoryStore();
    await rememberRest('squat', 180, store);
    await rememberRest('bench_press', 120, store);
    expect(await loadTrainSettings(store)).toEqual({
      rest: { squat: 180, bench_press: 120 },
    });
  });
});

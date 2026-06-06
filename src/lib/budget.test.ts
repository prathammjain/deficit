import { computeBudget, macroProgress } from './budget';
import { createMemoryStore } from './kv';
import {
  addWorkout,
  loadWorkouts,
  removeWorkout,
  sumBurned,
  type WorkoutEntry,
} from './workout-store';

describe('computeBudget', () => {
  it('remaining = target − consumed when no workouts', () => {
    const b = computeBudget({ targetKcal: 2287, consumedKcal: 1800 });
    expect(b.remainingKcal).toBe(487);
    expect(b.adjustedTargetKcal).toBe(2287);
    expect(b.isOver).toBe(false);
  });

  it('credits workouts back into the ceiling (the "adjust" behaviour)', () => {
    const b = computeBudget({
      targetKcal: 2000,
      consumedKcal: 1800,
      burnedKcal: 400,
    });
    expect(b.adjustedTargetKcal).toBe(2400);
    expect(b.remainingKcal).toBe(600);
  });

  it('honours a partial eat-back factor', () => {
    const b = computeBudget({
      targetKcal: 2000,
      consumedKcal: 0,
      burnedKcal: 500,
      eatBackFactor: 0.5,
    });
    expect(b.creditedBurnKcal).toBe(250);
    expect(b.adjustedTargetKcal).toBe(2250);
  });

  it('flags going over budget', () => {
    const b = computeBudget({ targetKcal: 2000, consumedKcal: 2300 });
    expect(b.remainingKcal).toBe(-300);
    expect(b.isOver).toBe(true);
    expect(b.fraction).toBe(1);
  });

  it('never divides by zero', () => {
    const b = computeBudget({ targetKcal: 0, consumedKcal: 0, burnedKcal: 0 });
    expect(b.fraction).toBe(0);
    expect(b.remainingKcal).toBe(0);
  });
});

describe('macroProgress', () => {
  it('tracks consumed vs target protein', () => {
    const p = macroProgress(90, 153);
    expect(p.remainingG).toBe(63);
    expect(p.fraction).toBeCloseTo(0.588, 2);
  });
});

describe('workout-store', () => {
  it('sums burned calories', () => {
    const entries: WorkoutEntry[] = [
      { id: '1', label: 'Run', kcalBurned: 300, at: '' },
      { id: '2', label: 'Lift', kcalBurned: 150, at: '' },
    ];
    expect(sumBurned(entries)).toBe(450);
  });

  it('adds and removes workouts per day', async () => {
    const s = createMemoryStore();
    const date = '2026-06-06';
    await addWorkout(date, { label: 'Run', kcalBurned: 300, minutes: 30 }, s);
    const after = await addWorkout(date, { label: 'Lift', kcalBurned: 150 }, s);
    expect(after).toHaveLength(2);
    expect(sumBurned(after)).toBe(450);

    const pruned = await removeWorkout(date, after[0].id, s);
    expect(pruned).toHaveLength(1);
    expect((await loadWorkouts(date, s))[0].label).toBe('Lift');
  });
});

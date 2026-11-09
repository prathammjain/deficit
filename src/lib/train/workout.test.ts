import { LIBRARY, exerciseMap } from './exercises';
import {
  addSet,
  allBests,
  autoName,
  canTick,
  clock,
  durationText,
  e1rm,
  finishSession,
  lastSets,
  moveBlock,
  newSession,
  patchBlock,
  patchSet,
  placeholderFor,
  previousFor,
  prSets,
  removeBlock,
  removeSet,
  restText,
  routineFromWorkout,
  sessionFromRoutine,
  sessionFromWorkout,
  setLabel,
  setScore,
  setText,
  setVolume,
  tally,
  tickable,
  tickRemaining,
  workoutStats,
  type SetType,
  type WorkSet,
  type Workout,
  type WorkoutExercise,
} from './workout';

const byId = exerciseMap(LIBRARY);
const WEIGHTED = { kind: 'weighted' as const };
const BODY = { kind: 'bodyweight' as const };

let n = 0;
const set = (
  kg: number | null,
  reps: number | null,
  type: SetType = 'working',
  done = true,
): WorkSet => ({ id: `s${n++}`, kg, reps, type, done });

const block = (exerciseId: string, sets: WorkSet[]): WorkoutExercise => ({
  id: `e${n++}`,
  exerciseId,
  sets,
});

const workout = (
  id: string,
  startedAt: string,
  exercises: WorkoutExercise[],
): Workout => ({
  id,
  name: 'Test',
  date: startedAt.slice(0, 10),
  startedAt,
  endedAt: startedAt,
  exercises,
  source: 'live',
});

describe('set math', () => {
  it('estimates a one rep max', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBe(116.7);
    expect(e1rm(100, 16)).toBe(0);
    expect(e1rm(0, 5)).toBe(0);
  });

  it('scores bodyweight sets on bodyweight plus added load', () => {
    expect(setScore({ kg: null, reps: 10 }, BODY, 80)).toBe(106.7);
    expect(setScore({ kg: 10, reps: 6 }, BODY, 80)).toBe(108);
    expect(setScore({ kg: 100, reps: 5 }, WEIGHTED, 80)).toBe(116.7);
  });

  it('counts volume on ticked, non warmup sets only', () => {
    expect(setVolume(set(80, 8))).toBe(640);
    expect(setVolume(set(60, 10, 'warmup'))).toBe(0);
    expect(setVolume(set(80, 8, 'working', false))).toBe(0);
  });

  it('knows when a set can be ticked', () => {
    expect(canTick({ kg: 80, reps: 8 }, WEIGHTED)).toBe(true);
    expect(canTick({ kg: null, reps: 8 }, WEIGHTED)).toBe(false);
    expect(canTick({ kg: null, reps: 8 }, BODY)).toBe(true);
    expect(canTick({ kg: 80, reps: 0 }, WEIGHTED)).toBe(false);
  });
});

describe('formatting', () => {
  it('writes sets the way lifters do', () => {
    expect(setText({ kg: 80, reps: 8 }, WEIGHTED)).toBe('80 × 8');
    expect(setText({ kg: 62.5, reps: 10 }, WEIGHTED)).toBe('62.5 × 10');
    expect(setText({ kg: null, reps: 12 }, BODY)).toBe('BW × 12');
    expect(setText({ kg: 10, reps: 6 }, BODY)).toBe('BW+10 × 6');
    expect(setText({ kg: 100, reps: 5, rpe: 8.5 }, WEIGHTED)).toBe(
      '100 × 5 @8.5',
    );
  });

  it('labels sets W, D, F or by working number', () => {
    const sets = [
      set(40, 10, 'warmup'),
      set(80, 8),
      set(80, 8),
      set(60, 10, 'drop'),
      set(80, 5, 'failure'),
      set(80, 8),
    ];
    expect(sets.map((_, i) => setLabel(sets, i))).toEqual([
      'W',
      '1',
      '2',
      'D',
      'F',
      '3',
    ]);
  });

  it('formats clocks, durations and rests', () => {
    expect(clock(65_000)).toBe('1:05');
    expect(clock(3_725_000)).toBe('1:02:05');
    expect(durationText(48 * 60_000)).toBe('48 min');
    expect(durationText(72 * 60_000)).toBe('1 h 12 min');
    expect(durationText(120 * 60_000)).toBe('2 h');
    expect(restText(90)).toBe('1:30');
    expect(restText(45)).toBe('45s');
    expect(restText(0)).toBe('Off');
  });
});

describe('previous numbers', () => {
  const older = workout('a', '2026-11-01T08:00:00.000Z', [
    block('bench_press', [set(75, 8), set(75, 8)]),
  ]);
  const newer = workout('b', '2026-11-04T08:00:00.000Z', [
    block('bench_press', [
      set(40, 10, 'warmup'),
      set(80, 8),
      set(80, 7),
      set(80, 6, 'working', false),
    ]),
  ]);

  it('takes the newest ticked sets per exercise', () => {
    const last = lastSets([older, newer]).get('bench_press');
    expect(last?.map((s) => s.kg)).toEqual([40, 80, 80]);
  });

  it('can look only before a moment, or skip a workout', () => {
    expect(
      lastSets([older, newer], '2026-11-03T00:00:00.000Z')
        .get('bench_press')
        ?.map((s) => s.kg),
    ).toEqual([75, 75]);
    expect(
      lastSets([older, newer], undefined, 'b')
        .get('bench_press')
        ?.map((s) => s.kg),
    ).toEqual([75, 75]);
  });

  it('lines warmups up with warmups', () => {
    const prev = lastSets([newer]).get('bench_press');
    const today = [set(null, null, 'working', false)];
    expect(previousFor(today, 0, prev)?.kg).toBe(80);
    const withWarmup = [
      set(null, null, 'warmup', false),
      set(null, null, 'working', false),
    ];
    expect(previousFor(withWarmup, 0, prev)?.kg).toBe(40);
    expect(previousFor(withWarmup, 1, prev)?.reps).toBe(8);
  });

  it('suggests last time, then the set above, then last time again', () => {
    const prev = [set(80, 8), set(80, 7)];
    const today = [
      set(85, 6, 'working', false),
      set(null, null, 'working', false),
      set(null, null, 'working', false),
    ];
    expect(placeholderFor(today, 1, prev)).toEqual({ kg: 80, reps: 7 });
    // Nothing lines up with the third set: use the nearest one typed above.
    expect(placeholderFor(today, 2, prev)).toEqual({ kg: 85, reps: 6 });
    // Weight and reps are found separately.
    const typed = [
      set(85, 6, 'working', false),
      set(87.5, null, 'working', false),
      set(null, null, 'working', false),
    ];
    expect(placeholderFor(typed, 2, prev)).toEqual({ kg: 87.5, reps: 6 });
    // No history at all: copy the set above.
    expect(placeholderFor(today, 1, undefined)).toEqual({ kg: 85, reps: 6 });
  });
});

describe('records', () => {
  const ex = byId.get('bench_press')!;
  const history = [
    workout('a', '2026-11-01T08:00:00.000Z', [
      block('bench_press', [set(80, 8), set(100, 1)]),
    ]),
  ];

  it('collects the best score, load and reps', () => {
    const b = allBests(history, byId, 80).get('bench_press');
    expect(b).toEqual({ score: 101.3, kg: 100, reps: 8, any: true });
  });

  it('flags sets that beat history, then each other', () => {
    const b = allBests(history, byId, 80).get('bench_press');
    const today = [set(80, 8), set(85, 6), set(87.5, 6), set(85, 5)];
    const prs = prSets(today, ex, 80, b);
    expect([...prs]).toEqual([today[1].id, today[2].id]);
  });

  it('sets no records the first time', () => {
    expect(prSets([set(80, 8)], ex, 80, undefined).size).toBe(0);
  });
});

describe('naming', () => {
  const w = (ids: string[]) => ids.map((id) => block(id, [set(50, 10)]));
  it('names a workout from what was trained', () => {
    expect(autoName(w(['bench_press', 'ohp', 'tricep_pushdown']), byId)).toBe(
      'Push',
    );
    expect(autoName(w(['pull_up', 'barbell_row', 'db_curl']), byId)).toBe(
      'Pull',
    );
    expect(autoName(w(['squat', 'rdl', 'leg_press']), byId)).toBe('Legs');
    expect(autoName(w(['bench_press', 'barbell_row']), byId)).toBe(
      'Upper body',
    );
    expect(autoName(w(['squat', 'bench_press', 'barbell_row']), byId)).toBe(
      'Full body',
    );
    expect(autoName(w(['cable_crunch', 'hanging_leg_raise']), byId)).toBe(
      'Core',
    );
    expect(autoName([], byId)).toBeNull();
  });
});

describe('sessions', () => {
  const start = new Date(2026, 10, 9, 7, 30);

  it('finishes into a workout of ticked sets only', () => {
    const s = {
      ...newSession(start),
      exercises: [
        block('bench_press', [set(80, 8), set(80, null, 'working', false)]),
        block('ohp', [set(null, null, 'working', false)]),
      ],
    };
    expect(s.name).toBe('Morning workout');
    const w = finishSession(s, byId, new Date(2026, 10, 9, 8, 30))!;
    expect(w.exercises).toHaveLength(1);
    expect(w.exercises[0].sets).toHaveLength(1);
    expect(w.name).toBe('Push');
    expect(w.date).toBe('2026-11-09');
    expect(workoutStats(w)).toEqual({
      sets: 1,
      volume: 640,
      exercises: 1,
      ms: 3_600_000,
    });
  });

  it('keeps a name the user chose', () => {
    const s = {
      ...newSession(start),
      name: 'Heavy day',
      named: true,
      exercises: [block('squat', [set(100, 5)])],
    };
    expect(finishSession(s, byId)?.name).toBe('Heavy day');
  });

  it('returns null when nothing was ticked', () => {
    const s = {
      ...newSession(start),
      exercises: [block('squat', [set(100, 5, 'working', false)])],
    };
    expect(finishSession(s, byId)).toBeNull();
  });

  it('ticks what it can from typed or suggested numbers', () => {
    const exercises = [
      block('bench_press', [
        set(80, 8),
        set(null, null, 'working', false),
        set(82.5, null, 'working', false),
      ]),
      block('lateral_raise', [set(null, null, 'working', false)]),
    ];
    const prev = new Map([
      ['bench_press', [set(80, 8), set(80, 8), set(80, 6)]],
    ]);
    expect(tickable(exercises, prev, byId)).toBe(2);
    const after = tickRemaining(exercises, prev, byId);
    expect(after[0].sets.map((s) => [s.kg, s.reps, s.done])).toEqual([
      [80, 8, true],
      [80, 8, true],
      [82.5, 6, true],
    ]);
    expect(after[1].sets[0].done).toBe(false);
    expect(tally(after)).toEqual({ done: 3, total: 4, volume: 1775 });
  });

  it('lays a session out from a routine or a past workout', () => {
    const past = {
      ...workout('p', '2026-11-02T08:00:00.000Z', [
        block('squat', [set(60, 5, 'warmup'), set(100, 5), set(100, 5)]),
      ]),
      name: 'Legs',
    };
    const again = sessionFromWorkout(past, start);
    expect(again.name).toBe('Legs');
    expect(again.named).toBe(true);
    expect(again.routineId).toBeUndefined();
    expect(again.exercises[0].sets.map((s) => [s.type, s.kg, s.done])).toEqual([
      ['warmup', null, false],
      ['working', null, false],
      ['working', null, false],
    ]);

    const routine = routineFromWorkout(past, ' Leg day ');
    expect(routine.name).toBe('Leg day');
    const s = sessionFromRoutine(routine, start);
    expect(s.routineId).toBe(routine.id);
    expect(s.exercises[0].sets).toHaveLength(3);
  });
});

describe('editing', () => {
  const blocks = () => [
    block('bench_press', [set(80, 8), set(80, 8, 'drop', false)]),
    block('ohp', [set(50, 8)]),
    block('squat', [set(100, 5)]),
  ];

  it('patches, adds and removes sets', () => {
    const b = blocks();
    const id = b[0].id;
    const patched = patchSet(b, id, b[0].sets[0].id, { kg: 82.5 });
    expect(patched[0].sets[0].kg).toBe(82.5);
    expect(b[0].sets[0].kg).toBe(80);
    const added = addSet(b, id);
    expect(added[0].sets).toHaveLength(3);
    // A set added after a drop set is another drop set.
    expect(added[0].sets[2]).toMatchObject({
      type: 'drop',
      kg: null,
      done: false,
    });
    expect(removeSet(b, id, b[0].sets[1].id)[0].sets).toHaveLength(1);
  });

  it('moves, patches and removes exercises', () => {
    const b = blocks();
    const ids = (x: WorkoutExercise[]) => x.map((e) => e.exerciseId);
    expect(ids(moveBlock(b, b[1].id, -1))).toEqual([
      'ohp',
      'bench_press',
      'squat',
    ]);
    expect(ids(moveBlock(b, b[2].id, 1))).toEqual([
      'bench_press',
      'ohp',
      'squat',
    ]);
    expect(patchBlock(b, b[2].id, { restSec: 180 })[2].restSec).toBe(180);
    expect(ids(removeBlock(b, b[0].id))).toEqual(['ohp', 'squat']);
  });
});

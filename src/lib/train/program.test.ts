import type { Exercise } from './exercises';
import {
  blankProgram,
  cleanCode,
  dayFromRoutine,
  newCode,
  position,
  prescription,
  programExercise,
  programProblems,
  repsText,
  sessionFromProgramDay,
  tidyProgram,
  type Program,
} from './program';
import type { Workout } from './workout';

function program(over: Partial<Program> = {}): Program {
  return {
    ...blankProgram('Aarav'),
    id: 'p1',
    title: 'Push Pull Legs',
    weeks: 2,
    days: [
      { id: 'd1', name: 'Push', exercises: [programExercise('bench_press')] },
      { id: 'd2', name: 'Pull', exercises: [programExercise('barbell_row')] },
      { id: 'd3', name: 'Legs', exercises: [programExercise('squat')] },
    ],
    ...over,
  };
}

function done(day: number, startedAt: string, programId = 'p1'): Workout {
  return {
    id: `w_${startedAt}`,
    name: 'x',
    date: startedAt.slice(0, 10),
    startedAt,
    endedAt: startedAt,
    exercises: [],
    source: 'live',
    programId,
    programDay: day,
  };
}

const SINCE = '2026-11-01T00:00:00.000Z';

describe('codes', () => {
  it('makes six characters with no look alike letters', () => {
    const code = newCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(newCode(() => 0)).toBe('AAAAAA');
    expect(newCode(() => 0.999)).toBe('999999');
  });

  it('cleans what someone typed', () => {
    expect(cleanCode(' abc 12x9 ')).toBe('ABC12X');
    expect(cleanCode('ab-cd')).toBe('ABCD');
  });
});

describe('words', () => {
  it('says the prescription plainly', () => {
    expect(
      prescription({
        ...programExercise('squat'),
        sets: 5,
        repsMin: 5,
        repsMax: 5,
      }),
    ).toBe('5 × 5');
    expect(prescription(programExercise('squat'))).toBe('3 × 8 to 12');
    expect(repsText({ repsMin: 1, repsMax: 1 })).toBe('1 rep');
    expect(repsText({ repsMin: 6, repsMax: 8 })).toBe('6 to 8 reps');
  });

  it('lists what stops a save', () => {
    expect(programProblems(program())).toEqual([]);
    expect(
      programProblems(
        program({ title: ' ', days: [{ id: 'd', name: 'A', exercises: [] }] }),
      ),
    ).toEqual(['Give it a title.', 'Add at least one exercise.']);
  });
});

describe('tidyProgram', () => {
  const mine: Exercise = {
    id: 'c_sled',
    name: 'Sled push',
    muscle: 'quads',
    equipment: 'other',
    kind: 'weighted',
    aliases: [],
    custom: true,
  };
  const unused: Exercise = { ...mine, id: 'c_other', name: 'Other' };

  it('clamps numbers, drops empty days and keeps only custom exercises in use', () => {
    const p = tidyProgram(
      program({
        title: '  Strength  ',
        weeks: 99,
        days: [
          {
            id: 'a',
            name: ' ',
            exercises: [
              { exerciseId: 'c_sled', sets: 40, repsMin: 12, repsMax: 6 },
            ],
          },
          { id: 'b', name: 'Empty', exercises: [] },
        ],
      }),
      [mine, unused],
    );
    expect(p.title).toBe('Strength');
    expect(p.weeks).toBe(52);
    expect(p.days).toHaveLength(1);
    expect(p.days[0].name).toBe('Day 1');
    expect(p.days[0].exercises[0]).toMatchObject({
      sets: 10,
      repsMin: 12,
      repsMax: 12,
    });
    expect(p.exercises.map((e) => e.id)).toEqual(['c_sled']);
  });

  it('keeps a meal plan only when it says something', () => {
    expect(
      tidyProgram(
        program({ nutrition: { kcal: null, proteinG: null, meals: [] } }),
        [],
      ).nutrition,
    ).toBeNull();
    const plan = tidyProgram(
      program({
        nutrition: {
          kcal: 2600,
          proteinG: 180,
          meals: [
            { id: 'm1', name: 'Oats and whey', kcal: 650, proteinG: 45 },
            { id: 'm2', name: ' ', kcal: 300, proteinG: 10 },
          ],
        },
      }),
      [],
    ).nutrition;
    expect(plan?.kcal).toBe(2600);
    expect(plan?.meals.map((m) => m.name)).toEqual(['Oats and whey']);
  });
});

describe('position', () => {
  it('starts on day one, week one', () => {
    expect(position(program(), [], SINCE)).toEqual({
      done: 0,
      dayIndex: 0,
      week: 1,
      complete: false,
    });
  });

  it('moves to the day after the last one done, so a missed day shifts the plan', () => {
    const ws = [
      done(0, '2026-11-02T09:00:00.000Z'),
      done(1, '2026-11-04T09:00:00.000Z'),
    ];
    expect(position(program(), ws, SINCE)).toMatchObject({
      done: 2,
      dayIndex: 2,
      week: 1,
    });
  });

  it('follows the day actually trained when someone picks another', () => {
    const ws = [done(2, '2026-11-02T09:00:00.000Z')];
    expect(position(program(), ws, SINCE).dayIndex).toBe(0);
  });

  it('counts weeks in rounds of the program days and ends after the last week', () => {
    const ws = [0, 1, 2].map((d, i) =>
      done(d, `2026-11-0${i + 2}T09:00:00.000Z`),
    );
    expect(position(program(), ws, SINCE)).toMatchObject({
      week: 2,
      dayIndex: 0,
      complete: false,
    });
    const all = [0, 1, 2, 0, 1, 2].map((d, i) =>
      done(d, `2026-11-0${i + 2}T09:00:00.000Z`),
    );
    expect(position(program(), all, SINCE)).toMatchObject({
      week: 2,
      complete: true,
    });
  });

  it('ignores other programs and anything before following', () => {
    const ws = [
      done(0, '2026-10-30T09:00:00.000Z'),
      done(0, '2026-11-02T09:00:00.000Z', 'other'),
      { ...done(0, '2026-11-03T09:00:00.000Z'), programId: undefined },
    ];
    expect(position(program(), ws, SINCE).done).toBe(0);
  });

  it('compares times, not text, so database timestamps work', () => {
    const ws = [done(0, '2026-11-01T05:30:00.000Z')];
    expect(position(program(), ws, '2026-11-01T10:00:00+05:30').done).toBe(1);
  });

  it('stays in range when the author removes days', () => {
    const ws = [done(2, '2026-11-02T09:00:00.000Z')];
    const shorter = program({ days: program().days.slice(0, 2) });
    expect(position(shorter, ws, SINCE).dayIndex).toBe(1);
  });
});

describe('sessionFromProgramDay', () => {
  it('lays out the day with its sets, rep targets and program link', () => {
    const p = program({
      days: [
        {
          id: 'd1',
          name: 'Push',
          exercises: [
            {
              exerciseId: 'bench_press',
              sets: 4,
              repsMin: 6,
              repsMax: 8,
              restSec: 180,
              note: 'Pause the first rep',
            },
          ],
        },
      ],
    });
    const s = sessionFromProgramDay(p, 0, new Date('2026-11-09T09:00:00Z'));
    expect(s).toMatchObject({
      name: 'Push',
      named: true,
      programId: 'p1',
      programDay: 0,
    });
    expect(s.exercises[0]).toMatchObject({
      exerciseId: 'bench_press',
      restSec: 180,
      note: 'Pause the first rep',
      target: { repsMin: 6, repsMax: 8 },
    });
    expect(s.exercises[0].sets).toHaveLength(4);
    expect(
      s.exercises[0].sets.every((x) => !x.done && x.type === 'working'),
    ).toBe(true);
  });
});

describe('dayFromRoutine', () => {
  it('keeps the lifts and set counts', () => {
    const d = dayFromRoutine('Upper', [
      { exerciseId: 'bench_press', sets: ['warmup', 'working', 'working'] },
      { exerciseId: 'barbell_row', sets: [] },
    ]);
    expect(d.name).toBe('Upper');
    expect(d.exercises.map((e) => [e.exerciseId, e.sets])).toEqual([
      ['bench_press', 3],
      ['barbell_row', 3],
    ]);
  });
});

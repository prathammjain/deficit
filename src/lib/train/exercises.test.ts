import {
  LIBRARY,
  MUSCLES,
  customExercise,
  matchExercise,
  normalizeName,
  searchExercises,
} from './exercises';

const id = (q: string) => matchExercise(q, LIBRARY)?.id ?? null;

describe('the library', () => {
  it('has unique ids and names', () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
    expect(new Set(LIBRARY.map((e) => e.name)).size).toBe(LIBRARY.length);
  });

  it('covers every muscle group', () => {
    for (const m of MUSCLES) {
      expect(LIBRARY.some((e) => e.muscle === m.id)).toBe(true);
    }
  });

  it('never uses a dash or hyphen in a name or alias', () => {
    for (const e of LIBRARY) {
      expect(e.name).not.toMatch(/[-–—]/);
      for (const a of e.aliases) expect(a).not.toMatch(/[-–—]/);
    }
  });

  it('marks bodyweight movements', () => {
    expect(LIBRARY.find((e) => e.id === 'pull_up')?.kind).toBe('bodyweight');
    expect(LIBRARY.find((e) => e.id === 'squat')?.kind).toBe('weighted');
  });
});

describe('normalizeName', () => {
  it('folds plurals, equipment words and punctuation', () => {
    expect(normalizeName('Dumbbell Curls')).toBe('db curl');
    expect(normalizeName("Farmer's walks")).toBe('farmer walk');
    expect(normalizeName('Pull-Ups')).toBe('pull up');
    expect(normalizeName('cable crunches')).toBe('cable crunch');
    expect(normalizeName('bench presses')).toBe('bench press');
    expect(normalizeName('Calves')).toBe('calf');
    expect(normalizeName('flyes')).toBe('fly');
  });
});

describe('matchExercise', () => {
  it('reads gym shorthand', () => {
    expect(id('bench')).toBe('bench_press');
    expect(id('ohp')).toBe('ohp');
    expect(id('rdl')).toBe('rdl');
    expect(id('rdls')).toBe('rdl');
    expect(id('db bench')).toBe('db_bench_press');
    expect(id('incline db press')).toBe('incline_db_press');
    expect(id('bss')).toBe('bulgarian_split_squat');
    expect(id('cgbp')).toBe('close_grip_bench');
  });

  it('ignores spacing and plurals', () => {
    expect(id('pullups')).toBe('pull_up');
    expect(id('pull ups')).toBe('pull_up');
    expect(id('lat pull down')).toBe('lat_pulldown');
    expect(id('skullcrushers')).toBe('skull_crusher');
    expect(id('squats')).toBe('squat');
    expect(id('leg curls')).toBe('lying_leg_curl');
    expect(id('dumbbell rows')).toBe('db_row');
  });

  it('forgives small typos', () => {
    expect(id('squart')).toBe('squat');
    expect(id('dedlift')).toBe('deadlift');
    expect(id('benchpres')).toBe('bench_press');
    expect(id('laterl raise')).toBe('lateral_raise');
  });

  it('prefers the common lift on a tie', () => {
    expect(id('incline press')).toBe('incline_bench_press');
    expect(id('curls')).toBe('db_curl');
  });

  it('returns null for words that are not exercises', () => {
    expect(id('felt great today')).toBeNull();
    expect(id('')).toBeNull();
  });
});

describe('searchExercises', () => {
  it('puts the exact match first', () => {
    const names = searchExercises('bench', LIBRARY).map((e) => e.id);
    expect(names[0]).toBe('bench_press');
    expect(names).toContain('incline_bench_press');
    expect(names).toContain('bench_dip');
  });

  it('filters by muscle and sorts A to Z with no query', () => {
    const calves = searchExercises('', LIBRARY, 'calves');
    expect(calves.every((e) => e.muscle === 'calves')).toBe(true);
    const names = calves.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('finds custom exercises too', () => {
    const mine = customExercise('  sled   push ', 'quads', 'weighted');
    expect(mine.name).toBe('Sled push');
    expect(mine.custom).toBe(true);
    expect(searchExercises('sled', [...LIBRARY, mine])[0].id).toBe(mine.id);
  });
});

import { describeWorkout } from './describe';
import { LIBRARY } from './exercises';

/** The parse, flattened to ids and "kg x reps" strings for easy reading. */
function read(text: string) {
  const r = describeWorkout(text, LIBRARY);
  return {
    title: r.title,
    unread: r.unread,
    lifts: r.exercises.map((e) => ({
      id: e.exercise?.id ?? null,
      sets: e.sets.map((s) => `${s.kg ?? '_'}x${s.reps ?? '_'}`),
    })),
  };
}

const lifts = (text: string) => read(text).lifts;

describe('describeWorkout', () => {
  it('reads weight x reps lists', () => {
    expect(lifts('bench 80x8, 80x8, 85x6')).toEqual([
      { id: 'bench_press', sets: ['80x8', '80x8', '85x6'] },
    ]);
    expect(lifts('Bench press: 80 x 8  85 x 6')).toEqual([
      { id: 'bench_press', sets: ['80x8', '85x6'] },
    ]);
    expect(lifts('bench 80kg x 8, 82.5kgx6')).toEqual([
      { id: 'bench_press', sets: ['80x8', '82.5x6'] },
    ]);
  });

  it('reads sets x reps with a weight anywhere', () => {
    expect(lifts('squat 100kg 5x5')[0].sets).toEqual(Array(5).fill('100x5'));
    expect(lifts('squat 5x5 at 100')[0].sets).toEqual(Array(5).fill('100x5'));
    expect(lifts('squat 5x5 @ 100')[0].sets).toEqual(Array(5).fill('100x5'));
    expect(lifts('squat 5x5 100')[0].sets).toEqual(Array(5).fill('100x5'));
    expect(lifts('db curl 15 3x10')[0].sets).toEqual(Array(3).fill('15x10'));
  });

  it('reads weight x reps x sets', () => {
    expect(lifts('deadlift 140 x 5 x 3')).toEqual([
      { id: 'deadlift', sets: ['140x5', '140x5', '140x5'] },
    ]);
    expect(lifts('deadlift 3x5x140')[0].sets).toEqual(Array(3).fill('140x5'));
  });

  it('reads a weight then a list of reps', () => {
    expect(lifts('ohp 50 for 8, 8 and 7')).toEqual([
      { id: 'ohp', sets: ['50x8', '50x8', '50x7'] },
    ]);
    expect(lifts('incline db press 30 kg 10 10 8')).toEqual([
      { id: 'incline_db_press', sets: ['30x10', '30x10', '30x8'] },
    ]);
    expect(lifts('squats 100 5 5 5')[0].sets).toEqual([
      '100x5',
      '100x5',
      '100x5',
    ]);
    expect(lifts('lateral raise 12.5 x 15, 15, 12')[0].sets).toEqual([
      '12.5x15',
      '12.5x15',
      '12.5x12',
    ]);
  });

  it('reads sets of reps phrases', () => {
    expect(lifts('lat pulldown 3 sets of 12 at 60')).toEqual([
      { id: 'lat_pulldown', sets: ['60x12', '60x12', '60x12'] },
    ]);
    expect(lifts('leg press 4 sets 10 reps 200kg')[0].sets).toEqual(
      Array(4).fill('200x10'),
    );
    expect(lifts('rows 10 reps 3 sets at 70')[0].sets).toEqual(
      Array(3).fill('70x10'),
    );
  });

  it('reads bodyweight work, with or without added load', () => {
    expect(lifts('pull ups 3x10')).toEqual([
      { id: 'pull_up', sets: ['_x10', '_x10', '_x10'] },
    ]);
    expect(lifts('push ups 20 15 12')[0].sets).toEqual([
      '_x20',
      '_x15',
      '_x12',
    ]);
    expect(lifts('pull ups bw x 10, +10 x 6')[0].sets).toEqual([
      '_x10',
      '10x6',
    ]);
    expect(lifts('dips bodyweight 12, 10')[0].sets).toEqual(['_x12', '_x10']);
  });

  it('converts pounds', () => {
    expect(lifts('bench 225x5')[0].sets).toEqual(['225x5']);
    expect(lifts('bench 225 lb x 5')[0].sets).toEqual(['102.1x5']);
    expect(lifts('bench 225x5, 245x3 lbs')[0].sets).toEqual([
      '102.1x5',
      '111.1x3',
    ]);
  });

  it('reads several exercises, one per line or in one sentence', () => {
    const text = `Push day
1. Bench 80x8, 80x8, 85x6
2. OHP 50 for 8 8 7
3. Tricep pushdowns 3x12 at 25`;
    const r = read(text);
    expect(r.title).toBe('Push day');
    expect(r.lifts.map((l) => l.id)).toEqual([
      'bench_press',
      'ohp',
      'tricep_pushdown',
    ]);
    expect(r.lifts[2].sets).toEqual(['25x12', '25x12', '25x12']);

    expect(
      lifts('bench 80x8 and 85x6, then squats 100 for 5 5 5').map((l) => [
        l.id,
        l.sets.length,
      ]),
    ).toEqual([
      ['bench_press', 2],
      ['squat', 3],
    ]);
  });

  it('reads an exercise name on its own line above its sets', () => {
    expect(lifts('Squats\n100x5\n110x3\n120x1')).toEqual([
      { id: 'squat', sets: ['100x5', '110x3', '120x1'] },
    ]);
  });

  it('reads speech, number words included', () => {
    expect(
      lifts('squats five sets of five at a hundred kilos')[0].sets,
    ).toEqual(Array(5).fill('100x5'));
    expect(
      lifts(
        'Bench press eighty kilos for eight, eight and six. Then I did lat pulldowns three sets of twelve at sixty two point five.',
      ),
    ).toEqual([
      { id: 'bench_press', sets: ['80x8', '80x8', '80x6'] },
      { id: 'lat_pulldown', sets: ['62.5x12', '62.5x12', '62.5x12'] },
    ]);
    expect(lifts('3 sets of 10 at 60 on seated cable row')).toEqual([
      { id: 'cable_row', sets: ['60x10', '60x10', '60x10'] },
    ]);
    expect(lifts('one arm rows twenty five kilos 10 10')).toEqual([
      { id: 'db_row', sets: ['25x10', '25x10'] },
    ]);
    expect(lifts('curls twelve and a half kilos 3 by 10')[0].sets).toEqual(
      Array(3).fill('12.5x10'),
    );
  });

  it('carries on the lift before for "went up to" phrases', () => {
    expect(lifts('bench 80x8, then went up to 85 for 6')).toEqual([
      { id: 'bench_press', sets: ['80x8', '85x6'] },
    ]);
  });

  it('leaves gaps it cannot fill instead of guessing', () => {
    expect(lifts('curls 3x12')[0].sets).toEqual(['_x12', '_x12', '_x12']);
    expect(lifts('squat 100')[0].sets).toEqual(['100x_']);
  });

  it('hands back what it cannot read', () => {
    const r = read('felt strong today\nbench 80x8\ncable thingy 3x12 at 20');
    expect(r.title).toBe('Felt strong today');
    expect(r.lifts[0].id).toBe('bench_press');
    expect(r.lifts[1]).toEqual({ id: null, sets: ['20x12', '20x12', '20x12'] });
    const later = read('bench 80x8\nfelt strong today');
    expect(later.unread).toEqual(['felt strong today']);
  });

  it('caps silly set counts', () => {
    expect(lifts('squat 100 x 5 x 99')[0].sets).toHaveLength(20);
  });
});

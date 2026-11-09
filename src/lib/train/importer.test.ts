import { LIBRARY } from './exercises';
import {
  buildImport,
  dateLine,
  guessMuscle,
  importNames,
  parseCsv,
  parseDate,
  parseDuration,
  readCsv,
  readNotes,
  suggestExercise,
  suggestMappings,
} from './importer';

const id = (name: string) => suggestExercise(name, LIBRARY)?.id ?? null;

describe('parseCsv', () => {
  it('reads quotes, doubled quotes, line breaks in quotes and CRLF', () => {
    const rows = parseCsv(
      '﻿a,b,c\r\n"x, y","say ""hi""","two\nlines"\r\n,,\r\n1,2,3',
    );
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'two\nlines'],
      ['1', '2', '3'],
    ]);
  });

  it('picks semicolons when the header uses them', () => {
    expect(parseCsv('"Date";"Reps"\n"2024-01-02";"5"')).toEqual([
      ['Date', 'Reps'],
      ['2024-01-02', '5'],
    ]);
  });
});

describe('dates and durations', () => {
  const at = (d: Date | null) =>
    d &&
    `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;

  it('reads the forms exports and people use', () => {
    expect(at(parseDate('2024-11-02 18:30:00'))).toBe('2024-11-2 18:30');
    expect(at(parseDate('28 Mar 2025, 17:29'))).toBe('2025-3-28 17:29');
    expect(at(parseDate('Mar 28, 2025 5:29 PM'))).toBe('2025-3-28 17:29');
    expect(at(parseDate('28/03/2025'))).toBe('2025-3-28 12:0');
    expect(at(parseDate('03/28/2025'))).toBe('2025-3-28 12:0');
    expect(at(parseDate('5.11.26'))).toBe('2026-11-5 12:0');
    expect(parseDate('31/02/2025')).toBeNull();
    expect(parseDate('yesterday')).toBeNull();
  });

  it('reads durations', () => {
    expect(parseDuration('3900')).toBe(3900);
    expect(parseDuration('1h 5m')).toBe(3900);
    expect(parseDuration('45m')).toBe(2700);
    expect(parseDuration('1:02:00')).toBe(3720);
    expect(parseDuration('')).toBe(0);
  });
});

describe('Strong', () => {
  const current = [
    '"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"',
    '"1";"2024-11-02 18:30:00";"Legs";"3900";"Squat (Barbell)";"W";"60";"5";"";"0";"0";"";"Felt good"',
    '"1";"2024-11-02 18:30:00";"Legs";"3900";"Squat (Barbell)";"1";"100";"5";"8";"0";"0";"belt";"Felt good"',
    '"1";"2024-11-02 18:30:00";"Legs";"3900";"Squat (Barbell)";"Rest Timer";"";"";"";"0";"90";"";""',
    '"1";"2024-11-02 18:30:00";"Legs";"3900";"Squat (Barbell)";"D";"80";"8";"";"0";"0";"";""',
    '"1";"2024-11-02 18:30:00";"Legs";"3900";"Running";"1";"";"";"";"2000";"600";"";""',
    '"2";"2024-11-04 07:00:00";"Push";"3000";"Bench Press (Dumbbell)";"1";"30";"10";"";"0";"0";"";""',
  ].join('\n');

  it('reads the current semicolon export', () => {
    const r = readCsv(current)!;
    expect(r.source).toBe('strong');
    expect(r.unit).toBe('kg');
    expect(r.skipped).toBe(2);
    expect(r.workouts).toHaveLength(2);
    const legs = r.workouts[0];
    expect(legs.title).toBe('Legs');
    expect(legs.note).toBe('Felt good');
    expect((legs.endedAt.getTime() - legs.startedAt.getTime()) / 60000).toBe(
      65,
    );
    expect(legs.exercises[0].sets).toEqual([
      { kg: 60, reps: 5, type: 'warmup' },
      { kg: 100, reps: 5, type: 'working', rpe: 8 },
      { kg: 80, reps: 8, type: 'drop' },
    ]);
    expect(legs.exercises[0].note).toBe('belt');
  });

  it('reads the older comma export, in pounds when asked', () => {
    const older = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      '2023-01-02 18:30:00,Evening,1h 5m,Bench Press (Barbell),1,225,5,0,0,,,',
    ].join('\n');
    const kg = readCsv(older)!;
    expect(kg.unit).toBe('unknown');
    expect(kg.workouts[0].exercises[0].sets[0].kg).toBe(225);
    const lb = readCsv(older, 'lb')!;
    expect(lb.workouts[0].exercises[0].sets[0].kg).toBe(102.1);
  });
});

describe('Hevy', () => {
  const file = [
    '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"',
    '"Upper","28 Mar 2025, 17:29","28 Mar 2025, 18:52","","Bench Press (Barbell)",,"",0,"warmup",135,10,,,',
    '"Upper","28 Mar 2025, 17:29","28 Mar 2025, 18:52","","Bench Press (Barbell)",,"paused",1,"normal",225,5,,,9',
    '"Upper","28 Mar 2025, 17:29","28 Mar 2025, 18:52","","Plank",,"",0,"normal",,,,60,',
    '"Upper","28 Mar 2025, 17:29","28 Mar 2025, 18:52","","Band Pullaparts",,"",0,"normal",,20,,0,',
  ].join('\n');

  it('reads sets, types, pounds, and leaves timed work out', () => {
    const r = readCsv(file)!;
    expect(r.source).toBe('hevy');
    expect(r.unit).toBe('lb');
    expect(r.skipped).toBe(1);
    const w = r.workouts[0];
    expect((w.endedAt.getTime() - w.startedAt.getTime()) / 60000).toBe(83);
    expect(w.exercises.map((e) => e.name)).toEqual([
      'Bench Press (Barbell)',
      'Band Pullaparts',
    ]);
    expect(w.exercises[0].sets).toEqual([
      { kg: 61.2, reps: 10, type: 'warmup' },
      { kg: 102.1, reps: 5, type: 'working', rpe: 9 },
    ]);
    expect(w.exercises[1].sets[0]).toEqual({
      kg: null,
      reps: 20,
      type: 'working',
    });
  });
});

describe('any spreadsheet', () => {
  it('reads date, exercise, weight, reps and sets columns', () => {
    const r = readCsv(
      [
        'Date,Exercise,Weight (kg),Sets,Reps',
        '03/11/2026,Squat,100,3,5',
        '03/11/2026,RDL,90,2,8',
        '05/11/2026,Bench,80,1,8',
      ].join('\n'),
    )!;
    expect(r.source).toBe('csv');
    expect(r.unit).toBe('kg');
    expect(r.workouts).toHaveLength(2);
    expect(r.workouts[0].exercises.map((e) => [e.name, e.sets.length])).toEqual(
      [
        ['Squat', 3],
        ['RDL', 2],
      ],
    );
    expect(r.workouts[0].startedAt.getMonth()).toBe(10);
  });

  it('gives up on files without the columns it needs', () => {
    expect(readCsv('name,email\nA,a@example.com')).toBeNull();
    expect(readCsv('')).toBeNull();
  });
});

describe('notes', () => {
  const today = '2026-11-09';

  it('finds date lines with or without a year and a title', () => {
    const d = (s: string) => {
      const r = dateLine(s, today);
      return (
        r &&
        `${r.day.getFullYear()}-${r.day.getMonth() + 1}-${r.day.getDate()}|${r.rest}`
      );
    };
    expect(d('Mon 3 Nov: Push day')).toBe('2026-11-3|Push day');
    expect(d('November 3rd')).toBe('2026-11-3|');
    expect(d('2025-12-30 legs')).toBe('2025-12-30|legs');
    expect(d('28/12')).toBe('2025-12-28|');
    expect(d('Dec 20, 2024 · Upper')).toBe('2024-12-20|Upper');
    expect(d('3 sets of 10')).toBeNull();
    expect(d('3/11 80x8')).toBeNull();
    expect(d('bench 80x8')).toBeNull();
  });

  it('turns pasted notes into one workout per date', () => {
    const r = readNotes(
      [
        'squat 100 5x5',
        '',
        'Mon 3 Nov: Push',
        'bench 80x8, 85x6',
        'ohp 50 for 8 8 7',
        '',
        '5 Nov',
        'deadlift 140 x 5 x 3',
        'felt strong',
      ].join('\n'),
      LIBRARY,
      today,
      '2026-11-01',
    );
    expect(
      r.workouts.map((w) => [
        w.startedAt.getDate(),
        w.title,
        w.exercises.length,
      ]),
    ).toEqual([
      [1, null, 1],
      [3, 'Push', 2],
      [5, null, 1],
    ]);
    expect(r.workouts[1].exercises[0]).toMatchObject({
      name: 'Bench press',
      match: { id: 'bench_press' },
    });
    expect(r.skipped).toBe(1);
  });
});

describe('matching exported names', () => {
  it('maps the kit in brackets to the right exercise', () => {
    expect(id('Bench Press (Barbell)')).toBe('bench_press');
    expect(id('Bench Press (Dumbbell)')).toBe('db_bench_press');
    expect(id('Incline Bench Press (Dumbbell)')).toBe('incline_db_press');
    expect(id('Lat Pulldown (Cable)')).toBe('lat_pulldown');
    expect(id('Bicep Curl (Barbell)')).toBe('barbell_curl');
    expect(id('Bicep Curl (Dumbbell)')).toBe('db_curl');
    expect(id('Lateral Raise (Cable)')).toBe('cable_lateral_raise');
    expect(id('Triceps Pushdown (Cable - Straight Bar)')).toBe(
      'tricep_pushdown',
    );
    expect(id('Romanian Deadlift (Barbell)')).toBe('rdl');
    expect(id('Pull Up')).toBe('pull_up');
    expect(id('Pull Up (Weighted)')).toBe('pull_up');
  });

  it('keeps assisted and unknown movements as new exercises', () => {
    expect(id('Pull Up (Assisted)')).toBeNull();
    expect(id('Band Pullaparts')).toBeNull();
  });

  it('guesses a muscle for new exercises', () => {
    expect(guessMuscle('Band Pullaparts')).toBe('core');
    expect(guessMuscle('Leg Curl (Seated, Single)')).toBe('hamstrings');
    expect(guessMuscle('Cossack Squat')).toBe('quads');
    expect(guessMuscle('Spider Curl')).toBe('biceps');
    expect(guessMuscle('Landmine Row')).toBe('back');
    expect(guessMuscle('Svend Press')).toBe('chest');
  });
});

describe('building the import', () => {
  const file = [
    'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
    '2023-01-02 18:30:00,Pull,1h,Pull Up (Assisted),1,20,8,0,0,,,',
    '2023-01-02 18:30:00,Pull,1h,Barbell Row (Barbell),1,70,8,0,0,,,',
    '2023-01-02 18:30:00,Pull,1h,Band Pullaparts,1,0,20,0,0,,,',
  ].join('\n');

  it('maps names, makes new exercises once, and keeps ids stable', () => {
    const r = readCsv(file)!;
    const names = importNames(r).map((n) => n.name);
    expect(names).toHaveLength(3);
    const maps = suggestMappings(r, LIBRARY);
    expect(maps.get('Barbell Row (Barbell)')).toEqual({
      to: 'existing',
      exerciseId: 'barbell_row',
    });
    expect(maps.get('Pull Up (Assisted)')).toMatchObject({
      to: 'new',
      name: 'Pull Up (assisted)',
      kind: 'weighted',
    });
    expect(maps.get('Band Pullaparts')).toMatchObject({
      to: 'new',
      kind: 'bodyweight',
    });

    const a = buildImport(r, maps);
    const b = buildImport(
      readCsv(file)!,
      suggestMappings(readCsv(file)!, LIBRARY),
    );
    expect(a.workouts.map((w) => w.id)).toEqual(b.workouts.map((w) => w.id));
    expect(a.exercises.map((e) => e.id)).toEqual(b.exercises.map((e) => e.id));
    expect(a.exercises).toHaveLength(2);
    const w = a.workouts[0];
    expect(w).toMatchObject({
      name: 'Pull',
      date: '2023-01-02',
      source: 'imported',
      importedFrom: 'strong',
    });
    expect(w.exercises.map((e) => e.exerciseId)).toEqual([
      a.exercises[0].id,
      'barbell_row',
      a.exercises[1].id,
    ]);
    expect(
      new Set(w.exercises.flatMap((e) => e.sets.map((s) => s.id))).size,
    ).toBe(3);
  });

  it('leaves out names mapped to nothing', () => {
    const r = readCsv(file)!;
    const maps = suggestMappings(r, LIBRARY);
    maps.delete('Band Pullaparts');
    expect(buildImport(r, maps).workouts[0].exercises).toHaveLength(2);
  });
});

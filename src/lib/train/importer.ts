/**
 * importer.ts: years of training brought in from other apps, spreadsheets
 * or notes. Pure: the import screen reads the file, this file reads the rows.
 *
 *   Strong   comma or semicolon CSV with Date, Workout Name, Exercise Name,
 *            Set Order, Weight (kg or lbs), Reps, RPE
 *   Hevy     CSV with title, start_time, exercise_title, set_type,
 *            weight_kg or weight_lbs, reps, rpe
 *   Any CSV  with a date, an exercise and reps column (weight, sets, RPE
 *            optional), the way people keep training spreadsheets
 *   Notes    pasted text, a date line before each day, read by describe.ts
 *
 * Every workout gets an id made from its source and start, so importing the
 * same file twice updates those workouts instead of doubling them.
 */

import { describeWorkout } from './describe';
import {
  bestMatch,
  normalizeName,
  type Equipment,
  type Exercise,
  type ExerciseKind,
  type Muscle,
} from './exercises';
import type { SetType, WorkSet, Workout } from './workout';

export type ImportSource = 'strong' | 'hevy' | 'csv' | 'notes';

export interface ImportedSet {
  kg: number | null;
  reps: number;
  type: SetType;
  rpe?: number;
}

export interface ImportedExercise {
  /** The name as the source wrote it. */
  name: string;
  sets: ImportedSet[];
  note?: string;
  /** A match the source already made (notes are read against the library). */
  match?: Exercise | null;
}

export interface ImportedWorkout {
  key: string;
  title: string | null;
  startedAt: Date;
  endedAt: Date;
  exercises: ImportedExercise[];
  note?: string;
}

export interface ImportResult {
  source: ImportSource;
  workouts: ImportedWorkout[];
  /** Weight column unit, or unknown when the file doesn't say. */
  unit: 'kg' | 'lb' | 'unknown';
  /** Rows left out: timed or distance work, rest timers, empty rows. */
  skipped: number;
}

const LB = 0.45359237;
const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

// ── CSV ──────────────────────────────────────────────────────────────────

/** Rows of cells. Handles quotes, doubled quotes and line breaks in quotes. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.slice(
    0,
    body.indexOf('\n') === -1 ? undefined : body.indexOf('\n'),
  );
  const outside = firstLine.replace(/"[^"]*"/g, '');
  const sep =
    (outside.match(/;/g)?.length ?? 0) > (outside.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const clean = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

/** Index of the first header matching any of the names, or -1. */
function col(header: string[], ...names: string[]): number {
  const h = header.map(clean);
  for (const n of names) {
    const i = h.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

const num = (s: string | undefined): number | null => {
  if (s == null) return null;
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// ── Dates ────────────────────────────────────────────────────────────────

/**
 * A date (and time, if given) in any of the forms exports and people use:
 * 2024-11-02 18:30:00, 28 Mar 2025, 17:29, Mar 28, 2025 5:29 PM, 28/03/2025.
 * Numeric dates are read day first unless that can't be right.
 */
export function parseDate(text: string): Date | null {
  const s = text.trim();
  let y: number;
  let mo: number;
  let d: number;
  let rest = '';
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/.exec(s);
  if (m) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
    rest = m[4];
  } else if ((m = /^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})(.*)$/i.exec(s))) {
    d = +m[1];
    mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    y = +m[3];
    rest = m[4];
  } else if ((m = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(.*)$/i.exec(s))) {
    mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    d = +m[2];
    y = +m[3];
    rest = m[4];
  } else if ((m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(.*)$/.exec(s))) {
    let a = +m[1];
    let b = +m[2];
    if (a <= 12 && b > 12) [a, b] = [b, a];
    d = a;
    mo = b;
    y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    rest = m[4];
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let h = 12;
  let min = 0;
  const t = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i.exec(rest);
  if (t) {
    h = +t[1] % 24;
    min = +t[2];
    if (t[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    if (t[3]?.toLowerCase() === 'am' && h === 12) h = 0;
  }
  const date = new Date(y, mo - 1, d, h, min);
  return date.getMonth() === mo - 1 ? date : null;
}

/** "1h 5m", "45m", "1:02:00", "3900" (seconds) to seconds. */
export function parseDuration(text: string | undefined): number {
  const s = (text ?? '').trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const hms = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (hms) {
    return hms[3] != null
      ? +hms[1] * 3600 + +hms[2] * 60 + +hms[3]
      : +hms[1] * 60 + +hms[2];
  }
  const h = /(\d+)\s*h/.exec(s);
  const mi = /(\d+)\s*m(?!s)/.exec(s);
  const se = /(\d+)\s*s/.exec(s);
  return (h ? +h[1] * 3600 : 0) + (mi ? +mi[1] * 60 : 0) + (se ? +se[1] : 0);
}

/** A short stable hash, for import ids. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ── Readers ──────────────────────────────────────────────────────────────

type Group = {
  title: string | null;
  start: Date;
  end: Date;
  note?: string;
  order: string[];
  byName: Map<string, ImportedExercise>;
};

function addSet(g: Group, name: string, set: ImportedSet, note?: string) {
  let ex = g.byName.get(name);
  if (!ex) {
    ex = { name, sets: [] };
    g.byName.set(name, ex);
    g.order.push(name);
  }
  if (note && !ex.note) ex.note = note;
  ex.sets.push(set);
}

function finish(
  groups: Map<string, Group>,
  source: ImportSource,
): ImportedWorkout[] {
  return [...groups.entries()]
    .map(([key, g]) => ({
      key: `${source}:${key}`,
      title: g.title,
      startedAt: g.start,
      endedAt: g.end,
      note: g.note,
      exercises: g.order.map((n) => g.byName.get(n)!),
    }))
    .filter((w) => w.exercises.length > 0)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}

const toKg = (v: number | null, unit: 'kg' | 'lb') =>
  v == null ? null : unit === 'lb' ? Math.round(v * LB * 10) / 10 : v;

const SET_TYPE: Record<string, SetType> = {
  normal: 'working',
  warmup: 'warmup',
  'warm up': 'warmup',
  w: 'warmup',
  dropset: 'drop',
  drop: 'drop',
  d: 'drop',
  failure: 'failure',
  f: 'failure',
};

function readStrong(
  rows: string[][],
  unitHint: 'kg' | 'lb' | 'unknown',
  unit: 'kg' | 'lb',
): ImportResult {
  const [header, ...data] = rows;
  const c = {
    no: col(header, 'workout #'),
    date: col(header, 'date'),
    name: col(header, 'workout name'),
    duration: col(header, 'duration (sec)', 'duration'),
    exercise: col(header, 'exercise name'),
    order: col(header, 'set order'),
    weight: col(header, 'weight (kg)', 'weight (lbs)', 'weight (lb)', 'weight'),
    reps: col(header, 'reps'),
    rpe: col(header, 'rpe'),
    notes: col(header, 'notes'),
    workoutNotes: col(header, 'workout notes'),
  };
  const groups = new Map<string, Group>();
  let skipped = 0;
  for (const r of data) {
    const start = parseDate(r[c.date] ?? '');
    const exercise = (r[c.exercise] ?? '').trim();
    const order = (r[c.order] ?? '').trim().toLowerCase();
    const reps = num(r[c.reps]);
    if (!start || !exercise || order.startsWith('rest') || !reps || reps <= 0) {
      skipped++;
      continue;
    }
    const key =
      c.no >= 0 && r[c.no]?.trim()
        ? `#${r[c.no].trim()}`
        : `${r[c.date]}|${r[c.name]}`;
    let g = groups.get(key);
    if (!g) {
      const seconds = parseDuration(r[c.duration]);
      g = {
        title: (r[c.name] ?? '').trim() || null,
        start,
        end: new Date(start.getTime() + seconds * 1000),
        note: (r[c.workoutNotes] ?? '').trim() || undefined,
        order: [],
        byName: new Map(),
      };
      groups.set(key, g);
    }
    const rpe = num(r[c.rpe]);
    addSet(
      g,
      exercise,
      {
        kg: toKg(num(r[c.weight]), unit),
        reps: Math.round(reps),
        type: SET_TYPE[order] ?? 'working',
        ...(rpe ? { rpe } : {}),
      },
      (r[c.notes] ?? '').trim() || undefined,
    );
  }
  return {
    source: 'strong',
    workouts: finish(groups, 'strong'),
    unit: unitHint,
    skipped,
  };
}

function readHevy(rows: string[][], unit: 'kg' | 'lb'): ImportResult {
  const [header, ...data] = rows;
  const c = {
    title: col(header, 'title'),
    start: col(header, 'start_time'),
    end: col(header, 'end_time'),
    description: col(header, 'description'),
    exercise: col(header, 'exercise_title'),
    notes: col(header, 'exercise_notes'),
    type: col(header, 'set_type'),
    weight: col(header, 'weight_kg', 'weight_lbs'),
    reps: col(header, 'reps'),
    rpe: col(header, 'rpe'),
  };
  const groups = new Map<string, Group>();
  let skipped = 0;
  for (const r of data) {
    const start = parseDate(r[c.start] ?? '');
    const exercise = (r[c.exercise] ?? '').trim();
    const reps = num(r[c.reps]);
    if (!start || !exercise || !reps || reps <= 0) {
      skipped++;
      continue;
    }
    const key = `${r[c.title]}|${r[c.start]}`;
    let g = groups.get(key);
    if (!g) {
      const end = parseDate(r[c.end] ?? '');
      g = {
        title: (r[c.title] ?? '').trim() || null,
        start,
        end: end && end > start ? end : start,
        note: (r[c.description] ?? '').trim() || undefined,
        order: [],
        byName: new Map(),
      };
      groups.set(key, g);
    }
    const rpe = num(r[c.rpe]);
    addSet(
      g,
      exercise,
      {
        kg: toKg(num(r[c.weight]), unit),
        reps: Math.round(reps),
        type: SET_TYPE[(r[c.type] ?? '').trim().toLowerCase()] ?? 'working',
        ...(rpe ? { rpe } : {}),
      },
      (r[c.notes] ?? '').trim() || undefined,
    );
  }
  return { source: 'hevy', workouts: finish(groups, 'hevy'), unit, skipped };
}

function readGeneric(
  rows: string[][],
  unitHint: 'kg' | 'lb' | 'unknown',
  unit: 'kg' | 'lb',
): ImportResult {
  const [header, ...data] = rows;
  const c = {
    date: col(header, 'date', 'day', 'workout date'),
    workout: col(header, 'workout', 'workout name', 'session', 'title'),
    exercise: col(header, 'exercise', 'exercise name', 'movement', 'lift'),
    weight: col(
      header,
      'weight',
      'weight (kg)',
      'weight kg',
      'weight_kg',
      'kg',
      'load',
      'weight (lbs)',
      'weight (lb)',
      'weight_lbs',
      'lbs',
      'lb',
    ),
    reps: col(header, 'reps', 'rep', 'repetitions'),
    sets: col(header, 'sets', 'set count'),
    type: col(header, 'type', 'set type'),
    rpe: col(header, 'rpe'),
  };
  const groups = new Map<string, Group>();
  let skipped = 0;
  for (const r of data) {
    const start = parseDate(r[c.date] ?? '');
    const exercise = (r[c.exercise] ?? '').trim();
    const reps = num(r[c.reps]);
    if (!start || !exercise || !reps || reps <= 0) {
      skipped++;
      continue;
    }
    const day = start.toDateString();
    const title = c.workout >= 0 ? (r[c.workout] ?? '').trim() : '';
    const key = `${day}|${title}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        title: title || null,
        start,
        end: start,
        order: [],
        byName: new Map(),
      };
      groups.set(key, g);
    }
    const count = Math.max(1, Math.min(20, Math.round(num(r[c.sets]) ?? 1)));
    const rpe = num(r[c.rpe]);
    for (let i = 0; i < count; i++) {
      addSet(g, exercise, {
        kg: toKg(num(r[c.weight]), unit),
        reps: Math.round(reps),
        type: SET_TYPE[(r[c.type] ?? '').trim().toLowerCase()] ?? 'working',
        ...(rpe ? { rpe } : {}),
      });
    }
  }
  return {
    source: 'csv',
    workouts: finish(groups, 'csv'),
    unit: unitHint,
    skipped,
  };
}

/**
 * Reads a CSV export or spreadsheet. `unit` is used when the file doesn't
 * say which unit its weights are in. Null when no known columns are found.
 */
export function readCsv(
  text: string,
  unit: 'kg' | 'lb' = 'kg',
): ImportResult | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const header = rows[0].map(clean);
  const has = (n: string) => header.includes(n);
  if (has('exercise_title') && has('start_time')) {
    return readHevy(rows, has('weight_lbs') ? 'lb' : 'kg');
  }
  const named = header.find((h) => h.startsWith('weight'));
  const hint = named?.includes('kg')
    ? 'kg'
    : named && /lb/.test(named)
      ? 'lb'
      : 'unknown';
  const used = hint === 'unknown' ? unit : hint;
  if (has('exercise name') && has('set order'))
    return readStrong(rows, hint, used);
  const dateCol = col(rows[0], 'date', 'day', 'workout date');
  const exCol = col(rows[0], 'exercise', 'exercise name', 'movement', 'lift');
  const repsCol = col(rows[0], 'reps', 'rep', 'repetitions');
  if (dateCol >= 0 && exCol >= 0 && repsCol >= 0) {
    const genericHint = header.some((h) => /\b(kg|weight_kg)\b|\(kg\)/.test(h))
      ? 'kg'
      : header.some((h) => /\b(lbs?|weight_lbs)\b|\(lbs?\)/.test(h))
        ? 'lb'
        : 'unknown';
    return readGeneric(
      rows,
      genericHint,
      genericHint === 'unknown' ? unit : genericHint,
    );
  }
  return null;
}

// ── Notes ────────────────────────────────────────────────────────────────

const WEEKDAY =
  '(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\\.?,?\\s+';

/**
 * A date at the start of a line, and what follows it: "Mon 3 Nov: Push",
 * "3/11", "2026-11-03", "November 3". A missing year is the latest one that
 * isn't in the future.
 */
export function dateLine(
  line: string,
  today: string,
): { day: Date; rest: string } | null {
  const s = line.trim();
  const now = new Date(
    +today.slice(0, 4),
    +today.slice(5, 7) - 1,
    +today.slice(8, 10),
    23,
    59,
  );
  const pick = (d: number, mo: number, y: number | null) => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    let year = y ?? now.getFullYear();
    let date = new Date(year, mo - 1, d, 12);
    if (y == null && date > now) date = new Date(--year, mo - 1, d, 12);
    return date.getMonth() === mo - 1 ? date : null;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})\b(.*)$/.exec(s);
  let day: Date | null = null;
  let rest = '';
  if (m) {
    day = pick(+m[3], +m[2], +m[1]);
    rest = m[4];
  } else if (
    (m = new RegExp(
      `^(?:${WEEKDAY})?(\\d{1,2})(?:st|nd|rd|th)?\\s+([a-z]{3,9})\\.?(?:,?\\s+(\\d{4}))?\\b(.*)$`,
      'i',
    ).exec(s))
  ) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    if (mo > 0) {
      day = pick(+m[1], mo, m[3] ? +m[3] : null);
      rest = m[4];
    }
  } else if (
    (m = new RegExp(
      `^(?:${WEEKDAY})?([a-z]{3,9})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b(.*)$`,
      'i',
    ).exec(s))
  ) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    if (mo > 0) {
      day = pick(+m[2], mo, m[3] ? +m[3] : null);
      rest = m[4];
    }
  } else if (
    (m = new RegExp(
      `^(?:${WEEKDAY})?(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?\\b(.*)$`,
      'i',
    ).exec(s))
  ) {
    let a = +m[1];
    let b = +m[2];
    if (a <= 12 && b > 12) [a, b] = [b, a];
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null;
    day = pick(a, b, y);
    rest = m[4];
  }
  if (!day) return null;
  // "3/11 80x8" is a set, not a date line: a date line is the date and maybe a title.
  rest = rest.replace(/^[\s:·|,.\-–—]+/, '').trim();
  if (/\d+\s*[x×*]\s*\d+/i.test(rest)) return null;
  return { day, rest };
}

/** Pasted training notes: each date line starts a workout. */
export function readNotes(
  text: string,
  list: Exercise[],
  today: string,
  undated: string,
): ImportResult {
  const chunks: { day: Date; title: string | null; lines: string[] }[] = [];
  const [uy, um, ud] = undated.split('-').map(Number);
  for (const line of text.split('\n')) {
    const found = line.trim() ? dateLine(line, today) : null;
    if (found) {
      chunks.push({ day: found.day, title: found.rest || null, lines: [] });
    } else if (line.trim()) {
      if (!chunks.length)
        chunks.push({
          day: new Date(uy, um - 1, ud, 12),
          title: null,
          lines: [],
        });
      chunks[chunks.length - 1].lines.push(line);
    }
  }
  const workouts: ImportedWorkout[] = [];
  let skipped = 0;
  for (const ch of chunks) {
    const parsed = describeWorkout(ch.lines.join('\n'), list);
    skipped += parsed.unread.length;
    const exercises = parsed.exercises
      .map((e) => ({
        name: e.exercise?.name ?? e.name,
        match: e.exercise,
        sets: e.sets
          .filter((s) => (s.reps ?? 0) > 0)
          .map((s) => ({
            kg: s.kg,
            reps: s.reps as number,
            type: 'working' as SetType,
          })),
      }))
      .filter((e) => e.sets.length > 0);
    if (!exercises.length) continue;
    workouts.push({
      key: `notes:${hash(`${ch.day.toDateString()}|${ch.lines.join('\n')}`)}`,
      title: ch.title ?? parsed.title,
      startedAt: ch.day,
      endedAt: ch.day,
      exercises,
    });
  }
  return { source: 'notes', workouts, unit: 'kg', skipped };
}

// ── Matching names ───────────────────────────────────────────────────────

const EQUIPMENT_WORDS: Record<string, Equipment[]> = {
  barbell: ['barbell'],
  dumbbell: ['dumbbell'],
  cable: ['cable'],
  machine: ['machine'],
  'smith machine': ['smith'],
  smith: ['smith'],
  kettlebell: ['kettlebell'],
  'ez bar': ['ezbar'],
  'trap bar': ['trapbar'],
  bodyweight: ['bodyweight'],
};

/** Words most exercise names share; they count half when comparing names. */
const COMMON = new Set([
  'press',
  'bench',
  'curl',
  'row',
  'raise',
  'db',
  'bb',
  'kb',
  'machine',
  'cable',
  'extension',
  'fly',
  'pulldown',
  'pushdown',
  'squat',
  'deadlift',
]);
const weight = (w: string) => (COMMON.has(w) ? 0.5 : 1);

/**
 * How much two names share, 0 to 1, with the telling words (incline,
 * seated, hammer) counting more than the common ones (press, curl).
 */
function overlap(a: string, b: string): number {
  const x = new Set(normalizeName(a).split(' '));
  const y = new Set(normalizeName(b).split(' '));
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += weight(w);
  const total = (set: Set<string>) =>
    [...set].reduce((sum, w) => sum + weight(w), 0);
  return shared / Math.max(total(x), total(y));
}

/**
 * The library exercise an exported name means: "Bench Press (Dumbbell)" is
 * Dumbbell bench press, "Lat Pulldown (Cable)" is Lat pulldown. The kit in
 * brackets is matched first, so a dumbbell lift never lands on the barbell
 * one. Assisted versions stay separate, because their weight helps rather
 * than loads.
 */
export function suggestExercise(
  name: string,
  list: Exercise[],
): Exercise | null {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name.trim());
  const base = m ? m[1] : name;
  const equip = m
    ? m[2]
        .split(/[-–—,/]/)[0]
        .trim()
        .toLowerCase()
    : '';
  if (equip.startsWith('assist')) return null;
  const kit = EQUIPMENT_WORDS[equip];
  if (kit) {
    const pool = list.filter((e) => kit.includes(e.equipment));
    const strict = bestMatch(base, pool);
    if (strict && strict.score >= 56) return strict.exercise;
    let loose: Exercise | null = null;
    let best = 0;
    for (const e of pool) {
      for (const text of [e.name, ...e.aliases]) {
        const o = overlap(base, text);
        if (o > best) {
          best = o;
          loose = e;
        }
      }
    }
    if (loose && best >= 0.6) return loose;
  }
  const hit = bestMatch(base, list);
  return hit && hit.score >= 56 ? hit.exercise : null;
}

const MUSCLE_WORDS: [RegExp, Muscle][] = [
  [
    /\bleg curl|hamstring|romanian|\brdl\b|good morning|nordic|stiff leg/,
    'hamstrings',
  ],
  [/leg extension|squat|leg press|lunge|step up|hack/, 'quads'],
  [/calf|calves/, 'calves'],
  [/adduct/, 'adductors'],
  [/hip thrust|glute|bridge|abduct|swing/, 'glutes'],
  [/wrist|forearm|grip|farmer/, 'forearms'],
  [
    /crunch|\bab\b|abs|plank|sit up|leg raise|oblique|twist|rollout|core|wood ?chop/,
    'core',
  ],
  [
    /tricep|pushdown|skull|kickback|close grip|overhead extension|french press|dip/,
    'triceps',
  ],
  [/curl|bicep|preacher/, 'biceps'],
  [
    /shoulder|overhead press|military|\bohp\b|lateral|front raise|delt|face pull|upright|arnold|shrug/,
    'shoulders',
  ],
  [
    /row|pulldown|pull ?up|chin ?up|deadlift|\blat\b|pullover|back extension|hyperextension/,
    'back',
  ],
  [/bench|chest|fly|flye|pec|push ?up|press/, 'chest'],
];

/** A first guess at the main muscle, from the name. */
export function guessMuscle(name: string): Muscle {
  const n = normalizeName(name);
  for (const [re, muscle] of MUSCLE_WORDS) if (re.test(n)) return muscle;
  return 'core';
}

/** Bodyweight when no set in the file carried a load. */
export function guessKind(sets: ImportedSet[]): ExerciseKind {
  return sets.every((s) => !s.kg) ? 'bodyweight' : 'weighted';
}

// ── Building workouts ────────────────────────────────────────────────────

export type Mapping =
  | { to: 'existing'; exerciseId: string }
  | { to: 'new'; name: string; muscle: Muscle; kind: ExerciseKind };

/** Every distinct name in an import, with its set count, most used first. */
export function importNames(r: ImportResult): {
  name: string;
  sets: number;
  sample: ImportedSet[];
  match?: Exercise | null;
}[] {
  const byName = new Map<
    string,
    {
      name: string;
      sets: number;
      sample: ImportedSet[];
      match?: Exercise | null;
    }
  >();
  for (const w of r.workouts) {
    for (const e of w.exercises) {
      const cur = byName.get(e.name) ?? {
        name: e.name,
        sets: 0,
        sample: [],
        match: e.match,
      };
      cur.sets += e.sets.length;
      if (cur.sample.length < 30)
        cur.sample.push(...e.sets.slice(0, 30 - cur.sample.length));
      byName.set(e.name, cur);
    }
  }
  return [...byName.values()].sort(
    (a, b) => b.sets - a.sets || a.name.localeCompare(b.name),
  );
}

/** First mappings: the library where a name fits, a new exercise otherwise. */
export function suggestMappings(
  r: ImportResult,
  list: Exercise[],
): Map<string, Mapping> {
  const out = new Map<string, Mapping>();
  for (const n of importNames(r)) {
    const ex = n.match ?? suggestExercise(n.name, list);
    out.set(
      n.name,
      ex
        ? { to: 'existing', exerciseId: ex.id }
        : {
            to: 'new',
            name: n.name
              .replace(
                /\s*\(([^)]*)\)\s*$/,
                (_, e: string) => ` (${e.toLowerCase()})`,
              )
              .trim(),
            muscle: guessMuscle(n.name),
            kind: guessKind(n.sample),
          },
    );
  }
  return out;
}

/** The id a new exercise from an import gets: the same name, the same id. */
export const importedExerciseId = (name: string) =>
  `c_imp_${hash(normalizeName(name))}`;

/**
 * Workouts ready to save, plus the new exercises they need. Ids come from
 * the source and start, so importing again updates instead of doubling.
 */
export function buildImport(
  r: ImportResult,
  mappings: Map<string, Mapping>,
): { workouts: Workout[]; exercises: Exercise[] } {
  const created = new Map<string, Exercise>();
  const idFor = (name: string): string | null => {
    const m = mappings.get(name);
    if (!m) return null;
    if (m.to === 'existing') return m.exerciseId;
    const id = importedExerciseId(m.name);
    if (!created.has(id)) {
      const clean = m.name.trim().replace(/\s+/g, ' ');
      created.set(id, {
        id,
        name: clean.charAt(0).toUpperCase() + clean.slice(1),
        muscle: m.muscle,
        equipment: m.kind === 'bodyweight' ? 'bodyweight' : 'other',
        kind: m.kind,
        aliases: [],
        custom: true,
      });
    }
    return id;
  };
  const workouts: Workout[] = r.workouts.map((w) => {
    const id = `imp_${hash(w.key)}`;
    let n = 0;
    return {
      id,
      name: w.title ?? 'Workout',
      date: dayKey(w.startedAt),
      startedAt: w.startedAt.toISOString(),
      endedAt: w.endedAt.toISOString(),
      ...(w.note ? { note: w.note } : {}),
      source: 'imported' as const,
      importedFrom: r.source,
      exercises: w.exercises
        .map((e) => ({ e, exerciseId: idFor(e.name) }))
        .filter(
          (x): x is { e: ImportedExercise; exerciseId: string } =>
            !!x.exerciseId,
        )
        .map(({ e, exerciseId }) => {
          const at = n++;
          return {
            id: `${id}_e${at}`,
            exerciseId,
            ...(e.note ? { note: e.note } : {}),
            sets: e.sets.map(
              (s, i): WorkSet => ({
                id: `${id}_e${at}_s${i}`,
                kg: s.kg,
                reps: s.reps,
                type: s.type,
                done: true,
                ...(s.rpe ? { rpe: s.rpe } : {}),
              }),
            ),
          };
        }),
    };
  });
  return {
    workouts: workouts.filter((w) => w.exercises.length),
    exercises: [...created.values()],
  };
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

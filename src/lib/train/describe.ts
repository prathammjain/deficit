/**
 * describe.ts: reads a workout written or spoken in plain words.
 *
 *   bench 80x8, 80x8, 85x6
 *   squat 100kg 5x5
 *   ohp 50 for 8, 8 and 7
 *   lat pulldown 3 sets of 12 at 60
 *   pull ups bw x 10, +10 x 6
 *   "squats five sets of five at a hundred kilos"
 *
 * Deterministic and offline: no model, no network, so it is instant, free,
 * and the same words always read the same way. Whatever it can't place is
 * handed back so the screen can ask instead of guessing.
 */

import { matchExercise, type Exercise } from './exercises';
import type { SetValues } from './workout';

export interface ParsedExercise {
  /** The words the exercise was read from. */
  name: string;
  exercise: Exercise | null;
  sets: SetValues[];
}

export interface ParsedWorkout {
  /** A first line that names the session ("Push day"), if there was one. */
  title: string | null;
  exercises: ParsedExercise[];
  /** Pieces that read as neither an exercise nor sets. */
  unread: string[];
}

const LB = 0.45359237;
const MAX_SETS = 20;

const UNITS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Number words to digits: "eight" 8, "sixty two" 62, "a hundred and
 * twenty" 120. Words only combine across plain spaces, so "eight, eight"
 * stays two numbers.
 */
function wordsToDigits(text: string): string {
  // Even slots hold letter words, odd slots whatever sits between them.
  const p = text.split(/([^a-z]+)/);
  const word = (j: number) => p[j] ?? '';
  /** Word j follows the word before it with only spaces between. */
  const joined = (j: number) => /^\s+$/.test(p[j - 1] ?? '');
  const isUnit = (j: number) => word(j) in UNITS;
  const isTen = (j: number) => word(j) in TENS;
  const hundredNext = (j: number) => joined(j + 2) && word(j + 2) === 'hundred';
  const out: string[] = [];
  let i = 0;
  while (i < p.length) {
    const w = word(i);
    const starts =
      i % 2 === 0 &&
      (isUnit(i) ||
        isTen(i) ||
        w === 'hundred' ||
        (w === 'a' && hundredNext(i)));
    if (!starts) {
      out.push(p[i]);
      i++;
      continue;
    }
    let j = i;
    let value = 0;
    if ((w === 'a' || isUnit(i)) && hundredNext(i)) {
      value = (w === 'a' ? 1 : UNITS[w]) * 100;
      j = i + 4;
    } else if (w === 'hundred') {
      value = 100;
      j = i + 2;
    }
    if (
      value &&
      joined(j) &&
      word(j) === 'and' &&
      joined(j + 2) &&
      (isUnit(j + 2) || isTen(j + 2))
    ) {
      j += 2;
    }
    if (j === i || joined(j)) {
      if (isTen(j)) {
        value += TENS[word(j)];
        j += 2;
        if (joined(j) && isUnit(j) && UNITS[word(j)] < 10) {
          value += UNITS[word(j)];
          j += 2;
        }
      } else if (isUnit(j)) {
        value += UNITS[word(j)];
        j += 2;
      }
    }
    out.push(String(value));
    // Carry on from the gap after the last word used.
    i = j - 1;
  }
  return out.join('');
}

/** Same spellings everywhere, so the readers below stay small. */
function normalize(text: string): string {
  let t = text
    .toLowerCase()
    .replace(/[×✕✖]/g, 'x')
    .replace(/\b(?:one|1)\s+(arm|leg|hand)(?:ed)?\b/g, 'single $1')
    .replace(/\bbody ?weight\b/g, 'bw')
    .replace(/\bkilo(?:gram)?s?\b|\bkgs\b/g, 'kg')
    .replace(/\bpounds?\b|\blbs\b/g, 'lb')
    .replace(/\brepetitions?\b/g, 'reps');
  t = wordsToDigits(t);
  return t
    .replace(/(\d+)\s+point\s+(\d+)/g, '$1.$2')
    .replace(/(\d+)\s+and a half\b/g, '$1.5')
    .replace(/(\d)\s*\*\s*(?=\d)/g, '$1 x ');
}

const LEADING =
  /^(?:and|then|also|next|plus|after that|followed by|finished with|started with|i|did|do|some|with)\b\s*/;

/** The pieces a workout is written in: lines, sentences, commas, "then". */
function pieces(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const body = line.replace(/^\s*(?:\d+[.)]|[•*\-–—])\s+/, '');
    for (const sentence of body.split(/;|\.(?!\d)/)) {
      const parts = sentence.split(
        /,|\band then\b|\bthen\b|\bfollowed by\b|\band\b|\bafter that\b/,
      );
      for (let p of parts) {
        p = p.trim();
        let prev = '';
        while (p !== prev) {
          prev = p;
          p = p.replace(LEADING, '').trim();
        }
        // Spoken order puts the name last: "3 sets of 10 at 60 on rows".
        const late = /^(\d.*?)\s+on\s+([a-z][a-z ]*)$/.exec(p);
        if (late) p = `${late[2]} ${late[1]}`;
        if (p) out.push(p);
      }
    }
  }
  return out;
}

/** Splits "incline db press 30 kg 10 10 8" into its name and its numbers. */
function splitName(piece: string): { name: string; rest: string } {
  const m = /(\+?\d|\bbw\b|@)/.exec(piece);
  const cut = m ? m.index : piece.length;
  const name = piece
    .slice(0, cut)
    .replace(/[\s:\-–—=]+$/, '')
    .replace(/\s+(?:at|for|with|of|x|did|was|is)$/, '')
    .trim();
  return { name, rest: piece.slice(cut).trim() };
}

/** Words that carry on the exercise before rather than naming a new one. */
const CARRY_ON = new Set([
  'went',
  'up',
  'to',
  'down',
  'another',
  'more',
  'same',
  'again',
  'set',
  'sets',
  'rep',
  'reps',
  'last',
  'final',
  'first',
  'second',
  'third',
  'one',
  'dropped',
  'drop',
  'weight',
  'at',
  'for',
  'of',
  'x',
  'then',
  'a',
  'did',
]);
const carriesOn = (name: string) =>
  name.split(/\s+/).every((w) => CARRY_ON.has(w));

// Reading the numbers
type Num = { k: 'num'; v: number; unit: 'kg' | 'lb' | null; plus: boolean };
type Word = { k: 'x' | 'for' | 'at' | 'sets' | 'reps' | 'of' | 'bw' };
type Tok = Num | Word;

const WORD_TOKENS: Record<string, Word['k']> = {
  x: 'x',
  for: 'for',
  at: 'at',
  set: 'sets',
  sets: 'sets',
  rep: 'reps',
  reps: 'reps',
  of: 'of',
  bw: 'bw',
};

/** Clauses (comma separated) of tokens. */
function tokenize(text: string): Tok[][] {
  const s = text
    .replace(/(\d)\s*(kg|lb)/g, '$1 $2 ')
    .replace(/\b(kg|lb)\s*x\s*(?=\d)/g, '$1 x ')
    .replace(/(\d)\s*(?:x|\bby\b|\btimes\b)\s*(?=[\d+]|bw\b)/g, '$1 x ')
    .replace(/\bbw\s*x\s*/g, 'bw x ')
    .replace(/@/g, ' at ')
    .replace(/\brpe\s*\d+(?:\.\d+)?/g, ' ')
    .replace(/,/g, ' , ');
  const clauses: Tok[][] = [[]];
  for (const w of s.split(/\s+/)) {
    if (!w) continue;
    const cur = clauses[clauses.length - 1];
    if (w === ',') {
      if (cur.length) clauses.push([]);
      continue;
    }
    const m = /^(\+)?(\d+(?:\.\d+)?)$/.exec(w);
    if (m) {
      cur.push({ k: 'num', v: parseFloat(m[2]), unit: null, plus: !!m[1] });
    } else if (w === 'kg' || w === 'lb') {
      const last = cur[cur.length - 1];
      if (last?.k === 'num') last.unit = w;
    } else if (WORD_TOKENS[w]) {
      cur.push({ k: WORD_TOKENS[w] });
    }
  }
  return clauses.filter((c) => c.length);
}

interface Ctx {
  /** The weight in play, carried from clause to clause. */
  weight: number | null;
  bodyweight: boolean;
  /** Pounds when the whole exercise was written in pounds. */
  unit: 'kg' | 'lb';
}

/**
 * The weight a clause names, if it names one: a number with a unit, one
 * after "at", "bw", an added "+10", or a lone number beside sets and reps
 * ("15 3x10").
 */
function namedWeight(c: Tok[], ctx: Ctx): { kg: number; at: number } | null {
  const kg = (t: Num) => toKg(t, ctx);
  for (let i = 0; i < c.length; i++) {
    const t = c[i];
    if (t.k === 'num' && (t.unit || t.plus)) return { kg: kg(t), at: i };
    if (t.k === 'at' && c[i + 1]?.k === 'num') {
      return { kg: kg(c[i + 1] as Num), at: i + 1 };
    }
    if (t.k === 'bw') return { kg: 0, at: i };
  }
  const setsLike = c.some(
    (t, i) =>
      t.k === 'sets' ||
      (t.k === 'num' &&
        c[i + 1]?.k === 'x' &&
        Number.isInteger(t.v) &&
        t.v <= 10),
  );
  if (!setsLike) return null;
  const lone = c
    .map((t, i) => ({ t, i }))
    .filter(
      ({ t, i }) =>
        t.k === 'num' &&
        !['x', 'for', 'at', 'of'].includes(c[i - 1]?.k ?? '') &&
        !['x', 'sets', 'reps', 'for'].includes(c[i + 1]?.k ?? ''),
    );
  return lone.length === 1 ? { kg: kg(lone[0].t as Num), at: lone[0].i } : null;
}

function toKg(t: Num, ctx: Ctx): number {
  const unit = t.unit ?? ctx.unit;
  return unit === 'lb' ? Math.round(t.v * LB * 10) / 10 : t.v;
}

function readClause(c: Tok[], ctx: Ctx): SetValues[] {
  const out: SetValues[] = [];
  const named = namedWeight(c, ctx);
  const num = (j: number) => (c[j]?.k === 'num' ? (c[j] as Num) : null);
  const is = (j: number, k: Tok['k']) => c[j]?.k === k;
  const kg = (t: Num) => toKg(t, ctx);
  const weightNow = () => named?.kg ?? ctx.weight;
  const push = (count: number, kgValue: number | null, reps: number | null) => {
    for (let n = 0; n < Math.min(count, MAX_SETS); n++) {
      out.push({ kg: kgValue, reps });
    }
  };
  const setWeight = (w: number) => {
    ctx.weight = w;
    for (const s of out) if (s.kg == null) s.kg = w;
  };

  let i = 0;
  while (i < c.length) {
    const a = num(i);
    // 140 x 5 x 3: weight, reps, sets (or sets, reps, weight).
    if (a && is(i + 1, 'x') && num(i + 2) && is(i + 3, 'x') && num(i + 4)) {
      const b = num(i + 2)!;
      const d = num(i + 4)!;
      if (a.unit || (!d.unit && a.v >= d.v)) {
        ctx.weight = kg(a);
        push(d.v, kg(a), b.v);
      } else {
        ctx.weight = kg(d);
        push(a.v, kg(d), b.v);
      }
      i += 5;
      continue;
    }
    // 80 x 8, or 5 x 5 when a weight is named or the first number is small.
    if (a && is(i + 1, 'x') && num(i + 2)) {
      const b = num(i + 2)!;
      i += is(i + 3, 'reps') ? 4 : 3;
      if (a.unit || a.plus) {
        ctx.weight = kg(a);
        push(1, kg(a), b.v);
      } else if (b.unit) {
        // "8 x 60kg" puts the unit on the weight; "245x3 lb" trails it.
        const w = b.v >= a.v ? kg(b) : kg({ ...a, unit: b.unit });
        ctx.weight = w;
        push(1, w, b.v >= a.v ? a.v : b.v);
      } else if (
        named ||
        (ctx.bodyweight && a.v <= 10) ||
        (Number.isInteger(a.v) && a.v <= 5)
      ) {
        push(a.v, weightNow(), b.v);
      } else {
        ctx.weight = kg(a);
        push(1, kg(a), b.v);
      }
      continue;
    }
    // 3 sets of 12, 3 sets 12 reps, 3 sets for 10.
    if (a && is(i + 1, 'sets')) {
      i += 2;
      if (is(i, 'of') || is(i, 'for')) i++;
      let reps: number | null = null;
      const r = num(i);
      if (r && !r.unit) {
        reps = r.v;
        i += is(i + 1, 'reps') ? 2 : 1;
      }
      push(a.v, weightNow(), reps);
      continue;
    }
    // 10 reps, or 10 reps 3 sets.
    if (a && is(i + 1, 'reps')) {
      const s = num(i + 2);
      if (s && is(i + 3, 'sets')) {
        push(s.v, weightNow(), a.v);
        i += 4;
      } else {
        push(1, weightNow(), a.v);
        i += 2;
      }
      continue;
    }
    // 80 for 8 8 6.
    if (a && is(i + 1, 'for')) {
      ctx.weight = kg(a);
      i += 2;
      while (num(i) && !num(i)!.unit && !is(i + 1, 'x') && !is(i + 1, 'sets')) {
        push(1, kg(a), num(i)!.v);
        i += is(i + 1, 'reps') ? 2 : 1;
      }
      continue;
    }
    const t = c[i];
    if (t.k === 'at' && a == null && num(i + 1)) {
      setWeight(kg(num(i + 1)!));
      i += 2;
      continue;
    }
    if (t.k === 'bw') {
      setWeight(0);
      i += is(i + 1, 'x') ? 2 : 1;
      while (num(i) && !num(i)!.unit && !is(i + 1, 'x')) {
        push(1, 0, num(i)!.v);
        i += is(i + 1, 'reps') ? 2 : 1;
      }
      continue;
    }
    // A weight, then reps: "30 kg 10 10 8", or the lone weight in "15 3x10".
    if (a && (a.unit || a.plus || named?.at === i)) {
      setWeight(named?.at === i ? named.kg : kg(a));
      i++;
      while (
        num(i) &&
        !num(i)!.unit &&
        !is(i + 1, 'x') &&
        !is(i + 1, 'sets') &&
        !is(i + 1, 'reps') &&
        !is(i + 1, 'for')
      ) {
        push(1, ctx.weight, num(i)!.v);
        i++;
      }
      continue;
    }
    // Plain numbers: reps at the weight in play, or "50 8 8 7".
    if (a) {
      const run: number[] = [];
      while (
        num(i) &&
        !num(i)!.unit &&
        !is(i + 1, 'x') &&
        !is(i + 1, 'sets') &&
        !is(i + 1, 'reps') &&
        !is(i + 1, 'for')
      ) {
        run.push(num(i)!.v);
        i++;
      }
      if (!run.length) {
        i++;
        continue;
      }
      const w = weightNow();
      if (ctx.bodyweight || w != null) {
        for (const r of run) push(1, w, r);
      } else if (run.length >= 2 && run[0] > Math.max(...run.slice(1))) {
        ctx.weight = run[0];
        for (const r of run.slice(1)) push(1, run[0], r);
      } else if (run.length === 1 && run[0] > 30) {
        push(1, run[0], null);
      } else {
        for (const r of run) push(1, null, r);
      }
      continue;
    }
    i++;
  }
  if (named) ctx.weight = named.kg;
  return out;
}

function readSets(text: string, ex: Exercise | null): SetValues[] {
  const ctx: Ctx = {
    weight: null,
    bodyweight: ex?.kind === 'bodyweight',
    unit: /\blb\b/.test(text) && !/\bkg\b/.test(text) ? 'lb' : 'kg',
  };
  const sets = tokenize(text).flatMap((c) => readClause(c, ctx));
  return sets
    .map((s) => ({
      kg: ctx.bodyweight && !s.kg ? null : s.kg,
      reps: s.reps == null ? null : Math.round(s.reps),
    }))
    .filter((s) => s.kg != null || s.reps != null);
}

/** Reads a whole written or spoken workout. */
export function describeWorkout(text: string, list: Exercise[]): ParsedWorkout {
  const parts = pieces(normalize(text));
  const found: (ParsedExercise & { text: string })[] = [];
  const unread: string[] = [];
  let title: string | null = null;

  parts.forEach((piece, p) => {
    const { name, rest } = splitName(piece);
    const current = found[found.length - 1];
    if (!name || (carriesOn(name) && rest)) {
      if (current && rest) current.text += ` , ${rest}`;
      else unread.push(piece);
      return;
    }
    const nextIsSets = !!parts[p + 1] && !splitName(parts[p + 1]).name;
    if (!rest && !nextIsSets) {
      // A bare line: the session's name if it comes first, else a lift
      // with no sets yet, else something we couldn't read.
      const exact = matchExercise(name, list, 100);
      if (!found.length && !title && !exact) {
        title = name.charAt(0).toUpperCase() + name.slice(1);
        return;
      }
      const ex = exact ?? matchExercise(name, list);
      if (!ex) {
        unread.push(piece);
        return;
      }
      found.push({ name, exercise: ex, sets: [], text: '' });
      return;
    }
    found.push({
      name,
      exercise: matchExercise(name, list),
      sets: [],
      text: rest,
    });
  });

  return {
    title,
    exercises: found.map(({ text: t, ...e }) => ({
      ...e,
      sets: readSets(t, e.exercise),
    })),
    unread,
  };
}

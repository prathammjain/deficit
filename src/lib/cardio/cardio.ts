/**
 * cardio.ts: runs, rides, rows, swims and the rest. Pure, no storage.
 *
 * Cardio never changes the food target. The weekly check in already works
 * out real burn from intake and the weight trend, so whatever cardio someone
 * does is in their maintenance once it shows on the scale. Adding a session's
 * calories on top would count it twice, and wrist devices estimate those
 * calories badly anyway (Shcherbina et al. 2017: the best of seven was off by
 * 27% on average). So a session keeps time, distance, pace, heart rate and
 * effort, and no calories.
 *
 * Weekly minutes follow the WHO 2020 guidelines for adults: 150 to 300
 * minutes of moderate aerobic activity, or 75 to 150 of vigorous, or a mix,
 * with a vigorous minute worth two moderate ones. Effort comes from the talk
 * test, which the user picks.
 *
 * Progress is measured only against the user's own history, the same way
 * lifts and HYROX are: records carry across breaks and switches.
 */

import { isFinished, summarize, type Sim } from '../hyrox/race';
import { addDays, inPeriod, type Period } from '../train/progress';
import type { Workout } from '../train/workout';

export type CardioKind =
  | 'run'
  | 'walk'
  | 'ride'
  | 'row'
  | 'ski'
  | 'swim'
  | 'stairs'
  | 'other';

export type Effort = 'light' | 'moderate' | 'vigorous';

export interface CardioSession {
  id: string;
  kind: CardioKind;
  /** Day key, YYYY-MM-DD. */
  date: string;
  /** When it started, ms since epoch. */
  startedAt: number;
  /** Moving time. */
  ms: number;
  km?: number | null;
  avgHr?: number | null;
  effort: Effort;
}

/** How a kind is shown: its pace unit and the distances it keeps bests for. */
export interface KindDef {
  id: CardioKind;
  label: string;
  /** Distance is typed in km or in metres. Null: no distance. */
  unit: 'km' | 'm' | null;
  /** Pace per km, per 500 m or per 100 m, or speed in km/h. */
  pace: 'perKm' | 'per500' | 'per100' | 'kmh' | null;
  /** Distances in km that get a best time. */
  marks: number[];
  /** The plural for "3 runs". */
  plural: string;
  /** Fastest believable pace, ms per km: faster is a typo. */
  fastestMsPerKm?: number;
}

export const KINDS: KindDef[] = [
  {
    id: 'run',
    label: 'Run',
    plural: 'runs',
    unit: 'km',
    pace: 'perKm',
    marks: [1, 5, 10, 21.0975, 42.195],
    fastestMsPerKm: 120_000,
  },
  {
    id: 'walk',
    label: 'Walk',
    plural: 'walks',
    unit: 'km',
    pace: 'perKm',
    marks: [5, 10],
    fastestMsPerKm: 240_000,
  },
  {
    id: 'ride',
    label: 'Ride',
    plural: 'rides',
    unit: 'km',
    pace: 'kmh',
    marks: [20, 40, 100],
    fastestMsPerKm: 45_000,
  },
  {
    id: 'row',
    label: 'Row',
    plural: 'rows',
    unit: 'm',
    pace: 'per500',
    marks: [0.5, 2, 5, 10],
    fastestMsPerKm: 150_000,
  },
  {
    id: 'ski',
    label: 'SkiErg',
    plural: 'SkiErg sessions',
    unit: 'm',
    pace: 'per500',
    marks: [0.5, 1, 2, 5],
    fastestMsPerKm: 150_000,
  },
  {
    id: 'swim',
    label: 'Swim',
    plural: 'swims',
    unit: 'm',
    pace: 'per100',
    marks: [0.4, 1, 1.5],
    fastestMsPerKm: 450_000,
  },
  {
    id: 'stairs',
    label: 'Stairs',
    plural: 'stair sessions',
    unit: null,
    pace: null,
    marks: [],
  },
  {
    id: 'other',
    label: 'Other',
    plural: 'other sessions',
    unit: null,
    pace: null,
    marks: [],
  },
];

export const kindOf = (id: CardioKind): KindDef =>
  KINDS.find((k) => k.id === id) ?? KINDS[KINDS.length - 1];

/** The talk test, the way the WHO and the CDC describe intensity. */
export const EFFORTS: { id: Effort; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Easy to chat or sing' },
  { id: 'moderate', label: 'Moderate', hint: 'You can talk, not sing' },
  { id: 'vigorous', label: 'Vigorous', hint: 'Only a few words at a time' },
];

/** WHO 2020: weekly moderate equivalent minutes, and muscle strengthening days. */
export const WHO_MIN = 150;
export const WHO_UPPER = 300;
export const WHO_STRENGTH_DAYS = 2;

const MIN = 60_000;
const HOUR = 60 * MIN;

// ------------------------------------------------------------ Clocks

/** "45:07" or "1:02:30". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "5 km", "21.1 km", "2,000 m". */
export function distanceText(km: number, kind: CardioKind): string {
  if (kindOf(kind).unit === 'm') {
    return `${Math.round(km * 1000).toLocaleString('en-US')} m`;
  }
  return `${Number(km.toFixed(km < 10 ? 2 : 1))} km`;
}

/** What a mark is called: "5 km", "Half marathon", "2,000 m". */
export function markName(km: number, kind: CardioKind): string {
  if (kind === 'run' && km === 21.0975) return 'Half marathon';
  if (kind === 'run' && km === 42.195) return 'Marathon';
  return distanceText(km, kind);
}

// ------------------------------------------------------------ Pace

/** ms per km, or null without a distance. */
export function msPerKm(s: CardioSession): number | null {
  return s.km && s.km > 0 ? s.ms / s.km : null;
}

/** "5:12 /km", "1:48 /500 m", "2:05 /100 m", "28.4 km/h". */
export function paceText(perKmMs: number, kind: CardioKind): string {
  switch (kindOf(kind).pace) {
    case 'perKm':
      return `${clock(perKmMs)} /km`;
    case 'per500':
      return `${clock(perKmMs / 2)} /500 m`;
    case 'per100':
      return `${clock(perKmMs / 10)} /100 m`;
    case 'kmh':
      return `${(HOUR / perKmMs).toFixed(1)} km/h`;
    default:
      return '';
  }
}

/** The pace of a session, as text, or "" without a distance. */
export function sessionPace(s: CardioSession): string {
  const p = msPerKm(s);
  return p == null ? '' : paceText(p, s.kind);
}

// ------------------------------------------------------------ Checking

/** Why a session can't be saved, or null when it can. */
export function checkSession(s: {
  kind: CardioKind;
  ms: number;
  km?: number | null;
  avgHr?: number | null;
}): string | null {
  if (!(s.ms > 0)) return 'Add how long it took.';
  if (s.ms >= 24 * HOUR) return 'That’s more than a day. Check the time.';
  const def = kindOf(s.kind);
  if (s.km != null && def.unit) {
    if (!(s.km > 0)) return 'Distance has to be more than zero.';
    if (def.fastestMsPerKm && s.ms / s.km < def.fastestMsPerKm) {
      return `That pace is faster than the world record. Check the distance and time.`;
    }
  }
  if (s.avgHr != null && (s.avgHr < 30 || s.avgHr > 230)) {
    return 'Heart rate looks off. It should be beats a minute, like 145.';
  }
  return null;
}

// ------------------------------------------------------------ Weekly minutes

export interface Minutes {
  moderate: number;
  vigorous: number;
  /** Moderate plus twice vigorous: what the WHO guideline counts. */
  equivalent: number;
  /** Light minutes: logged, not counted toward the guideline. */
  light: number;
}

/**
 * Aerobic minutes in a period. A finished HYROX sim counts as vigorous: it
 * is run at race effort.
 */
export function minutes(
  sessions: CardioSession[],
  sims: Sim[],
  p: Period,
): Minutes {
  let moderate = 0;
  let vigorous = 0;
  let light = 0;
  for (const s of sessions) {
    if (!inPeriod(s.date, p)) continue;
    const m = s.ms / MIN;
    if (s.effort === 'vigorous') vigorous += m;
    else if (s.effort === 'moderate') moderate += m;
    else light += m;
  }
  for (const sim of sims) {
    if (isFinished(sim) && inPeriod(sim.date, p)) {
      vigorous += summarize(sim).totalMs / MIN;
    }
  }
  const r = Math.round;
  return {
    moderate: r(moderate),
    vigorous: r(vigorous),
    light: r(light),
    equivalent: r(moderate + 2 * vigorous),
  };
}

/** Days with lifting in a period: the WHO's muscle strengthening days. */
export function strengthDays(workouts: Workout[], p: Period): number {
  return new Set(workouts.filter((w) => inPeriod(w.date, p)).map((w) => w.date))
    .size;
}

// ------------------------------------------------------------ Records

export interface CardioBest {
  ms: number;
  date: string;
  id: string;
}

export interface KindRecords {
  kind: CardioKind;
  count: number;
  /** Best time at each mark the user has covered, shortest mark first. */
  marks: { km: number; best: CardioBest }[];
  longestKm: (CardioBest & { km: number }) | null;
  longestMs: CardioBest | null;
}

const oldestFirst = (xs: CardioSession[]) =>
  [...xs].sort((a, b) => a.startedAt - b.startedAt);

/**
 * A session counts for a mark when it covered the mark and at most 5% more:
 * the time at the mark is its pace times the mark. Much longer sessions are
 * left out, since an even pace over 12 km says little about a best 5 km.
 */
function timeAt(s: CardioSession, mark: number): number | null {
  if (!s.km || s.km < mark || s.km > mark * 1.05) return null;
  return (s.ms * mark) / s.km;
}

export function kindRecords(
  sessions: CardioSession[],
  kind: CardioKind,
): KindRecords {
  const own = oldestFirst(sessions).filter((s) => s.kind === kind);
  const marks = kindOf(kind).marks.flatMap((mark) => {
    let best: CardioBest | null = null;
    for (const s of own) {
      const t = timeAt(s, mark);
      if (t != null && (!best || t < best.ms)) {
        best = { ms: t, date: s.date, id: s.id };
      }
    }
    return best ? [{ km: mark, best }] : [];
  });
  let longestKm: KindRecords['longestKm'] = null;
  let longestMs: CardioBest | null = null;
  for (const s of own) {
    if (s.km && (!longestKm || s.km > longestKm.km)) {
      longestKm = { km: s.km, ms: s.ms, date: s.date, id: s.id };
    }
    if (!longestMs || s.ms > longestMs.ms) {
      longestMs = { ms: s.ms, date: s.date, id: s.id };
    }
  }
  return { kind, count: own.length, marks, longestKm, longestMs };
}

/**
 * Ids of sessions that beat every earlier time at one of their kind's
 * marks. A first time at a mark is not a record: there was nothing to beat.
 */
export function recordSessions(sessions: CardioSession[]): Set<string> {
  const best = new Map<string, number>();
  const out = new Set<string>();
  for (const s of oldestFirst(sessions)) {
    for (const mark of kindOf(s.kind).marks) {
      const t = timeAt(s, mark);
      if (t == null) continue;
      const key = `${s.kind}:${mark}`;
      const prev = best.get(key);
      if (prev != null && t < prev) out.add(s.id);
      if (prev == null || t < prev) best.set(key, t);
    }
  }
  return out;
}

/** Kinds logged, most sessions first. */
export function kindsDone(sessions: CardioSession[]): CardioKind[] {
  const n = new Map<CardioKind, number>();
  for (const s of sessions) n.set(s.kind, (n.get(s.kind) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

// ------------------------------------------------------------ Trend

export interface PaceTrend {
  /** Pace of each session with a distance, oldest first, ms per km. */
  paces: number[];
  /** Total time over total distance in the last 28 days. */
  recentMsPerKm: number | null;
  /** The same for the 28 days before that. */
  beforeMsPerKm: number | null;
  /** The first session's pace: the start of the legacy. */
  firstMsPerKm: number;
  /** Sessions in the last 28 days. */
  recentCount: number;
}

const pooled = (xs: CardioSession[]) => {
  const km = xs.reduce((t, s) => t + (s.km ?? 0), 0);
  const ms = xs.reduce((t, s) => t + s.ms, 0);
  return km > 0 ? ms / km : null;
};

/** Null until the kind has a session with a distance. */
export function paceTrend(
  sessions: CardioSession[],
  kind: CardioKind,
  today: string,
): PaceTrend | null {
  const own = oldestFirst(sessions).filter(
    (s) => s.kind === kind && s.km && s.km > 0,
  );
  if (!own.length) return null;
  const recentStart = addDays(today, -27);
  const beforeStart = addDays(today, -55);
  const recent = own.filter((s) => s.date >= recentStart && s.date <= today);
  const before = own.filter(
    (s) => s.date >= beforeStart && s.date < recentStart,
  );
  return {
    paces: own.map((s) => s.ms / (s.km as number)),
    recentMsPerKm: pooled(recent),
    beforeMsPerKm: pooled(before),
    firstMsPerKm: own[0].ms / (own[0].km as number),
    recentCount: recent.length,
  };
}

// ------------------------------------------------------------ The check in

export interface CardioJump {
  /** Aerobic minutes (cardio and HYROX) in the last 7 days. */
  recent: number;
  /** The average week across the 4 weeks before. */
  usual: number;
}

/**
 * A clear rise in aerobic training: at least half as much again as the
 * usual week, and at least an hour more. The check in mentions it next to a
 * higher burn. It never changes the maths.
 */
export function cardioJump(
  sessions: CardioSession[],
  sims: Sim[],
  today: string,
): CardioJump | null {
  const total = (start: string, end: string) => {
    const m = minutes(sessions, sims, { kind: 'week', start, end });
    return m.moderate + m.vigorous + m.light;
  };
  const recent = total(addDays(today, -6), today);
  const usual = Math.round(total(addDays(today, -34), addDays(today, -7)) / 4);
  if (recent >= usual * 1.5 && recent - usual >= 60) return { recent, usual };
  return null;
}

// ------------------------------------------------------------ Lifting nearby

/** Within this of each other, lifting and cardio count as one sitting. */
export const NEAR_MS = 3 * HOUR;

/**
 * True when a workout and this session were less than 3 hours apart, end to
 * start. Schumann et al. 2022 (43 studies): lifting and cardio together don't
 * hold back muscle size or maximal strength, but can blunt gains in power,
 * mostly when done in the same session; 3 hours apart, the effect wasn't
 * significant.
 */
export function nearLifting(s: CardioSession, workouts: Workout[]): boolean {
  const start = s.startedAt;
  const end = s.startedAt + s.ms;
  return workouts.some((w) => {
    const ws = Date.parse(w.startedAt);
    const we = Date.parse(w.endedAt);
    if (!Number.isFinite(ws) || !Number.isFinite(we)) return false;
    const gap = Math.max(ws - end, start - we, 0);
    return gap < NEAR_MS;
  });
}

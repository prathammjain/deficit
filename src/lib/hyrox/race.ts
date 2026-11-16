/**
 * race.ts: the HYROX race as data, and the maths on a simulation. Pure, no
 * storage, no React.
 *
 * The format never changes between events: eight 1 km runs, each followed
 * by one station, always in the same order. Divisions change only the loads
 * and the wall ball. Loads below are the singles divisions for season
 * 2026/27, from hyrox.com (the race page) and the published rulebook
 * figures; sled loads include the sled. Check them against the new
 * rulebook each season.
 *
 * Time between a station and the next run (the Roxzone) is not a separate
 * lap here: a run lap runs from leaving one station to starting the next,
 * so Roxzone time lands in the runs. That keeps a sim to 16 taps.
 */

export const SEASON = '2026/27';

export type Division = 'open_women' | 'open_men' | 'pro_women' | 'pro_men';

export const DIVISIONS: { id: Division; label: string }[] = [
  { id: 'open_women', label: 'Open women' },
  { id: 'open_men', label: 'Open men' },
  { id: 'pro_women', label: 'Pro women' },
  { id: 'pro_men', label: 'Pro men' },
];

export type StationId =
  | 'ski'
  | 'sled_push'
  | 'sled_pull'
  | 'burpee_broad_jumps'
  | 'row'
  | 'farmers_carry'
  | 'sandbag_lunges'
  | 'wall_balls';

/** Loads per division: [open women, open men, pro women, pro men]. */
type ByDivision<T> = Record<Division, T>;
const by = <T>(ow: T, om: T, pw: T, pm: T): ByDivision<T> => ({
  open_women: ow,
  open_men: om,
  pro_women: pw,
  pro_men: pm,
});

interface StationDef {
  id: StationId;
  name: string;
  /** What the station asks of a division, e.g. "50 m at 152 kg". */
  work: ByDivision<string>;
}

export const STATIONS: StationDef[] = [
  {
    id: 'ski',
    name: 'SkiErg',
    work: by('1,000 m', '1,000 m', '1,000 m', '1,000 m'),
  },
  {
    id: 'sled_push',
    name: 'Sled push',
    work: by(
      '50 m at 102 kg',
      '50 m at 152 kg',
      '50 m at 152 kg',
      '50 m at 202 kg',
    ),
  },
  {
    id: 'sled_pull',
    name: 'Sled pull',
    work: by(
      '50 m at 78 kg',
      '50 m at 103 kg',
      '50 m at 103 kg',
      '50 m at 153 kg',
    ),
  },
  {
    id: 'burpee_broad_jumps',
    name: 'Burpee broad jumps',
    work: by('80 m', '80 m', '80 m', '80 m'),
  },
  {
    id: 'row',
    name: 'Row',
    work: by('1,000 m', '1,000 m', '1,000 m', '1,000 m'),
  },
  {
    id: 'farmers_carry',
    name: 'Farmers carry',
    work: by(
      '200 m, 2 × 16 kg',
      '200 m, 2 × 24 kg',
      '200 m, 2 × 24 kg',
      '200 m, 2 × 32 kg',
    ),
  },
  {
    id: 'sandbag_lunges',
    name: 'Sandbag lunges',
    work: by(
      '100 m at 10 kg',
      '100 m at 20 kg',
      '100 m at 20 kg',
      '100 m at 30 kg',
    ),
  },
  {
    id: 'wall_balls',
    name: 'Wall balls',
    work: by(
      '100 reps, 4 kg to 2.70 m',
      '100 reps, 6 kg to 3.00 m',
      '100 reps, 6 kg to 2.70 m',
      '100 reps, 9 kg to 3.00 m',
    ),
  },
];

export type Segment =
  | { kind: 'run'; n: number }
  | { kind: 'station'; n: number; id: StationId };

/** Full race, or one half (runs and stations 1 to 4, or 5 to 8). */
export type Part = 'full' | 'first' | 'second';

export const PARTS: { id: Part; label: string; detail: string }[] = [
  { id: 'full', label: 'Full sim', detail: '8 runs and 8 stations' },
  { id: 'first', label: 'First half', detail: 'Runs and stations 1 to 4' },
  { id: 'second', label: 'Second half', detail: 'Runs and stations 5 to 8' },
];

export function segments(part: Part): Segment[] {
  const from = part === 'second' ? 5 : 1;
  const to = part === 'first' ? 4 : 8;
  const out: Segment[] = [];
  for (let n = from; n <= to; n++) {
    out.push({ kind: 'run', n });
    out.push({ kind: 'station', n, id: STATIONS[n - 1].id });
  }
  return out;
}

/** Stable key for a segment: run1..run8, or the station id. */
export const segmentKey = (s: Segment) =>
  s.kind === 'run' ? `run${s.n}` : s.id;

export function segmentName(s: Segment): string {
  return s.kind === 'run' ? `Run ${s.n}` : STATIONS[s.n - 1].name;
}

export function segmentWork(s: Segment, division: Division): string {
  return s.kind === 'run' ? '1 km' : STATIONS[s.n - 1].work[division];
}

/** A finished or running simulation. Times are epoch ms. */
export interface Sim {
  id: string;
  /** Local day key it started. */
  date: string;
  division: Division;
  part: Part;
  startedAt: number;
  /** When each segment ended, in order. */
  laps: number[];
}

export interface Split {
  segment: Segment;
  key: string;
  ms: number;
}

export function splits(sim: Sim): Split[] {
  const segs = segments(sim.part);
  return sim.laps.slice(0, segs.length).map((at, i) => ({
    segment: segs[i],
    key: segmentKey(segs[i]),
    ms: at - (i === 0 ? sim.startedAt : sim.laps[i - 1]),
  }));
}

export const isFinished = (sim: Sim) =>
  sim.laps.length >= segments(sim.part).length;

export interface SimSummary {
  totalMs: number;
  runMs: number;
  stationMs: number;
  /**
   * How much slower the later runs were than the earlier ones, as a share
   * (0.1 = 10% slower). Needs at least two runs; null otherwise.
   */
  runFade: number | null;
}

export function summarize(sim: Sim): SimSummary {
  const sp = splits(sim);
  const runs = sp.filter((s) => s.segment.kind === 'run').map((s) => s.ms);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const half = Math.floor(runs.length / 2);
  const runFade =
    runs.length >= 2
      ? avg(runs.slice(runs.length - half)) / avg(runs.slice(0, half)) - 1
      : null;
  return {
    totalMs: sum(sp.map((s) => s.ms)),
    runMs: sum(runs),
    stationMs: sum(
      sp.filter((s) => s.segment.kind === 'station').map((s) => s.ms),
    ),
    runFade,
  };
}

/**
 * Your best time for every segment across earlier sims. Stations only count
 * sims in the same division, since the loads differ; a 1 km run is a 1 km
 * run in any division.
 */
export function bests(sims: Sim[], division: Division): Map<string, number> {
  const out = new Map<string, number>();
  for (const sim of sims) {
    for (const s of splits(sim)) {
      if (s.segment.kind === 'station' && sim.division !== division) continue;
      const cur = out.get(s.key);
      if (cur == null || s.ms < cur) out.set(s.key, s.ms);
    }
  }
  return out;
}

export interface Gap {
  segment: Segment;
  key: string;
  /** Time lost against your best, ms (positive = slower). */
  lostMs: number;
}

/**
 * Where this sim lost the most time against your own bests from earlier
 * sims, biggest first. Empty when there is nothing earlier to compare with.
 */
export function whereYouLostTime(sim: Sim, earlier: Sim[], top = 3): Gap[] {
  const best = bests(earlier, sim.division);
  return splits(sim)
    .flatMap((s) => {
      const b = best.get(s.key);
      return b == null || s.ms <= b
        ? []
        : [{ segment: s.segment, key: s.key, lostMs: s.ms - b }];
    })
    .sort((a, b) => b.lostMs - a.lostMs)
    .slice(0, top);
}

/** 754000 → "12:34", 3_754_000 → "1:02:34". */
export function raceClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

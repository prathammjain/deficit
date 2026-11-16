/**
 * progress.ts: HYROX over time. Pure, no storage.
 *
 * A sim only compares with sims of the same shape: totals within one
 * division and one part (full or half), stations within one division, runs
 * within one format (see bests in race.ts). Everything is measured against
 * the user's own history.
 */

import {
  division as divisionOf,
  isFinished,
  segmentKey,
  segments,
  splits,
  summarize,
  type Division,
  type Part,
  type Segment,
  type Sim,
} from './race';

const oldestFirst = (sims: Sim[]) =>
  [...sims].filter(isFinished).sort((a, b) => a.startedAt - b.startedAt);

/** Finished sims of one division and part, oldest first. */
export function series(sims: Sim[], division: Division, part: Part): Sim[] {
  return oldestFirst(sims).filter(
    (s) => s.division === division && s.part === part,
  );
}

/** The parts this division has finished sims for, full first. */
export function partsDone(sims: Sim[], division: Division): Part[] {
  return (['full', 'first', 'second'] as Part[]).filter(
    (p) => series(sims, division, p).length > 0,
  );
}

export interface Trend {
  count: number;
  /** Totals in ms, oldest first. */
  totals: number[];
  bestMs: number;
  /** Latest minus first: negative means faster. */
  sinceFirstMs: number;
  /** Latest minus the one before: negative means faster. */
  sinceLastMs: number;
}

/** Null until there are two sims to compare. */
export function trend(
  sims: Sim[],
  division: Division,
  part: Part,
): Trend | null {
  const s = series(sims, division, part);
  if (s.length < 2) return null;
  const totals = s.map((x) => summarize(x).totalMs);
  const last = totals[totals.length - 1];
  return {
    count: s.length,
    totals,
    bestMs: Math.min(...totals),
    sinceFirstMs: last - totals[0],
    sinceLastMs: last - totals[totals.length - 2],
  };
}

export interface StationRow {
  segment: Segment;
  key: string;
  bestMs: number;
  latestMs: number;
  /** Latest minus the time before it: negative means faster. */
  changeMs: number | null;
  /** Every time for this station, oldest first. */
  times: number[];
}

/** Each station this division has done, in race order. */
export function stationBoard(sims: Sim[], division: Division): StationRow[] {
  const times = new Map<string, number[]>();
  for (const sim of oldestFirst(sims)) {
    if (sim.division !== division) continue;
    for (const s of splits(sim)) {
      if (s.segment.kind !== 'station') continue;
      times.set(s.key, [...(times.get(s.key) ?? []), s.ms]);
    }
  }
  return segments('full')
    .filter((seg) => seg.kind === 'station' && times.has(segmentKey(seg)))
    .map((seg) => {
      const t = times.get(segmentKey(seg)) as number[];
      return {
        segment: seg,
        key: segmentKey(seg),
        bestMs: Math.min(...t),
        latestMs: t[t.length - 1],
        changeMs: t.length > 1 ? t[t.length - 1] - t[t.length - 2] : null,
        times: t,
      };
    });
}

export interface Best {
  ms: number;
  date: string;
}

export interface HyroxRecords {
  /** Best total per part, for this division. */
  totals: Partial<Record<Part, Best>>;
  /** Fastest 1 km run in this division's format. */
  fastestRun: Best | null;
}

export function hyroxRecords(sims: Sim[], division: Division): HyroxRecords {
  const totals: Partial<Record<Part, Best>> = {};
  let fastestRun: Best | null = null;
  const format = divisionOf(division).format;
  for (const sim of oldestFirst(sims)) {
    if (sim.division === division) {
      const ms = summarize(sim).totalMs;
      const cur = totals[sim.part];
      if (!cur || ms < cur.ms) totals[sim.part] = { ms, date: sim.date };
    }
    if (divisionOf(sim.division).format !== format) continue;
    for (const s of splits(sim)) {
      if (s.segment.kind !== 'run') continue;
      if (!fastestRun || s.ms < fastestRun.ms) {
        fastestRun = { ms: s.ms, date: sim.date };
      }
    }
  }
  return { totals, fastestRun };
}

/** Finished sims that started on a day inside [start, end]. */
export function simsBetween(sims: Sim[], start: string, end: string): Sim[] {
  return oldestFirst(sims).filter((s) => s.date >= start && s.date <= end);
}

/**
 * How many sims between start and end set a new best total for their
 * division and part. A first ever sim is not a record: there was nothing
 * to beat.
 */
export function recordsSetBetween(
  sims: Sim[],
  start: string,
  end: string,
): number {
  const ids = recordSims(sims);
  return oldestFirst(sims).filter(
    (s) => ids.has(s.id) && s.date >= start && s.date <= end,
  ).length;
}

/** Ids of the sims that beat every earlier total of their division and part. */
export function recordSims(sims: Sim[]): Set<string> {
  const best = new Map<string, number>();
  const out = new Set<string>();
  for (const sim of oldestFirst(sims)) {
    const key = `${sim.division}:${sim.part}`;
    const ms = summarize(sim).totalMs;
    const prev = best.get(key);
    if (prev != null && ms < prev) out.add(sim.id);
    if (prev == null || ms < prev) best.set(key, ms);
  }
  return out;
}

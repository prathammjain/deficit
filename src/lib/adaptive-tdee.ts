/**
 * adaptive-tdee.ts — learn the user's REAL maintenance from their data
 * (white paper §12). Pure math, no storage.
 *
 * Mifflin-St Jeor is only a starting estimate; everyone's true expenditure
 * differs by hundreds of calories. Given a trailing window of daily intake and
 * body-weight check-ins we can back out actual TDEE from energy balance:
 *
 *   dailySurplus(kcal) = intake − TDEE
 *   weightChange/day(kg) = dailySurplus / 7700      (7700 kcal ≈ 1 kg)
 *   ⇒ TDEE = avgIntake − (kg/day trend) × 7700
 *
 * The weight trend is a least-squares slope over the weigh-ins (robust to the
 * day-to-day water-weight noise that wrecks naive endpoint differences). We
 * only surface an estimate once there's enough data to trust it.
 */

import { KCAL_PER_KG_FAT } from './targets';

export interface DailyDatum {
  /** YYYY-MM-DD. */
  date: string;
  /** Total calories eaten that day; null/0/absent = not logged. */
  intakeKcal?: number | null;
  /** Morning weight that day; null/absent = not weighed. */
  weightKg?: number | null;
}

export type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface AdaptiveTdee {
  confidence: Confidence;
  /** Days with a real intake log. */
  intakeDays: number;
  /** Number of weigh-ins used. */
  weighIns: number;
  /** Calendar span (days) covered by the weigh-ins. */
  spanDays: number;
  /** Smoothed weight trend (negative = losing). null until enough weigh-ins. */
  trendKgPerWeek: number | null;
  avgIntakeKcal: number | null;
  /** Data-driven maintenance estimate. null until confidence > 'none'. */
  estimatedTdeeKcal: number | null;
}

export interface AdaptiveOptions {
  /** Minimum logged intake days to produce any estimate. Default 7. */
  minIntakeDays?: number;
  /** Minimum weigh-ins to produce any estimate. Default 3. */
  minWeighIns?: number;
  /** Minimum calendar span (days) of weigh-ins. Default 7. */
  minSpanDays?: number;
}

const EPOCH_DAY = 86_400_000;
const toDayIndex = (isoDate: string): number =>
  Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / EPOCH_DAY);

export function estimateAdaptiveTdee(
  data: DailyDatum[],
  opts: AdaptiveOptions = {},
): AdaptiveTdee {
  const minIntakeDays = opts.minIntakeDays ?? 7;
  const minWeighIns = opts.minWeighIns ?? 3;
  const minSpanDays = opts.minSpanDays ?? 7;

  const intakes = data.filter(
    (d) => typeof d.intakeKcal === 'number' && (d.intakeKcal as number) > 0,
  );
  const weights = data
    .filter((d) => typeof d.weightKg === 'number' && (d.weightKg as number) > 0)
    .map((d) => ({ x: toDayIndex(d.date), y: d.weightKg as number }))
    .sort((a, b) => a.x - b.x);

  const intakeDays = intakes.length;
  const weighIns = weights.length;
  const spanDays =
    weighIns >= 2 ? weights[weighIns - 1].x - weights[0].x : 0;

  const avgIntakeKcal =
    intakeDays > 0
      ? Math.round(
          intakes.reduce((s, d) => s + (d.intakeKcal as number), 0) /
            intakeDays,
        )
      : null;

  const slopeKgPerDay = weighIns >= 2 ? leastSquaresSlope(weights) : null;
  const trendKgPerWeek =
    slopeKgPerDay != null ? round1(slopeKgPerDay * 7) : null;

  const enough =
    intakeDays >= minIntakeDays &&
    weighIns >= minWeighIns &&
    spanDays >= minSpanDays &&
    slopeKgPerDay != null &&
    avgIntakeKcal != null;

  const estimatedTdeeKcal =
    enough && avgIntakeKcal != null && slopeKgPerDay != null
      ? Math.round(avgIntakeKcal - slopeKgPerDay * KCAL_PER_KG_FAT)
      : null;

  const confidence: Confidence = !enough
    ? 'none'
    : intakeDays >= 14 && weighIns >= 8 && spanDays >= 14
      ? 'high'
      : intakeDays >= 10 && weighIns >= 5 && spanDays >= 10
        ? 'medium'
        : 'low';

  return {
    confidence,
    intakeDays,
    weighIns,
    spanDays,
    trendKgPerWeek,
    avgIntakeKcal,
    estimatedTdeeKcal,
  };
}

/**
 * Recommended daily target from a TDEE estimate, holding the user's chosen
 * deficit, never below the floor.
 */
export function recommendedTarget(
  estimatedTdeeKcal: number,
  dailyDeficitKcal: number,
  floorKcal: number,
): number {
  return Math.max(floorKcal, Math.round(estimatedTdeeKcal - dailyDeficitKcal));
}

/** Ordinary least-squares slope of y over x. Assumes ≥2 points, varied x. */
function leastSquaresSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

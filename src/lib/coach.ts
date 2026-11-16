/**
 * coach.ts — the weekly check in that turns the adaptive estimate into the
 * maintenance every target is built on. Pure, no storage.
 *
 * adaptive-tdee.ts backs out real expenditure from intake and the weight
 * trend. On its own that number is noisy week to week, so the coach moves
 * toward it gradually: last week's maintenance (the formula, the first time)
 * plus a share of the gap, the share growing with the estimate's confidence.
 * That is ordinary shrinkage of a noisy measurement toward what we already
 * believed. The step cap and the BMR bounds are guards against bad logging,
 * not physiology claims.
 *
 * A week without a trustworthy estimate changes nothing: an inactive user
 * keeps their target and is never told off for it.
 */

import type { AdaptiveTdee } from './adaptive-tdee';

export interface CoachState {
  /** The maintenance the targets use, set at the last check in. */
  maintenanceKcal: number;
  /** YYYY-MM-DD of the last check in. */
  on: string;
  /** What it replaced, so the user can keep last week's for one more week. */
  previousKcal?: number;
}

/** Days between check ins. */
export const CHECK_IN_EVERY_DAYS = 7;

/** Most one check in can move maintenance. */
export const COACH_MAX_STEP_KCAL = 250;

/** Share of the gap to the estimate taken per check in. */
const TRUST: Record<Exclude<AdaptiveTdee['confidence'], 'none'>, number> = {
  low: 0.35,
  medium: 0.6,
  high: 0.85,
};

/** Maintenance is held between BMR and this multiple of it. */
const MAX_BMR_MULTIPLE = 2.5;

const DAY_MS = 86_400_000;
const dayIndex = (iso: string) =>
  Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

export function isCheckInDue(
  coach: CoachState | undefined,
  today: string,
): boolean {
  return !coach || dayIndex(today) - dayIndex(coach.on) >= CHECK_IN_EVERY_DAYS;
}

export function daysUntilCheckIn(coach: CoachState, today: string): number {
  return Math.max(
    0,
    CHECK_IN_EVERY_DAYS - (dayIndex(today) - dayIndex(coach.on)),
  );
}

/**
 * The new coach state for a check in, or null when there is nothing
 * trustworthy to learn from this week.
 */
export function checkIn(input: {
  coach: CoachState | undefined;
  adaptive: AdaptiveTdee | null;
  formulaKcal: number;
  bmr: number;
  today: string;
}): CoachState | null {
  const { coach, adaptive, formulaKcal, bmr, today } = input;
  if (
    !adaptive ||
    adaptive.confidence === 'none' ||
    adaptive.estimatedTdeeKcal == null
  ) {
    return null;
  }
  const prior = coach?.maintenanceKcal ?? formulaKcal;
  const pulled =
    prior + TRUST[adaptive.confidence] * (adaptive.estimatedTdeeKcal - prior);
  const stepped = clamp(
    pulled,
    prior - COACH_MAX_STEP_KCAL,
    prior + COACH_MAX_STEP_KCAL,
  );
  const maintenanceKcal = Math.round(
    clamp(stepped, bmr, bmr * MAX_BMR_MULTIPLE),
  );
  return { maintenanceKcal, on: today, previousKcal: prior };
}

/** Undo this week's change: last week's number, held until the next check in. */
export function keepLastWeek(coach: CoachState): CoachState {
  if (coach.previousKcal == null) return coach;
  return { maintenanceKcal: coach.previousKcal, on: coach.on };
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

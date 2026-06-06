/**
 * targets.ts — the deterministic math engine (white paper §8).
 *
 * NO AI here. Maintenance calories, deficit, and macro splits are all
 * closed-form formulas. This module is pure (no React Native imports) so it is
 * unit-testable and runs identically on the client and on the server.
 *
 * The one rule: same input -> same output, every time.
 */

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type ProteinMode = 'auto' | 'manual';

/** Activity multipliers applied to BMR to get TDEE (§8.2). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** ~7,700 kcal ≈ 1 kg of body fat (§8.3). */
export const KCAL_PER_KG_FAT = 7700;

/** Safety clamps on the requested loss rate (§8.3). Faster isn't better. */
export const MIN_RATE_KG_WEEK = 0.25;
export const MAX_RATE_KG_WEEK = 1.0;

/**
 * Absolute calorie floor. The target is never allowed below the user's BMR,
 * and never below this hard floor either, whichever is higher (§8.3).
 */
export const ABSOLUTE_KCAL_FLOOR = 1200;

/** Macro coefficients (§8.4). */
export const PROTEIN_G_PER_KG = 1.8; // preserve muscle in a deficit
export const FAT_G_PER_KG = 0.8; // hormone health floor
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARB = 4;
export const KCAL_PER_G_FAT = 9;

export interface ProfileInput {
  sex: Sex;
  /** Age in years. */
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  /** Desired loss rate in kg/week (will be clamped to a safe range). */
  goalRateKgWeek: number;
  proteinMode?: ProteinMode;
  /** Used only when proteinMode === 'manual'. */
  manualProteinG?: number;
}

export interface Targets {
  bmr: number;
  /** TDEE — what the white paper calls "maintenance calories". */
  maintenanceKcal: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  dailyDeficitKcal: number;
  /** The loss rate actually applied after safety clamping. */
  appliedRateKgWeek: number;
  /** True if we reduced the requested deficit/rate for safety. */
  clamped: boolean;
  /** A gentle, user-facing explanation when we clamped. */
  safetyNote?: string;
}

const round = (n: number) => Math.round(n);

/**
 * Basal Metabolic Rate — Mifflin-St Jeor (§8.1), the current standard.
 * weight in kg, height in cm, age in years.
 */
export function bmrMifflinStJeor(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const { sex, weightKg, heightCm, age } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return round(sex === 'male' ? base + 5 : base - 161);
}

/** Total Daily Energy Expenditure = BMR × activity factor (§8.2). */
export function tdee(bmr: number, activityLevel: ActivityLevel): number {
  return round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

/** Clamp a requested loss rate to the safe range (§8.3). */
export function clampRate(rateKgWeek: number): number {
  if (Number.isNaN(rateKgWeek)) return MIN_RATE_KG_WEEK;
  return Math.min(MAX_RATE_KG_WEEK, Math.max(MIN_RATE_KG_WEEK, rateKgWeek));
}

/**
 * Macro split given a calorie target and bodyweight (§8.4).
 * Protein and fat are bodyweight-driven; carbs are the remainder.
 */
export function macroSplit(input: {
  targetKcal: number;
  weightKg: number;
  proteinMode?: ProteinMode;
  manualProteinG?: number;
}): { proteinG: number; carbsG: number; fatG: number } {
  const { targetKcal, weightKg, proteinMode = 'auto', manualProteinG } = input;

  const proteinG =
    proteinMode === 'manual' && typeof manualProteinG === 'number'
      ? round(manualProteinG)
      : round(PROTEIN_G_PER_KG * weightKg);

  const fatG = round(FAT_G_PER_KG * weightKg);

  const remainingKcal =
    targetKcal - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT;
  // Carbs absorb whatever's left; never go negative.
  const carbsG = Math.max(0, round(remainingKcal / KCAL_PER_G_CARB));

  return { proteinG, carbsG, fatG };
}

/**
 * The full target computation (§8.3–8.4) with safety clamps baked in.
 * This is the function the onboarding results screen calls.
 */
export function computeTargets(profile: ProfileInput): Targets {
  const { sex, age, heightCm, weightKg, activityLevel } = profile;

  const bmr = bmrMifflinStJeor({ sex, weightKg, heightCm, age });
  const maintenanceKcal = tdee(bmr, activityLevel);

  // 1. Clamp the requested rate to a sane range.
  const requestedRate = profile.goalRateKgWeek;
  const clampedRate = clampRate(requestedRate);
  let clamped = clampedRate !== requestedRate;

  // 2. Deficit from the (rate-clamped) loss rate.
  const requestedDeficit = (clampedRate * KCAL_PER_KG_FAT) / 7;

  // 3. Enforce the calorie floor: never below BMR, never below the hard floor.
  const floor = Math.max(bmr, ABSOLUTE_KCAL_FLOOR);
  let targetKcal = maintenanceKcal - requestedDeficit;

  if (targetKcal < floor) {
    // Cap the deficit so the target sits at the floor (but never above
    // maintenance — if even the floor exceeds TDEE, just eat at maintenance).
    targetKcal = Math.min(maintenanceKcal, floor);
    clamped = true;
  }

  targetKcal = round(targetKcal);
  const dailyDeficitKcal = round(maintenanceKcal - targetKcal);
  // Back out the rate the applied deficit actually represents.
  const appliedRateKgWeek =
    (dailyDeficitKcal * 7) / KCAL_PER_KG_FAT;

  const { proteinG, carbsG, fatG } = macroSplit({
    targetKcal,
    weightKg,
    proteinMode: profile.proteinMode,
    manualProteinG: profile.manualProteinG,
  });

  const safetyNote = clamped
    ? "We've set a safer pace — aggressive deficits backfire and erode muscle."
    : undefined;

  return {
    bmr,
    maintenanceKcal,
    targetKcal,
    proteinG,
    carbsG,
    fatG,
    dailyDeficitKcal,
    appliedRateKgWeek,
    clamped,
    safetyNote,
  };
}

/**
 * budget.ts — the live daily budget (white paper §9, the "what can I still eat?"
 * number). Pure math, no storage.
 *
 * This is the heart of goal #3: at any moment — including your last meal of the
 * day — `remainingKcal` tells you exactly how much you can still afford, with
 * any workouts you logged already credited back.
 *
 *   adjustedTarget = target + burned     (workouts raise your ceiling)
 *   remaining      = adjustedTarget − consumed
 *
 * Whether to credit exercise calories back is configurable (`eatBackFactor`),
 * because "eating back" 100% of a fuzzy fitness-tracker estimate is a common way
 * to stall fat loss. Default is to credit them fully; we can dial this down.
 */

export interface MacroProgress {
  consumedG: number;
  targetG: number;
  remainingG: number;
  /** 0..1 (can exceed 1 when over). */
  fraction: number;
}

export interface DailyBudget {
  targetKcal: number;
  consumedKcal: number;
  burnedKcal: number;
  /** Burned calories actually credited after the eat-back factor. */
  creditedBurnKcal: number;
  /** target + creditedBurn. */
  adjustedTargetKcal: number;
  /** adjustedTarget − consumed. Negative = over budget. */
  remainingKcal: number;
  /** consumed / adjustedTarget, clamped to [0, 1] for bars. */
  fraction: number;
  isOver: boolean;
}

export interface BudgetInput {
  targetKcal: number;
  consumedKcal: number;
  burnedKcal?: number;
  /** Fraction of burned calories to credit back (0..1). Default 1. */
  eatBackFactor?: number;
}

export function computeBudget(input: BudgetInput): DailyBudget {
  const target = Math.max(0, Math.round(input.targetKcal));
  const consumed = Math.max(0, Math.round(input.consumedKcal));
  const burned = Math.max(0, Math.round(input.burnedKcal ?? 0));
  const factor = clamp01(input.eatBackFactor ?? 1);

  const creditedBurn = Math.round(burned * factor);
  const adjustedTarget = target + creditedBurn;
  const remaining = adjustedTarget - consumed;
  const fraction =
    adjustedTarget > 0 ? clamp01(consumed / adjustedTarget) : consumed > 0 ? 1 : 0;

  return {
    targetKcal: target,
    consumedKcal: consumed,
    burnedKcal: burned,
    creditedBurnKcal: creditedBurn,
    adjustedTargetKcal: adjustedTarget,
    remainingKcal: remaining,
    fraction,
    isOver: remaining < 0,
  };
}

/** Progress against a single macro target (e.g. protein). */
export function macroProgress(consumedG: number, targetG: number): MacroProgress {
  const consumed = Math.max(0, Math.round(consumedG));
  const target = Math.max(0, Math.round(targetG));
  return {
    consumedG: consumed,
    targetG: target,
    remainingG: target - consumed,
    fraction: target > 0 ? consumed / target : 0,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * custom-entry.ts: the arithmetic behind a meal typed in by hand. Pure.
 *
 * Calories from macros use the general Atwater factors already used for
 * targets (4 kcal per gram of protein and carbs, 9 per gram of fat). Labels
 * round, and fibre and alcohol carry energy too, so a typed total that
 * differs a little from the macros is normal; only a big gap is worth a
 * second look.
 */

import {
  KCAL_PER_G_CARB,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
} from '../targets';

export interface Macros {
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

/** Share either way beyond which typed kcal and macros disagree. */
const MISMATCH = 0.25;

export function macroKcal(m: Macros): number {
  return Math.round(
    (m.proteinG ?? 0) * KCAL_PER_G_PROTEIN +
      (m.carbsG ?? 0) * KCAL_PER_G_CARB +
      (m.fatG ?? 0) * KCAL_PER_G_FAT,
  );
}

export type Check =
  | { kind: 'none' }
  /** No calories typed: the macros give them. */
  | { kind: 'fromMacros'; kcal: number }
  | { kind: 'mismatch'; kcal: number };

export function checkEntry(kcal: number | null, m: Macros): Check {
  const fromMacros = macroKcal(m);
  if (!fromMacros) return { kind: 'none' };
  if (!kcal) return { kind: 'fromMacros', kcal: fromMacros };
  return Math.abs(fromMacros - kcal) / kcal > MISMATCH
    ? { kind: 'mismatch', kcal: fromMacros }
    : { kind: 'none' };
}

/** "12", "12.5" or "" from whatever was typed: digits and one decimal. */
export function gramsInput(text: string): string {
  const clean = text.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = clean.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 1)}` : whole;
}

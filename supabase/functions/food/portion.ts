// portion.ts — how many of a candidate's serving were actually eaten.
//
// `quantity` is a multiplier of the chosen candidate's own serving string, and
// for a per-100g candidate that is simply grams / 100. Asking the model for it
// was the engine's single largest error source. From the live cache:
//
//   "milk 150 ml"          -> quantity 6   -> 414 kcal  (should be ~1.5, ~104)
//   "1 tablespoon ghee"    -> quantity 1   -> 876 kcal  (should be 0.14, ~123)
//
// The ghee entry was reported 'high' confidence, because the independent AI
// estimate repeated the same portion mistake, so the cross-check agreed with
// it. A cross-check cannot catch an error both sides make — this has to be
// arithmetic, not judgement.
//
// Separate from index.ts so it can be unit-tested: index.ts calls Deno.serve
// at module scope and cannot be imported from jest.

// @ts-nocheck

/** True when a serving label means "per 100 g/ml" rather than a countable
 *  home portion. Matches USDA's "100g" and IFCT's "100g cooked" /
 *  "100g raw (uncooked weight)", but never "1 katori (150g)". */
export function isPer100(serving: string): boolean {
  return /^100\s*(g|ml)\b/i.test(String(serving ?? ''));
}

/**
 * The multiplier to apply to a candidate's serving.
 *
 * Deterministic whenever the eaten amount was stated as a weight or measure
 * AND the candidate is per-100g. Otherwise the judge's own quantity stands:
 * for countable servings ("2 roti", "1.5 katori") the model's answer is the
 * right kind of answer, and guessing grams for an unstated portion would
 * replace one estimate with another.
 */
export function servingMultiplier(
  serving: string,
  statedGrams: unknown,
  judgedQuantity: number,
): number {
  const fallback = judgedQuantity > 0 ? judgedQuantity : 1;
  if (!isPer100(serving)) return fallback;
  const grams = Number(statedGrams);
  if (!Number.isFinite(grams) || grams <= 0) return fallback;
  // Floor at 0.01 so a tiny garnish still logs something rather than zero.
  return Math.max(0.01, Math.round(grams) / 100);
}

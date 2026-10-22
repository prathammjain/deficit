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

/** Grams (or ml) in one serving, when the label names them: "100g" -> 100,
 *  "1 tsp (5g)" -> 5, "1 katori (150g)" -> 150. Null for "1 glass". */
export function servingGrams(serving: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(g|ml)\b/i.exec(String(serving ?? ''));
  const grams = m ? Number(m[1]) : NaN;
  return grams > 0 ? grams : null;
}

/**
 * The multiplier for the AI's own estimate, used when no candidate matched.
 * Its serving is whatever the model wrote, often a home measure with its
 * weight in brackets. When the user stated an amount it is honoured against
 * that weight. Live case: "quarter tablespoon of ghee" was split as 3.5 g,
 * the model estimated "1 tsp (5g)" at 45 kcal, and quantity 1 logged the
 * whole teaspoon; 3.5 / 5 = 0.7 gives the ~31 kcal actually eaten.
 */
export function estimateMultiplier(
  serving: string,
  statedGrams: unknown,
  fallbackQuantity: number,
): number {
  const fallback = fallbackQuantity > 0 ? fallbackQuantity : 1;
  const grams = Number(statedGrams);
  const per = servingGrams(serving);
  if (!per || !Number.isFinite(grams) || grams <= 0) return fallback;
  return Math.max(0.01, Math.round((grams / per) * 100) / 100);
}

/** A portion the user stated is known, whatever the model thought: "100 gm
 *  paneer" came back 'unsure' and was labelled "portion uncertain". */
export function portionCertainty(
  statedGrams: unknown,
  judged: unknown,
): 'clear' | 'unsure' {
  const grams = Number(statedGrams);
  if (Number.isFinite(grams) && grams > 0) return 'clear';
  return judged === 'clear' ? 'clear' : 'unsure';
}

/**
 * quantity.ts — what an entry's `quantity` means, and how it moves.
 *
 * `quantity` is a multiplier of the entry's own serving string, and serving
 * strings come in two kinds:
 *
 *   countable  "1 katori (150g)", "1 piece (40g)"   1.5 means 1.5 katori
 *   weighed    "100g", "100g cooked", "100g raw…"  0.07 means 7 g
 *
 * Both used to be handled as countable: floored to 0.5 and stepped in halves.
 * For a weighed serving 0.5 is 50 g, so half a tablespoon of sugar — 0.07,
 * 27 kcal in the composer — was saved as 0.5, 193 kcal and 50 g of carbs, the
 * moment Log was tapped. The composer showed one number and the log kept
 * another, for every ingredient under 50 g: ghee, oil, sugar, nuts, besan.
 */

/** Same rule as `isPer100` in supabase/functions/food/portion.ts, which
 *  decides when the engine computes a quantity as grams / 100. Keep the two in
 *  step: this side decides how that quantity is shown and moved. */
const PER_100 = /^100\s*(g|ml)\b\s*(.*)$/i;

/** A serving meaning "per 100 g/ml" — its quantity is grams / 100. */
export function isWeighed(serving?: string): boolean {
  return PER_100.test(serving ?? '');
}

// Steps are worked in whole base units — grams, or half-servings — so a run of
// 5 g presses never drifts into 0.15000000000000002.
const WEIGHED = { scale: 100, step: 5 }; // 1 unit = 1 g; step 5 g
const COUNTABLE = { scale: 2, step: 1 }; // 1 unit = half a serving

/**
 * One press of the stepper: to the next grid point in that direction — 5 g
 * for weighed servings, half a serving for countable ones. An off-grid value,
 * like the engine's 7 g, goes to its neighbours: up to 10, down to 5.
 *
 * A press never moves the value the wrong way. At the bottom of the grid "−"
 * does nothing, rather than jumping up to a floor — that is how "−" on 7 g
 * used to land on 50 g. Removing an item is what ✕ is for.
 */
export function stepQuantity(
  serving: string | undefined,
  quantity: number,
  dir: 1 | -1,
): number {
  const { scale, step } = isWeighed(serving) ? WEIGHED : COUNTABLE;
  // Snap to 3 decimals of a unit first, so 0.07 * 100 reads as 7 exactly.
  const units = Math.round(quantity * scale * 1000) / 1000;
  const k = units / step;
  const next =
    dir > 0
      ? (Math.floor(k + 1e-9) + 1) * step
      : (Math.ceil(k - 1e-9) - 1) * step;
  return next > 0 ? next / scale : quantity;
}

/** A countable quantity as a person reads it: the engine may hand back
 *  1.3333, nobody wants to read that. */
const plain = (q: number) => `${Math.round(q * 100) / 100}`;

/**
 * The portion in words. Weighed: "7 g", keeping whatever the serving says
 * about its basis — "150 g cooked", "120 g raw (uncooked weight)" — because
 * 150 g of rice is three times the food raw as cooked. Countable:
 * "1.5 × 1 katori (150g)".
 */
export function quantityLabel(
  serving: string | undefined,
  quantity: number,
): string {
  const m = PER_100.exec(serving ?? '');
  if (!m) return `${plain(quantity)} × ${serving}`;
  const amount = `${Math.round(quantity * 100)} ${m[1].toLowerCase()}`;
  return m[2] ? `${amount} ${m[2]}` : amount;
}

/** The short form the stepper shows between its − and +. */
export function stepperLabel(
  serving: string | undefined,
  quantity: number,
): string {
  const m = PER_100.exec(serving ?? '');
  return m ? `${Math.round(quantity * 100)} ${m[1].toLowerCase()}` : plain(quantity);
}

/**
 * food/types.ts — the food-lookup contract.
 *
 * Every food source (the built-in Indian table today; FatSecret + Gemini later)
 * implements `FoodProvider`. The logging UI only ever talks to this interface,
 * so swapping in the real backend changes nothing upstream.
 */

export interface FoodItem {
  id: string;
  name: string;
  /** Human serving this row's macros describe, e.g. "1 roti", "1 katori (150g)". */
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source?: 'local' | 'fatsecret' | 'ai';
}

export interface ParsedMeal {
  items: { item: FoodItem; quantity: number }[];
  total: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  /** Any AI caveat, e.g. "estimated portion for dal". */
  note?: string;
}

export interface FoodProvider {
  readonly name: string;
  /** Free-text search over food names. */
  search(query: string, limit?: number): Promise<FoodItem[]>;
  /**
   * Optional: parse a natural-language meal ("2 roti, dal, 1 katori rice")
   * into structured items + totals. Implemented by the Gemini+FatSecret
   * provider; the local provider may omit it.
   */
  parseMeal?(text: string): Promise<ParsedMeal>;
}

/** Sum a list of (item × quantity) into a single macro total. Pure. */
export function totalMacros(
  items: { item: FoodItem; quantity: number }[],
): ParsedMeal['total'] {
  return items.reduce(
    (acc, { item, quantity }) => ({
      kcal: acc.kcal + Math.round(item.kcal * quantity),
      proteinG: acc.proteinG + Math.round(item.proteinG * quantity),
      carbsG: acc.carbsG + Math.round(item.carbsG * quantity),
      fatG: acc.fatG + Math.round(item.fatG * quantity),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

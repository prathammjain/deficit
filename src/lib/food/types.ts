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
  source?: 'local' | 'usda' | 'ai';
}

/**
 * How much to trust a single parsed item. The whole point of the hybrid engine
 * is to never hide a guess: when the AI and the food database don't clearly
 * agree, we say so ('low') instead of presenting a number as fact.
 */
export type Confidence = 'high' | 'medium' | 'low';

/** One line of a parsed meal: the chosen food, its portion, and how sure we are. */
export interface ParsedItem {
  item: FoodItem;
  /** Number of servings of `item`. */
  quantity: number;
  /** How sure we are this is the right food + portion. */
  confidence?: Confidence;
  /** One-line rationale, e.g. "matched Dal Tadka; 1 katori ≈ 150g". */
  reason?: string;
  /**
   * Other database candidates for this item, best-first, so the user can
   * correct a wrong match in one tap. This is the trust mechanism — the thing a
   * plain chatbot never gives you.
   */
  alternates?: FoodItem[];
}

export interface ParsedMeal {
  items: ParsedItem[];
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

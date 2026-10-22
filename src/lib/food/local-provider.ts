/**
 * local-provider.ts — a FoodProvider backed by the built-in Indian food table.
 *
 * Ranked substring/alias search, plus a heuristic `parseMeal` that turns a
 * free-text description ("2 roti, dal tadka, 1 katori rice") into an itemized
 * breakdown the user can verify and edit before logging. No network — this
 * ships as the default so logging works offline and before any API keys exist.
 *
 * The Gemini provider implements the SAME interface: its parseMeal sends the
 * text to Gemini (which normalizes Indian portions and custom household
 * recipes) and returns itemized macros. The UI never changes.
 */

import { isWeighed } from '../quantity';
import { INDIAN_FOODS, type IndianFood } from './indian-foods';
import {
  totalMacros,
  type Confidence,
  type FoodItem,
  type FoodProvider,
  type ParsedMeal,
} from './types';

const toItem = (f: IndianFood): FoodItem => ({
  id: f.id,
  name: f.name,
  serving: f.serving,
  kcal: f.kcal,
  proteinG: f.proteinG,
  carbsG: f.carbsG,
  fatG: f.fatG,
  source: 'local',
});

/** Score a food against a query. Higher is better; 0 = no match. */
function score(food: IndianFood, q: string): number {
  const name = food.name.toLowerCase();
  const aliases = (food.aliases ?? []).map((a) => a.toLowerCase());
  const hay = [name, ...aliases];

  if (hay.some((h) => h === q)) return 100;
  if (name.startsWith(q) || aliases.some((a) => a.startsWith(q))) return 80;
  if (hay.some((h) => h.includes(q))) return 60;
  const qTokens = q.split(/\s+/).filter(Boolean);
  const overlap = qTokens.filter((t) => hay.some((h) => h.includes(t))).length;
  return overlap > 0 ? 20 + overlap * 10 : 0;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
};

/** Portion/unit words we strip so they don't pollute the food-name match. */
const UNIT_WORDS = new Set([
  'katori',
  'katoris',
  'bowl',
  'bowls',
  'plate',
  'plates',
  'piece',
  'pieces',
  'pcs',
  'pc',
  'cup',
  'cups',
  'glass',
  'glasses',
  'slice',
  'slices',
  'g',
  'gram',
  'grams',
  'gm',
  'gms',
  'tbsp',
  'tsp',
  'serving',
  'servings',
  'of',
  'small',
  'medium',
  'large',
  'big',
  'full',
]);

/** A weight or volume: "150g", "1.5kg" (as 1500 g), "250ml". */
type Measure = { amount: number; unit: 'g' | 'ml' };

/** Split a meal description into individual food segments. A period ends a
 *  sentence ("2 roti. 1 katori dal") unless it sits between two digits, where
 *  it is a decimal point: "1.5 roti" is one segment, not "1" and "5 roti". */
export function splitSegments(text: string): string[] {
  return text
    .split(/,|\band\b|\+|\n|;|&|(?<!\d)\.|\.(?!\d)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Pull a leading quantity and clean the food name out of one segment. */
export function extractQuantity(segment: string): {
  quantity: number;
  name: string;
  measured?: Measure;
} {
  // Join "200 g" into "200g" so both forms read as one amount token.
  const tokens = segment
    .toLowerCase()
    .trim()
    .replace(/(\d)\s+(g|gm|gms|grams?|kg|ml)\b/g, '$1$2')
    .split(/\s+/);
  let quantity = 1;
  let started = false;
  let measured: Measure | undefined;

  const kept: string[] = [];
  for (const tok of tokens) {
    const asNum = Number(tok);
    if (!started && !Number.isNaN(asNum) && tok !== '') {
      quantity = asNum;
      started = true;
      continue;
    }
    if (!started && tok in NUMBER_WORDS) {
      quantity = NUMBER_WORDS[tok];
      started = true;
      continue;
    }
    started = true;
    if (UNIT_WORDS.has(tok)) continue;
    // a stated amount like "150g": keep it out of the name, but keep it
    const m = /^(\d+(?:\.\d+)?)(g|gm|gms|grams?|kg|ml)$/.exec(tok);
    if (m) {
      measured ??=
        m[2] === 'ml'
          ? { amount: Number(m[1]), unit: 'ml' }
          : { amount: Number(m[1]) * (m[2] === 'kg' ? 1000 : 1), unit: 'g' };
      continue;
    }
    kept.push(tok);
  }

  const name = kept.join(' ').trim();
  if (measured) return { quantity: 1, name, measured };
  return { quantity: quantity > 0 ? quantity : 1, name };
}

/**
 * The amount one serving weighs, when the serving says: "100g" (a weighed
 * serving, see quantity.ts) or the "(150g)" in "1 katori (150g)". A bare
 * "1 katori" or "1 cup" says nothing, and gets nothing.
 */
function servingMeasure(serving: string): Measure | undefined {
  if (isWeighed(serving))
    return { amount: 100, unit: /^100\s*ml/i.test(serving) ? 'ml' : 'g' };
  const m = /\((\d+(?:\.\d+)?)\s*(g|ml)\)/i.exec(serving);
  if (m)
    return {
      amount: Number(m[1]),
      unit: m[2].toLowerCase() as Measure['unit'],
    };
  return undefined;
}

/**
 * The local table is a small set of rough home-portion estimates, so it never
 * claims 'high' confidence — only the AI+FatSecret backend earns that. A strong
 * name/alias hit is 'medium'; a looser substring/token hit is 'low' (worth a
 * glance before logging).
 */
function localConfidence(score: number): Confidence {
  return score >= 80 ? 'medium' : 'low';
}

export class LocalFoodProvider implements FoodProvider {
  readonly name = 'local';

  /** Ranked matches (best first) with their scores. Shared by search + parse. */
  private rank(query: string): { item: FoodItem; score: number }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return INDIAN_FOODS.map((f) => ({ f, s: score(f, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name))
      .map((x) => ({ item: toItem(x.f), score: x.s }));
  }

  async search(query: string, limit = 12): Promise<FoodItem[]> {
    return this.rank(query)
      .slice(0, limit)
      .map((x) => x.item);
  }

  async parseMeal(text: string): Promise<ParsedMeal> {
    const segments = splitSegments(text);
    const items: ParsedMeal['items'] = [];
    const unmatched: string[] = [];

    for (const seg of segments) {
      const { quantity, name, measured } = extractQuantity(seg);
      if (!name) continue;
      const ranked = this.rank(name);
      if (ranked.length === 0) {
        unmatched.push(seg.trim());
        continue;
      }
      const [best, ...rest] = ranked;
      // A stated amount is scaled only against a serving that declares one in
      // the same unit. Otherwise it stays 1 serving, flagged, never converted.
      const per = measured && servingMeasure(best.item.serving);
      const scaled = measured && per && per.unit === measured.unit;
      items.push({
        item: best.item,
        quantity: scaled ? measured.amount / per.amount : quantity,
        confidence: measured && !scaled ? 'low' : localConfidence(best.score),
        ...(measured &&
          !scaled && {
            reason: `${measured.amount} ${measured.unit} not converted to ${best.item.serving} — check the portion`,
          }),
        // Up to 4 other guesses so a wrong match is a one-tap fix.
        alternates: rest.slice(0, 4).map((r) => r.item),
      });
    }

    return {
      items,
      total: totalMacros(items),
      note: unmatched.length
        ? `Couldn’t match: ${unmatched.join(', ')}. Add it as a custom item.`
        : undefined,
    };
  }
}

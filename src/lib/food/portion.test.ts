/**
 * The per-100g multiplier, which was the engine's worst error source. Both
 * failing cases below are real entries pulled from the live food_cache.
 */
import {
  isPer100,
  servingMultiplier,
} from '../../../supabase/functions/food/portion';

describe('isPer100', () => {
  it('recognises per-100 servings from every source', () => {
    expect(isPer100('100g')).toBe(true); // USDA
    expect(isPer100('100g cooked')).toBe(true); // IFCT, converted
    expect(isPer100('100g raw (uncooked weight)')).toBe(true); // IFCT, raw
    expect(isPer100('100 ml')).toBe(true);
  });

  it('does not mistake a countable home serving for one', () => {
    // "1 katori (150g)" names grams but is still counted in katoris.
    expect(isPer100('1 katori (150g)')).toBe(false);
    expect(isPer100('1 piece (40g)')).toBe(false);
    expect(isPer100('1 glass')).toBe(false);
    expect(isPer100('')).toBe(false);
  });
});

describe('servingMultiplier', () => {
  it('converts a stated volume (live bug: milk 150 ml logged 414 kcal)', () => {
    // The model returned quantity 6 against a 69 kcal/100g milk row.
    expect(servingMultiplier('100g', 150, 6)).toBe(1.5);
    expect(69 * servingMultiplier('100g', 150, 6)).toBeCloseTo(103.5);
  });

  it('converts a kitchen measure (live bug: 1 tbsp ghee logged 876 kcal)', () => {
    // The model returned quantity 1 against an 876 kcal/100g ghee row, and it
    // passed as 'high' because the AI cross-check repeated the same mistake.
    expect(servingMultiplier('100g', 14, 1)).toBe(0.14);
    expect(Math.round(876 * servingMultiplier('100g', 14, 1))).toBe(123);
  });

  it('keeps the judged quantity for countable servings', () => {
    // "2 roti" against "1 piece (40g)" is genuinely 2 — grams must not
    // hijack a serving that is counted rather than weighed.
    expect(servingMultiplier('1 piece (40g)', 80, 2)).toBe(2);
    expect(servingMultiplier('1 katori (150g)', 150, 1.5)).toBe(1.5);
  });

  it('keeps the judged quantity when no amount was stated', () => {
    // Stage 1 returns null rather than guessing a typical portion.
    expect(servingMultiplier('100g', null, 1.5)).toBe(1.5);
    expect(servingMultiplier('100g', undefined, 2)).toBe(2);
    expect(servingMultiplier('100g', 'a bowl', 1)).toBe(1);
    expect(servingMultiplier('100g', 0, 1)).toBe(1);
    expect(servingMultiplier('100g', -5, 1)).toBe(1);
  });

  it('falls back to 1 for a missing or nonsensical quantity', () => {
    expect(servingMultiplier('1 katori', null, 0)).toBe(1);
    expect(servingMultiplier('1 katori', null, NaN)).toBe(1);
  });

  it('never rounds a small amount away to zero', () => {
    expect(servingMultiplier('100g', 1, 1)).toBe(0.01);
  });
});

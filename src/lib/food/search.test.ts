/**
 * The engine's search over its own tables (supabase/functions/food/search.ts).
 * The first cases are what users hit on 13 November 2026: "100 grams soya
 * chunks" was matched to soya chunk curry, and plain paneer was listed after
 * Paneer Butter Masala and Paneer Tikka.
 */
import { ifctSearch } from '../../../supabase/functions/food/ifct';
import {
  byRelevance,
  indianSearch,
  matchScore,
  words,
} from '../../../supabase/functions/food/search';

/** What the judge is shown from the two tables, by name, in order. */
const shown = (q: string) =>
  byRelevance(indianSearch(q, 3), ifctSearch(q, 3)).map((r) => r.name);

describe('the cases users hit', () => {
  it('reads soya chunks as the dry chunks, not the curry', () => {
    for (const q of [
      'soya chunks',
      'soy chunks',
      'soya chunk',
      'nutrela',
      'meal maker',
    ]) {
      expect(shown(q)[0]).toBe('Soya Chunks (dry)');
    }
    const [dry] = indianSearch('soya chunks', 1);
    expect(dry.serving).toBe('100g'); // so a stated weight is grams / 100
    expect(dry.proteinG).toBe(52); // Nutrela label
    expect(dry.kcal).toBe(345);
  });

  it('still finds the curry when the curry is named', () => {
    expect(shown('soya chunk curry')[0]).toBe('Soya Chunk Curry');
    expect(shown('soya chunk sabzi')[0]).toBe('Soya Chunk Curry');
  });

  it('puts plain paneer before paneer dishes', () => {
    expect(shown('paneer')[0]).toBe('Paneer (raw)');
    expect(shown('raw paneer')[0]).toBe('Paneer (raw)');
    expect(shown('palak paneer')[0]).toBe('Palak Paneer');
  });
});

describe('ranking', () => {
  it('puts the ingredient before dishes that share a word', () => {
    // Today's search listed chicken biryani, curry and tikka first.
    expect(shown('chicken breast')).toEqual([
      'Chicken, poultry, breast, skinless',
    ]);
    expect(shown('potato')[0]).toMatch(/^Potato/);
    expect(shown('egg whites')).toEqual([
      'Egg, poultry, white, raw',
      'Egg, poultry, white, boiled',
    ]);
  });

  it('ignores plurals, word order and Hindi joiners', () => {
    expect(shown('almonds')[0]).toBe('Almond');
    expect(shown('aloo ka paratha')[0]).toBe('Aloo Paratha');
    expect(matchScore('rice white', ['White Rice'])).toBe(100);
  });

  it('forgives one slip in a longer word, but an exact word wins', () => {
    expect(shown('chiken breast')[0]).toBe(
      'Chicken, poultry, breast, skinless',
    );
    expect(shown('grilled paneer tika')).toContain('Paneer Tikka');
    // "chilla" is one letter from "chilly", but the dish holds the word itself.
    expect(shown('chilla')[0]).toBe('Moong Dal Chilla');
    // Two different foods, not a typo.
    expect(matchScore('beef', ['Beet'])).toBe(0);
  });

  it('reads a dish by its food, not by the word curry', () => {
    expect(shown('rajma curry')[0]).toBe('Rajma');
    expect(shown('anda curry')[0]).toBe('Egg Curry (2 eggs)');
  });

  it('keeps rows that share a word when nothing covers the whole food', () => {
    // "whole wheat roti" is in no table as such: the roti and the grain are
    // both worth showing the judge.
    const r = shown('whole wheat roti');
    expect(r).toContain('Roti / Chapati');
    expect(r.length).toBeGreaterThan(1);
  });

  it('scores the food itself above a dish built on it above a shared word', () => {
    const food = matchScore('paneer', ['Paneer (raw)']);
    const dish = matchScore('paneer', ['Paneer Butter Masala']);
    const word = matchScore('paneer tikka', ['Paneer (raw)']);
    expect(food).toBeGreaterThan(dish);
    expect(dish).toBeGreaterThan(word);
    expect(matchScore('paneer', ['Rajma'])).toBe(0);
    expect(matchScore('', ['Rajma'])).toBe(0);
  });
});

describe('searching with the name and the query', () => {
  it('keeps the better fit of the two for every row', () => {
    // The app named it "potato", the split asked for "boiled potato". With
    // one string per table, Aloo Paratha fit the name and IFCT's potatoes
    // only half fit the query, so the potatoes were dropped.
    const rows = byRelevance(
      indianSearch(['potato', 'boiled potato'], 3),
      ifctSearch(['boiled potato', 'potato'], 3),
    );
    expect(rows[0].name).toMatch(/^Potato/);
    expect(rows.map((r) => r.name)).toContain('Aloo Paratha');
  });
});

describe('words', () => {
  it('normalises the way both tables and people write', () => {
    expect(words('Soya Chunks (dry)')).toEqual(['soya', 'chunk', 'dry']);
    expect(words('Potatoes, Berries')).toEqual(['potato', 'berry']);
    expect(words('mixed vegetables')).toEqual(['mix', 'veg']);
    expect(words('maa ki dal')).toEqual(['maa', 'dal']);
    // A name that arrives with its amount is still the food.
    expect(words('100 grams soya chunks')).toEqual(['soya', 'chunk']);
    expect(words('30 gms soya chunks')).toEqual(['soya', 'chunk']);
    // A fat percentage is part of the food, so it is kept.
    expect(words('2% cottage cheese')).toEqual(['2pct', 'cottage', 'cheese']);
    expect(
      matchScore('2% cottage cheese', ['Paneer (raw)', 'cottage cheese']),
    ).toBeLessThan(61);
    expect(words('2 slices of whole wheat bread')).toEqual([
      'whole',
      'wheat',
      'bread',
    ]);
  });
});

describe('byRelevance', () => {
  it('keeps a dish row ahead of an IFCT row on a tie', () => {
    const local = [{ name: 'a', match: 80 }];
    const ifct = [{ name: 'b', match: 80 }];
    expect(byRelevance(local, ifct).map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('drops rows that share a word only when a row covers the food', () => {
    const rows = byRelevance(
      [{ name: 'dish', match: 30 }],
      [{ name: 'food', match: 98 }],
    );
    expect(rows.map((r) => r.name)).toEqual(['food']);
    const none = byRelevance(
      [{ name: 'dish', match: 30 }],
      [{ name: 'grain', match: 40 }],
    );
    expect(none.map((r) => r.name)).toEqual(['grain', 'dish']);
  });
});

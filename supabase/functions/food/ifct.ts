// ifct.ts — ingredient-level candidates from IFCT 2017 (ICMR-NIN).
//
// IFCT grounds INGREDIENTS, never dishes: millets, dals, Indian fish and meats,
// local vegetables — the foods USDA is weakest on. Cooked composite dishes
// (dal tadka, paneer paratha) stay with the curated table in _indian-foods.ts,
// which is the only source that knows home portions and recipe fats.
//
// This module is separate from index.ts so the yield arithmetic below can be
// unit-tested: index.ts calls Deno.serve at module scope and cannot be
// imported from jest. The conversion silently changes a calorie number, so it
// is the one part of this that must not ship untested.

// @ts-nocheck
import { IFCT_FOODS } from './_ifct.ts';

/**
 * IFCT names are botanical English ("Red gram, dal"); users and the meal
 * structurer write vernacular ("toor dal"). Only the staples that justify
 * preferring IFCT over USDA are aliased — the same hand-curated stance as
 * import-indb.py's TARGETS, kept short enough to audit against the book.
 *
 * Millets and beans already published under their Indian names need nothing
 * here: bajra A003, jowar A005, ragi A010, samai A016, varagu A017,
 * rajmah B018-B020.
 */
const IFCT_ALIASES: Record<string, string[]> = {
  B001: ['chana dal', 'bengal gram'],
  B003: ['urad dal', 'black gram'],
  B010: ['moong dal', 'green gram'],
  B013: ['masoor dal', 'lentil'],
  B021: ['toor dal', 'arhar dal', 'tur dal', 'red gram'],
  // Six rows start with "Rice" and all tie at 80, so without these the tie
  // broke on table order and plain rice — the most-logged staple here — did
  // not even make the top 3. An exact alias hit scores 100 and settles it.
  A013: ['brown rice'],
  A014: ['parboiled rice', 'sella rice'],
  A015: ['rice', 'white rice', 'cooked rice', 'chawal'],
  A011: ['poha'],
  A012: ['murmura'],
  A019: ['atta', 'wheat flour'],
  A022: ['suji', 'rava', 'semolina'],
};

/**
 * Cooked-to-raw weight ratio for the staples that absorb water.
 *
 * IFCT Table 1 has no cooked foods at all, so a raw row reaching the judge
 * unconverted invites it to read 100 g raw as 100 g eaten — a ~3x overcount on
 * the most-logged foods there are. Converting here, in code, keeps the
 * headline number off unverifiable model arithmetic:
 *
 *   cooked kcal/100g = raw kcal/100g / yield
 *
 * Cross-check at 3.0: A015 raw milled rice is 356 kcal/100 g -> 119 cooked,
 * against USDA cooked white rice at 130 and this app's own curated rice row
 * (200 kcal / 150 g = 133). Within ~10%, and deliberately on the low side,
 * because IFCT's raw figure carries no cooking fat.
 *
 * Deliberately short. A staple missing from here still surfaces as raw and is
 * caught by the judge's raw/as-eaten rule; extend it from eval evidence, not
 * from guesswork.
 */
const COOKED_YIELD: Record<string, number> = {
  A013: 3.0, A014: 3.0, A015: 3.0, // rice: brown, parboiled, milled
  A023: 2.2, A024: 2.2, // wheat vermicelli
  B001: 2.5, B002: 2.5, // bengal gram
  B003: 2.5, B004: 2.5, // black gram
  B010: 2.5, B011: 2.5, // green gram
  B013: 2.5, // lentil dal
  B018: 2.5, B019: 2.5, B020: 2.5, // rajmah
  B021: 2.5, // red gram
};

/** Eggs are the one food IFCT publishes already cooked; calling them raw
 *  would be false, and the state is in the name, so derive it. `\bboiled\b`
 *  deliberately does not match "parboiled" — that grain is still dry. */
const isCooked = (name: string) => /\b(boiled|omlet)\b/i.test(name);

/**
 * Ranked IFCT matches. Scoring is `indianSearch`'s, so an IFCT candidate is
 * structurally indistinguishable from a curated one apart from source,
 * serving and state.
 *
 * `max` caps distinct FOODS, not returned rows: a staple with a cooked yield
 * comes back twice, once per reading, so a grain or legume query can return up
 * to 2 x max. Everything else — fish, meat, vegetables, nuts — returns one row
 * per food, so the widening is confined to exactly the foods where raw vs
 * cooked is ambiguous.
 */
export function ifctSearch(query: string, max = 3) {
  const q = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!q) return [];
  const toks = q.split(/\s+/).filter(Boolean);
  return IFCT_FOODS.map((f: any) => {
    const name = f.name.toLowerCase();
    const aliases = (IFCT_ALIASES[f.code] ?? []).map((a: string) =>
      a.toLowerCase(),
    );
    const hay = [name, ...aliases];
    let s = 0;
    if (hay.some((h) => h === q)) s = 100;
    else if (name.startsWith(q) || aliases.some((a) => a.startsWith(q))) s = 80;
    else if (hay.some((h) => h.includes(q))) s = 60;
    else {
      const overlap = toks.filter((t) => hay.some((h) => h.includes(t))).length;
      s = overlap > 0 ? 20 + overlap * 10 : 0;
    }
    return { f, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .flatMap(({ f }) => {
      const scale = (y: number) => ({
        kcal: Math.round(f.kcal / y),
        proteinG: Math.round(f.proteinG / y),
        carbsG: Math.round(f.carbsG / y),
        fatG: Math.round(f.fatG / y),
      });
      const base = { name: String(f.name), source: 'ifct' as const };
      const y = COOKED_YIELD[f.code];

      if (!y) {
        const cooked = isCooked(f.name);
        return [{
          ...base,
          id: `ifct-${f.code}`,
          // The serving text is what the judge reads, and what the user sees
          // if they open the alternates list — so it must say which weight
          // this is.
          serving: cooked ? '100g' : '100g raw (uncooked weight)',
          state: cooked ? ('as-eaten' as const) : ('raw' as const),
          ...scale(1),
        }];
      }

      // A staple that absorbs water is genuinely two readings of one food, and
      // which one applies depends on what the user said: "1 katori rice" is
      // cooked, "100g dry rice" is raw. Offering only the cooked row made the
      // judge undercount a weighed-out dry portion ~3x, and contradicted the
      // prompt, which tells it to pick a raw candidate for "a measured weight
      // of dry grain". So offer both and let it choose. Cooked comes first:
      // it is much the commoner way people log these.
      return [
        {
          ...base,
          id: `ifct-${f.code}-cooked`,
          serving: '100g cooked',
          state: 'as-eaten' as const,
          ...scale(y),
        },
        {
          ...base,
          id: `ifct-${f.code}-raw`,
          serving: '100g raw (uncooked weight)',
          state: 'raw' as const,
          ...scale(1),
        },
      ];
    });
}

export { COOKED_YIELD, IFCT_ALIASES };

// search.ts — how a food the user ate is matched to rows of the engine's own
// tables: the curated dish table and IFCT.
//
// Both tables used to score a row by exact name, then prefix, then substring,
// then 20 plus 10 per shared word. Every dish that merely contained the word
// tied with the plain food: "paneer" put Paneer Butter Masala and Paneer Tikka
// level with Paneer (raw), "chicken breast" put three chicken dishes ahead of
// IFCT's breast, and "almonds" missed "Almond" because of the s.
//
// Now a row scores by how much of what was eaten it covers and how much it
// adds: a row that is the food itself beats a dish built on it, and a dish
// beats a row that only shares a word. IFCT's descriptors ("Potato, red skin",
// "Paneer (raw)") cost little, words that make another dish ("Potato Paratha")
// cost more. Plurals, word order, Hindi joiners ("aloo ka paratha") and one
// slip of the thumb in a longer word don't matter, but an exact word always
// beats a near one.
//
// Separate from index.ts so it can be unit tested: index.ts calls Deno.serve at
// module scope and cannot be imported from jest.

// @ts-nocheck
import { INDIAN_FOODS } from './_indian-foods.ts';

/** Words that never decide which food it is: joiners, and the amount, should
 *  a name arrive with it ("100 grams soya chunks"). Matched after plurals are
 *  folded, so "grams" and "slices" go too. */
const FILLER = new Set([
  ...['a', 'an', 'and', 'of', 'the', 'with', 'in', 'ka', 'ki', 'ke'],
  ...['g', 'gm', 'gms', 'gram', 'kg', 'ml', 'litre', 'liter', 'tbsp', 'tsp'],
  ...['tablespoon', 'teaspoon', 'cup', 'katori', 'bowl', 'plate', 'glass'],
  ...['piece', 'pc', 'pcs', 'slice', 'scoop', 'serving'],
]);

/** One spelling for words the tables and people write differently. */
const SAME: Record<string, string> = {
  vegetable: 'veg',
  mixed: 'mix',
  chilli: 'chilly',
  chili: 'chilly',
  yoghurt: 'yogurt',
};

/** Words that say what kind of dish, not which food: "rajma curry" is rajma. */
const GENERIC = new Set(['curry', 'masala', 'sabzi', 'subzi', 'gravy', 'dish']);

/** "chunks" -> "chunk", "potatoes" -> "potato", "berries" -> "berry". Applied
 *  to both sides, so it only has to be consistent, not correct English. */
function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(oes|ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us)$/.test(w)) return w.slice(0, -1);
  return w;
}

export function words(text: string): string[] {
  return (
    String(text ?? '')
      .toLowerCase()
      // A fat percentage names a different food ("2% cottage cheese" is not
      // paneer, whose alias is "cottage cheese"), so it stays, as "2pct".
      .replace(/(\d+(?:\.\d+)?)\s*%/g, ' $1pct ')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .map((w) => {
        const s = singular(w);
        return SAME[s] ?? s;
      })
      .filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w))
  );
}

/** A name read as what it is (`main`) plus how it is described (`qual`):
 *  "Chicken, poultry, breast, skinless" is chicken, described; "Paneer (raw)"
 *  is paneer, described. "Roti / Chapati" is two names. */
interface Name {
  main: string[];
  qual: string[];
}

/** Table names never change, so each is read once per instance. */
const readNames = new Map<string, Name[]>();

function readName(name: string): Name[] {
  const key = String(name ?? '');
  const known = readNames.get(key);
  if (known) return known;
  const read = key
    .split('/')
    .map((alt) => {
      const inBrackets = [...alt.matchAll(/\(([^)]*)\)/g)]
        .map((m) => m[1])
        .join(' ');
      const [head, ...rest] = alt.replace(/\([^)]*\)/g, ' ').split(',');
      return {
        main: words(head),
        qual: [...words(rest.join(' ')), ...words(inBrackets)],
      };
    })
    .filter((n) => n.main.length);
  readNames.set(key, read);
  return read;
}

/** True when one edit (a letter dropped, added, changed, or two swapped) turns
 *  a into b. Long words only: "tika" and "tikka" are a typo, "beef" and
 *  "beet" are two foods. */
function oneSlip(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (Math.min(a.length, b.length) < 4 || Math.max(a.length, b.length) < 5)
    return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // changed
    return (
      a[i] === b[i + 1] &&
      a[i + 1] === b[i] &&
      a.slice(i + 2) === b.slice(i + 2)
    ); // swapped
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i); // dropped or added
}

/** A word that stands for another without being it: a typo, or the start of
 *  a longer word ("pista" for "pistachio"). */
const near = (w: string, x: string) =>
  oneSlip(w, x) ||
  (w.length >= 4 && x.length >= w.length + 2 && x.startsWith(w));

/** How well one name fits what was eaten, 0 (not at all) to 100 (it is that). */
function fit(q: string[], n: Name): number {
  const all = [...n.main, ...n.qual];
  const used = new Set<string>();
  let covered = 0;
  let loose = 0;
  for (const w of q) {
    const hit = all.find((x) => x === w) ?? all.find((x) => near(w, x));
    if (hit === undefined) continue;
    covered++;
    if (hit !== w) loose++;
    used.add(hit);
  }
  if (!covered) return 0;
  const extraMain = n.main.filter((x) => !used.has(x)).length;
  const extraQual = n.qual.filter((x) => !used.has(x)).length;
  if (covered === q.length) {
    // It is the food, perhaps described: "paneer" and "Paneer (raw)".
    if (!loose && !extraMain) return 100 - extraQual;
    // It is built on the food: "paneer" and "Palak Paneer".
    return Math.max(61, 90 - 6 * extraMain - extraQual - 12 * loose);
  }
  // It shares a word. The last word of a food is usually what it is ("whole
  // wheat roti" is a roti), so a row holding that word ranks higher.
  const head = [...q].reverse().find((w) => !GENERIC.has(w)) ?? q[q.length - 1];
  const bonus = n.main.some((x) => x === head || near(head, x)) ? 10 : 0;
  const s =
    Math.round(20 + (30 * covered) / q.length) +
    bonus -
    2 * extraMain -
    3 * loose;
  return Math.max(1, Math.min(50, s));
}

/** The best fit of a query to a row, across its name and aliases. */
export function matchScore(query: string, names: string[]): number {
  const q = words(query);
  if (!q.length) return 0;
  let best = 0;
  for (const name of names)
    for (const n of readName(name)) best = Math.max(best, fit(q, n));
  return best;
}

/** Rows ranked by fit, best first; table order breaks ties. With several
 *  queries (the food as the user named it, and the split's English query),
 *  a row scores its best fit to any of them. */
export function rank<T>(
  query: string | string[],
  rows: T[],
  names: (row: T) => string[],
  max: number,
) {
  const queries = Array.isArray(query) ? query : [query];
  const fitOf = (row: T) =>
    Math.max(0, ...queries.map((q) => matchScore(q, names(row))));
  return rows
    .map((row) => ({ row, match: fitOf(row) }))
    .filter((x) => x.match > 0)
    .sort((a, b) => b.match - a.match)
    .slice(0, max);
}

/** Curated Indian home cooking table, ranked by name and alias. `match` is the
 *  fit, so these can be ordered with IFCT rows by relevance. */
export function indianSearch(query: string | string[], max = 3) {
  return rank(
    query,
    INDIAN_FOODS,
    (f: any) => [f.name, ...(f.aliases ?? [])],
    max,
  ).map(({ row: f, match }: any) => ({
    id: String(f.id),
    name: String(f.name),
    serving: String(f.serving),
    kcal: Math.round(f.kcal),
    proteinG: Math.round(f.proteinG),
    carbsG: Math.round(f.carbsG),
    fatG: Math.round(f.fatG),
    source: 'local' as const,
    match,
  }));
}

/** The highest score of a row that shares some words but not all. */
const PARTIAL = 50;

/**
 * What the judge is shown from the engine's own tables: dish rows and IFCT
 * rows together, most relevant first. They used to be listed by source, dishes
 * first, and models lean towards what comes first, so "chicken breast" was
 * shown three chicken dishes before the breast. On a tie the dish row stays
 * first. When some row covers every word of the food, rows that only share a
 * word ("White Rice" for egg whites) are noise for the judge and in the app's
 * list of alternatives, so they go. `match` is for the run log and is dropped
 * before the app sees a row.
 */
export function byRelevance<
  A extends { match?: number },
  B extends { match?: number },
>(local: A[], ifct: B[]): (A | B)[] {
  const rows = [...local, ...ifct].sort(
    (a, b) => (b.match ?? 0) - (a.match ?? 0),
  );
  const covers = (r: A | B) => (r.match ?? 0) > PARTIAL;
  return rows.some(covers) ? rows.filter(covers) : rows;
}

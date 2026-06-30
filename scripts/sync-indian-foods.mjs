// Generates supabase/functions/food/_indian-foods.ts from the canonical
// src/lib/food/indian-foods.ts so the Deno edge function can ground meals on
// the same curated Indian table the app uses. Run after editing the table:
//   node scripts/sync-indian-foods.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const SRC = 'src/lib/food/indian-foods.ts';
const OUT = 'supabase/functions/food/_indian-foods.ts';

const text = readFileSync(SRC, 'utf8');
const m = text.match(/INDIAN_FOODS[^=]*=\s*(\[[\s\S]*?\n\]);/);
if (!m) throw new Error(`Could not find INDIAN_FOODS array literal in ${SRC}`);

// The captured text is a plain array-of-objects literal from our own committed
// source. We evaluate it in an isolated VM context with an empty (null-proto)
// sandbox — no access to require/process/globals — so even a malformed table
// can only produce data, never run side effects. Safer than eval(); not user input.
const foods = runInNewContext(m[1], Object.create(null), { timeout: 1000 });
if (!Array.isArray(foods) || foods.length === 0) throw new Error('empty table');

const header =
  `// AUTO-GENERATED from ${SRC} by scripts/sync-indian-foods.mjs — do not edit by hand.\n` +
  `// Regenerate with: node scripts/sync-indian-foods.mjs\n\n`;
writeFileSync(
  OUT,
  header + `export const INDIAN_FOODS = ${JSON.stringify(foods, null, 2)};\n`,
);
console.log(`wrote ${foods.length} foods to ${OUT}`);

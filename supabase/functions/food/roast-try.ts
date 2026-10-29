// Try GrainAI's roast on sample meals, straight against Groq, without
// deploying. Prints every candidate and the one the app would show.
//
//   GROQ_API_KEY=... npx tsx supabase/functions/food/roast-try.ts
//   MODELS=qwen/qwen3.8-27b,openai/gpt-oss-120b  (optional, comma separated)
//
// On Groq's free tier Qwen allows about 1,000 output tokens a minute, so the
// script waits out rate limits rather than failing; a full run takes a few
// minutes.
//
// Not deployed: the function only bundles what index.ts imports.

import {
  parseCandidates,
  pickRoast,
  roastUserMessage,
  ROAST_SYSTEM,
  type RoastInput,
} from './roast.ts';

const day = (eaten: number, protein: number, hour: number) => ({
  eatenKcalBefore: eaten,
  targetKcal: 2200,
  proteinGBefore: protein,
  proteinTargetG: 140,
  localHour: hour,
});

const MEALS: RoastInput[] = [
  {
    meal: 'a chocolate brownie from mcdonalds',
    items: [{ name: 'Chocolate brownie', kcal: 380, proteinG: 4 }],
    day: day(1400, 70, 23),
  },
  {
    meal: '2 samosa and a cutting chai',
    items: [
      { name: 'Samosa', kcal: 520, proteinG: 8 },
      { name: 'Masala chai', kcal: 90, proteinG: 2 },
    ],
    day: day(900, 40, 17),
  },
  {
    meal: '200g chicken breast, 150g rice',
    items: [
      { name: 'Chicken breast, cooked', kcal: 330, proteinG: 62 },
      { name: 'Rice, cooked', kcal: 195, proteinG: 4 },
    ],
    day: day(800, 50, 13),
  },
  {
    meal: 'maggi',
    items: [{ name: 'Instant noodles', kcal: 350, proteinG: 7 }],
    day: day(1900, 90, 1),
  },
  {
    meal: '4 slices of dominos pizza',
    items: [{ name: 'Pizza slice', kcal: 1100, proteinG: 40 }],
    day: day(1200, 60, 21),
  },
  {
    meal: 'do roti ek katori dal',
    items: [
      { name: 'Roti', kcal: 240, proteinG: 8 },
      { name: 'Dal tadka', kcal: 180, proteinG: 9 },
    ],
    day: day(600, 30, 14),
  },
  {
    meal: 'one scoop whey with water',
    items: [{ name: 'Whey protein', kcal: 120, proteinG: 24 }],
    day: day(300, 20, 20),
  },
  {
    meal: '3 gulab jamun',
    items: [{ name: 'Gulab jamun', kcal: 450, proteinG: 6 }],
    day: day(2000, 100, 22),
  },
  {
    meal: 'greek yogurt with berries',
    items: [{ name: 'Greek yogurt', kcal: 150, proteinG: 15 }],
    day: day(1100, 90, 11),
  },
  {
    meal: 'full plate chicken biryani',
    items: [{ name: 'Chicken biryani', kcal: 750, proteinG: 30 }],
    day: day(1500, 80, 23),
  },
  {
    meal: '3 beers',
    items: [{ name: 'Beer', kcal: 450, proteinG: 3 }],
    day: day(1600, 70, 22),
  },
  {
    meal: 'paneer bhurji 200g',
    items: [{ name: 'Paneer bhurji', kcal: 520, proteinG: 34 }],
    day: day(900, 60, 20),
  },
];

const key = process.env.GROQ_API_KEY;
if (!key) throw new Error('Set GROQ_API_KEY');
const models = (process.env.MODELS ?? 'qwen/qwen3.8-27b').split(',');

async function main() {
  for (const model of models) {
    console.log(`\n=== ${model} ===`);
    for (const input of MEALS) {
      const started = Date.now();
      const res = await askWaiting(() =>
        fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: ROAST_SYSTEM },
              { role: 'user', content: roastUserMessage(input) },
            ],
            temperature: 1,
          }),
        }),
      );
      const ms = Date.now() - started;
      if (!res.ok) {
        console.log(
          `\n${input.meal}\n  error ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
        continue;
      }
      const data = await res.json();
      const candidates = parseCandidates(
        data?.choices?.[0]?.message?.content ?? '',
      );
      console.log(`\n${input.meal}  (${ms} ms)`);
      for (const c of candidates) console.log(`  . ${c}`);
      console.log(`  >> ${pickRoast(candidates) ?? '(nothing safe)'}`);
    }
  }
}

/** Retries a rate limited call after the wait Groq asks for (or 15 s). */
async function askWaiting(call: () => Promise<Response>): Promise<Response> {
  for (let tries = 0; ; tries++) {
    const res = await call();
    if (res.status !== 429 || tries >= 5) return res;
    const wait = Number(res.headers.get('retry-after')) || 15;
    console.log(`  (rate limited, waiting ${wait} s)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

main();

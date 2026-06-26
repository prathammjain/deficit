// Deficit — food Edge Function (Supabase / Deno). USDA-grounded, AI-judged.
//
// FatSecret's free tier IP-allowlists every request (max 15 IPs, no CIDR on the
// Basic tier) and a Supabase Edge Function's egress IP rotates — so it's blocked
// on every call. We ground on USDA FoodData Central instead: free API key, no IP
// lock, and the government reference dataset every other food API cites.
//
//   { action: 'parse',  text }  -> ParsedMeal   (Gemini → USDA → Gemini judge)
//   { action: 'health' }        -> { ok, gemini, usda }
//
// The engine is DB-anchored, AI-judged: USDA supplies real candidate foods +
// measured macros; Gemini maps the dish, picks the best candidate (or explicitly
// estimates), scales the portion, and attaches a confidence — so a guess is
// always flagged, never hidden.
//
// Deploy:
//   supabase functions deploy food --no-verify-jwt
//   supabase secrets set GEMINI_API_KEY=... USDA_API_KEY=...
//
// Targets the Deno runtime; excluded from the app's TS build (tsconfig).

// @ts-nocheck
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const MODEL = 'gemini-2.5-flash';

async function gemini(prompt: string): Promise<any> {
  const key = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    },
  );
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ---- USDA FoodData Central -------------------------------------------------
// Search returns measured macros per 100g; the AI judge scales the eaten grams.

async function usdaSearch(query: string, max = 5) {
  const key = Deno.env.get('USDA_API_KEY')?.trim();
  if (!key) throw new Error('USDA_API_KEY not set');
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        pageSize: max,
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
      }),
    },
  );
  const data = await res.json();
  const foods = Array.isArray(data?.foods) ? data.foods : [];
  return foods
    .map((f: any) => {
      const val = (id: number) => {
        const x = (f.foodNutrients ?? []).find((n: any) => n.nutrientId === id);
        return x ? Math.round(Number(x.value) || 0) : 0;
      };
      const kcal = val(1008) || val(2047) || val(2048); // energy (kcal) + Atwater fallbacks
      return {
        id: String(f.fdcId),
        name: String(f.description ?? '').trim(),
        serving: '100g',
        kcal,
        proteinG: val(1003),
        carbsG: val(1005),
        fatG: val(1004),
        source: 'usda' as const,
      };
    })
    .filter((c: any) => c.kcal > 0 && c.name);
}

// ---- Gemini: structure then judge -----------------------------------------

/** Stage 1 — split free text into items with a normalised portion + db query. */
async function geminiStructure(
  text: string,
): Promise<{ name: string; quantity: number; query: string }[]> {
  const parsed = await gemini(
    `You are a nutrition assistant for Indian food. Break this meal into individual food items. For each item return its display name, the quantity (number of servings as a decimal), and a concise English search query suitable for a food database like USDA (use generic ingredient terms, e.g. "cooked lentils dal", "wheat flatbread roti", "cooked white rice"). Normalise Indian portions (katori, roti, bowl, plate). Return ONLY JSON of the form {"items":[{"name":"","quantity":1,"query":""}]}.

Meal: ${text}`,
  );
  return Array.isArray(parsed.items) ? parsed.items : [];
}

interface JudgeDecision {
  chosen: number; // candidate index, or -1 to use `estimate`
  quantity: number; // servings of the candidate (its serving is 100g) actually eaten
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  estimate?: {
    name: string;
    serving: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

/** Stage 2 — judge each described item against its real USDA candidates. */
async function geminiJudge(
  described: { name: string; quantity: number }[],
  candidatesPerItem: any[][],
): Promise<JudgeDecision[]> {
  const payload = described.map((d, i) => ({
    index: i,
    eaten: d.name,
    statedQuantity: d.quantity,
    candidates: candidatesPerItem[i].map((c, ci) => ({
      i: ci,
      name: c.name,
      serving: c.serving, // always "100g" for USDA
      kcal: c.kcal,
      proteinG: c.proteinG,
      carbsG: c.carbsG,
      fatG: c.fatG,
    })),
  }));

  const parsed = await gemini(
    `You are grounding a food log. For each EATEN item you are given real USDA database CANDIDATES whose macros are per 100g. For each item return a decision:
- "chosen": the index i of the candidate that best matches the eaten food. If NONE is a reasonable match, use -1 and provide your own "estimate" (per-serving macros for a typical Indian home portion, with a "serving" label like "1 katori (150g)").
- "quantity": how many of that candidate's servings were eaten. The candidate serving is 100g, so convert the eaten portion to grams and divide by 100 (e.g. ate "1 katori dal ≈ 150g" => quantity 1.5; ate "2 roti ≈ 60g" => quantity 0.6).
- "confidence": "high" if a candidate clearly matches and the portion is clear; "medium" if the match is plausible but the portion is uncertain; "low" if you had to guess the food OR you used an estimate.
- "reason": one short clause, e.g. "matched cooked lentils, 1 katori ≈ 150g".
Be conservative: when in doubt, prefer "low" — a flagged guess is better than a hidden one.
Return ONLY JSON: {"decisions":[{"index":0,"chosen":0,"quantity":1.5,"confidence":"high","reason":"","estimate":null}]}.

Items: ${JSON.stringify(payload)}`,
  );
  return Array.isArray(parsed.decisions) ? parsed.decisions : [];
}

const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

// ---- handler --------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { action, text } = await req.json();

    if (action === 'health') {
      return json({
        ok: true,
        gemini: !!Deno.env.get('GEMINI_API_KEY')?.trim(),
        usda: !!Deno.env.get('USDA_API_KEY')?.trim(),
      });
    }

    if (action === 'parse') {
      const described = await geminiStructure(String(text ?? ''));
      if (described.length === 0) {
        return json({
          items: [],
          total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
        });
      }

      // Real USDA candidates for each item (top 5).
      const candidatesPerItem = await Promise.all(
        described.map((d) => usdaSearch(d.query || d.name, 5)),
      );

      const decisions = await geminiJudge(described, candidatesPerItem);

      const items: any[] = [];
      const unmatched: string[] = [];
      described.forEach((d, i) => {
        const candidates = candidatesPerItem[i] ?? [];
        const decision = decisions.find((x) => x.index === i) ?? decisions[i];
        const quantity = decision?.quantity || d.quantity || 1;
        const confidence = decision?.confidence ?? 'low';
        const reason = decision?.reason;
        const chosen = decision?.chosen ?? (candidates.length ? 0 : -1);

        if (chosen >= 0 && candidates[chosen]) {
          const picked = candidates[chosen];
          items.push({
            item: { ...picked, name: d.name || picked.name },
            quantity,
            confidence,
            reason,
            alternates: candidates.filter((_, ci) => ci !== chosen),
          });
        } else if (decision?.estimate) {
          const e = decision.estimate;
          items.push({
            item: {
              id: `ai-${i}`,
              name: e.name || d.name,
              serving: e.serving || '1 serving',
              kcal: num(e.kcal),
              proteinG: num(e.proteinG),
              carbsG: num(e.carbsG),
              fatG: num(e.fatG),
              source: 'ai',
            },
            quantity: chosen >= 0 ? quantity : d.quantity || 1,
            confidence: 'low',
            reason: reason || 'No USDA match — AI estimate.',
            alternates: candidates,
          });
        } else {
          unmatched.push(d.name);
        }
      });

      const total = items.reduce(
        (a, { item, quantity }) => ({
          kcal: a.kcal + Math.round(item.kcal * quantity),
          proteinG: a.proteinG + Math.round(item.proteinG * quantity),
          carbsG: a.carbsG + Math.round(item.carbsG * quantity),
          fatG: a.fatG + Math.round(item.fatG * quantity),
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      );

      return json({
        items,
        total,
        note: unmatched.length
          ? `Couldn’t match: ${unmatched.join(', ')}.`
          : undefined,
      });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

// Deficit — food Edge Function (Supabase / Deno).
//
// Keeps the FatSecret + Gemini secrets server-side. The app calls this with:
//   { action: 'search', query }   -> FoodItem[]
//   { action: 'parse',  text  }   -> ParsedMeal  (Gemini → FatSecret → totals)
//
// Deploy:
//   supabase functions deploy food --no-verify-jwt   (then flip JWT on if wanted)
//   supabase secrets set GEMINI_API_KEY=... FATSECRET_CLIENT_ID=... FATSECRET_CLIENT_SECRET=...
//
// NOTE: this file targets the Deno runtime and is excluded from the app's
// TypeScript build (see tsconfig "exclude"). It needs a live deploy + the three
// secrets before it does anything; until then the app uses the local provider.

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

// ---- FatSecret (OAuth2 client-credentials) -------------------------------

let fsToken: { value: string; expires: number } | null = null;

async function fatsecretToken(): Promise<string> {
  if (fsToken && Date.now() < fsToken.expires) return fsToken.value;
  const id = Deno.env.get('FATSECRET_CLIENT_ID');
  const secret = Deno.env.get('FATSECRET_CLIENT_SECRET');
  if (!id || !secret) throw new Error('FatSecret credentials not set');

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('FatSecret token failed');
  fsToken = {
    value: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return fsToken.value;
}

/** Pull kcal + macros out of FatSecret's food_description string. */
function parseDescription(desc: string) {
  const num = (re: RegExp) => {
    const m = desc.match(re);
    return m ? Math.round(parseFloat(m[1])) : 0;
  };
  return {
    kcal: num(/Calories:\s*([\d.]+)kcal/i),
    proteinG: num(/Protein:\s*([\d.]+)g/i),
    carbsG: num(/Carbs:\s*([\d.]+)g/i),
    fatG: num(/Fat:\s*([\d.]+)g/i),
    serving: (desc.split('-')[0] ?? '1 serving').trim(),
  };
}

async function fatsecretSearch(query: string, max = 8) {
  const token = await fatsecretToken();
  const params = new URLSearchParams({
    method: 'foods.search',
    search_expression: query,
    format: 'json',
    max_results: String(max),
  });
  const res = await fetch(
    `https://platform.fatsecret.com/rest/server.api?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  const foods = data?.foods?.food ?? [];
  const list = Array.isArray(foods) ? foods : [foods];
  return list.map((f: any) => {
    const m = parseDescription(f.food_description ?? '');
    return {
      id: String(f.food_id),
      name: f.food_name,
      serving: m.serving,
      kcal: m.kcal,
      proteinG: m.proteinG,
      carbsG: m.carbsG,
      fatG: m.fatG,
      source: 'fatsecret' as const,
    };
  });
}

// ---- Gemini ---------------------------------------------------------------
//
// The engine is API-anchored, AI-judged (two Gemini calls per meal, total):
//
//   1. STRUCTURE  free text        -> [{ name, quantity, query }]
//   2. FatSecret  each query       -> real candidate foods + macros
//   3. JUDGE      dish + candidates -> pick the best candidate (or estimate),
//                                      scale the portion, attach a confidence.
//
// This is the grounding the product is about: FatSecret keeps the AI honest
// (it can only choose a real food or *explicitly* estimate), and the AI keeps
// FatSecret honest (it rejects a wrong top hit and scales the portion). When
// the two don't clearly agree, the item comes back 'low' confidence so the app
// can flag it instead of presenting a guess as fact.

async function gemini(prompt: string): Promise<any> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
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

/** Stage 1 — split free text into items with a normalised portion + db query. */
async function geminiStructure(
  text: string,
): Promise<{ name: string; quantity: number; query: string }[]> {
  const parsed = await gemini(
    `You are a nutrition assistant for Indian food. Break this meal into individual food items. For each item return its display name, the quantity (number of servings as a decimal), and a concise search query suitable for a food database. Normalise Indian portions (katori, roti, bowl, plate). Return ONLY JSON of the form {"items":[{"name":"","quantity":1,"query":""}]}.

Meal: ${text}`,
  );
  return Array.isArray(parsed.items) ? parsed.items : [];
}

interface JudgeDecision {
  /** Index into the candidate list, or -1 to use `estimate` instead. */
  chosen: number;
  /** Servings of the chosen candidate (or of the estimate) actually eaten. */
  quantity: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  /** Only when chosen === -1: the AI's own per-serving estimate. */
  estimate?: {
    name: string;
    serving: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

/**
 * Stage 3 — for each described item, given its FatSecret candidates, decide
 * which one matches (or that none do and an estimate is needed), scale the
 * portion, and rate confidence. Batched into one call for all items.
 */
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
      serving: c.serving,
      kcal: c.kcal,
      proteinG: c.proteinG,
      carbsG: c.carbsG,
      fatG: c.fatG,
    })),
  }));

  const parsed = await gemini(
    `You are grounding a food log. For each EATEN item you are given real database CANDIDATES (with their per-serving macros). For each item return a decision:
- "chosen": the index i of the candidate that best matches the eaten food. If NONE is a reasonable match, use -1 and provide your own "estimate" (per-serving macros for a typical Indian home portion).
- "quantity": how many of that candidate's servings were actually eaten, scaling the stated quantity to the candidate's serving size (e.g. eaten "1 katori (150g)" but candidate serving is "100g" => quantity 1.5).
- "confidence": "high" if the candidate clearly matches and the portion is clear; "medium" if the match is plausible but portion is uncertain; "low" if you had to guess the food OR you used an estimate.
- "reason": one short clause, e.g. "matched Dal Tadka, scaled 1 katori to 1.5x".
Be conservative: when in doubt, prefer "low" — a flagged guess is better than a hidden one.
Return ONLY JSON: {"decisions":[{"index":0,"chosen":0,"quantity":1,"confidence":"high","reason":"","estimate":null}]}.

Items: ${JSON.stringify(payload)}`,
  );
  return Array.isArray(parsed.decisions) ? parsed.decisions : [];
}

// ---- handler -------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { action, query, text, limit } = await req.json();

    if (action === 'health') {
      // Cheap readiness probe — no external calls. Lets the app show whether
      // the grounded engine is live and which secrets are still missing.
      return json({
        ok: true,
        gemini: !!Deno.env.get('GEMINI_API_KEY'),
        fatsecret: !!(
          Deno.env.get('FATSECRET_CLIENT_ID') &&
          Deno.env.get('FATSECRET_CLIENT_SECRET')
        ),
      });
    }

    if (action === 'search') {
      const items = await fatsecretSearch(String(query ?? ''), limit ?? 8);
      return json({ items });
    }

    if (action === 'parse') {
      // 1. Structure the free text into items.
      const described = await geminiStructure(String(text ?? ''));
      if (described.length === 0) {
        return json({
          items: [],
          total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
        });
      }

      // 2. Pull real candidates for each item from FatSecret (top 5).
      const candidatesPerItem = await Promise.all(
        described.map((d) => fatsecretSearch(d.query || d.name, 5)),
      );

      // 3. Let the AI judge each item against its candidates.
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
            // Every other candidate, so the app offers a one-tap swap.
            alternates: candidates.filter((_, ci) => ci !== chosen),
          });
        } else if (decision?.estimate) {
          // No DB match — surface the AI estimate, explicitly low-confidence.
          const e = decision.estimate;
          items.push({
            item: {
              id: `ai-${i}`,
              name: e.name || d.name,
              serving: e.serving || '1 serving',
              kcal: Math.round(e.kcal) || 0,
              proteinG: Math.round(e.proteinG) || 0,
              carbsG: Math.round(e.carbsG) || 0,
              fatG: Math.round(e.fatG) || 0,
              source: 'ai',
            },
            quantity,
            confidence: 'low',
            reason: reason || 'No database match — AI estimate.',
            alternates: candidates, // still let the user pick a real food
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
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

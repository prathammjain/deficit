// Deficit — food Edge Function (Supabase / Deno). Indian-table + USDA grounded,
// AI cross-checked.
//
//   { action: 'parse',  text }  -> ParsedMeal
//   { action: 'health' }        -> { ok, gemini, usda }
//
// The engine grounds each food on real candidates from TWO sources — the app's
// curated Indian home-cooking table (home portions, ghee/butter included) and
// USDA FoodData Central (measured macros per 100g) — then Gemini picks the best
// match AND makes its own independent calorie estimate. We compare the two
// (cross-check): close agreement => trusted ('high'); real divergence, a guessed
// portion, or no DB match => flagged ('medium'/'low'). So a guess is surfaced,
// never hidden — and clearly-known foods stay quiet (no over-nagging).
//
// Deploy:
//   node scripts/sync-indian-foods.mjs   # refresh ./_indian-foods.ts from the app table
//   supabase functions deploy food --no-verify-jwt
//   supabase secrets set GEMINI_API_KEY=... USDA_API_KEY=...
//
// Targets the Deno runtime; excluded from the app's TS build (tsconfig).

// @ts-nocheck
import { INDIAN_FOODS } from './_indian-foods.ts';

// Browsers may only call this function from the deployed app or local dev.
// Native apps and server-side callers send no Origin header, so CORS doesn't
// apply to them — the auth gate below is what actually protects the engine.
const ALLOWED_ORIGINS = ['https://deficit-cyan.vercel.app'];
const isAllowedOrigin = (origin: string | null) =>
  !!origin &&
  (ALLOWED_ORIGINS.includes(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin));

const corsHeaders = (origin: string | null) => ({
  ...(isAllowedOrigin(origin)
    ? { 'Access-Control-Allow-Origin': origin! }
    : {}),
  Vary: 'Origin',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
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
  // Throw on rate-limit / quota / server errors so the caller falls back to the
  // local food table instead of silently returning an empty (blank) result.
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ---- Candidate sources -----------------------------------------------------
// Each candidate carries its own `serving` (Indian table: a home portion like
// "1 katori (150g)"; USDA: "100g") and macros per that serving. The judge says
// how many of that serving were eaten.

/** Curated Indian home-cooking table — ranked by name/alias match. */
function indianSearch(query: string, max = 3) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];
  const toks = q.split(/\s+/).filter(Boolean);
  return INDIAN_FOODS.map((f: any) => {
    const name = f.name.toLowerCase();
    const aliases = (f.aliases ?? []).map((a: string) => a.toLowerCase());
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
    .map(({ f }) => ({
      id: String(f.id),
      name: String(f.name),
      serving: String(f.serving),
      kcal: Math.round(f.kcal),
      proteinG: Math.round(f.proteinG),
      carbsG: Math.round(f.carbsG),
      fatG: Math.round(f.fatG),
      source: 'local' as const,
    }));
}

/** USDA FoodData Central search (measured macros per 100g). Branded excluded —
 *  it returns noisy keyword-matched packaged products that hurt precision. */
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
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
      }),
    },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const foods = Array.isArray(data?.foods) ? data.foods : [];
  return foods
    .map((f: any) => {
      const val = (id: number) => {
        const x = (f.foodNutrients ?? []).find((n: any) => n.nutrientId === id);
        return x ? Math.round(Number(x.value) || 0) : 0;
      };
      const kcal = val(1008) || val(2047) || val(2048);
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
    `You are a nutrition assistant for Indian food. Break this meal into individual food items. For each item return its display name, the quantity (number of servings as a decimal), and a concise English search query suitable for a food database (generic ingredient terms, e.g. "cooked lentils dal", "wheat flatbread roti", "cooked white rice"). Normalise Indian portions (katori, roti, bowl, plate). Return ONLY JSON of the form {"items":[{"name":"","quantity":1,"query":""}]}.

Meal: ${text}`,
  );
  return Array.isArray(parsed.items) ? parsed.items : [];
}

interface JudgeDecision {
  index: number;
  chosen: number; // candidate index, or -1 to use `estimate`
  quantity: number; // how many of the chosen candidate's serving were eaten
  aiEstimateKcal: number; // AI's OWN total-kcal estimate for the eaten portion
  portionCertainty: 'clear' | 'unsure';
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

/** Stage 2 — judge each described item against its real candidates, and make an
 *  independent estimate so we can cross-check the database number. */
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
      source: c.source, // 'local' (Indian home table) or 'usda'
      name: c.name,
      serving: c.serving, // "1 katori (150g)" for local, "100g" for usda
      kcal: c.kcal,
      proteinG: c.proteinG,
      carbsG: c.carbsG,
      fatG: c.fatG,
    })),
  }));

  const parsed = await gemini(
    `You are grounding a food log so its numbers can be trusted. For each EATEN item you get real CANDIDATE foods from two sources: a curated Indian home-cooking table ("local" — macros per the stated home serving, recipe fats included) and USDA ("usda" — macros per 100g). For each item return a decision:
- "chosen": index i of the candidate that best matches the eaten dish. PREFER a specific Indian-table ("local") match over a generic USDA one when both reasonably fit (e.g. real "Dal Tadka" over plain "cooked lentils"). If NONE is a reasonable match, use -1 and provide your own "estimate" (per-serving macros for a typical Indian home portion, with a "serving" label like "1 katori (150g)").
- "quantity": how many of the CHOSEN candidate's stated serving were eaten. (candidate serving "1 katori (150g)", ate ~1.5 katori => 1.5; candidate serving "100g", ate ~150g => 1.5.)
- "aiEstimateKcal": your OWN independent best estimate of the TOTAL calories for the eaten portion, from your knowledge of the dish. Do NOT just copy the candidate — this is an independent cross-check.
- "portionCertainty": "clear" if the eaten portion is well specified, "unsure" if you had to guess it.
- "reason": one short clause, e.g. "matched dal tadka, 1.5 katori".
Portion reference (use unless grams are given): 1 roti/chapati≈45g, 1 paratha≈80g, 1 naan≈90g, 1 katori (dal/curry/sabzi/rice)≈150g, 1 bowl≈200g, 1 idli≈40g, 1 dosa≈90g, 1 glass≈250ml.
Return ONLY JSON: {"decisions":[{"index":0,"chosen":0,"quantity":1.5,"aiEstimateKcal":220,"portionCertainty":"clear","reason":"","estimate":null}]}.

Items: ${JSON.stringify(payload)}`,
  );
  return Array.isArray(parsed.decisions) ? parsed.decisions : [];
}

const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/**
 * Confidence from the cross-check: how far the database number (scaled to the
 * eaten portion) is from the AI's independent estimate. Close + clear portion =>
 * 'high' (curated Indian foods get a slightly wider tolerance — they're trusted
 * home values); real divergence or a guessed portion => flagged. Never claim
 * 'high' when we couldn't cross-check.
 */
function calcConfidence(
  dbKcalTotal: number,
  aiKcal: number,
  portionCertainty: 'clear' | 'unsure',
  source: string,
): 'high' | 'medium' | 'low' {
  if (!aiKcal) return 'medium'; // no independent estimate => can't verify
  const base = Math.max(aiKcal, dbKcalTotal, 1);
  const gap = Math.abs(dbKcalTotal - aiKcal) / base;
  const tol = source === 'local' ? 0.25 : 0.2;
  if (portionCertainty === 'clear' && gap <= tol) return 'high';
  if (gap <= 0.4) return 'medium';
  return 'low';
}

function buildReason(
  confidence: 'high' | 'medium' | 'low',
  dbKcalTotal: number,
  aiKcal: number,
  portionCertainty: 'clear' | 'unsure',
  modelReason: string | undefined,
): string | undefined {
  if (confidence === 'high') return modelReason || undefined;
  if (!aiKcal) {
    return portionCertainty === 'unsure'
      ? 'Portion uncertain — double-check.'
      : modelReason || undefined;
  }
  const portionNote =
    portionCertainty === 'unsure' ? ', portion uncertain' : ' — recipe varies';
  return `Database ${Math.round(dbKcalTotal)} kcal vs AI estimate ~${Math.round(aiKcal)} kcal${portionNote}.`;
}

// ---- auth gate --------------------------------------------------------------
// The function is deployed with --no-verify-jwt (platform verification breaks
// CORS preflights and would accept the public anon key anyway), so this is the
// real gate: the bearer token must belong to a signed-in Supabase user.
// supabase-js v2 forwards the session token on functions.invoke automatically.

async function isSignedInUser(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) return false;
  const url = Deno.env.get('SUPABASE_URL');
  const apikey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !apikey) return false;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- result cache -----------------------------------------------------------
// Parsed meals are user-independent ("2 roti dal" is the same for everyone), so
// results live in a shared `food_cache` table keyed on the normalised text.
// The version prefix invalidates everything when the prompts/engine change.
// Cache failures must never break parsing — every operation swallows errors.

const ENGINE_VERSION = 'v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const cacheKey = (text: string) =>
  `${ENGINE_VERSION}|${text.toLowerCase().replace(/\s+/g, ' ').trim()}`;

function cacheEnv() {
  const url = Deno.env.get('SUPABASE_URL');
  const key =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEY');
  return url && key ? { url, key } : null;
}

async function cacheGet(key: string): Promise<unknown | null> {
  const env = cacheEnv();
  if (!env) return null;
  try {
    const res = await fetch(
      `${env.url}/rest/v1/food_cache?key=eq.${encodeURIComponent(key)}&select=value,created_at`,
      { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    if (Date.now() - new Date(row.created_at).getTime() > CACHE_TTL_MS)
      return null;
    return row.value;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, value: unknown): Promise<void> {
  const env = cacheEnv();
  if (!env) return;
  try {
    await fetch(`${env.url}/rest/v1/food_cache`, {
      method: 'POST',
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ key, value, created_at: new Date() }]),
    });
  } catch {
    // best-effort
  }
}

// ---- handler --------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders(origin) });
  try {
    if (!(await isSignedInUser(req))) {
      return json({ error: 'sign in required' }, 401, origin);
    }

    const { action, text } = await req.json();

    if (action === 'health') {
      return json(
        {
          ok: true,
          gemini: !!Deno.env.get('GEMINI_API_KEY')?.trim(),
          usda: !!Deno.env.get('USDA_API_KEY')?.trim(),
        },
        200,
        origin,
      );
    }

    if (action === 'parse') {
      const key = cacheKey(String(text ?? ''));
      const hit = await cacheGet(key);
      if (hit) return json({ ...hit, cached: true }, 200, origin);

      const described = await geminiStructure(String(text ?? ''));
      if (described.length === 0) {
        return json(
          {
            items: [],
            total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
          },
          200,
          origin,
        );
      }

      // Real candidates per item: curated Indian table first, then USDA.
      const candidatesPerItem = await Promise.all(
        described.map(async (d) => {
          const q = d.query || d.name;
          const [indian, usda] = await Promise.all([
            Promise.resolve(indianSearch(q, 3)),
            usdaSearch(q, 5),
          ]);
          return [...indian, ...usda];
        }),
      );

      const decisions = await geminiJudge(described, candidatesPerItem);

      const items: any[] = [];
      const unmatched: string[] = [];
      described.forEach((d, i) => {
        const candidates = candidatesPerItem[i] ?? [];
        const decision = decisions.find((x) => x.index === i) ?? decisions[i];
        const quantity = decision?.quantity || d.quantity || 1;
        const chosen = decision?.chosen ?? (candidates.length ? 0 : -1);
        const aiKcal = num(decision?.aiEstimateKcal);
        const portionCertainty =
          decision?.portionCertainty === 'clear' ? 'clear' : 'unsure';

        if (chosen >= 0 && candidates[chosen]) {
          const picked = candidates[chosen];
          const dbKcalTotal = picked.kcal * quantity;
          const confidence = calcConfidence(
            dbKcalTotal,
            aiKcal,
            portionCertainty,
            picked.source,
          );
          items.push({
            item: { ...picked, name: d.name || picked.name },
            quantity,
            confidence,
            reason: buildReason(
              confidence,
              dbKcalTotal,
              aiKcal,
              portionCertainty,
              decision?.reason,
            ),
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
            quantity: d.quantity || 1,
            confidence: 'low',
            reason: decision.reason || 'No database match — AI estimate.',
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

      const result = {
        items,
        total,
        note: unmatched.length
          ? `Couldn’t match: ${unmatched.join(', ')}.`
          : undefined,
      };
      // Only cache useful results — empty/unmatched parses should retry fresh.
      if (items.length > 0) await cacheSet(key, result);
      return json(result, 200, origin);
    }

    return json({ error: 'unknown action' }, 400, origin);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500, origin);
  }
});

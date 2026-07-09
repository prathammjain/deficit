// Deficit — food Edge Function (Supabase / Deno). Indian-table + USDA grounded,
// AI cross-checked.
//
//   { action: 'parse',  text }  -> ParsedMeal
//   { action: 'health' }        -> { ok, provider, model, usda }
//
// The engine grounds each food on real candidates from TWO sources — the app's
// curated Indian home-cooking table (home portions, ghee/butter included) and
// USDA FoodData Central (measured macros per 100g) — then the LLM picks the best
// match AND makes its own independent calorie estimate. We compare the two
// (cross-check): close agreement => trusted ('high'); real divergence, a guessed
// portion, or no DB match => flagged ('medium'/'low').
//
// ---- LLM provider config (set via `supabase secrets set`) -------------------
//
//   LLM_PROVIDER   groq (default) | openai
//   GROQ_API_KEY   from console.groq.com
//   GROQ_MODEL     default: openai/gpt-oss-120b  (reasoning model — handles the
//                  USDA per-100g portion scaling much better than llama-3.3-70b;
//                  eval: 16.8% median kcal error vs 19.4%, no >400% blowups)
//   OPENAI_API_KEY from platform.openai.com
//   OPENAI_MODEL   default: gpt-4o-mini  (override to gpt-4.1, gpt-5.4, etc.)
//
// Switch providers without touching code:
//   supabase secrets set LLM_PROVIDER=openai
//   supabase functions deploy food --no-verify-jwt
//
// ---- Deploy -----------------------------------------------------------------
//   node scripts/sync-indian-foods.mjs   # refresh ./_indian-foods.ts
//   supabase functions deploy food --no-verify-jwt
//   supabase secrets set GROQ_API_KEY=... USDA_API_KEY=...
//
// Targets the Deno runtime; excluded from the app's TS build (tsconfig).

// @ts-nocheck
import { INDIAN_FOODS } from './_indian-foods.ts';

// ---- CORS -------------------------------------------------------------------

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

// ---- LLM provider -----------------------------------------------------------
// Both Groq and OpenAI use the OpenAI-compatible chat completions API, so the
// only differences are the base URL, API key env var, and model name.

interface LLMConfig {
  provider: 'groq' | 'openai';
  url: string;
  key: string;
  model: string;
}

function getLLMConfig(): LLMConfig | null {
  const provider = (Deno.env.get('LLM_PROVIDER') ?? 'groq') as
    | 'groq'
    | 'openai';

  if (provider === 'openai') {
    const key = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!key) return null;
    return {
      provider,
      url: 'https://api.openai.com/v1/chat/completions',
      key,
      model:
        Deno.env.get('OPENAI_MODEL')?.trim() ?? 'gpt-4o-mini',
    };
  }

  // Default: Groq
  const key = Deno.env.get('GROQ_API_KEY')?.trim();
  if (!key) return null;
  return {
    provider,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key,
    model:
      Deno.env.get('GROQ_MODEL')?.trim() ?? 'openai/gpt-oss-120b',
  };
}

async function callLLM(prompt: string): Promise<any> {
  const cfg = getLLMConfig();
  if (!cfg) throw new Error('No LLM API key configured');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ---- Candidate sources ------------------------------------------------------

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

/** USDA FoodData Central search (measured macros per 100g). Branded excluded. */
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

// ---- LLM: structure then judge ----------------------------------------------

/** Stage 1 — split free text into items with a normalised portion + db query. */
async function structureMeal(
  text: string,
): Promise<{ name: string; quantity: number; query: string }[]> {
  const parsed = await callLLM(
    `You are a nutrition assistant for Indian food. Break this meal into individual food items. For each item return its display name, the quantity (number of servings as a decimal), and a concise English search query suitable for a food database (generic ingredient terms, e.g. "cooked lentils dal", "wheat flatbread roti", "cooked white rice"). Normalise Indian portions (katori, roti, bowl, plate). Return ONLY JSON of the form {"items":[{"name":"","quantity":1,"query":""}]}.

Meal: ${text}`,
  );
  return Array.isArray(parsed.items) ? parsed.items : [];
}

interface JudgeDecision {
  index: number;
  chosen: number;
  quantity: number;
  aiEstimateKcal: number;
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

/** Stage 2 — judge each item against real candidates + make an independent
 *  estimate for cross-checking. */
async function judgeCandidates(
  described: { name: string; quantity: number }[],
  candidatesPerItem: any[][],
): Promise<JudgeDecision[]> {
  const payload = described.map((d, i) => ({
    index: i,
    eaten: d.name,
    statedQuantity: d.quantity,
    candidates: candidatesPerItem[i].map((c, ci) => ({
      i: ci,
      source: c.source,
      name: c.name,
      serving: c.serving,
      kcal: c.kcal,
      proteinG: c.proteinG,
      carbsG: c.carbsG,
      fatG: c.fatG,
    })),
  }));

  const parsed = await callLLM(
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

// ---- Confidence + reason ----------------------------------------------------

const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

function calcConfidence(
  dbKcalTotal: number,
  aiKcal: number,
  portionCertainty: 'clear' | 'unsure',
  source: string,
): 'high' | 'medium' | 'low' {
  if (!aiKcal) return 'medium';
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

// ---- Auth gate --------------------------------------------------------------

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

// ---- Result cache -----------------------------------------------------------
// Keyed on ENGINE_VERSION + model + normalised text so switching providers or
// models automatically uses a separate cache namespace.

const ENGINE_VERSION = 'v2';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cacheKey = (text: string) => {
  const cfg = getLLMConfig();
  const model = cfg?.model ?? 'unknown';
  return `${ENGINE_VERSION}|${model}|${text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
};

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

// ---- Handler ----------------------------------------------------------------

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
      const cfg = getLLMConfig();
      return json(
        {
          ok: !!cfg,
          provider: cfg?.provider ?? null,
          model: cfg?.model ?? null,
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

      const described = await structureMeal(String(text ?? ''));
      if (described.length === 0) {
        return json(
          { items: [], total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } },
          200,
          origin,
        );
      }

      const candidatesPerItem = await Promise.all(
        described.map(async (d) => {
          const usdaQuery = d.query || d.name;
          // The curated Indian table is keyed on real dish names ("Paneer
          // Paratha"), so match it on the display name — the generic USDA
          // query ("wheat flatbread") would miss those entries. Fall back to
          // the query only when the name finds nothing.
          const byName = indianSearch(d.name, 3);
          const indian = byName.length ? byName : indianSearch(usdaQuery, 3);
          const usda = await usdaSearch(usdaQuery, 5);
          return [...indian, ...usda];
        }),
      );

      const decisions = await judgeCandidates(described, candidatesPerItem);

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
          ? `Couldn't match: ${unmatched.join(', ')}.`
          : undefined,
      };
      if (items.length > 0) await cacheSet(key, result);
      return json(result, 200, origin);
    }

    return json({ error: 'unknown action' }, 400, origin);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500, origin);
  }
});

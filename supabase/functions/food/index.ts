// Grain — food Edge Function (Supabase / Deno). Indian-table + USDA grounded,
// AI cross-checked.
//
//   { action: 'parse',  text }               -> ParsedMeal (with runId)
//   { action: 'health' }                     -> { ok, provider, model, usda }
//   { action: 'correction', runId, logged }  -> { ok }  what the user logged
//   { action: 'transcribe', audio, mime }    -> { text }  a spoken meal as text
//   { action: 'roast', meal, items, day }    -> { line }  GrainAI's verdict
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
//   GROQ_API_KEY   from console.groq.com. Also used for voice notes (Whisper).
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
// ---- Engine switch and run log ----------------------------------------------
// The env above configures the LIVE engine, which everyone gets. The
// `engine_settings` row can turn on a BETA engine (another provider/model) for
// the users in `engine_testers` plus `rollout_percent` of everyone else, capped
// per user per day. Every parse is saved to `engine_runs` with its stage
// outputs; `engine_corrections` holds what the user logged from it. Users are
// recorded as a salted hash:
//   ENGINE_LOG_SALT  any long random string; changing it unlinks old runs
//
// ---- Deploy -----------------------------------------------------------------
//   node scripts/sync-indian-foods.mjs   # refresh ./_indian-foods.ts
//   supabase functions deploy food --no-verify-jwt
//   supabase secrets set GROQ_API_KEY=... USDA_API_KEY=...
//
// Targets the Deno runtime; excluded from the app's TS build (tsconfig).

// @ts-nocheck
import { INDIAN_FOODS } from './_indian-foods.ts';
import { ifctSearch } from './ifct.ts';
import {
  estimateMultiplier,
  portionCertainty as statedCertainty,
  servingMultiplier,
} from './portion.ts';

// ---- CORS -------------------------------------------------------------------

// The app's own address, plus the old Vercel one, which keeps working for
// anyone still on it.
const ALLOWED_ORIGINS = [
  'https://app.getgrain.fit',
  'https://deficit-cyan.vercel.app',
];
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

/** The live engine's model comes from the env; the beta engine passes its own
 *  provider and model from `engine_settings`. Keys always come from the env. */
function getLLMConfig(
  providerOverride?: string | null,
  modelOverride?: string | null,
): LLMConfig | null {
  const provider = (providerOverride ??
    Deno.env.get('LLM_PROVIDER') ??
    'groq') as 'groq' | 'openai';

  if (provider === 'openai') {
    const key = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!key) return null;
    return {
      provider,
      url: 'https://api.openai.com/v1/chat/completions',
      key,
      model:
        modelOverride ?? Deno.env.get('OPENAI_MODEL')?.trim() ?? 'gpt-4o-mini',
    };
  }

  // Default: Groq
  const key = Deno.env.get('GROQ_API_KEY')?.trim();
  if (!key) return null;
  return {
    provider: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key,
    model:
      modelOverride ??
      Deno.env.get('GROQ_MODEL')?.trim() ??
      'openai/gpt-oss-120b',
  };
}

/** One LLM call as the run log records it. */
interface StageTrace {
  ms: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  output?: unknown;
}

async function callLLM(
  cfg: LLMConfig,
  prompt: string,
  stage?: StageTrace,
): Promise<any> {
  const started = Date.now();
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
      // Selection + portion arithmetic, not prose: identical meals should give
      // identical numbers rather than drifting between runs.
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}`);
  const data = await res.json();
  if (stage) {
    stage.ms = Date.now() - started;
    stage.usage = {
      prompt_tokens: data?.usage?.prompt_tokens,
      completion_tokens: data?.usage?.completion_tokens,
    };
  }
  const raw = data?.choices?.[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ---- Provider liveness ------------------------------------------------------
// A configured key is not a working key. `health` used to report `ok` from the
// mere presence of a key string, so an expired, revoked or quota-exhausted key
// left the app showing "AI-grounded · USDA" while every parse failed and fell
// back to the local table. Probe the provider for real instead.

let liveness: { at: number; ok: boolean; detail: string } | null = null;
const LIVENESS_TTL_MS = 5 * 60 * 1000;

async function checkLLMLive(): Promise<{ ok: boolean; detail: string }> {
  if (liveness && Date.now() - liveness.at < LIVENESS_TTL_MS) {
    return { ok: liveness.ok, detail: liveness.detail };
  }

  const cfg = getLLMConfig();
  let result: { ok: boolean; detail: string };

  if (!cfg) {
    result = { ok: false, detail: 'no API key configured' };
  } else {
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.key}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      if (res.ok) {
        result = { ok: true, detail: 'ok' };
      } else if (res.status === 401 || res.status === 403) {
        result = {
          ok: false,
          detail: `${cfg.provider} rejected the API key (${res.status}) — expired or revoked`,
        };
      } else if (res.status === 429) {
        result = {
          ok: false,
          detail: `${cfg.provider} quota or rate limit exhausted (429)`,
        };
      } else if (res.status === 404) {
        result = {
          ok: false,
          detail: `${cfg.provider} does not serve model "${cfg.model}" (404) — retired or renamed`,
        };
      } else {
        // Any other status still proves the key authenticated, so don't blame
        // the key: a reasoning model may simply reject this tiny probe body.
        result = { ok: true, detail: `${cfg.provider} ${res.status} on probe` };
      }
    } catch {
      result = { ok: false, detail: `${cfg.provider} unreachable` };
    }
  }

  liveness = { at: Date.now(), ...result };
  return result;
}

// ---- Voice to text -----------------------------------------------------------
// The app records a voice note and sends it as 16 kHz mono WAV. Whisper large
// v3 on Groq transcribes it, on the same key as the engine. The prompt is a
// sample of how meals are said here, which steers Whisper towards Roman
// script Hinglish and the usual spellings of Indian foods.

const MAX_AUDIO_BASE64 = 4_000_000; // about 2 minutes of 16 kHz mono WAV

const WHISPER_PROMPT =
  'do roti, ek katori dal, 200g chicken breast, 1 tablespoon ghee, paneer bhurji, besan chilla, 1 scoop whey';

async function transcribe(audio: string, mime: string): Promise<string> {
  const key = Deno.env.get('GROQ_API_KEY')?.trim();
  if (!key) throw new Error('No GROQ_API_KEY configured');
  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), 'meal.wav');
  form.append('model', 'whisper-large-v3');
  form.append('language', 'en');
  form.append('prompt', WHISPER_PROMPT);
  const res = await fetch(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form },
  );
  if (!res.ok) throw new Error(`stt ${res.status}`);
  const data = await res.json();
  return String(data?.text ?? '').trim();
}

// ---- GrainAI roast mode ------------------------------------------------------
// Opt in from the app. One brutal line about the meal: the choice, the timing,
// the excuses, the love life. Never the body. The prompt says so, and a word
// filter drops any line that slips through, so a bad roast shows nothing
// rather than something hurtful.

const ROAST_PROMPT = `You are GrainAI, the roast comic inside Grain, a calorie and protein tracker for people who train. The user has opted in to be roasted. You get the meal they just logged and their day so far. Reply with JSON: {"line": "..."}.

The line: one or two sentences, at most 30 words. Brutal, specific, funny, like a savage gym friend. Mild swearing is fine (dumbass, damn, hell). Hinglish is fine when it lands.

Roast: the food choice, the timing, the excuses, the discipline, the protein, the cheat meal pretending to be healthy, their gym ego, their love life (an ex, a crush, a situationship, a Greek god stealing their date), their mom's cooking.
Never mention or imply: body, weight, size, fatness, looks, appearance, eating disorders, starving, purging, skipping meals, illness, religion, caste, race, gender, sexuality, disability, death, self harm. Never assume the user's gender or who they date. Never tell them to eat less than their target.
If they are far under their calorie target late in the day, roast them for under eating and tell them to go eat some protein.
A good meal still gets roasted, with a backhanded compliment.
No dashes. No hashtags. No emojis.

Examples of the tone:
"A McDonald's brownie. Good job, your dumbass won't take things seriously until your ex leaves you for a Greek god who meal preps."
"Brownie at 11 pm. Discipline left the chat, and honestly, so would I."
"Chicken and rice again. You eat like a spreadsheet, but at least your protein shows up more than your situationship ever did."
"800 kcal by 9 pm? That's not a cut, that's a hunger strike nobody asked for. Go eat some paneer, champ."
"Greek yogurt and berries. Look at you cosplaying as a fitness influencer. Keep this up and someone might actually believe you."`;

const ROAST_BANNED =
  /\b(fat|fatso|fatass|fatty|obese|chubby|belly|gut|weight|kgs?|kilos?|ugly|body|skinny|thin|starv\w*|purg\w*|vomit\w*|anorexi\w*|bulimi\w*|skip(ping)? (a |your )?meals?|suicid\w*|kill yourself)\b/i;

async function roastLine(
  cfg: LLMConfig,
  input: unknown,
): Promise<string | null> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: ROAST_PROMPT },
        { role: 'user', content: JSON.stringify(input) },
      ],
      response_format: { type: 'json_object' },
      // Comedy, not arithmetic: let it vary.
      temperature: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  let line = '';
  try {
    line = String(
      JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')?.line ?? '',
    );
  } catch {
    return null;
  }
  line = line
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!line || line.length > 240 || ROAST_BANNED.test(line)) return null;
  return line;
}

// ---- Candidate sources ------------------------------------------------------

/** Curated Indian home-cooking table — ranked by name/alias match. */
function indianSearch(query: string, max = 3) {
  const q = String(query ?? '')
    .trim()
    .toLowerCase();
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

/**
 * USDA FoodData Central search (measured macros per 100g). Branded excluded.
 *
 * Returns `null` when USDA itself is unavailable (no key, HTTP error, rate
 * limit, network failure) as distinct from `[]`, which means "USDA answered
 * and had no match". The caller needs that difference: an unavailable USDA
 * means the parse is only half-grounded, which must not be cached or
 * presented with the same confidence as a fully grounded one. Previously a
 * missing key threw and failed the whole request (the client then silently
 * fell back to the local heuristic), while an HTTP error returned `[]` and was
 * indistinguishable from a genuine no-match.
 */
async function usdaSearch(query: string, max = 5) {
  const key = Deno.env.get('USDA_API_KEY')?.trim();
  if (!key) return null;
  let res: Response;
  try {
    res = await fetch(
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
  } catch {
    return null;
  }
  if (!res.ok) return null;
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
  cfg: LLMConfig,
  text: string,
  stage: StageTrace,
): Promise<
  { name: string; quantity: number; query: string; grams?: number | null }[]
> {
  const parsed = await callLLM(
    cfg,
    `You are a nutrition assistant for Indian food. Break this meal into individual food items. For each item return its display name, the quantity (number of servings as a decimal), a concise English search query suitable for a food database (generic ingredient terms, e.g. "cooked lentils dal", "wheat flatbread roti", "cooked white rice"), and "grams". Normalise Indian portions (katori, roti, bowl, plate).
"grams" is the edible weight of the WHOLE eaten amount in grams, and ONLY when the text states a measurable amount — a weight, a volume, or a standard kitchen measure. "150 ml milk" => 150. "100 gram paneer" => 100. "1 tablespoon ghee" => 14. "2 teaspoons sugar" => 8. "1 glass lassi" => 250. If the text gives no such amount — "dal", "2 roti", "a bowl of rice" — return null, do NOT guess a typical portion. Return ONLY JSON of the form {"items":[{"name":"","quantity":1,"query":"","grams":null}]}.

Meal: ${text}`,
    stage,
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
  cfg: LLMConfig,
  described: { name: string; quantity: number }[],
  candidatesPerItem: any[][],
  stage: StageTrace,
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
    cfg,
    `You are grounding a food log so its numbers can be trusted. For each EATEN item you get real CANDIDATE foods from three sources: a curated Indian home-cooking table ("local" — macros per the stated home serving, recipe fats included), IFCT 2017 ("ifct" — Indian lab-measured macros per 100g of a single raw ingredient), and USDA ("usda" — macros per 100g). For each item return a decision:
- "chosen": index i of the candidate that best matches the eaten dish. PREFER a specific Indian-table ("local") match over a generic USDA one when both reasonably fit (e.g. real "Dal Tadka" over plain "cooked lentils"). If NONE is a reasonable match, use -1 and provide your own "estimate" (per-serving macros for a typical Indian home portion, with a "serving" label like "1 katori (150g)").
- RAW vs AS-EATEN. Every candidate's "serving" says which it is. An "ifct" candidate labelled "100g raw (uncooked weight)" is the dry/uncooked ingredient, NOT the cooked food on the plate: 100g of cooked rice is roughly 33g raw. Never treat a raw candidate's 100g as 100g eaten. For a cooked dish prefer a "local" candidate, or an "ifct" one already labelled "100g cooked"; pick a raw "ifct" candidate only when the food really is eaten raw or uncooked (fruit, salad, nuts, curd, a measured weight of dry grain). A candidate labelled "100g cooked" is ALREADY converted — do not adjust it again. A staple may appear TWICE, once as "100g cooked" and once as "100g raw (uncooked weight)": these are the same food, not two foods, so choose the reading that matches how the portion was described.
- "quantity": how many of the CHOSEN candidate's stated serving were eaten. (candidate serving "1 katori (150g)", ate ~1.5 katori => 1.5; candidate serving "100g", ate ~150g => 1.5.)
- "aiEstimateKcal": your OWN independent best estimate of the TOTAL calories for the eaten portion, from your knowledge of the dish. Do NOT just copy the candidate — this is an independent cross-check.
- "portionCertainty": "clear" if the eaten portion is well specified, "unsure" if you had to guess it.
- "reason": one short clause, e.g. "matched dal tadka, 1.5 katori".
Portion reference (use unless grams are given): 1 roti/chapati≈40g, 1 paratha≈80g, 1 naan≈90g, 1 katori (dal/curry/sabzi/rice)≈150g, 1 bowl≈200g, 1 idli≈40g, 1 dosa≈90g, 1 glass≈250ml.
Return ONLY JSON: {"decisions":[{"index":0,"chosen":0,"quantity":1.5,"aiEstimateKcal":220,"portionCertainty":"clear","reason":"","estimate":null}]}.

Items: ${JSON.stringify(payload)}`,
    stage,
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
  // The independent AI estimate IS the cross-check. Without it the database
  // number has no corroboration at all, so it is a guess and must be labelled
  // one — this used to report 'medium', which reads as "roughly checked".
  if (!aiKcal) return 'low';
  const base = Math.max(aiKcal, dbKcalTotal, 1);
  const gap = Math.abs(dbKcalTotal - aiKcal) / base;
  const tol = source === 'local' ? 0.25 : 0.2;
  if (portionCertainty === 'clear' && gap <= tol) return 'high';
  if (gap <= 0.4) return 'medium';
  return 'low';
}

/** The model writes reasons in its own style; the app shows no dashes. */
const plain = (t?: string) => t?.replace(/\s*[\u2014\u2013]\s*/g, ', ');

function buildReason(
  confidence: 'high' | 'medium' | 'low',
  dbKcalTotal: number,
  aiKcal: number,
  portionCertainty: 'clear' | 'unsure',
  modelReason: string | undefined,
): string | undefined {
  modelReason = plain(modelReason);
  if (confidence === 'high') return modelReason || undefined;
  if (!aiKcal) {
    return portionCertainty === 'unsure'
      ? 'Portion uncertain, worth a check.'
      : modelReason || undefined;
  }
  const portionNote =
    portionCertainty === 'unsure' ? ', portion uncertain' : ', recipes vary';
  return `Database says ${Math.round(dbKcalTotal)} kcal, AI estimate about ${Math.round(aiKcal)} kcal${portionNote}.`;
}

// ---- Auth gate --------------------------------------------------------------

/** The signed-in user's id, or null when the request isn't signed in. */
async function signedInUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) return null;
  const url = Deno.env.get('SUPABASE_URL');
  const apikey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !apikey) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === 'string' ? user.id : null;
  } catch {
    return null;
  }
}

// ---- Result cache -----------------------------------------------------------
// Keyed on ENGINE_VERSION + model + normalised text so switching providers or
// models automatically uses a separate cache namespace.

const ENGINE_VERSION = 'v5';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cacheKey = (cfg: LLMConfig, text: string) =>
  `${ENGINE_VERSION}|${cfg.model}|${text.toLowerCase().replace(/\s+/g, ' ').trim()}`;

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

// ---- Engine switch -----------------------------------------------------------
// All of this reads through the service role and fails towards the live
// engine: a missing table, a slow query or a bad setting must never stop a
// user from logging.

const rest = (path: string, init: RequestInit = {}) => {
  const env = cacheEnv();
  if (!env) return Promise.reject(new Error('no service role'));
  return fetch(`${env.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
};

interface EngineSettings {
  beta_enabled: boolean;
  beta_provider: string | null;
  beta_model: string | null;
  rollout_percent: number;
  beta_daily_cap: number;
}

// Settings change rarely; re-read them at most once a minute per instance.
let settingsCache: { at: number; value: EngineSettings | null } | null = null;

async function engineSettings(): Promise<EngineSettings | null> {
  if (settingsCache && Date.now() - settingsCache.at < 60_000)
    return settingsCache.value;
  let value: EngineSettings | null = null;
  try {
    const res = await rest('engine_settings?id=eq.1&select=*');
    if (res.ok) value = (await res.json())[0] ?? null;
  } catch {
    // live engine
  }
  settingsCache = { at: Date.now(), value };
  return value;
}

async function isTester(userId: string): Promise<boolean> {
  try {
    const res = await rest(
      `engine_testers?user_id=eq.${encodeURIComponent(userId)}&select=user_id`,
    );
    return res.ok && (await res.json()).length > 0;
  } catch {
    return false;
  }
}

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** How a user appears in the run log: a salted hash, never the id itself. */
const userRef = (userId: string) =>
  sha256(`${Deno.env.get('ENGINE_LOG_SALT') ?? ''}:${userId}`);

/** Uncached beta runs this user has had since midnight UTC. */
async function betaRunsToday(ref: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  try {
    const res = await rest(
      `engine_runs?user_ref=eq.${ref}&arm=eq.beta&cached=eq.false&created_at=gte.${since.toISOString()}&select=id`,
      { method: 'HEAD', headers: { Prefer: 'count=exact' } },
    );
    const range = res.headers.get('content-range') ?? '';
    return Number(range.split('/')[1]) || 0;
  } catch {
    // Can't count, so can't promise the cap holds: treat as spent.
    return Infinity;
  }
}

/** Which engine answers this user: the beta one when it's switched on, the
 *  user is a tester or inside the rollout, and they're under today's cap. */
async function pickEngine(
  userId: string,
  ref: string,
): Promise<{ arm: 'live' | 'beta'; cfg: LLMConfig | null }> {
  const live = { arm: 'live' as const, cfg: getLLMConfig() };
  const s = await engineSettings();
  if (!s?.beta_enabled || !s.beta_model) return live;
  // The user's place in the rollout is fixed by their hash, so raising the
  // percentage only ever adds people.
  const inRollout = parseInt(ref.slice(0, 8), 16) % 100 < s.rollout_percent;
  if (!inRollout && !(await isTester(userId))) return live;
  if ((await betaRunsToday(ref)) >= s.beta_daily_cap) return live;
  const cfg = getLLMConfig(s.beta_provider, s.beta_model);
  return cfg ? { arm: 'beta', cfg } : live;
}

/** Saves a run without holding up the response. */
function saveRun(row: Record<string, unknown>): void {
  const write = rest('engine_runs', {
    method: 'POST',
    body: JSON.stringify(row),
  }).catch(() => {});
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(write);
}

// ---- Handler ----------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders(origin) });
  try {
    const userId = await signedInUserId(req);
    if (!userId) {
      return json({ error: 'sign in required' }, 401, origin);
    }

    const { action, text, runId, logged, audio, mime, meal, items, day } =
      await req.json();

    if (action === 'roast') {
      const cfg = getLLMConfig();
      if (!cfg) return json({ line: null }, 200, origin);
      const n = (v: unknown) => Math.round(Number(v) || 0);
      const input = {
        meal: String(meal ?? '').slice(0, 300),
        items: (Array.isArray(items) ? items : []).slice(0, 15).map((i) => ({
          name: String(i?.name ?? '').slice(0, 80),
          kcal: n(i?.kcal),
          proteinG: n(i?.proteinG),
        })),
        day: {
          eatenKcalBefore: n(day?.eatenKcal),
          targetKcal: n(day?.targetKcal),
          proteinGBefore: n(day?.proteinG),
          proteinTargetG: n(day?.proteinTargetG),
          localHour: n(day?.hour),
        },
      };
      return json({ line: await roastLine(cfg, input) }, 200, origin);
    }

    if (action === 'transcribe') {
      const valid =
        typeof audio === 'string' &&
        audio.length > 0 &&
        audio.length <= MAX_AUDIO_BASE64 &&
        mime === 'audio/wav';
      if (!valid) return json({ error: 'bad audio' }, 400, origin);
      return json({ text: await transcribe(audio, mime) }, 200, origin);
    }

    if (action === 'health') {
      const cfg = getLLMConfig();
      const live = await checkLLMLive();
      return json(
        {
          // `ok` now means the provider actually answered, not merely that a
          // key is present — so a dead key shows the app as offline instead of
          // claiming AI grounding it cannot deliver.
          ok: !!cfg && live.ok,
          provider: cfg?.provider ?? null,
          model: cfg?.model ?? null,
          usda: !!Deno.env.get('USDA_API_KEY')?.trim(),
          // Human-readable reason, for diagnosing a dead engine from the
          // browser's network tab without redeploying.
          llm: live.detail,
        },
        200,
        origin,
      );
    }

    if (action === 'correction') {
      // What the user logged from a run, after their edits. Shape-checked
      // only; the playground does the comparing.
      const valid =
        typeof runId === 'string' &&
        /^[0-9a-f-]{36}$/i.test(runId) &&
        Array.isArray(logged) &&
        logged.length <= 30;
      if (!valid) return json({ error: 'bad correction' }, 400, origin);
      await rest('engine_corrections', {
        method: 'POST',
        body: JSON.stringify({
          run_id: runId,
          user_ref: await userRef(userId),
          logged,
        }),
      }).catch(() => {});
      return json({ ok: true }, 200, origin);
    }

    if (action === 'parse') {
      const mealText = String(text ?? '');
      const started = Date.now();
      const ref = await userRef(userId);
      const { arm, cfg } = await pickEngine(userId, ref);
      if (!cfg) throw new Error('No LLM API key configured');
      const id = crypto.randomUUID();
      const run = {
        id,
        user_ref: ref,
        arm,
        engine: `${ENGINE_VERSION}/${cfg.provider}/${cfg.model}`,
        text: mealText,
      };

      const key = cacheKey(cfg, mealText);
      const hit = await cacheGet(key);
      if (hit) {
        saveRun({
          ...run,
          result: hit,
          cached: true,
          latency_ms: Date.now() - started,
        });
        return json({ ...hit, cached: true, runId: id }, 200, origin);
      }

      const trace = {
        structure: { ms: 0 } as StageTrace,
        lookup: { ms: 0 } as StageTrace,
        judge: { ms: 0 } as StageTrace,
      };
      try {
        return json(
          await parseUncached(cfg, mealText, key, run, trace, started),
          200,
          origin,
        );
      } catch (e) {
        saveRun({
          ...run,
          trace,
          error: String((e as Error)?.message ?? e),
          latency_ms: Date.now() - started,
        });
        throw e;
      }
    }

    return json({ error: 'unknown action' }, 400, origin);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500, origin);
  }
});

/** A full engine run: split, look up, judge, then the arithmetic. */
async function parseUncached(
  cfg: LLMConfig,
  text: string,
  key: string,
  run: Record<string, unknown> & { id: string },
  trace: Record<'structure' | 'lookup' | 'judge', StageTrace>,
  started: number,
) {
  const described = await structureMeal(cfg, text, trace.structure);
  trace.structure.output = described;
  if (described.length === 0) {
    const empty = {
      items: [],
      total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    };
    saveRun({
      ...run,
      result: empty,
      trace,
      latency_ms: Date.now() - started,
    });
    return { ...empty, runId: run.id };
  }

  // `degraded` means this parse hit an infrastructure or judge FAILURE —
  // USDA unavailable, or the model returned no usable decision for an
  // item. Such a run still answers (logging must never hard-fail) but it
  // is flagged to the user and never cached, because a retry once USDA is
  // back can do genuinely better.
  //
  // It deliberately does NOT cover an honest low-confidence call (the
  // database and the AI really disagree, or the dish is in neither table).
  // Those are correct, reproducible results that the UI already flags, so
  // caching them is right.
  let degraded = false;

  const lookupStarted = Date.now();
  const candidatesPerItem = await Promise.all(
    described.map(async (d) => {
      const usdaQuery = d.query || d.name;
      // The curated Indian table is keyed on real dish names ("Paneer
      // Paratha"), so match it on the display name — the generic USDA
      // query ("wheat flatbread") would miss those entries. Fall back to
      // the query only when the name finds nothing.
      const byName = indianSearch(d.name, 3);
      const indian = byName.length ? byName : indianSearch(usdaQuery, 3);
      // IFCT is keyed on generic ingredient English ("Red gram, dal"),
      // which is how structureMeal writes `query` — the mirror image of
      // the curated dish table, keyed on dish names and matched on `name`.
      const byQuery = ifctSearch(usdaQuery, 3);
      const ifct = byQuery.length ? byQuery : ifctSearch(d.name, 3);
      const usda = await usdaSearch(usdaQuery, 5);
      if (usda === null) degraded = true;
      // local first, so the curated table keeps the low indices the
      // "PREFER local" rule relies on; IFCT ahead of USDA so the Indian
      // ingredient is seen before the generic one. IFCT is compiled in
      // with no network and no key, so it can never be unavailable and
      // must never set `degraded`.
      return [...indian, ...ifct, ...(usda ?? [])];
    }),
  );

  trace.lookup.ms = Date.now() - lookupStarted;
  trace.lookup.output = candidatesPerItem;

  const decisions = await judgeCandidates(
    cfg,
    described,
    candidatesPerItem,
    trace.judge,
  );
  trace.judge.output = decisions;

  const items: any[] = [];
  const unmatched: string[] = [];
  described.forEach((d, i) => {
    const candidates = candidatesPerItem[i] ?? [];
    const decision = decisions.find((x) => x.index === i) ?? decisions[i];
    // The model can return fewer decisions than items, or omit/misnumber
    // the index. Falling back to the first candidate then presented an
    // unjudged guess — often a generic USDA 100g row — as a normal match.
    // It still gets shown (dropping the food would be worse), but only as
    // an explicitly unverified 'low', and it degrades the run.
    const judged = !!decision;
    if (!judged) degraded = true;
    const quantity = decision?.quantity || d.quantity || 1;
    const chosen = decision?.chosen ?? (candidates.length ? 0 : -1);
    const aiKcal = num(decision?.aiEstimateKcal);
    const portionCertainty = statedCertainty(
      d.grams,
      decision?.portionCertainty,
    );

    if (chosen >= 0 && candidates[chosen]) {
      const picked = candidates[chosen];
      // For a per-100g candidate the multiplier is just grams / 100, and
      // this is where the engine was losing worst: "150 ml milk" came back
      // as quantity 6 (414 kcal for ~100 kcal of milk) and "1 tablespoon
      // ghee" as a full 100g — 876 kcal, reported 'high' because the AI
      // cross-check repeated the same portion mistake. When stage 1 found
      // an explicit amount, do the arithmetic instead of asking for it.
      const scaled = servingMultiplier(picked.serving, d.grams, quantity);
      const dbKcalTotal = picked.kcal * scaled;
      const confidence = judged
        ? calcConfidence(dbKcalTotal, aiKcal, portionCertainty, picked.source)
        : 'low';
      items.push({
        item: { ...picked, name: d.name || picked.name },
        quantity: scaled,
        confidence,
        reason: judged
          ? buildReason(
              confidence,
              dbKcalTotal,
              aiKcal,
              portionCertainty,
              decision?.reason,
            )
          : 'Not cross checked, verify this portion.',
        alternates: candidates.filter((_, ci) => ci !== chosen),
      });
    } else if (decision?.estimate) {
      const e = decision.estimate;
      const estServing = e.serving || '1 serving';
      const estQuantity = estimateMultiplier(
        estServing,
        d.grams,
        d.quantity || 1,
      );
      const scaled = estQuantity !== (d.quantity || 1);
      items.push({
        item: {
          id: `ai-${i}`,
          name: e.name || d.name,
          serving: estServing,
          kcal: num(e.kcal),
          proteinG: num(e.proteinG),
          carbsG: num(e.carbsG),
          fatG: num(e.fatG),
          source: 'ai',
        },
        quantity: estQuantity,
        confidence: 'low',
        // The model's own reason names its serving ("1 tsp"), which no longer
        // describes the amount once it is scaled to the user's weight.
        reason: scaled
          ? `No database match. AI estimate per ${estServing}, scaled to the ${d.grams} g you gave.`
          : plain(decision.reason) || 'No database match, AI estimate.',
        alternates: candidates,
      });
    } else {
      unmatched.push(d.name);
      // The total is missing a food the user said they ate.
      degraded = true;
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

  const notes: string[] = [];
  if (unmatched.length) notes.push(`Couldn't match: ${unmatched.join(', ')}.`);
  if (degraded) {
    notes.push(
      'Grounding was incomplete for this meal, so these numbers are less reliable than usual. Try again in a minute for a better match.',
    );
  }

  const result = {
    items,
    total,
    note: notes.length ? notes.join(' ') : undefined,
  };

  // Cache only fully grounded results. The cache lives for 7 days and is
  // shared across users, so caching a degraded parse froze a bad number
  // for that phrase for a week: the same meal typed again returned the
  // same wrong calories, while a phrase first parsed while USDA was
  // healthy stayed accurate. That is what made the engine look like it
  // was "sometimes right, sometimes wildly off".
  if (items.length > 0 && !degraded) await cacheSet(key, result);
  saveRun({
    ...run,
    result,
    trace,
    degraded,
    latency_ms: Date.now() - started,
  });
  return { ...result, runId: run.id };
}

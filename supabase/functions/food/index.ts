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
  const res = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

// ---- Gemini (meal text → structured items) -------------------------------

async function geminiParse(text: string): Promise<{ name: string; quantity: number; query: string }[]> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const prompt = `You are a nutrition assistant for Indian food. Break this meal into individual food items. For each item return its display name, the quantity (number of servings as a decimal), and a concise search query suitable for a food database. Normalise Indian portions (katori, roti, bowl, plate). Return ONLY JSON of the form {"items":[{"name":"","quantity":1,"query":""}]}.

Meal: ${text}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    },
  );
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"items":[]}';
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

// ---- handler -------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { action, query, text, limit } = await req.json();

    if (action === 'search') {
      const items = await fatsecretSearch(String(query ?? ''), limit ?? 8);
      return json({ items });
    }

    if (action === 'parse') {
      const parsed = await geminiParse(String(text ?? ''));
      const items: any[] = [];
      const unmatched: string[] = [];
      for (const it of parsed) {
        const [top] = await fatsecretSearch(it.query || it.name, 1);
        if (top) items.push({ item: { ...top, name: it.name || top.name }, quantity: it.quantity || 1 });
        else unmatched.push(it.name);
      }
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
        note: unmatched.length ? `Couldn’t match: ${unmatched.join(', ')}.` : undefined,
      });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

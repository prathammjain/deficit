# `food` Edge Function — the hybrid AI food engine

This function is what makes **"Describe a meal"** real. It keeps the Gemini +
FatSecret secrets server-side and exposes three actions to the app:

| action | body | returns |
| --- | --- | --- |
| `health` | `{ action: 'health' }` | `{ ok, gemini, fatsecret }` — readiness, no external calls |
| `search` | `{ action: 'search', query, limit? }` | `FoodItem[]` (FatSecret) |
| `parse` | `{ action: 'parse', text }` | `ParsedMeal` (Gemini → FatSecret → Gemini judge) |

The engine is **API-anchored, AI-judged**: Gemini structures the free text,
FatSecret returns real candidate foods + macros, then Gemini picks the best
candidate (or explicitly estimates) and attaches a confidence. When the two
don't clearly agree, the item comes back `low` so the app flags it.

Until this is deployed **with both secrets set**, the app silently uses the
local Indian table. The Log screen shows which engine is live (see "Verify").

---

## 1. Prerequisites

- **Supabase CLI** — `npm i -g supabase` (or `brew install supabase/tap/supabase`)
- A **Gemini API key** — https://aistudio.google.com/app/apikey
- **FatSecret** OAuth2 client credentials (Platform API, "Basic" scope) —
  https://platform.fatsecret.com/platform-api → register an app → Client ID +
  Secret. (FatSecret IP-allowlists by default; either allowlist your function's
  egress IP or disable the restriction in the FatSecret console.)

## 2. Link the project (once)

```bash
cd /path/to/deficit
supabase login
supabase link --project-ref <your-project-ref>   # ref is in the Supabase dashboard URL
```

## 3. Set the secrets

```bash
supabase secrets set \
  GEMINI_API_KEY=... \
  FATSECRET_CLIENT_ID=... \
  FATSECRET_CLIENT_SECRET=...
```

## 4. Deploy

```bash
supabase functions deploy food --no-verify-jwt
```

`--no-verify-jwt` lets the app call it with just the anon key (fine for a
personal app). To require an authenticated session instead, deploy without that
flag — `functions.invoke` already sends the user's JWT.

## 5. Verify

```bash
# Health — should report both secrets present:
curl -s -X POST "https://<project-ref>.functions.supabase.co/food" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action":"health"}'
# => {"ok":true,"gemini":true,"fatsecret":true}

# Parse a meal:
curl -s -X POST "https://<project-ref>.functions.supabase.co/food" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action":"parse","text":"2 roti, dal tadka, 1 katori rice"}'
```

**In the app:** open the **Log** tab. The status line under "Meals" reads:

- 🟢 **AI-grounded · Gemini + FatSecret** — deployed, both secrets set, working.
- 🟠 **AI engine offline — using local foods** — function unreachable or a secret
  is missing (check `health`).
- ⚪ **Local food table** — no cloud account configured (running locally).

Grounded results also carry a small **FatSecret** / **AI est.** tag.

## Troubleshooting

- `health` shows `fatsecret: false` → secret not set, or you set it on the wrong
  project. Re-run step 3, then re-deploy.
- `health` ok but `parse`/`search` 500s → usually FatSecret IP allowlisting, or
  the FatSecret app lacks the `basic` scope. Check `supabase functions logs food`.
- App stays 🟠 after deploy → confirm `EXPO_PUBLIC_SUPABASE_URL` points at the
  same project you deployed to.

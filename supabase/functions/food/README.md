# `food` Edge Function — the USDA-grounded food engine

This function powers **"Describe a meal."** It's **DB-anchored, AI-judged**:
Gemini structures the free text, **USDA FoodData Central** supplies real candidate
foods with measured macros, then Gemini picks the best match (or explicitly
estimates), scales the portion, and attaches a confidence — so a guess is always
flagged, never hidden.

| action | body | returns |
| --- | --- | --- |
| `health` | `{ action: 'health' }` | `{ ok, gemini, usda }` — readiness, no model/DB call |
| `parse` | `{ action: 'parse', text }` | `ParsedMeal` (items + measured macros + confidence + one-tap alternates) |

Type-ahead **search** stays on the app's instant local Indian table; only the
free-text path calls this function. Everything falls back to the local table if
the function errors or isn't deployed, so logging never hard-fails.

> **Why USDA and not FatSecret?** FatSecret's free tier IP-allowlists every
> request (max 15 IPs, no CIDR/wildcard on Basic) and a Supabase Edge Function's
> egress IP rotates across a large pool — so it's blocked on every call (verified:
> `error code 21, Invalid IP address`). USDA FoodData Central is the government
> reference dataset, free, and has **no IP lock**.

---

## Deploy (one-time)

```bash
supabase login   # already done if `supabase projects list` works

# Keys (both free, both instant, neither IP-locked):
#   Gemini → https://aistudio.google.com/app/apikey   (model: gemini-2.5-flash)
#   USDA   → https://fdc.nal.usda.gov/api-key-signup

supabase secrets set \
  GEMINI_API_KEY=YOUR_GEMINI_KEY \
  USDA_API_KEY=YOUR_USDA_KEY \
  --project-ref <project-ref>

supabase functions deploy food --project-ref <project-ref> --no-verify-jwt
```

## Verify

```bash
# Health — expect {"ok":true,"gemini":true,"usda":true}
curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/food" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" -d '{"action":"health"}'

# Parse a meal (grounded in USDA, portions scaled by the AI)
curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/food" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action":"parse","text":"2 roti, dal tadka, 1 katori rice"}'
```

**In the app:** the **Log** tab shows the engine status under "Meals":
🟢 **AI-grounded · USDA** (live) · 🟠 offline (function unreachable / a key
missing) · ⚪ Local food table (no cloud account). Grounded items carry a small
**USDA** tag; anything the AI had to estimate is tagged **AI est.** + low
confidence.

## Troubleshooting

- `usda:false` / `gemini:false` → that secret isn't set on this project.
- Health ok but parse empty → a Gemini quota error (`429`, `limit: 0`) on the
  model, or USDA returned no candidates. Check `supabase functions logs food`.
- USDA free tier is rate-limited (~1k req/hour by default) — plenty for personal
  use; the local table covers type-ahead search so keystrokes don't burn quota.

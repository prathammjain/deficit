# Setup

Grain runs fully on-device with no account until you add the keys below.
Each step switches on more: Supabase adds sign-in and sync, the engine keys add
grounded meal parsing. Nothing in the app code changes; everything is gated on
configuration.

## 1. Supabase: accounts and sync

1. Create a project at [supabase.com](https://supabase.com).
2. **Schema.** SQL Editor → paste [`supabase/schema.sql`](supabase/schema.sql)
   → Run. It creates the per-user storage table and the shared engine cache,
   both with row-level security.
3. **Email sign-in.** Authentication → Providers → Email: enabled. Magic links
   work on the built-in sender at low volume; add SMTP for real traffic.
4. **Allowed addresses.** Authentication → URL Configuration:
   - Site URL: `https://app.getgrain.fit`
   - Redirect URLs: `https://app.getgrain.fit` and `http://localhost:8081`
5. **Keys.** Project Settings → API. Copy `.env.example` to `.env` and fill in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```

   The anon key is meant to be public; row-level security keeps each user's
   data private.

6. Restart `npm run web`. The sign-in screen appears.

### Google sign-in (optional)

1. Google Cloud Console → Credentials → OAuth client ID (Web application).
   Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → Google: paste the client ID and
   secret.

## 2. The engine: grounded meal parsing

Without this, "Describe a meal" uses the offline parser over the built-in
table. With it, descriptions go through the `food` Edge Function.

Keys:

- **Gemini** (the default LLM, and voice to text): [aistudio.google.com](https://aistudio.google.com/apikey)
- **USDA FoodData Central** (free): [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup)
- **Groq** (optional, free): [console.groq.com](https://console.groq.com). Used
  when no Gemini key is set, for both the LLM and voice (Whisper).

Deploy with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set GEMINI_API_KEY=... USDA_API_KEY=...
supabase functions deploy food --no-verify-jwt
```

Models default to `gemini-3.8-flash` for meals and `gemini-3.5-flash-lite` for
voice; override with `GEMINI_MODEL` and `STT_MODEL`. To use another provider:
`supabase secrets set LLM_PROVIDER=groq` (or `openai` with `OPENAI_API_KEY`)
and redeploy.

The Log screen says nothing while the engine works, and shows a line when it is
offline. The health check makes a real call to the LLM, so an expired key shows
as offline rather than as healthy.

If you add the engine's address to a new domain, also add that domain to
`ALLOWED_ORIGINS` in `supabase/functions/food/index.ts` and redeploy.

## 3. Hosting: Vercel

Two Vercel projects deploy from this repository on every push to `main`:

| Project   | Root directory | Domain                             |
| --------- | -------------- | ---------------------------------- |
| `deficit` | `/`            | `app.getgrain.fit`                 |
| `grain`   | `landing`      | `getgrain.fit`, `www.getgrain.fit` |

The app's build is set in [`vercel.json`](vercel.json); the landing page has
its own [`landing/vercel.json`](landing/vercel.json) that serves its files as
they are. Add the two `EXPO_PUBLIC_SUPABASE_*` values as environment variables
on the app project.

## 4. Food data (maintainers)

The food tables are generated; don't edit them by hand.

| Table                              | Source             | Regenerate                                                                           |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `src/lib/food/indian-foods.ts`     | curated, part INDB | `python3 scripts/import-indb.py INDB.xlsx` (then paste)                              |
| engine copy of the above           | the curated table  | `node scripts/sync-indian-foods.mjs`                                                 |
| `supabase/functions/food/_ifct.ts` | IFCT 2017 PDF      | `npm run ifct -- path/to/food_table_IFCT2017.pdf > supabase/functions/food/_ifct.ts` |

IFCT 2017's publisher requires written permission to reproduce its data in a
product. That permission is an open item to settle before wider launch.

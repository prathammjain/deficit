# Deficit — Backend setup (Supabase + FatSecret + Gemini)

The app runs fully **local, no account** until you add the values below. Adding
them switches on magic-link accounts, cloud sync, and AI meal parsing. Nothing
in the app code needs to change — it's all gated on these keys.

Estimated time: ~15 minutes.

---

## 1. Supabase (auth + sync) — required

1. Create a free project at https://supabase.com → **New project**. Pick a
   region close to your testers. Save the database password somewhere.
2. **Run the schema.** Dashboard → **SQL Editor** → New query → paste the
   contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Enable email auth.** Dashboard → **Authentication → Providers → Email**:
   make sure Email is enabled. (Magic links work out of the box on the built-in
   email sender for low volume; for nicer delivery add an SMTP provider later.)
4. **Allow the redirect URL.** Authentication → **URL Configuration** → add your
   app URL to *Redirect URLs* (for local dev: `http://localhost:8081`; for the
   deployed PWA: its real URL).
5. **Grab the keys.** Project Settings → **API**. Copy the **Project URL** and
   the **anon public** key.
6. In the project root, copy `.env.example` to `.env` and fill in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

7. Restart the dev server (`npm run web`). You should now see the sign-in
   screen. Enter your email, click the link, and you're in — your data now
   syncs to Supabase.

> The anon key is **meant** to be public; row-level security (from the schema)
> is what keeps each user's data private.

---

## 2. AI meal parsing (Gemini + FatSecret) — optional, enables describe-to-log accuracy

Without these, "Describe" mode uses the built-in Indian food table. With them,
it uses Gemini to understand your wording and FatSecret for real nutrition.

### Get the keys
- **Gemini:** https://aistudio.google.com → **Get API key** (free tier).
- **FatSecret:** https://platform.fatsecret.com → register → create an app →
  copy **Client ID** and **Client Secret**. (Request "Basic" API access.)

### Deploy the Edge Function
Install the Supabase CLI (https://supabase.com/docs/guides/cli), then from the
project root:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set \
  GEMINI_API_KEY=... \
  FATSECRET_CLIENT_ID=... \
  FATSECRET_CLIENT_SECRET=...
supabase functions deploy food
```

> FatSecret may require you to **allow-list the egress IP** of your functions
> for the nutrition API. If lookups fail, check FatSecret's IP restrictions
> setting first.

Once deployed, the app automatically routes meal lookups through the function
(with the local table as an automatic fallback if it ever errors).

---

## What's where

| Piece | File |
|---|---|
| DB schema + RLS | `supabase/schema.sql` |
| Gemini + FatSecret proxy | `supabase/functions/food/index.ts` |
| Supabase client (gated) | `src/lib/supabase/client.ts` |
| Auth (magic link) | `src/lib/supabase/auth.tsx` |
| Cloud-backed storage | `src/lib/supabase/supabase-kv.ts` |
| Remote food provider | `src/lib/food/remote-provider.ts` |

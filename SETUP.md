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
   app URL to _Redirect URLs_ (for local dev: `http://localhost:8081`; for the
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

### Google sign-in (optional, web)

The sign-in screen shows a **Continue with Google** button on web. To make it
work:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   create an **OAuth client ID** (type: *Web application*):
   - First configure the **OAuth consent screen** (External, app name
     “Deficit”, your support email). No scopes beyond the defaults are needed.
   - **Authorized redirect URI:**
     `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
2. Supabase Dashboard → **Authentication → Providers → Google**: enable, paste
   the **Client ID** and **Client secret**, save.
3. That's it — no code or env changes. Users who previously signed in by magic
   link keep their data: Supabase links providers with the same verified email
   to one account.

---

## 2. AI meal parsing (Gemini + USDA) — optional, enables describe-to-log accuracy

Without these, "Describe" mode uses the built-in Indian food table. With them,
the engine grounds AI and a real food database in each other: Gemini structures
your wording, **USDA FoodData Central** supplies measured macros for candidate
foods, and Gemini then judges which candidate fits and how sure it is — so a
guess is always flagged, never hidden.

> We use USDA (not FatSecret) because Supabase Edge Functions have a rotating
> egress IP, and FatSecret's free tier IP-allowlists every request. USDA's key
> has no IP lock.

### Get the keys

- **Gemini:** https://aistudio.google.com → **Get API key** (free tier).
- **USDA:** https://fdc.nal.usda.gov/api-key-signup — instant free key from
  api.data.gov. No IP allow-listing.

### Deploy the Edge Function

Install the Supabase CLI (https://supabase.com/docs/guides/cli), then from the
project root:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set \
  GEMINI_API_KEY=... \
  USDA_API_KEY=...
supabase functions deploy food --no-verify-jwt
```

Check it's live: the app's log screen shows **"AI-grounded · USDA"** when the
function is reachable and both keys are set; otherwise it quietly falls back to
the local table (logging never hard-fails).

---

## What's where

| Piece                    | File                               |
| ------------------------ | ---------------------------------- |
| DB schema + RLS          | `supabase/schema.sql`              |
| Gemini + USDA engine     | `supabase/functions/food/index.ts` |
| Supabase client (gated)  | `src/lib/supabase/client.ts`       |
| Auth (magic link)        | `src/lib/supabase/auth.tsx`        |
| Cloud-backed storage     | `src/lib/supabase/supabase-kv.ts`  |
| Remote food provider     | `src/lib/food/remote-provider.ts`  |

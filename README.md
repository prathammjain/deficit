# Deficit

Hallucination-resistant meal logging for fat loss. Log what you ate in plain
language ("2 roti, mom's dal, 1 katori rice") and get calories, macros, and
your deficit, with every number you can trust.

## Why Deficit exists

I've been lifting for the better part of a year. Building muscle turned out to
be the easy half; losing fat while living in an Indian household, where the
food is gloriously carb-rich, is the hard one. So I tried the obvious hack: a
dedicated ChatGPT project where, every night before bed, I logged everything I
ate and got back calories, macros, and whether I hit my deficit.

It worked, until I noticed it sometimes just makes numbers up.

That is the whole reason this app exists: meal logging in natural language,
but with a **hybrid engine where AI and real food databases ground each
other**, so neither gets to invent a number alone. Log a meal the moment you
eat it, and the daily dashboard updates with numbers you can actually trust.

## How the engine works

1. An **LLM structures** your text into food items with normalised Indian
   portions (katori, roti, bowl). The provider is pluggable: Groq's
   `gpt-oss-120b` by default, OpenAI via one env switch.
2. Real candidates are fetched from two grounded sources: a **curated Indian
   home-cooking table** (derived from INDB, grounded in IFCT 2017) and **USDA
   FoodData Central** (measured macros per 100g).
3. The **LLM judges** which candidate matches, scales the portion, and makes
   its own independent calorie estimate. The two are cross-checked: agreement
   earns high confidence; divergence or a guessed portion gets flagged
   (`✓ good match`, `≈ likely`, `check this`).

A guess is always visible and one tap from correction. The trust signal
follows every entry into the log and history.

## Architecture map

```
src/app/          screens (expo-router): home, log, history, profile
src/components/   UI by feature: dashboard/, log/, history/, ui/ primitives
src/lib/          pure logic + IO: food engine client, targets, adaptive TDEE,
                  weekly prediction, KV storage (local or Supabase)
supabase/         schema.sql (RLS) + functions/food (the hybrid engine, Deno)
docs/             design specs and implementation plans
```

## Stack

- **Expo / React Native** (iOS, Android, web) with `expo-router`
- **Supabase** — magic-link + Google auth, row-level-secured cloud sync, and
  the `food` Edge Function (Deno) that runs the hybrid engine
- Runs **fully local with no account** until you add Supabase keys

## Run it locally

```bash
npm install
npm run web        # or: npm run ios / npm run android
```

That's enough to use the app against the built-in Indian food table. To turn on
accounts, cloud sync, and the AI-grounded engine, see **[SETUP.md](SETUP.md)**.

## Develop

```bash
npm test           # jest unit tests (pure logic: TDEE, budget, log, history)
npm run typecheck  # tsc --noEmit
npm run lint
```

## Deploy the web app

The app exports to a static PWA:

```bash
npx expo export --platform web      # outputs ./dist
```

Host `./dist` anywhere static (EAS Hosting, Vercel, Netlify). After deploying,
add the deployed URL to Supabase → Authentication → **URL Configuration →
Redirect URLs** so magic links land back in the app.

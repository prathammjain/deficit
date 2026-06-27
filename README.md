# Deficit

Hallucination-resistant meal logging for fat loss. Log what you ate in plain
language ("2 roti, mom's dal, 1 katori rice") and get calories, macros, and your
deficit — with every number you can trust.

## Why it exists

Logging meals to a ChatGPT project works until you notice it silently invents
numbers. Deficit fixes that with a **hybrid engine that grounds AI and a real
food database in each other**: neither gets to make up a number alone.

1. **Gemini** breaks your text into food items + normalised Indian portions
   (katori, roti, bowl).
2. **USDA FoodData Central** returns real candidate foods with *measured* macros.
3. **Gemini judges** which candidate actually matches, scales the portion, and
   attaches a **confidence** — `✓ good match`, `≈ likely`, or `⚠ check this`.

A guess is always flagged and one tap away from correction (swap to another
candidate). The trust signal follows the entry into your daily log and history,
so you can always see which numbers were solid and which were estimates.

Everything else — adaptive TDEE, weigh-ins, history dashboard — supports that
core loop.

## Stack

- **Expo / React Native** (iOS, Android, web) with `expo-router`
- **Supabase** — magic-link auth, row-level-secured cloud sync, and the `food`
  Edge Function (Deno) that runs the hybrid engine
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

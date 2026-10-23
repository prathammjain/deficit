# Grain

Food tracking for people who care about every gram.

Describe what you ate in plain English, "200 g chicken breast, 150 g rice,
1 tbsp ghee", and Grain works out the calories and macros from measured
nutrition data. Built for lifters, athletes and anyone whose numbers have to
be right.

**Live:** [getgrain.fit](https://getgrain.fit) (landing) ·
[app.getgrain.fit](https://app.getgrain.fit) (app)

## Why describe instead of scan

A photo can't see the oil in the pan, the chicken under the rice, or the
difference between 100 g and 180 g. Chatbots can read a description, but they
invent numbers and never show their work. Grain grounds an AI on real food data
so that every number comes from a measured source, and anything it isn't sure
about is flagged rather than hidden.

## How the engine works

The engine is the `food` Supabase Edge Function (`supabase/functions/food`).

1. **Structure.** An LLM splits the description into foods, servings and any
   stated amount ("150 ml", "1 tbsp").
2. **Ground.** Each food is matched against three sources: a curated table of
   Indian home dishes (home portions, recipe fats included), IFCT 2017 (Indian
   lab-measured ingredients) and USDA FoodData Central.
3. **Judge.** The LLM picks the best match and makes an independent estimate as
   a cross-check.
4. **Calculate.** Portion arithmetic is done in code, not by the model: stated
   weights become exact multipliers, and raw-to-cooked conversion for rice and
   dals uses documented yield factors.
5. **Flag.** Each item carries a source and a confidence (`✓ good match`,
   `≈ likely`, `check this`), and follows the entry into the log.

The LLM is pluggable (Groq `openai/gpt-oss-120b` by default, OpenAI by env
switch). If the engine is unreachable, the app falls back to an offline parser
over the built-in Indian table, so logging never hard-fails.

The engine's design, practice set and playground live in the separate,
private `grain_engine` repository. The build log for the app is
[`x.md`](x.md).

## Repository

```
src/app/           screens (expo-router): home, log, history, profile
src/components/    UI by feature: dashboard/, log/, history/, ui/
src/lib/           logic and storage: food engine client, targets, adaptive
                   TDEE, history, quantity rules, local or Supabase storage
supabase/          schema.sql (row-level security) and functions/food (engine)
landing/           the getgrain.fit landing page (static HTML, CSS, JS)
scripts/           data importers: IFCT 2017, INDB, table sync
public/            PWA manifest, icons, service worker
docs/              design specs and implementation plans
```

## Stack

- **Expo / React Native** with `expo-router`, shipped as a web PWA
- **Supabase**: email and Google sign-in, row-level-secured sync, and the
  Deno Edge Function that runs the engine
- **Vercel**: two projects from this repo, the app and `landing/`, both
  deploying on every push to `main`

## Run locally

```bash
npm install
npm run web
```

With no keys, the app runs fully on-device against the built-in food table.
To switch on accounts, sync and the grounded engine, see [SETUP.md](SETUP.md).

## Develop

```bash
npm test            # jest: engine rules, storage, targets, TDEE, history
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format      # prettier
```

## License

MIT, see [LICENSE](LICENSE).

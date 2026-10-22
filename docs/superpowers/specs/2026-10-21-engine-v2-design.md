# Engine v2 — accurate macro tracking for athletes

Date: 2026-10-21 · Status: awaiting approval (owner's answers folded in 2026-10-22)

## Intent and why

Deficit exists because ChatGPT gives calorie numbers that are silently wrong
and can't show its work. The plan was an engine that grounds an AI on real food
data, so its numbers come from measured sources rather than guesses.

In practice it now does worse than ChatGPT on everyday meals. On the same input
— "50g soya chunks blended with 1 potato and 1 tablespoon besan" — ChatGPT said
319 kcal / 31 g protein (about right). Deficit said 733 kcal / 41 g, matching
"soya chunk _curry_" under a "✓ good match" badge and reading "1 tablespoon" of
besan as "1 cup". The grounding idea is sound; the execution is incomplete. When
the right food is missing from our data, or the engine looks up the wrong one,
grounding pushes it towards an answer it wouldn't otherwise have given.

**The audience has changed.** Deficit is now built for people whose physique is
their profession or their serious pursuit: professional athletes, powerlifters,
models, gym and fitness influencers. They pay for tools; general users don't.
Ordinary users remain welcome but are no longer the design target, and every
decision is taken for the athlete.

What that audience logs on a typical day: protein-led meals (chicken with rice,
chicken sandwiches, paneer dishes, egg dishes, whey-protein desserts), fruit,
low-sugar and low-calorie snacks, healthy carbs (boiled potato, sweet potato,
oats), and small measured amounts of oil and ghee. They usually **weigh their
food and know what's in it.**

**The north star is unchanged: effective, accurate calorie and macro tracking.**
It is now held to a professional standard, because this audience will notice and
pay for the difference.

## Goals

1. Be measurably more accurate than ChatGPT on the meals this audience actually
   logs, with protein treated as being as important as calories.
2. Never be silently wrong. When unsure, say so plainly; never put a confident
   badge on a guess.
3. Make improving the engine a measured activity: every change is scored against
   a fixed set of meals with known answers before it reaches users.

## Success criteria

Scored on the practice set (below):

| Meal kind                                                     | Calories                | Protein                 |
| ------------------------------------------------------------- | ----------------------- | ----------------------- |
| Weighed ingredients ("200g chicken breast, 150g cooked rice") | within ±5%              | within ±5%              |
| Home-cooked or composite dishes ("2 roti, dal tadka")         | within ±15%             | within ±15%             |
| Any meal                                                      | never off by 2× or more | never off by 2× or more |

And overall: beats ChatGPT's recorded answers on the same set.

How it is counted (my call):

- **Per meal, on the meal's total.** Where a meal mixes kinds (weighed chicken
  plus 2 roti), each item is held to its own band and the meal passes only if
  every item does.
- **Weighed meals:** at least 90% land within ±5%. **Dishes:** at least 90% land
  inside their reference range. **The 2× rule has no exceptions.**
- **"Beats ChatGPT"** means a lower median error than ChatGPT's recorded answers
  on calories _and_ on protein, each measured separately.

These targets are my proposal from our conversation; adjust them if they feel
wrong.

## Non-goals

- **Specific brands.** Whey, soya chunks, low-fat paneer, Greek yogurt and
  protein bars vary by brand. For now each has one standard row, and the
  engine notes that brands vary. Exact brand numbers will come from a future
  "scan a label" feature (owner's decision).
- **Photo scanning.** A photo can't see food beneath other food, can't see oil
  or ghee, can't judge depth or weight, and can't tell low-fat paneer from
  regular. Deficit calculates from what you ate rather than guessing from a
  picture, and that is a selling point. Photos might later _identify_ foods and
  then ask for weights, but never supply the numbers. Out of scope here.
- Designing for casual users at the athlete's expense.
- Changes to the rest of the app (dashboard, weigh-ins, TDEE) beyond what the
  engine needs.

## Anti-goals — failure even if it "works"

- A confident badge ("✓ good match") on a wrong answer. Worse than no badge.
- Tuning the engine to the practice set so it scores well there and badly on
  real meals.
- Numbers that change between two phrasings of the same meal ("50g" vs "50gm").
- Silently ignoring a weight the user stated.
- Shipping an engine change that hasn't been scored.

## Constraints

- Solo developer. **AI budget: at most $10–20 a month.** A paid model is
  acceptable within that **if** it clearly improves the score.
- **Speed: "Match" must return within 8–9 seconds.** Today it takes about
  10–15 s, so this is a real target, not slack — it constrains the model choice
  and how many AI calls a meal may make.
- The live app (Expo PWA on Vercel, Supabase backend, `food` edge function on
  Deno) must keep working throughout. Users see no change until step 6.
- Groq's free tier caps requests per day; any model choice must hold up at
  athlete-app volumes.
- IFCT 2017 data is used now, by the owner's decision. Its publisher requires
  written permission to reproduce the data in a product. **Open item:** settle
  this before marketing, investor conversations, or wider expansion.

## The plan, as decided

### 1. Practice set (the "eval")

A fixed list of real meals, typed exactly as a user would type them, each with a
correct answer and ChatGPT's recorded answer.

- The owner supplies meals and recipes from the athlete's typical day, including
  the ones that went wrong.
- **Weighed meals** get an exact answer: published per-100g values (USDA, IFCT,
  product labels) × the stated weights.
- **Dishes** get an answer _range_ built from professional recipes, because
  home cooking varies.
- Answers are checked the way the owner already checks: against published
  nutrition data and professional recipes.
- **Who produces what (my call):** the builder computes each correct answer
  from the source rules in step 3 and records how it was derived; the owner
  signs off a sample of them before the set is used to gate shipping.
  ChatGPT's answers are recorded from the owner's own ChatGPT, the way they use
  it today, since that is the comparison that matters. Meals the builder adds
  later may be recorded through the API with a current GPT model, labelled as
  such.

Known cases that must be in it: the soya-chunk meal above; "120 ml milk with
half a tablespoon of sugar and coffee"; "1 tablespoon ghee"; "50g soya chunks"
alone.

### 2. The lab

A small separate project — a workshop — where the engine is run against the
practice set in one go, producing a score and a side-by-side view: each meal,
our answer, the correct answer, ChatGPT's answer, the error, and the candidate
foods the engine considered. It is where the engine gets improved; the app does
not change while work happens there.

**The engine exists in one place only.** The lab and the app's edge function use
the same engine code. Copies must not drift — this project has already been
bitten by two food tables that nothing kept in sync. "Shipping to the app" means
updating the version the app uses, never copying files across.

My call: the lab is its own repository, so it can be experimented in freely.

### 3. Our own food database

One database of our own in Supabase, replacing live calls to USDA on every meal.

- Sources: USDA FoodData Central (public domain), IFCT 2017 (already parsed:
  525 rows, `scripts/import-ifct.py`), the curated Indian dish table
  (`src/lib/food/indian-foods.ts`), and INDB recipes.
- Every row records where it came from, so it can be audited and corrected.
- **Staples come first and must be right:** chicken breast and thigh (raw _and_
  cooked), eggs and egg whites, paneer (regular and low-fat), whey, Greek
  yogurt, milks (toned, double-toned, full-cream, cow, buffalo), rice raw and
  cooked, boiled potato, sweet potato, oats, common fruits, oil, ghee, butter,
  sugar, besan, soya chunks.
- Each staple carries Hinglish and English names, and **its own weight per
  household measure** — a tablespoon of oil is not a tablespoon of besan.
- Raw versus cooked is explicit for every food where it matters.
- **When sources disagree, one decision applies to both the database and the
  practice set's answers,** so a meal can never fail purely on which source
  each side used.
  - Where IFCT and USDA agree within about 10%, use either — it doesn't matter.
  - Where they disagree by more than that, **don't pick a source wholesale —
    decide that food on its own evidence** and record why. The gap may be a
    measurement difference, or it may be real: IFCT measured Indian produce
    and animals, USDA measured American ones, and breed, feed and trimming
    genuinely differ (owner's point). For an Indian athlete eating Indian
    chicken, the Indian figure may be the right one. Tie-breaker: the
    nutrition labels on what Indian athletes actually buy.
  - Example of why it matters: IFCT lists skinless chicken breast at 168 kcal
    and 9 g fat per 100 g; USDA says about 120 kcal and 2.6 g fat.
  - The lab lists every food where the sources disagree, so these decisions
    are visible and deliberate rather than accidental.

### 4. Fix how the engine thinks

- **Ingredient vs dish.** "50g soya chunks" and "1 tbsp ghee" are ingredients
  and look up ingredients. "Dal tadka" and "chicken sandwich" are dishes and
  look up dishes. This alone fixes the soya-chunk failure.
- **Arithmetic in code, not in the AI.** Grams, spoons, katoris and glasses are
  converted using the food's own measure weights. The AI identifies foods and
  amounts; it does not do the maths.
- **Every stated weight is honoured,** whatever kind of food it matches.
- **A weight is assumed cooked unless the user says raw** (owner's decision).
  "200 g chicken breast" means cooked; "200 g raw chicken breast" means raw.
  The engine always shows which it assumed, so a user who weighed raw can see
  it and correct it. The practice set's answers follow the same rule.
- **An honest confidence signal** built on something checkable — an exact
  staple match with a stated weight is trustworthy; a guessed portion of a
  loosely matched dish is not. It replaces the current check, where the AI
  grades its own answer and agrees with its own mistakes.
- **Say what's missing.** Like ChatGPT's "(without oil)": when a likely
  ingredient isn't mentioned, the engine says so rather than silently assuming.

### 5. Try stronger models

Run the practice set with the current free model and two or three paid ones.
Switch only if a model clearly improves the score at a cost per meal that makes
sense.

### 6. Ship

When the lab's score beats ChatGPT's on the practice set and meets the success
criteria, the app's edge function moves to the new engine version.

At the same time (my call), the app's own food search and its offline fallback
move onto the new database, retiring `src/lib/food/indian-foods.ts` as a
separate source. Otherwise the app would show different numbers from the
engine — the drift this project has already suffered.

## Left to the builder

- Database schema and how the sources are merged and de-duplicated.
- The lab's form: CLI, web page, or both; how results are stored over time.
- How the engine is shared between lab and app (package, submodule, or another
  way), provided there is exactly one copy of the engine's code.
- How lookup works (keyword, aliases, embeddings, or a mix).
- Which paid models go into the bake-off.
- How many practice meals are enough, beyond the owner's set.

## Current state to build on

- Live engine: `supabase/functions/food/` — `index.ts` (pipeline), `ifct.ts`
  (IFCT lookup and raw→cooked yields), `portion.ts` (per-100g quantity from
  stated grams), engine cache version `v4`.
- Logging now saves engine quantities exactly and shows weighed items in grams
  (`src/lib/quantity.ts`, commit `06a446a`).
- A fix for the offline fallback parser (decimals and grams) sits on branch
  `claude/loving-dirac-e3d833`, not yet merged.
- The engine's answers are cached in the `food_cache` table, which only stores
  runs that didn't degrade — so it shows the engine's better answers, not its
  worst.

## Future, not in this project

- **"My recipes."** Enter a batch recipe once (say, whey brownies or a week's
  chicken prep), then log "1 brownie" or "300 g" with exact numbers. Likely
  valuable to athletes who meal-prep; my guess, not yet asked for.
- **"Scan a label."** Photograph a product's nutrition label to log or save
  its exact values — the owner's planned route for branded foods. Unlike
  photographing a plate, a label states its numbers, so this is reliable.
- Photo assistance as described under Non-goals.

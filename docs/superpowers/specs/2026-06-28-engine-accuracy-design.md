# Deficit — Engine accuracy for Indian food (Describe a meal)

**Date:** 2026-06-28
**Scope:** Piece 1 of the "make Describe a meal powerful" work — **engine
accuracy**. Personal food memory (Piece 2) and the UI alignment pass are
separate, later tracks. Photo/voice input is out of scope.

## Problem (evidence from the live engine, 2026-06-28)

Tested with real meals, the engine is **overconfident**, not under-powered. It
marked nearly everything `high` confidence while silently:

- matching **"dal tadka" → plain "cooked dal"** (drops tempering ghee → undercounts)
- matching **"butter naan" → plain "Bread, naan"** (drops butter → undercounts)
- estimating **"2 roti ≈ 60g"** (a roti is ~45g; 2 ≈ 90g → ~30% low)

All shown as confident green badges. This is the silent-wrong-number problem the
app exists to prevent — now hidden behind false confidence. Root causes:

1. Engine grounds **only on USDA** (US-centric, weak on Indian home food) and
   **ignores the app's own curated `INDIAN_FOODS` table**.
2. **No real cross-check.** The model picks a DB number and self-reports
   confidence (optimistically); it never makes an independent estimate to
   compare against, so divergence is never caught.
3. **Portion guesses** are silent and sometimes well off.

## Goal

Numbers more accurate for Indian food, and — per the north star — **honestly
flagged when they can't be trusted**. Calibration constraint from the user:
**don't over-nag** — keep clearly-known foods quiet; flag only genuine
disagreement, guessed foods, or shaky portions.

## Design — 3 moves (all in `supabase/functions/food/index.ts`)

### Move 1 — Indian table as a candidate source
- Bundle the curated Indian foods into the function as
  `supabase/functions/food/indian-foods.json`, generated from the canonical
  `src/lib/food/indian-foods.ts` by a small sync script
  (`scripts/sync-indian-foods.mjs`). One source of truth; regenerate when the
  table changes.
- For each structured item, build candidates from **both** sources:
  - Indian table: top ~3 by the existing name/alias scorer (these carry real
    home portions and include ghee/butter), tagged `source: 'local'`.
  - USDA: top ~5 from search, tagged `source: 'usda'`. **Exclude `Branded`**
    (noisy keyword products) to raise precision.
- The judge sees the merged, source-tagged list and picks the best across both.

### Move 2 — Cross-check → honest, server-computed confidence
- The judge step (one Gemini call, no extra latency) returns, per item:
  `chosen` (candidate index or -1), `quantity`, an **independent
  `aiEstimateKcal`** (the model's own estimate for the eaten portion), and
  `portionCertainty` ('clear' | 'unsure').
- **Confidence is computed server-side** (not self-reported), from the gap
  between the chosen candidate's scaled kcal and `aiEstimateKcal`:
  - gap ≤ 20% **and** portion 'clear' → **high** (quiet)
  - gap ≤ 20% but portion 'unsure', or gap 20–40% → **medium**
  - gap > 40%, or no DB match (pure AI estimate) → **low**
  - **Don't-over-nag override:** a chosen **Indian-table** candidate whose
    estimate agrees (≤20%) and portion 'clear' is always **high** — curated
    home foods are trusted.
- When flagged, `reason` names the disagreement, e.g.
  *"table says 180 kcal, my estimate ~260 — recipe/portion varies"*, so the
  user sees *why*. UI already renders reason + alternates + badge.

### Move 3 — Portion grounding
- Add an Indian portion→grams reference to the structuring prompt: roti/chapati
  ≈ 45g, phulka ≈ 35g, paratha ≈ 80g, naan ≈ 90g, katori (dal/curry/rice) ≈
  150g, bowl ≈ 200g, glass ≈ 250ml. Use these unless the user gives grams.
- When an Indian-table candidate is chosen, prefer **its** home serving over
  re-deriving grams.

## Data flow (after)

```
text
 → geminiStructure  (items + portions, grounded by the gram table)
 → for each item: indianSearch(top3) + usdaSearch(top5, no Branded)  [merge]
 → geminiJudge      (pick best candidate + own aiEstimateKcal + portionCertainty)
 → server computes calibrated confidence (cross-check)
 → items[] with source, confidence, reason, alternates  → totals
```

Client (`remote-provider.ts`) and UI are unchanged — same `ParsedMeal` shape.
The local-table fallback on engine error (added 2026-06-28) still applies.

## Testing / verification

- **Before/after on a fixed meal set** (the 3 tested + rajma chawal, chole
  bhature, poha): confirm (a) Indian-table candidates get used, (b) portions
  realistic (2 roti ≈ 90g), (c) confidence calibrated — staples quiet, rich/
  ambiguous dishes (dal makhani, butter dishes) flagged, not blanket-high.
- Function is Deno/`@ts-nocheck` (excluded from jest/tsc); verification is the
  live before/after comparison, captured in the implementation notes.
- Redeploy: `supabase functions deploy food --no-verify-jwt`.

## Out of scope (later / separate)

- Personal food memory (Piece 2 — remembered foods, corrections stick).
- UI professional alignment pass (separate track).
- Photo / voice input.
- Per-user AI rate limiting / function auth hardening.

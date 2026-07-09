# "This week" — weekly weight-loss prediction

**Date:** 2026-07-09
**Status:** Approved

## Purpose

Turn the daily deficits a user logs into one motivating number on Home:
the weight they are on pace to lose this week. Tolerate a missed day or
two; after 7 consecutive unlogged days the prediction restarts fresh
while all log history stays intact.

## Decisions (user-approved)

1. **Rolling window, not calendar weeks.** The prediction always reads
   the trailing 7 days. Seven consecutive unlogged days leave the window
   empty, which *is* the reset — no stored anchor, no reset state to
   manage, and log history is untouched by construction.
2. **Missed days count as your average, up to 2.** With ≥5 logged days
   the prediction is `avgDailyDeficit × 7` (the ×7 implicitly fills
   missed days with the average). With 1–4 logged days there is no
   number — the card asks the user to log more days. With 0, it starts
   fresh.
3. **Lives on Home**, directly below the daily-target hero card.
4. **Today is excluded.** The window is the 7 days ending *yesterday*.
   A half-eaten day looks like a huge deficit and would swing the
   prediction all morning; completed days are stable.
5. **Maintenance = best available estimate.** Use the adaptive TDEE
   estimate when it exists (`estimatedTdeeKcal`), else the formula
   maintenance from the profile. The lib takes a single number; the
   caller chooses.
6. **Surpluses are shown honestly.** If the average is a surplus, the
   card says "on pace to gain X kg" in accent orange — consistent with
   the app's never-hide-a-guess principle.

## Architecture

New pure module + one card component. Zero new IO — Home already loads
`gatherHistory(21)`, which contains everything needed.

### `src/lib/weekly-prediction.ts` (pure, no storage)

```ts
export interface WeeklyPrediction {
  state: 'ready' | 'building' | 'fresh';
  loggedDays: number;                 // 0..7
  missedDays: number;                 // 7 − loggedDays
  avgDailyDeficitKcal: number | null; // ready only
  weeklyDeficitKcal: number | null;   // avg × 7, ready only
  predictedKgPerWeek: number | null;  // weekly / 7700; positive = loss
  days: { date: string; logged: boolean }[]; // 7 entries, oldest → newest
}

export function predictWeeklyLoss(
  data: DailyDatum[],      // any series that includes the window
  maintenanceKcal: number, // adaptive ?? formula, chosen by caller
  today?: string,          // YYYY-MM-DD, injectable for tests
): WeeklyPrediction;
```

Rules:

- Window: the 7 calendar dates ending the day before `today`
  (default: today's local date via the existing `todayKey()` logic).
- A day is *logged* when its `intakeKcal` is a number > 0 (same
  predicate `estimateAdaptiveTdee` uses).
- Per logged day: `deficit = maintenanceKcal − intakeKcal`.
- `loggedDays ≥ 5` → `state: 'ready'`;
  `avg = round(sum / loggedDays)`; `weekly = avg × 7`;
  `predictedKgPerWeek = round2(weekly / KCAL_PER_KG_FAT)`.
- `1 ≤ loggedDays ≤ 4` → `state: 'building'`, numeric fields null.
- `loggedDays === 0` → `state: 'fresh'`, numeric fields null.
- `days` is always populated so the card can render the dot strip.

### `src/components/dashboard/week-card.tsx`

Rendered on Home under the hero, headed by `SectionLabel` "This week".
Warm Instrument skin: standard `Card`, label + stat-size value (not
DotMatrix — hero numerals stay reserved for the signature numbers).

- **ready:** "Predicted loss" label; value `−0.48 kg` in ink (or
  "Predicted gain" + `+0.21 kg` in accent orange when
  `predictedKgPerWeek < 0`); sub-line `goal −0.50 kg / week` from
  `targets.appliedRateKgWeek`; 7-dot strip.
- **building:** dot strip + "N of 7 days logged — log M more to see
  your weekly prediction" (M = 5 − loggedDays).
- **fresh:** "Starting fresh — log today to begin a new week."

Dot strip: 7 dots oldest → newest; filled ink = logged, hollow
(hairline ring) = missed. Sized like the calendar's day dots.

### Wiring (`src/app/index.tsx`)

Home already has `gatherHistory(21)` in state for the adaptive card.
Compute `predictWeeklyLoss(history, adaptive?.estimatedTdeeKcal ??
t.maintenanceKcal)` and render `<WeekCard …/>` below the hero. The
history state must be kept (it currently only feeds
`estimateAdaptiveTdee` and is discarded — retain the array in state).

## Sign / display conventions

- Internally `deficit > 0` = ate under maintenance (matches
  `dayDeficit`), so `predictedKgPerWeek > 0` = **loss**.
- Display: loss renders with a leading "−" ("−0.48 kg", ink); gain
  renders "+0.21 kg" in accent. Rounded to 2 decimals.

## Error handling

- No profile → card not rendered (Home already gates on profile).
- Fewer than 7 days of history available (new user): missing dates are
  simply unlogged days; states degrade naturally to building/fresh.
- `maintenanceKcal ≤ 0` cannot occur (formula floor); no guard needed.

## Testing (`src/lib/weekly-prediction.test.ts`)

Pure-function unit tests, fixed `today` injected:

1. 7/7 logged → ready; avg, weekly, kg math exact.
2. 5/7 logged → ready; missed days filled by the ×7 average.
3. 4/7 logged → building, nulls, correct loggedDays.
4. 0/7 logged → fresh (the 7-day reset).
5. Surplus week → negative `predictedKgPerWeek` (gain).
6. Today excluded: a logged `today` must not affect the result.
7. `days` array ordered oldest → newest with correct flags.

## Out of scope

- No persistence of past predictions; the number is always derived.
- No push/notification nudges for missed days.
- History screen unchanged.

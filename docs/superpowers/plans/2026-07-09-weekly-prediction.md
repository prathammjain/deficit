# Weekly Weight-Loss Prediction ("This week" card) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "This week" card on Home that turns the trailing 7 days of logged deficits into a predicted weekly weight change, tolerating up to 2 missed days and restarting fresh after a fully unlogged week.

**Architecture:** One new pure module (`predictWeeklyLoss`) mirroring `adaptive-tdee.ts` — no storage, fully unit-tested — plus one new dashboard card component wired into Home. Zero new IO: Home already loads `gatherHistory(21)`; we retain that array in state and derive the prediction from it.

**Tech Stack:** Expo / React Native (web PWA), TypeScript strict, Jest for unit tests, existing Warm Instrument design tokens (`@/constants/palette`).

**Spec:** `docs/superpowers/specs/2026-07-09-weekly-prediction-design.md`

## Global Constraints

- Window = the 7 calendar days ending **yesterday** (today excluded).
- A day is *logged* iff `typeof intakeKcal === 'number' && intakeKcal > 0` (same predicate as `estimateAdaptiveTdee`).
- States: `loggedDays ≥ 5` → `ready`; `1–4` → `building`; `0` → `fresh`.
- `predictedKgPerWeek = round2((avgDeficit × 7) / KCAL_PER_KG_FAT)`; `KCAL_PER_KG_FAT` is `7700`, imported from `./targets` — never hard-code it.
- Sign convention: positive = loss. Display: loss renders `−0.48 kg` in ink, gain renders `+0.21 kg` in `palette.accent`. Use the true minus sign `−` (U+2212), as elsewhere in the app.
- Styling only via existing tokens (`palette`, `space`, `type` from `@/constants/palette`); no new colors. DotMatrix is NOT used here (reserved for hero numerals).
- Follow CLAUDE.md: surgical changes only; match existing style.
- Test runner: `npx jest <path>`. Typecheck: `npx tsc --noEmit`. Lint: `npx eslint <paths>`.

---

### Task 1: `predictWeeklyLoss` pure library (TDD)

**Files:**
- Create: `src/lib/weekly-prediction.ts`
- Test: `src/lib/weekly-prediction.test.ts`

**Interfaces:**
- Consumes: `DailyDatum` from `src/lib/adaptive-tdee.ts` (`{ date: string; intakeKcal?: number | null; weightKg?: number | null }`), `KCAL_PER_KG_FAT` from `src/lib/targets.ts`, `todayKey(d?: Date): string` from `src/lib/log-store.ts`.
- Produces: `predictWeeklyLoss(data: DailyDatum[], maintenanceKcal: number, today?: string): WeeklyPrediction` and the `WeeklyPrediction` interface — Task 2 imports both from `@/lib/weekly-prediction`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/weekly-prediction.test.ts`:

```ts
/**
 * weekly-prediction.test.ts — the "This week" math (spec:
 * docs/superpowers/specs/2026-07-09-weekly-prediction-design.md).
 * Window is the 7 days ending YESTERDAY; ≥5 logged days → prediction;
 * 1–4 → building; 0 → fresh (the 7-missed-days reset, stateless).
 */

import type { DailyDatum } from './adaptive-tdee';
import { predictWeeklyLoss } from './weekly-prediction';

const TODAY = '2026-07-09'; // window = 2026-07-02 .. 2026-07-08
const MAINT = 2500;

const WINDOW = [
  '2026-07-02',
  '2026-07-03',
  '2026-07-04',
  '2026-07-05',
  '2026-07-06',
  '2026-07-07',
  '2026-07-08',
];

const day = (date: string, intakeKcal: number | null): DailyDatum => ({
  date,
  intakeKcal,
});

/** The full window at a constant intake, with optional unlogged dates. */
const week = (intake: number, skip: string[] = []): DailyDatum[] =>
  WINDOW.map((d) => day(d, skip.includes(d) ? null : intake));

describe('predictWeeklyLoss', () => {
  it('predicts from a fully logged week', () => {
    // deficit 700/day → avg 700, weekly 4900, 4900/7700 = 0.64 kg
    const p = predictWeeklyLoss(week(1800), MAINT, TODAY);
    expect(p.state).toBe('ready');
    expect(p.loggedDays).toBe(7);
    expect(p.missedDays).toBe(0);
    expect(p.avgDailyDeficitKcal).toBe(700);
    expect(p.weeklyDeficitKcal).toBe(4900);
    expect(p.predictedKgPerWeek).toBe(0.64);
  });

  it('fills up to 2 missed days with the logged-day average', () => {
    const p = predictWeeklyLoss(
      week(1800, ['2026-07-03', '2026-07-05']),
      MAINT,
      TODAY,
    );
    expect(p.state).toBe('ready');
    expect(p.loggedDays).toBe(5);
    expect(p.missedDays).toBe(2);
    // avg unchanged → same weekly prediction as the full week
    expect(p.avgDailyDeficitKcal).toBe(700);
    expect(p.weeklyDeficitKcal).toBe(4900);
    expect(p.predictedKgPerWeek).toBe(0.64);
  });

  it('is building with fewer than 5 logged days', () => {
    const p = predictWeeklyLoss(
      week(1800, ['2026-07-03', '2026-07-05', '2026-07-07']),
      MAINT,
      TODAY,
    );
    expect(p.state).toBe('building');
    expect(p.loggedDays).toBe(4);
    expect(p.avgDailyDeficitKcal).toBeNull();
    expect(p.weeklyDeficitKcal).toBeNull();
    expect(p.predictedKgPerWeek).toBeNull();
  });

  it('starts fresh on an empty window (the 7-missed-days reset)', () => {
    // No data at all, and zero-intake days both count as unlogged.
    const empty = predictWeeklyLoss([], MAINT, TODAY);
    expect(empty.state).toBe('fresh');
    expect(empty.loggedDays).toBe(0);
    expect(empty.predictedKgPerWeek).toBeNull();

    const zeros = predictWeeklyLoss(week(0), MAINT, TODAY);
    expect(zeros.state).toBe('fresh');
  });

  it('reports a surplus week as a predicted gain (negative kg)', () => {
    // intake 2900 vs maintenance 2500 → avg −400, weekly −2800 → −0.36 kg
    const p = predictWeeklyLoss(week(2900), MAINT, TODAY);
    expect(p.state).toBe('ready');
    expect(p.avgDailyDeficitKcal).toBe(-400);
    expect(p.predictedKgPerWeek).toBe(-0.36);
  });

  it('excludes today from the window', () => {
    const withToday = predictWeeklyLoss(
      [...week(1800), day(TODAY, 100)], // extreme partial day
      MAINT,
      TODAY,
    );
    const without = predictWeeklyLoss(week(1800), MAINT, TODAY);
    expect(withToday).toEqual(without);
  });

  it('returns the 7 window days oldest → newest with logged flags', () => {
    const p = predictWeeklyLoss(week(1800, ['2026-07-04']), MAINT, TODAY);
    expect(p.days.map((d) => d.date)).toEqual(WINDOW);
    expect(p.days.map((d) => d.logged)).toEqual([
      true,
      true,
      false,
      true,
      true,
      true,
      true,
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/weekly-prediction.test.ts`
Expected: FAIL — `Cannot find module './weekly-prediction'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/weekly-prediction.ts`:

```ts
/**
 * weekly-prediction.ts — turn the trailing week of logged deficits into one
 * motivating number: the weight the user is on pace to lose this week
 * (spec: docs/superpowers/specs/2026-07-09-weekly-prediction-design.md).
 *
 * Pure math, no storage. The window is the 7 days ending YESTERDAY — a
 * half-eaten today looks like a huge deficit and would swing the prediction
 * all morning. Missing 1–2 days are implicitly filled with the logged-day
 * average (that's what avg × 7 does); below 5 logged days we don't pretend
 * ('building'), and an empty window starts over ('fresh') — which is exactly
 * the "7 missed days resets the prediction, never the history" rule, with
 * no stored state to manage.
 */

import type { DailyDatum } from './adaptive-tdee';
import { todayKey } from './log-store';
import { KCAL_PER_KG_FAT } from './targets';

export interface WeeklyPrediction {
  state: 'ready' | 'building' | 'fresh';
  /** Days with a real intake log, 0..7. */
  loggedDays: number;
  missedDays: number;
  /** maintenance − intake, averaged over logged days (ready only). */
  avgDailyDeficitKcal: number | null;
  /** avgDailyDeficitKcal × 7 (ready only). */
  weeklyDeficitKcal: number | null;
  /** weeklyDeficit / 7700. Positive = loss, negative = gain (ready only). */
  predictedKgPerWeek: number | null;
  /** The 7 window days, oldest → newest — for the dot strip. */
  days: { date: string; logged: boolean }[];
}

/** Below this many logged days we show progress, not a prediction. */
const MIN_READY_DAYS = 5;

export function predictWeeklyLoss(
  data: DailyDatum[],
  maintenanceKcal: number,
  today: string = todayKey(),
): WeeklyPrediction {
  const intakeByDate = new Map(data.map((d) => [d.date, d.intakeKcal]));
  const base = new Date(`${today}T00:00:00`);

  // Offsets 7..1 = the 7 days ending yesterday, oldest first.
  const window: { date: string; logged: boolean; intake: number }[] = [];
  for (let offset = 7; offset >= 1; offset--) {
    const d = new Date(base);
    d.setDate(d.getDate() - offset);
    const date = todayKey(d);
    const intake = intakeByDate.get(date);
    const logged = typeof intake === 'number' && intake > 0;
    window.push({ date, logged, intake: logged ? (intake as number) : 0 });
  }

  const logged = window.filter((d) => d.logged);
  const loggedDays = logged.length;
  const missedDays = 7 - loggedDays;
  const days = window.map(({ date, logged: l }) => ({ date, logged: l }));

  if (loggedDays < MIN_READY_DAYS) {
    return {
      state: loggedDays === 0 ? 'fresh' : 'building',
      loggedDays,
      missedDays,
      avgDailyDeficitKcal: null,
      weeklyDeficitKcal: null,
      predictedKgPerWeek: null,
      days,
    };
  }

  const sum = logged.reduce((s, d) => s + (maintenanceKcal - d.intake), 0);
  const avg = Math.round(sum / loggedDays);
  const weekly = avg * 7;
  return {
    state: 'ready',
    loggedDays,
    missedDays,
    avgDailyDeficitKcal: avg,
    weeklyDeficitKcal: weekly,
    predictedKgPerWeek: Math.round((weekly / KCAL_PER_KG_FAT) * 100) / 100,
    days,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/weekly-prediction.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekly-prediction.ts src/lib/weekly-prediction.test.ts
git commit -m "feat: weekly weight-loss prediction math (rolling 7-day window)"
```

---

### Task 2: WeekCard on Home

**Files:**
- Create: `src/components/dashboard/week-card.tsx`
- Modify: `src/components/dashboard/styles.ts` (append week* styles before the closing `});`)
- Modify: `src/app/index.tsx` (retain history in state; render the card below the hero)

**Interfaces:**
- Consumes: `predictWeeklyLoss` + `WeeklyPrediction` from `@/lib/weekly-prediction` (Task 1); `DailyDatum` from `@/lib/adaptive-tdee`; existing Home values `adaptive.estimatedTdeeKcal`, `t.maintenanceKcal`, `t.appliedRateKgWeek`.
- Produces: `WeekCard({ prediction, goalRateKgWeek }: { prediction: WeeklyPrediction; goalRateKgWeek: number })`.

- [ ] **Step 1: Create the card component**

Create `src/components/dashboard/week-card.tsx`:

```tsx
/**
 * week-card.tsx — "This week" on Home: the weight the user is on pace to
 * lose, from the trailing-7-day deficit average (see weekly-prediction.ts).
 * A 7-dot strip shows logged/missed days; below 5 logged days the card asks
 * for more logging; after a fully unlogged week it starts fresh. Gains are
 * shown honestly, in accent.
 */

import { Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import type { WeeklyPrediction } from '@/lib/weekly-prediction';

import { st } from './styles';

export function WeekCard({
  prediction,
  goalRateKgWeek,
}: {
  prediction: WeeklyPrediction;
  goalRateKgWeek: number;
}) {
  const { state, loggedDays, predictedKgPerWeek } = prediction;
  const gaining = state === 'ready' && (predictedKgPerWeek as number) < 0;

  return (
    <Card padded>
      <View style={st.weekTopRow}>
        <Text style={st.weekLabel}>
          {state !== 'ready'
            ? 'Weekly prediction'
            : gaining
              ? 'Predicted gain'
              : 'Predicted loss'}
        </Text>
        <View style={st.weekDots}>
          {prediction.days.map((d) => (
            <View
              key={d.date}
              style={[st.weekDot, d.logged ? st.weekDotOn : st.weekDotOff]}
            />
          ))}
        </View>
      </View>

      {state === 'ready' ? (
        <>
          <Text style={[st.weekValue, gaining && { color: palette.accent }]}>
            {formatKg(predictedKgPerWeek as number)}
          </Text>
          <Text style={st.weekGoal}>
            goal −{goalRateKgWeek.toFixed(2)} kg / week
          </Text>
        </>
      ) : state === 'building' ? (
        <Text style={st.weekBody}>
          {loggedDays} of 7 days logged — log {5 - loggedDays} more to see
          your weekly prediction.
        </Text>
      ) : (
        <Text style={st.weekBody}>
          Starting fresh — log today to begin a new week.
        </Text>
      )}
    </Card>
  );
}

/** Positive = loss → "−0.48 kg"; negative = gain → "+0.21 kg". */
function formatKg(kgPerWeek: number): string {
  if (kgPerWeek === 0) return '0.00 kg';
  const abs = Math.abs(kgPerWeek).toFixed(2);
  return kgPerWeek > 0 ? `−${abs} kg` : `+${abs} kg`;
}
```

- [ ] **Step 2: Add the styles**

In `src/components/dashboard/styles.ts`, immediately before the final `});`, append:

```ts
  // ---- "This week" prediction card ----
  weekTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekLabel: { ...typo.label, color: palette.textMuted },
  weekValue: { ...typo.stat, color: palette.text, marginTop: space.sm },
  weekGoal: { color: palette.textFaint, fontSize: 12, marginTop: space.xxs },
  weekBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.sm,
  },
  weekDots: { flexDirection: 'row', gap: space.xs + 2 },
  weekDot: { width: 8, height: 8, borderRadius: 4 },
  weekDotOn: { backgroundColor: palette.text },
  weekDotOff: { borderWidth: 1, borderColor: palette.hairline },
```

(`typo`, `palette`, and `space` are already imported at the top of that file.)

- [ ] **Step 3: Wire into Home**

In `src/app/index.tsx`, four edits:

3a. Extend the adaptive-tdee import and add the new imports (the WeekCard import goes with the other `@/components/dashboard/*` imports, alphabetically after `weigh-in-card`; predictWeeklyLoss goes with the `@/lib/*` imports):

```ts
import { estimateAdaptiveTdee, type AdaptiveTdee, type DailyDatum } from '@/lib/adaptive-tdee';
```

```ts
import { WeekCard } from '@/components/dashboard/week-card';
```

```ts
import { predictWeeklyLoss } from '@/lib/weekly-prediction';
```

3b. Add state below the existing `adaptive` state:

```ts
const [history, setHistory] = useState<DailyDatum[]>([]);
```

3c. Retain the gathered history. In `refresh`, replace:

```ts
const [history, lw] = await Promise.all([
  gatherHistory(21),
  latestWeight(),
]);
setAdaptive(estimateAdaptiveTdee(history));
setLastWeight(lw?.kg ?? null);
```

with (renamed to avoid shadowing the new state):

```ts
const [hist, lw] = await Promise.all([gatherHistory(21), latestWeight()]);
setAdaptive(estimateAdaptiveTdee(hist));
setHistory(hist);
setLastWeight(lw?.kg ?? null);
```

And in `handleWeighIn`, replace:

```ts
const history = await gatherHistory(21);
setAdaptive(estimateAdaptiveTdee(history));
```

with:

```ts
const hist = await gatherHistory(21);
setAdaptive(estimateAdaptiveTdee(hist));
setHistory(hist);
```

3d. Render the card between the hero `</GlassSurface>` and the `{/* Macros */}` section:

```tsx
{/* This week — on pace to lose */}
<SectionLabel>This week</SectionLabel>
<WeekCard
  prediction={predictWeeklyLoss(
    history,
    adaptive?.estimatedTdeeKcal ?? t.maintenanceKcal,
  )}
  goalRateKgWeek={t.appliedRateKgWeek}
/>
```

- [ ] **Step 4: Verify — typecheck, lint, full test suite**

```bash
npx tsc --noEmit
npx eslint src/components/dashboard/ src/app/index.tsx src/lib/weekly-prediction.ts
npx jest
```

Expected: no type errors, no lint errors, all suites pass (73 tests: previous 66 + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/week-card.tsx src/components/dashboard/styles.ts src/app/index.tsx
git commit -m "feat: 'This week' card on Home — predicted weekly loss with dot strip"
```

---

## Verification checklist (post-plan)

- `npx jest` — all green.
- `npx tsc --noEmit` — clean.
- Manual states: full week logged → number; 2 gaps → same avg; fresh install → "Starting fresh".

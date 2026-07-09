# Deficit — "Warm Instrument" UI redesign

**Date:** 2026-07-09
**Goal:** Full visual redesign from dark indigo glass to the reference aesthetic:
warm bone-white, soft-industrial, near-monochrome with a single orange accent,
dot-matrix hero numerals. Pure re-skin — no logic, data, navigation, or engine
changes.

## Reference language (from the user's four mockups)

- Warm off-white canvas; content on soft outlined cards (hairline + one low
  shadow), not glass, not heavy neumorphism.
- Near-black warm ink type. Tiny uppercase utility labels over strong values
  ("CURRENT RANGE / 167 km").
- Exactly one hue in the whole app: burnt orange. Attention = orange,
  calm/good = ink. No green, no red.
- Dot-matrix display numerals for hero numbers only.
- Thin arcs/lines; charts are grayscale + accent, faint hairline grids.
- Pill-shaped actions (orange fill, like "swipe to stop charge").

## Decisions (user-confirmed)

1. **Dot-matrix heroes: yes** — Doto font, numerals on exactly three surfaces:
   Home daily target, Log "left to eat" (accent orange), History total deficit.
2. **Accent: `#F4511E`** — vermillion orange sampled from the charging
   reference; the only color.
3. **Typography stolen from the refs** — app font swaps Plus Jakarta Sans →
   **Inter** (neutral grotesque, the refs' voice). Scale from the refs:
   - `label`: 12px / medium / sentence case, muted — "Current range"
   - `value`: 17px / 700 — "167 km", "43min"
   - `title`: 32px / 800 / −0.5 tracking — the "Disorder" weight
   - `eyebrow` (brand only): 11px caps, wide tracking
   - `hero`: Doto, ~84px, numerals only
   - `body` 15px / `heading` 20px 700 / `stat` 24px 700
4. **Surfaces: soft-outlined cards** (hairline border + one soft shadow), not
   full neumorphic extrusion.
5. **Macros: ink tints** — protein = ink 100%, carbs = ink ~55%, fat = ink
   ~30%. History split bar becomes grayscale.
6. **Light-only.** Dark mode is dropped; status bar flips to dark-on-light.

## Palette (same token keys in `src/constants/palette.ts`, new values)

```
bg          #EDEAE4      warm bone canvas
bgElevated  #F2F0EB
surface     #F7F5F1      raised warm-white card
surface2    #E7E4DD      inset well (inputs, progress tracks)
hairline    rgba(25,23,21,0.12)
text        #191715      warm ink
textMuted   rgba(25,23,21,0.60)
textFaint   rgba(25,23,21,0.38)
textDim     rgba(25,23,21,0.24)
accent      #F4511E      the one orange (sampled from ref 1); accentText #FFFFFF
accentSoft  rgba(244,81,30,0.10)
protein     ink 100% · carb ink 55% · fat ink 30%   (tints, not hues)
good        ink (calm)  · danger/warn/negative → accent orange (attention)
shadow      single soft low umbra, rgba-black at low opacity
glass*      keys kept for compatibility, remapped to the card treatment
blobs       removed (transparent) — the canvas is calm and unlit
```

Semantic consequence: "over budget", warnings, and destructive hints render
in orange; "in deficit / on target" renders as confident ink. Confidence
badges: high = quiet ink outline, medium/low = orange tint/outline.

## Layers of work

1. **Tokens** — rewrite palette values (keys unchanged), light shadow set,
   fix the stale "warm light" doc comment to describe the real direction.
2. **Fonts** — swap the app family to Inter (400/600/700/800) and load Doto
   for hero numerals; add a `type.heroDisplay` token. Fallback degrades to
   the platform sans, then Inter bold for heroes if Doto fails to load.
3. **Primitives** (`src/components/ui/primitives.tsx`, same APIs) —
   `GlassSurface`/`Card` → outlined soft card; `GlassBackdrop` → plain
   canvas; `PrimaryButton` → orange pill w/ white text; `ProgressBar` →
   thin 3px track on `surface2`; labels retuned.
4. **Theme chrome** — custom light navigation theme (replace `DarkTheme`),
   `StatusBar style="dark"`, splash/app.json background `#EDEAE4`,
   `+html.tsx` + `public/manifest.json` theme colors, tab bar → warm white,
   hairline top border, ink icons, accent active state.
5. **Charts** (`charts.tsx`) — ink lines on hairline grids; eaten line =
   accent; deficit bars = ink (deficit) vs orange (surplus); weight dots ink.
6. **Per-screen pass** — Home, Log (incl. meal composer/rows, engine status,
   confidence badges), History (journey, day-by-day, range pills), onboarding,
   sign-in (Google button re-checked on light), splash overlay/animated icon.
7. **Assets** — icon/splash/OG image can stay for now (brand refresh is a
   separate task); only background colors around them update.

## Explicitly out of scope

- Calendar/date-header feature (already designed; will be built after, in
  this new skin).
- Any engine, storage, auth, or navigation change.
- App icon redesign; dark mode.

## Verification

- `npm run typecheck`, `npm test` (66), `npx expo export --platform web`.
- Run the web app locally; screenshot Home, Log (with a parsed meal),
  History, onboarding, sign-in; compare against the four references for:
  canvas warmth, card treatment, single-accent discipline, dot-matrix heroes,
  label/value hierarchy, chart restraint.
- Contrast spot-check: ink tints ≥ WCAG AA for body text; textFaint reserved
  for non-essential hints.

# Professional polish pass: sign-in, profile, onboarding, chrome, copy

**Date:** 2026-07-10
**Status:** Approved (A to E, user-confirmed)

## Goal

Maximize the professional tone of the app. Three surfaces get real work
(sign-in, a new profile screen with the missing logout, onboarding), the
chrome gets detail fixes users feel but cannot name, and the copy loses
every punctuation dash.

## A. Sign-in screen (`src/components/sign-in-screen.tsx`)

- Tagline under the DEFICIT wordmark: "Calorie tracking you can trust."
- Footer pinned at the bottom, faint ink: "Deficit provides estimates,
  not medical advice."
- Sent state adds: "Didn't get it? Check spam, or use a different email."
  (the existing resend link stays).
- Copy de-dashed (see E). Structure, Google pill, and form unchanged.

## B. Profile screen and logout (new surface)

The app currently has NO logout and no account surface; `signOut` is
exported but never called. Home's "Edit" link opens the questionnaire.

- New `src/components/ui/monogram.tsx`: circular monogram (first letter
  of the email, or "D" in local mode), warm-white card treatment,
  `size` prop (small for headers, large for the profile hero).
- Home header: the "Edit" text link becomes a small Monogram button that
  navigates to `/profile`. First-run onboarding on Home is unchanged;
  profile *editing* moves to the profile screen.
- New route `src/app/profile.tsx`:
  - Back control returning to Home.
  - Hero: large Monogram + account email, or "Local device" when there
    is no session (the app has a working no-account mode).
  - "Your plan" card: rows for Age, Height, Weight, Activity, Goal pace,
    Daily target (from `loadProfile` + `computeTargets`).
  - "Edit profile" opens the existing `OnboardingFlow` with `initial`
    (rendered by the profile screen; saving returns to the rows).
  - "Sign out": quiet outlined button, ink text (leaving is not an
    alarm); calls `useAuth().signOut()`; the existing auth gate flips to
    the sign-in screen. Hidden in local mode.
  - Footer: app version from `expo-constants`, faint.

## C. Onboarding (`src/components/onboarding-flow.tsx`)

- New leading **welcome step**, only when `initial` is absent (editing
  skips it): DEFICIT eyebrow in accent, title "Let's build your plan",
  body "A daily calorie target built from your numbers. It takes about
  a minute." and a full-width "Get started" pill.
- Reskin the whole flow to Warm Instrument tokens:
  - Progress bar: 3px, `surface2` track (matches `ProgressBar`).
  - Step eyebrow: standard `type.eyebrow` token.
  - Next button: orange pill (`radius.pill`), Back unchanged.
  - Option cards and list options: `hairline` borders, selection =
    `accentSoft` fill + `accentBorder`.
  - Final target preview: the number becomes a `DotMatrix` hero numeral
    on an outlined raised card, matching Home's signature.
- Copy pass: sentence case, plain verbs, no filler, no dashes.

## D. Chrome polish (the "can't name it" items)

1. **Tab icons** (`src/components/app-tabs.web.tsx`): replace the
   mixed-language glyphs with one consistent set of thin-stroke SVG
   icons (home, log, chart) drawn with `react-native-svg`, stroke width
   matched to the ArcGauge. Active tab keeps the orange pill.
2. **Emoji removal:** History streak `🔥` becomes plain type ("N" over
   "day streak"); meal-row flag `⚠` becomes a small accent dot before
   the name; the `⚠︎` prefix on safety notes (Home, onboarding preview)
   is dropped, the orange text already signals it.
3. **Tabular numerals:** `fontVariant: ['tabular-nums']` on aligned
   stat styles (entry/result kcal, hero stats, stat blocks, calendar
   summary, week value, macro values). Not on Doto hero numerals.
4. **Web focus/hover** (`src/global.css`): focused text inputs get an
   inset 2px accent underline (the onboarding number-field language);
   `[role="button"]:hover` gets a gentle opacity ease.
5. **Section rhythm:** normalize ad-hoc card top margins to the spacing
   scale (Log summary card aligns with Home hero at `space.lg`).

## E. Copy sweep: no dashes (app-wide)

- Every em/en dash in user-facing copy is rewritten with a period or
  comma. Example: "magic link — no password needed." becomes "magic
  link. No password needed."
- Ranges in words: "1–3 days/week" becomes "1 to 3 days a week".
- **Kept:** numeric minus signs (−550, −0.48 kg), `·` middot data
  separators, hyphens in proper names (Mifflin-St Jeor) and standard
  compounds (weigh-in).

## Out of scope

- No engine, storage, or route-guard changes; UI and copy only.
- No legal pages, no engine-status row on Profile (user chose core set).

## Verification

- `npx tsc --noEmit`, `npx eslint src/`, `npx jest` all green (no test
  changes expected; suite has no UI snapshots).
- Local-mode screenshot pass: sign-in, Home header + monogram, profile
  screen, onboarding welcome + a question step + review, tab bar icons.
- `grep -rn "—\|–" src/` returns no user-facing copy hits.

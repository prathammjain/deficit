# Hardening and cleanup pass

**Date:** 2026-07-10
**Status:** Approved

## Audit result (context)

The foundations checked out: no secret has ever been committed (full-history
scan), `.env` is gitignored with only `.env.example` tracked, RLS was
live-verified (anon key reads return `[]` on `user_kv` and `food_cache`), the
edge function has an auth gate and CORS allowlist, there are no `console.log`s,
and 73 tests pass. This pass removes what remains: template remnants, dead
code from the old glass skin, a personal note in a public repo, and stale docs.

## 1. Privacy and docs

- **`thoughts.md` (personal founding note, publicly visible):** distill it
  into a polished "Why Deficit exists" opening in the README (the gym months,
  the carb-rich Indian household, nightly ChatGPT logging, the hallucination
  discovery, the hybrid idea), then `git rm --cached thoughts.md` and add it
  to `.gitignore`. The file stays on disk. Old git history still contains it;
  history rewrite is explicitly out of scope.
- **README accuracy:** the engine description still says "Gemini". Update to
  the current architecture: pluggable LLM (Groq `gpt-oss-120b` default,
  OpenAI-switchable), candidates from the curated Indian table (INDB/IFCT
  grounded) + USDA, judge + independent cross-check estimate → confidence.
  Add a five-line architecture map (app routes, components, lib engine,
  supabase, docs).

## 2. Dependencies

- `npm audit fix` — safe fixes only. No `--force` (would downgrade Expo).
  Remaining moderates are dev-only transitive deps; accepted and documented
  here. Re-run the full test suite afterwards.

## 3. Dead-weight removal (each verified unused)

| Item | Action |
| --- | --- |
| `scripts/reset-project.js` + npm script | delete (create-expo-app remnant) |
| `GhostButton` in primitives | delete (0 uses) |
| `GlassBackdrop` (renders `null`) | delete + remove its 2 import/render sites |
| `webBlur()` (inert on opaque surfaces) | delete + remove 3 spread sites |
| Legacy palette keys: `bgElevated`, `surfaceSolid`, `surface2Solid`, `surfaceBorder`, `glass`, `glassBorder`, `glassHighlight`, `glassDark`, `blobA/B/C`, `accentGlow` | migrate 3 stragglers (`glassBorder`→`hairline` ×2, `surface2Solid`→`surface2` ×1), then delete all keys + the "legacy" comment block |
| `GlassSurface`'s legacy `dark` prop | remove prop + its one use |
| `constants/theme.ts` | delete; `app-tabs.tsx` (its only consumer) reads palette directly |
| Remaining `as any` casts (2 after webBlur removal) | keep, each annotated with a one-line platform reason |

## 4. Out of scope

Git history rewrite, dependency upgrades beyond `audit fix`, folder
restructuring, engine changes, native tab icon redesign (png icons stay;
native is unshipped).

## 5. Verification

- `tsc --noEmit`, `eslint src/`, `jest` (73 tests) green after each batch.
- Fresh `expo export -p web` builds; screenshot sanity on sign-in +
  onboarding (the two webBlur surfaces).
- Final greps return zero: `webBlur`, `GlassBackdrop`, `GhostButton`,
  `glassBorder`, `blob`, `reset-project`.
- `git ls-files | grep thoughts` returns nothing.

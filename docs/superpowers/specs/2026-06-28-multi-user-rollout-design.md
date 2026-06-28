# Deficit — Multi-user rollout (10–20 peers) — Design & Setup Guide

**Date:** 2026-06-28
**Goal:** Let ~10–20 known peers ("friends helping me test") use the live app
reliably, free, with open sign-up (anyone with the link can join).

## Already done (no work needed)

- **Data privacy:** `supabase/schema.sql` enforces Row-Level Security — every
  user sees only their own rows. Multi-user safe already.
- **Live frontend:** Vercel `deficit-cyan.vercel.app`, auto-deploys from GitHub.
- **AI engine:** `food` Edge Function deployed and healthy (Gemini + USDA).
- **Graceful AI fallback exists:** if the engine is unreachable, the app uses the
  built-in Indian food table (`local-provider.ts`).

## The only real gap: email + one reliability edge

The built-in Supabase email sender is hard-capped at a few messages/hour — it
will block real users. Everything below fixes that and smooths the edges.

Scope chosen: **B (unblock + polish)**. No feedback button (out of scope).

---

## Part 1 — Reliable sign-in email via Gmail (settings)

Use the owner's Gmail as the SMTP sender. Free (~500/day), no domain needed,
reliable delivery.

**1a. Create a Gmail App Password**
1. https://myaccount.google.com → **Security**.
2. Turn on **2-Step Verification** (required for app passwords).
3. Go to https://myaccount.google.com/apppasswords → create one named
   **Deficit** → copy the 16-character password.

**1b. Point Supabase at Gmail**
Supabase dashboard → **Authentication → Emails → SMTP Settings** → enable
**Custom SMTP**:
- Sender email: `your-gmail@gmail.com`
- Sender name: `Deficit`
- Host: `smtp.gmail.com`
- Port: `465`
- Username: `your-gmail@gmail.com`
- Password: the 16-char app password
- **Save.**

**1c. Raise the email rate limit**
Supabase → **Authentication → Rate Limits → "Rate limit for sending emails"** →
set to **30 per hour** (plenty for 20 users) → **Save.**

**Verify:** from the live site, request a magic link to an email *other* than the
owner's. It should arrive within a minute, from "Deficit".

---

## Part 2 — Branded login email (settings)

Supabase → **Authentication → Email Templates → "Magic Link"**.

- **Subject:** `Your Deficit sign-in link`
- **Body:** (keep the `{{ .ConfirmationURL }}` token exactly)

```html
<h2>Sign in to Deficit</h2>
<p>Tap below to sign in. The link works once and expires shortly.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to Deficit</a></p>
<p>If you didn't request this, you can ignore this email.</p>
```

If first-time users receive a "Confirm signup" email instead, apply the same
subject/body to the **"Confirm signup"** template too.

---

## Part 3 — Reliability tweak (code + redeploy)

**Problem:** if Gemini's free limit is briefly hit, `gemini()` currently swallows
the error and returns empty, so a described meal comes back blank instead of
falling back to the local table.

**Fix:** in `supabase/functions/food/index.ts`, make `gemini()` throw on a
non-OK HTTP response. The error then propagates → the handler returns 500 →
`remote-provider.ts` catches it and uses the local heuristic parse. Result: the
user always gets a best-effort breakdown, never a blank.

**Redeploy after the edit:**
```bash
supabase functions deploy food --no-verify-jwt
```

**Verify:** describe a normal meal on the live site → still works (USDA-grounded).
(The fallback path only shows under real rate-limiting; the change is safe — it
only converts an HTTP error into a clean fallback.)

---

## Part 4 — "How to get in" note for friends (copy-paste)

```
Hey! Try the app I built — Deficit, for tracking calories/macros (good with Indian food).
1. Open: https://deficit-cyan.vercel.app
2. Enter your email → tap "Send magic link".
3. Open the email on your phone → tap the link. You're in.
4. (Optional) Share → "Add to Home Screen" for an app icon.
Just describe what you ate in plain English. Tell me what breaks!
```

---

## Cost: $0

Gmail (~500 emails/day), Supabase free tier (50k monthly users, 500MB DB),
Google AI free tier (ample for ~20 light users; spikes fall back to local),
USDA (1000 req/hr), Vercel (static hosting) — all comfortably within free limits.

## Out of scope (revisit only if it grows)

- Invite-only allowlist (chose open sign-up).
- Google AI billing / removing AI limits (free + fallback is enough for 20).
- Locking the Edge Function to logged-in callers.
- In-app feedback button.

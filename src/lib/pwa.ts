/**
 * pwa.ts: the rules for an installed web app that stays open for days.
 * Pure, so they are tested; the browser wiring is in app-lifecycle.tsx.
 *
 * Phones keep a home screen app alive in the background, so "open Grain"
 * often resumes a page loaded days ago. Two things go stale: the code (a
 * deploy shipped since) and the date (the screens still think it is
 * yesterday). Both are fixed by a reload, at a moment it can't hurt.
 */

/** The bundle a page's HTML loads; its hash changes with every deploy. */
export function entryBundle(html: string): string | null {
  return (
    /\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/.exec(html)?.[0] ?? null
  );
}

/**
 * Screens where something is being done live: a workout, a HYROX sim, a
 * program being written. Their state is saved, but a reload mid set or mid
 * lap is still an interruption, so updates wait for a tap there.
 */
const LIVE = ['/workout', '/hyrox', '/write'];

export const isLiveRoute = (path: string) =>
  LIVE.some((p) => path === p || path.startsWith(`${p}/`));

export function canReloadNow(input: {
  path: string;
  /** A text field has focus. */
  typing: boolean;
}): boolean {
  return !input.typing && !isLiveRoute(input.path);
}

export type ResumeAction = 'reload' | 'offer' | 'none';

/**
 * What to do when the app comes back to the screen: reload quietly when it
 * is safe, offer a refresh when it isn't, or nothing.
 */
export function onResume(input: {
  updateReady: boolean;
  dayChanged: boolean;
  path: string;
  typing: boolean;
}): ResumeAction {
  if (!input.updateReady && !input.dayChanged) return 'none';
  if (canReloadNow(input)) return 'reload';
  return input.updateReady ? 'offer' : 'none';
}

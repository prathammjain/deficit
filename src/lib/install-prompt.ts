/**
 * install-prompt.ts — a tiny observable for "can we offer to install the PWA".
 *
 * Chrome fires `beforeinstallprompt` once on `window`, shortly after load, and
 * never replays it. The old code listened from inside the Add to Home Screen
 * component, which only mounts on the Profile screen — so the event fired on
 * Home with no listener attached, was discarded, and the button could never
 * appear. Three follow-up commits each made the fallback hint louder instead,
 * because the fallback was the visible symptom.
 *
 * The event is therefore captured by an inline script in `+html.tsx`, before
 * the bundle parses (2.3MB of it, which on a mid-range phone Chrome can
 * outrun), and stashed on `window`. This module is the React-side view of that
 * stash. Same shape as food/provider-status.ts.
 */

import { useSyncExternalStore } from 'react';

/** The non-standard Chrome event. Not in lib.dom. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** What the inline script in +html.tsx maintains. Mutated in place by it. */
interface InstallBridge {
  prompt: InstallPromptEvent | null;
  installed: boolean;
}

export interface InstallState {
  /** Present only when the browser has offered a native install prompt. */
  prompt: InstallPromptEvent | null;
  /** True once the app reports itself installed. */
  installed: boolean;
}

/** Must match the event name the inline script dispatches. */
const CHANGE = 'deficit:installchange';

const EMPTY: InstallState = { prompt: null, installed: false };

function bridge(): InstallBridge | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { __deficitInstall?: InstallBridge })
      .__deficitInstall ?? null
  );
}

// The bridge is mutated in place, so its identity never changes. Snapshot it
// into a fresh object when it actually differs, or useSyncExternalStore's
// Object.is check would never see a change.
let state: InstallState = EMPTY;
const listeners = new Set<() => void>();

function sync(): void {
  const b = bridge();
  const next: InstallState = b
    ? { prompt: b.prompt, installed: b.installed }
    : EMPTY;
  if (next.prompt === state.prompt && next.installed === state.installed) {
    return;
  }
  state = next;
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener(CHANGE, sync);
  sync(); // the event may already have fired before this module evaluated
}

export function getInstallState(): InstallState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook — re-renders when the install offer appears or is used up. */
export function useInstallPrompt(): InstallState {
  return useSyncExternalStore(subscribe, getInstallState, getInstallState);
}

/**
 * Show the browser's install prompt. A prompt event can only be used once, so
 * it is cleared either way: on "dismissed" the UI falls back to the manual
 * instructions, which is the honest state — Chrome will not re-offer until its
 * own criteria trigger again.
 */
export async function promptInstall(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  const b = bridge();
  const event = b?.prompt;
  if (!b || !event) return 'unavailable';
  await event.prompt();
  const { outcome } = await event.userChoice;
  b.prompt = null;
  sync();
  return outcome;
}

/**
 * How this browser puts a site on the home screen by hand. Safari has no
 * install prompt at all, so on an iPhone the steps are the only route, and
 * they differ by browser and by version:
 *
 * - `ios-safari`: iPhone Safari 26 and later, where Share sits behind the
 *   three dots button.
 * - `ios-safari-old`: older iPhone Safari and every iPad, where the Share
 *   button is in Safari's bar.
 * - `ios-chrome`: Chrome on an iPhone or iPad.
 * - `ios-other`: Edge or Firefox on an iPhone or iPad.
 * - `ios-in-app`: a browser inside another app (Instagram, Facebook,
 *   LinkedIn). It can't add to the home screen at all, so the only step is
 *   opening the page in a real browser.
 * - `other`: Android and desktop, which are offered the native prompt.
 */
export type InstallGuide =
  | 'ios-safari'
  | 'ios-safari-old'
  | 'ios-chrome'
  | 'ios-other'
  | 'ios-in-app'
  | 'other';

/** `touch` tells an iPad from a Mac: both send a Macintosh user agent. */
export function installGuide(ua: string, touch: boolean): InstallGuide {
  const phone = /iPhone|iPod/.test(ua);
  const tablet = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
  if (!phone && !tablet) return 'other';
  if (/CriOS/.test(ua)) return 'ios-chrome';
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return 'ios-other';
  // Every real browser on iOS ends its user agent with a Safari token. An
  // app's own browser leaves it out. So does Grain opened from the home
  // screen, which is why callers check isStandalone first.
  if (!/Safari\//.test(ua)) return 'ios-in-app';
  // Safari 26 freezes the iOS version in its user agent, so only the Version
  // token says which Safari this is.
  const version = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
  return phone && version >= 26 ? 'ios-safari' : 'ios-safari-old';
}

/** True when the page is running from the home screen icon, not a tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

/**
 * True inside another app's own browser on an iPhone or iPad. Google refuses
 * to sign anyone in there, and nothing can be added to the home screen.
 */
export function inAppBrowser(): boolean {
  if (typeof window === 'undefined' || isStandalone()) return false;
  return (
    installGuide(navigator.userAgent, 'ontouchend' in window) === 'ios-in-app'
  );
}

/**
 * The address that hands a page to a real browser on iOS. Safari's scheme
 * needs iOS 17; Chrome's does nothing when Chrome isn't installed. Neither
 * can be checked from a page, so the UI always says what to do by hand too.
 */
export function browserLink(
  browser: 'safari' | 'chrome',
  href: string,
): string {
  return browser === 'safari'
    ? `x-safari-${href}`
    : href.replace(/^http/, 'googlechrome');
}

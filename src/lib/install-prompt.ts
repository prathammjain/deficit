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

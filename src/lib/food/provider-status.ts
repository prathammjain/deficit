/**
 * provider-status.ts — a tiny observable for "which food engine is live".
 *
 * The remote provider falls back to the local table silently so logging never
 * breaks; this store surfaces that fact so the UI can tell the user whether
 * they're getting grounded AI (Gemini + USDA) or the offline Indian table.
 */

import { useSyncExternalStore } from 'react';

import { isSupabaseConfigured } from '../supabase/config';

export type ProviderStatus =
  | 'local-only' // no cloud account configured — local table is all there is
  | 'checking' // probing the edge function
  | 'online' // edge function reachable with both secrets — AI grounding active
  | 'offline'; // cloud configured but the engine is unreachable / unconfigured

let status: ProviderStatus = isSupabaseConfigured ? 'checking' : 'local-only';
const listeners = new Set<() => void>();

export function getProviderStatus(): ProviderStatus {
  return status;
}

export function setProviderStatus(next: ProviderStatus): void {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook — re-renders when the live engine status changes. */
export function useProviderStatus(): ProviderStatus {
  return useSyncExternalStore(subscribe, getProviderStatus, getProviderStatus);
}

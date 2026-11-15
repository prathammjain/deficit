/**
 * ai-access.ts: whether this person can use GrainAI right now, and how much
 * of today's limit is left. The server decides and enforces both (ai_spend
 * in schema.sql); this store only mirrors what it last said, so the screens
 * can show the invite card, a quiet "3 left today", or the limit reached.
 *
 * Unknown means "assume yes": local mode has no limits, and a failed check
 * must not hide a feature the server would allow. The server still refuses.
 */

import { useSyncExternalStore } from 'react';

export type AiGateReason = 'invite_only' | 'daily_limit' | 'unavailable';

export interface AiAccess {
  /** False only when the server has said no to this person. */
  allowed: boolean;
  /** Meals a day, and how many are used today. Null when unknown. */
  limit: number | null;
  used: number | null;
}

const UNKNOWN: AiAccess = { allowed: true, limit: null, used: null };

let state: AiAccess = UNKNOWN;
const listeners = new Set<() => void>();

function set(next: AiAccess): void {
  if (
    next.allowed === state.allowed &&
    next.limit === state.limit &&
    next.used === state.used
  )
    return;
  state = next;
  listeners.forEach((l) => l());
}

export function getAiAccess(): AiAccess {
  return state;
}

/** What my_ai() returned. Anything unreadable leaves the state unknown. */
export function setAiAccessFromServer(raw: unknown): void {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.allowed !== 'boolean') return;
  set({
    allowed: r.allowed,
    limit: typeof r.limit === 'number' ? r.limit : null,
    used: typeof r.used === 'number' ? r.used : null,
  });
}

/** After a match: the usage the server counted. */
export function noteAiUsage(usage: { used: number; limit: number }): void {
  set({ allowed: true, limit: usage.limit, used: usage.used });
}

/** After a refusal. */
export function noteAiGate(reason: AiGateReason, limit?: number | null): void {
  if (reason === 'invite_only')
    set({ allowed: false, limit: null, used: null });
  else if (reason === 'daily_limit') {
    const l = limit ?? state.limit;
    set({ allowed: true, limit: l, used: l });
  }
}

export function resetAiAccess(): void {
  set(UNKNOWN);
}

/** Meals left today, or null when the limit isn't known. */
export function aiLeft(a: AiAccess): number | null {
  return a.limit == null || a.used == null
    ? null
    : Math.max(0, a.limit - a.used);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAiAccess(): AiAccess {
  return useSyncExternalStore(subscribe, getAiAccess, getAiAccess);
}

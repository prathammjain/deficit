/**
 * store.ts: cardio sessions on the device and the account. Keys start with
 * "deficit." so they sync like everything else.
 */

import { getJSON, kv, setJSON, type KVStore } from '../kv';
import { todayKey } from '../log-store';
import { newId } from '../train/exercises';
import type { CardioKind, CardioSession, Effort } from './cardio';

const SESSIONS = 'deficit.cardio.sessions.v1';
const SETTINGS = 'deficit.cardio.v1';

export interface CardioSettings {
  /** The lifting and cardio note has been shown once. */
  nearTipSeen?: boolean;
}

/** Newest first. */
export async function loadCardio(
  store: KVStore = kv,
): Promise<CardioSession[]> {
  const all = (await getJSON<CardioSession[]>(store, SESSIONS)) ?? [];
  return [...all].sort((a, b) => b.startedAt - a.startedAt);
}

export async function saveCardio(
  s: CardioSession,
  store: KVStore = kv,
): Promise<CardioSession[]> {
  const rest = (await loadCardio(store)).filter((x) => x.id !== s.id);
  const next = [s, ...rest].sort((a, b) => b.startedAt - a.startedAt);
  await setJSON(store, SESSIONS, next);
  return next;
}

export async function deleteCardio(
  id: string,
  store: KVStore = kv,
): Promise<CardioSession[]> {
  const next = (await loadCardio(store)).filter((x) => x.id !== id);
  await setJSON(store, SESSIONS, next);
  return next;
}

export async function loadCardioSettings(
  store: KVStore = kv,
): Promise<CardioSettings> {
  return (await getJSON<CardioSettings>(store, SETTINGS)) ?? {};
}

export async function markNearTipSeen(store: KVStore = kv): Promise<void> {
  await setJSON(store, SETTINGS, {
    ...(await loadCardioSettings(store)),
    nearTipSeen: true,
  });
}

/** A new session, for the form to fill in. */
export function newCardio(
  fields: {
    kind: CardioKind;
    startedAt: number;
    ms: number;
    km?: number | null;
    avgHr?: number | null;
    effort: Effort;
  },
  id: string = newId('cd'),
): CardioSession {
  return { id, date: todayKey(new Date(fields.startedAt)), ...fields };
}

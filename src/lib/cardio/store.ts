/**
 * store.ts: cardio sessions on the device and the account. Keys start with
 * "deficit." so they sync like everything else.
 */

import { getJSON, kv, setJSON, type KVStore } from '../kv';
import { todayKey } from '../log-store';
import { newId } from '../train/exercises';
import type { CardioKind, CardioLive, CardioSession, Effort } from './cardio';

const SESSIONS = 'deficit.cardio.sessions.v1';
const SETTINGS = 'deficit.cardio.v1';
const LIVE = 'deficit.cardio.live.v1';

export interface CardioSettings {
  /** The lifting and cardio note has been shown once. */
  nearTipSeen?: boolean;
  /** A measured max heart rate, used instead of the age estimate. */
  maxHr?: number | null;
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

export async function saveMaxHr(
  maxHr: number | null,
  store: KVStore = kv,
): Promise<CardioSettings> {
  const next = { ...(await loadCardioSettings(store)), maxHr };
  await setJSON(store, SETTINGS, next);
  return next;
}

/** A session being timed, if any. */
export async function loadLive(
  store: KVStore = kv,
): Promise<CardioLive | null> {
  return getJSON<CardioLive>(store, LIVE);
}

export async function saveLive(l: CardioLive, store: KVStore = kv) {
  await setJSON(store, LIVE, l);
}

export async function clearLive(store: KVStore = kv) {
  await store.remove(LIVE);
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
  } & Partial<
    Pick<
      CardioSession,
      'laps' | 'intervals' | 'incline' | 'elevation' | 'indoor' | 'note' | 'rpe'
    >
  >,
  id: string = newId('cd'),
): CardioSession {
  return { id, date: todayKey(new Date(fields.startedAt)), ...fields };
}

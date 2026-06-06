/**
 * weight-store.ts — daily body-weight check-ins (white paper §12, adaptive TDEE).
 *
 * One weight per calendar day (latest wins). The series of weigh-ins is the raw
 * signal the adaptive engine regresses to learn your *real* energy expenditure,
 * rather than trusting the Mifflin-St Jeor estimate forever.
 */

import { getJSON, kv, type KVStore, setJSON } from './kv';

export interface WeightEntry {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  kg: number;
  at: string;
}

const KEY = 'deficit.weight.v1';

/** All weigh-ins, ascending by date. */
export async function loadWeights(store: KVStore = kv): Promise<WeightEntry[]> {
  const all = (await getJSON<WeightEntry[]>(store, KEY)) ?? [];
  return [...all].sort((a, b) => a.date.localeCompare(b.date));
}

/** Record (or overwrite) the weight for a given day. */
export async function setWeight(
  date: string,
  kg: number,
  store: KVStore = kv,
): Promise<WeightEntry[]> {
  const all = await loadWeights(store);
  const next = all.filter((w) => w.date !== date);
  next.push({ date, kg, at: new Date().toISOString() });
  next.sort((a, b) => a.date.localeCompare(b.date));
  await setJSON(store, KEY, next);
  return next;
}

export async function removeWeight(
  date: string,
  store: KVStore = kv,
): Promise<WeightEntry[]> {
  const all = await loadWeights(store);
  const next = all.filter((w) => w.date !== date);
  await setJSON(store, KEY, next);
  return next;
}

export async function latestWeight(
  store: KVStore = kv,
): Promise<WeightEntry | null> {
  const all = await loadWeights(store);
  return all.length ? all[all.length - 1] : null;
}

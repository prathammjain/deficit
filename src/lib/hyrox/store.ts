/**
 * store.ts: HYROX simulations on the device and the account. Keys start
 * with "deficit." so they sync like everything else.
 *
 * A running sim is saved on every lap. Its times are timestamps, so the
 * clock stays right if the phone locks or the app reloads mid race.
 */

import { getJSON, kv, setJSON, type KVStore } from '../kv';
import { todayKey } from '../log-store';
import { newId } from '../train/exercises';
import type { Division, Part, Sim } from './race';

const SETTINGS = 'deficit.hyrox.v1';
const SIMS = 'deficit.hyrox.sims.v1';
const LIVE = 'deficit.hyrox.live.v1';

export interface HyroxSettings {
  division: Division | null;
}

export async function loadSettings(
  store: KVStore = kv,
): Promise<HyroxSettings> {
  return (await getJSON<HyroxSettings>(store, SETTINGS)) ?? { division: null };
}

export async function saveDivision(
  division: Division,
  store: KVStore = kv,
): Promise<HyroxSettings> {
  const next = { ...(await loadSettings(store)), division };
  await setJSON(store, SETTINGS, next);
  return next;
}

/** Finished sims, newest first. */
export async function loadSims(store: KVStore = kv): Promise<Sim[]> {
  const all = (await getJSON<Sim[]>(store, SIMS)) ?? [];
  return [...all].sort((a, b) => b.startedAt - a.startedAt);
}

export async function saveSim(sim: Sim, store: KVStore = kv): Promise<Sim[]> {
  const all = (await loadSims(store)).filter((s) => s.id !== sim.id);
  const next = [sim, ...all].sort((a, b) => b.startedAt - a.startedAt);
  await setJSON(store, SIMS, next);
  return next;
}

export async function deleteSim(id: string, store: KVStore = kv) {
  const next = (await loadSims(store)).filter((s) => s.id !== id);
  await setJSON(store, SIMS, next);
  return next;
}

export async function loadLive(store: KVStore = kv): Promise<Sim | null> {
  return getJSON<Sim>(store, LIVE);
}

export async function saveLive(sim: Sim, store: KVStore = kv) {
  await setJSON(store, LIVE, sim);
}

export async function clearLive(store: KVStore = kv) {
  await store.remove(LIVE);
}

/** A new sim, started now. */
export function newSim(
  division: Division,
  part: Part,
  now: number = Date.now(),
): Sim {
  return {
    id: newId('hx'),
    date: todayKey(new Date(now)),
    division,
    part,
    startedAt: now,
    laps: [],
  };
}

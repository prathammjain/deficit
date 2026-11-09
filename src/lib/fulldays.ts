/**
 * fulldays.ts: days the user confirmed were complete even though they ate
 * under half their target (a fast, a sick day). Without the mark such a day
 * reads as unfinished and stays out of the totals (see history-stats.ts).
 */

import { getJSON, kv, setJSON, type KVStore } from './kv';

const KEY = 'deficit.complete.v1';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function loadCompleteDays(
  store: KVStore = kv,
): Promise<Set<string>> {
  const list = (await getJSON<unknown>(store, KEY)) ?? [];
  return new Set(
    Array.isArray(list)
      ? list.filter((d): d is string => typeof d === 'string' && DAY.test(d))
      : [],
  );
}

/** Marks a day complete, or takes the mark off. Returns every marked day. */
export async function setDayComplete(
  date: string,
  complete: boolean,
  store: KVStore = kv,
): Promise<Set<string>> {
  const days = await loadCompleteDays(store);
  if (complete) days.add(date);
  else days.delete(date);
  await setJSON(store, KEY, [...days].sort());
  return days;
}

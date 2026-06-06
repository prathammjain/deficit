/**
 * log-store.ts — the daily food log (white paper §9, "track against target").
 *
 * Entries are grouped by local calendar day (YYYY-MM-DD). Each day is stored
 * under its own key so reads/writes touch only the day in question. Pure logic
 * (summaries) is split out so it can be unit-tested without any storage.
 */

import { getJSON, kv, type KVStore, setJSON } from './kv';

export interface LogEntry {
  /** Stable id (uuid-ish) for list keys and deletes. */
  id: string;
  /** What the user ate, free text. */
  label: string;
  /** Total calories for this entry (unit × quantity for portioned entries). */
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** ISO timestamp the entry was added. */
  at: string;

  // --- Portioning (present for food-database entries; absent for custom) ---
  /** Human serving the unit macros describe, e.g. "1 katori (150g)". */
  serving?: string;
  /** Number of servings. Editable in the log. */
  quantity?: number;
  /** Per-single-serving macros, so quantity can be re-scaled later. */
  unitKcal?: number;
  unitProteinG?: number;
  unitCarbsG?: number;
  unitFatG?: number;
}

/** Minimal shape of a food-database item used to build a portioned entry. */
export interface FoodLike {
  name: string;
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const r = (n: number) => Math.round(n);

/** Build a portioned (quantity-editable) entry from a food item. */
export function portionedEntry(
  food: FoodLike,
  quantity = 1,
): Omit<LogEntry, 'id' | 'at'> {
  const q = Math.max(0.5, quantity);
  return {
    label: food.name,
    serving: food.serving,
    quantity: q,
    unitKcal: food.kcal,
    unitProteinG: food.proteinG,
    unitCarbsG: food.carbsG,
    unitFatG: food.fatG,
    kcal: r(food.kcal * q),
    proteinG: r(food.proteinG * q),
    carbsG: r(food.carbsG * q),
    fatG: r(food.fatG * q),
  };
}

export interface DaySummary {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  count: number;
}

const dayKey = (date: string) => `deficit.log.v1.${date}`;

/** Local calendar date as YYYY-MM-DD (not UTC — the user's "today"). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Sum a day's entries. Pure — no storage, fully testable. */
export function summarize(entries: LogEntry[]): DaySummary {
  return entries.reduce<DaySummary>(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      proteinG: acc.proteinG + (e.proteinG || 0),
      carbsG: acc.carbsG + (e.carbsG || 0),
      fatG: acc.fatG + (e.fatG || 0),
      count: acc.count + 1,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, count: 0 },
  );
}

/** Calories left against a target. Negative means over. */
export function remaining(targetKcal: number, consumedKcal: number): number {
  return targetKcal - consumedKcal;
}

export async function loadDay(
  date: string,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  return (await getJSON<LogEntry[]>(store, dayKey(date))) ?? [];
}

export async function addEntry(
  date: string,
  entry: Omit<LogEntry, 'id' | 'at'>,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  const entries = await loadDay(date, store);
  const full: LogEntry = {
    ...entry,
    id: makeId(),
    at: new Date().toISOString(),
  };
  const next = [...entries, full];
  await setJSON(store, dayKey(date), next);
  return next;
}

export async function removeEntry(
  date: string,
  id: string,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  const entries = await loadDay(date, store);
  const next = entries.filter((e) => e.id !== id);
  await setJSON(store, dayKey(date), next);
  return next;
}

/**
 * Re-scale a portioned entry to a new quantity, recomputing its macros from the
 * stored per-serving unit. No-op for custom entries (no unit macros).
 */
export async function updateEntryQuantity(
  date: string,
  id: string,
  quantity: number,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  const q = Math.max(0.5, Math.round(quantity * 2) / 2);
  const entries = await loadDay(date, store);
  const next = entries.map((e) => {
    if (e.id !== id || e.unitKcal == null) return e;
    return {
      ...e,
      quantity: q,
      kcal: r(e.unitKcal * q),
      proteinG: e.unitProteinG != null ? r(e.unitProteinG * q) : e.proteinG,
      carbsG: e.unitCarbsG != null ? r(e.unitCarbsG * q) : e.carbsG,
      fatG: e.unitFatG != null ? r(e.unitFatG * q) : e.fatG,
    };
  });
  await setJSON(store, dayKey(date), next);
  return next;
}

function makeId(): string {
  // Good enough for client-side list keys; the cloud layer can assign real ids.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

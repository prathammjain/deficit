/**
 * log-store.ts — the daily food log (white paper §9, "track against target").
 *
 * Entries are grouped by local calendar day (YYYY-MM-DD). Each day is stored
 * under its own key so reads/writes touch only the day in question. Pure logic
 * (summaries) is split out so it can be unit-tested without any storage.
 */

import type { Confidence, FoodItem } from './food';
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

  // --- Trust signal (carried from the hybrid engine; never hide a guess) ---
  /** How sure the engine was about this match at log time. */
  confidence?: Confidence;
  /** Where the numbers came from: local table, USDA, or an AI estimate. */
  source?: FoodItem['source'];
}

/** Minimal shape of a food-database item used to build a portioned entry. */
export interface FoodLike {
  name: string;
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source?: FoodItem['source'];
}

const r = (n: number) => Math.round(n);

/** A real amount: positive and finite. */
const isAmount = (q: number) => Number.isFinite(q) && q > 0;
/** Strip float noise (0.15000000000000002) before it reaches storage. */
const tidy = (q: number) => Math.round(q * 1e4) / 1e4;

/** Build a portioned (quantity-editable) entry from a food item. */
export function portionedEntry(
  food: FoodLike,
  quantity = 1,
  confidence?: Confidence,
): Omit<LogEntry, 'id' | 'at'> {
  // Saved exactly as given. This was Math.max(0.5, quantity), which for a
  // weighed serving is a 50 g floor: the composer showed 7 g of sugar at
  // 27 kcal and tapping Log saved 50 g at 193 kcal. Only something that is
  // not an amount at all falls back to one serving.
  const q = isAmount(quantity) ? tidy(quantity) : 1;
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
    source: food.source,
    confidence,
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

/**
 * Read a day straight from the store, bypassing the mutation queue.
 *
 * Only for use *inside* a queued mutation: a serialized read there would wait
 * on the very mutation that issued it and deadlock the key's queue.
 */
async function readDay(date: string, store: KVStore): Promise<LogEntry[]> {
  return (await getJSON<LogEntry[]>(store, dayKey(date))) ?? [];
}

/**
 * Serialize read-modify-write mutations on a single day key.
 *
 * `addEntry`/`removeEntry`/`updateEntryQuantity` each read the day from the
 * store, modify it, and write it back. When two such calls overlap — the UI
 * fires several un-awaited mutations in quick succession (rapid taps, a
 * multi-item "describe a meal" log, or a duplicated press event) — the second
 * read can observe the pre-write snapshot and its write silently overwrites
 * the first, dropping entries. Queuing mutations per key makes the last write
 * always include every entry, and keeps the returned arrays consistent with
 * what's actually stored.
 */
const mutationQueues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const tail = mutationQueues.get(key) ?? Promise.resolve();
  const next = tail.then(fn, fn);
  // Keep the chain alive whether this mutation resolved or rejected, so a
  // single failure can't strand the whole queue.
  mutationQueues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

/**
 * Read a day's entries, queued behind any in-flight mutation on that day.
 *
 * The queue matters as much for reads as for writes. The log screen reloads
 * the day on every focus (`useFocusEffect`), so a tab switch moments after a
 * tap would otherwise fire an unqueued read that observes the pre-write
 * snapshot. Resolving last, its `setMeals` overwrote the mutation's correct
 * result and the meal vanished from the list while the store still held it —
 * until the next add returned the full array and everything reappeared.
 * Queueing reads makes resolution order match issue order, so the UI's last
 * write of state is always the freshest view of the store.
 */
export function loadDay(
  date: string,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  return serialized(dayKey(date), () => readDay(date, store));
}

export function addEntry(
  date: string,
  entry: Omit<LogEntry, 'id' | 'at'>,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  return serialized(dayKey(date), async () => {
    const entries = await readDay(date, store);
    const full: LogEntry = {
      ...entry,
      id: makeId(),
      at: new Date().toISOString(),
    };
    const next = [...entries, full];
    await setJSON(store, dayKey(date), next);
    return next;
  });
}

export function removeEntry(
  date: string,
  id: string,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  return serialized(dayKey(date), async () => {
    const entries = await readDay(date, store);
    const next = entries.filter((e) => e.id !== id);
    await setJSON(store, dayKey(date), next);
    return next;
  });
}

/**
 * Re-scale a portioned entry to a new quantity, recomputing its macros from the
 * stored per-serving unit. No-op for custom entries (no unit macros).
 */
export function updateEntryQuantity(
  date: string,
  id: string,
  quantity: number,
  store: KVStore = kv,
): Promise<LogEntry[]> {
  // The caller has already moved the value along the right grid — 5 g for a
  // weighed serving, half a serving otherwise (lib/quantity.ts) — so it is
  // saved as-is. Re-rounding to half-steps here is what turned a 5 g edit on a
  // weighed food into 50 g. A non-amount is ignored rather than replaced.
  const valid = isAmount(quantity);
  const q = tidy(quantity);
  return serialized(dayKey(date), async () => {
    const entries = await readDay(date, store);
    const next = entries.map((e) => {
      if (!valid || e.id !== id || e.unitKcal == null) return e;
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
  });
}

function makeId(): string {
  // Good enough for client-side list keys; the cloud layer can assign real ids.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

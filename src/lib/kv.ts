/**
 * kv.ts — the lowest storage primitive: a tiny async key/value store.
 *
 * Everything the app persists goes through a `KVStore`. Today the default is
 * backed by the browser's localStorage (the PWA target). Tomorrow a Supabase
 * adapter implements the same three methods and the rest of the app doesn't
 * change. That's the whole point of the interface.
 *
 * This module deliberately imports nothing from react-native so it stays pure
 * and unit-testable in plain Node (jest). Platform detection is done by
 * sniffing for `localStorage` rather than importing RN's `Platform`.
 */

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** In-memory fallback. Used on native (for now) and in tests. */
export function createMemoryStore(seed?: Record<string, string>): KVStore {
  const map = new Map<string, string>(seed ? Object.entries(seed) : undefined);
  return {
    async get(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
  };
}

function hasLocalStorage(): boolean {
  try {
    return (
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as { localStorage?: unknown }).localStorage !==
        'undefined' &&
      (globalThis as { localStorage?: unknown }).localStorage !== null
    );
  } catch {
    return false;
  }
}

/** Browser localStorage adapter (the PWA store). */
function createWebStore(): KVStore {
  const ls = (globalThis as unknown as { localStorage: Storage }).localStorage;
  return {
    async get(key) {
      return ls.getItem(key);
    },
    async set(key, value) {
      ls.setItem(key, value);
    },
    async remove(key) {
      ls.removeItem(key);
    },
  };
}

/**
 * The default store for the running app.
 *
 * - Web / PWA  -> localStorage (persists across reloads, survives install).
 * - Native     -> in-memory for now. TODO(native): swap in an
 *   @react-native-async-storage/async-storage adapter when we cut the native
 *   build; nothing else has to change.
 */
export const kv: KVStore = hasLocalStorage()
  ? createWebStore()
  : createMemoryStore();

/** Small helpers so call sites don't repeat JSON.parse/stringify + try/catch. */
export async function getJSON<T>(store: KVStore, key: string): Promise<T | null> {
  const raw = await store.get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON<T>(
  store: KVStore,
  key: string,
  value: T,
): Promise<void> {
  await store.set(key, JSON.stringify(value));
}

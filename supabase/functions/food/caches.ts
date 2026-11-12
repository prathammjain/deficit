// caches.ts — answers the engine keeps so it doesn't ask twice.
//
// A USDA search takes about 2 seconds and the same few hundred foods come up
// again and again ("cooked white rice", "chicken breast cooked"), so each
// answer is kept in this instance's memory and in the shared food_cache
// table, and a search already answered costs nothing or one database read.
// USDA's data barely moves (SR Legacy is frozen, Foundation and FNDDS update
// a couple of times a year), so an answer stays good for 30 days.
//
// Plain TypeScript with no Deno APIs, so it is unit tested from jest like
// portion.ts; index.ts passes in the network calls.

// @ts-nocheck

/** A small map whose entries expire, dropping the oldest when full. */
export class TtlCache<V> {
  private readonly map = new Map<string, { value: V; until: number }>();

  constructor(
    private readonly max: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.until <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  /** Keeps `value` for the cache's lifetime, or `ttlMs` when shorter. */
  set(key: string, value: V, ttlMs: number = this.ttlMs): void {
    if (!(ttlMs > 0)) return;
    this.map.delete(key);
    this.map.set(key, {
      value,
      until: this.now() + Math.min(ttlMs, this.ttlMs),
    });
    while (this.map.size > this.max) {
      this.map.delete(this.map.keys().next().value);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

export const USDA_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** How long a stored answer may take to come back before it is skipped. */
export const STORED_WAIT_MS = 1500;

export interface LookupIO<V> {
  /** This instance's answers. */
  memory: TtlCache<V>;
  /** Stored answers still good, by query. May reject; that reads as none. */
  load: (queries: string[]) => Promise<Map<string, V>>;
  /** Asks USDA. Null when USDA is unavailable, never cached. */
  fetch: (query: string, signal: AbortSignal) => Promise<V | null>;
  /** Stores new answers; runs after the reply, nothing waits for it. */
  save: (found: Map<string, V>) => void;
  /** How long to wait for stored answers. */
  storedWaitMs?: number;
}

/**
 * The USDA answer for each query, in the order asked; null where USDA was
 * needed and unavailable. Repeated queries are asked once.
 *
 * Memory first. For the rest, the stored answers and USDA are asked at the
 * same time: a query found in the store cancels its USDA search, so a stored
 * answer arrives in one database round trip and a new query waits no longer
 * than it did before there was a store.
 */
export async function usdaLookups<V>(
  queries: string[],
  io: LookupIO<V>,
): Promise<(V | null)[]> {
  const answers = new Map<string, V | null>();
  const misses: string[] = [];
  for (const q of new Set(queries)) {
    const hit = io.memory.get(q);
    if (hit !== undefined) answers.set(q, hit);
    else misses.push(q);
  }

  if (misses.length) {
    const searches = new Map(
      misses.map((q) => {
        const stop = new AbortController();
        const answer = io.fetch(q, stop.signal).catch(() => null);
        return [q, { stop, answer }];
      }),
    );
    const stored = await Promise.race([
      io.load(misses).catch(() => new Map<string, V>()),
      new Promise<Map<string, V>>((r) =>
        setTimeout(() => r(new Map()), io.storedWaitMs ?? STORED_WAIT_MS),
      ),
    ]);
    const fresh = new Map<string, V>();
    await Promise.all(
      misses.map(async (q) => {
        const search = searches.get(q)!;
        if (stored.has(q)) {
          search.stop.abort();
          answers.set(q, stored.get(q)!);
          io.memory.set(q, stored.get(q)!);
          return;
        }
        const found = await search.answer;
        answers.set(q, found);
        if (found !== null) {
          io.memory.set(q, found);
          fresh.set(q, found);
        }
      }),
    );
    if (fresh.size) io.save(fresh);
  }

  return queries.map((q) => answers.get(q) ?? null);
}

/** Seconds since 1970 when a JWT expires, or null if it isn't a JWT. */
export function tokenExpiry(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = Number(JSON.parse(json)?.exp);
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

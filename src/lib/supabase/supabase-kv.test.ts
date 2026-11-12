import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseStore } from './supabase-kv';

/**
 * A stand in for the client: a `user_kv` table in memory that answers the
 * few query shapes the store makes, a tick late, and counts its requests.
 */
function fakeClient(seed: Record<string, string> = {}) {
  const rows = new Map(Object.entries(seed));
  const requests: string[] = [];
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const client = {
    from: () => ({
      select: () => {
        const filter: { key?: string; keys?: string[] } = {};
        const query = {
          eq(column: string, value: string) {
            if (column === 'key') filter.key = value;
            return query;
          },
          in(_column: string, keys: string[]) {
            filter.keys = keys;
            return query;
          },
          async maybeSingle() {
            requests.push(`get ${filter.key}`);
            await tick();
            const value = rows.get(filter.key as string);
            return { data: value == null ? null : { value }, error: null };
          },
          // A query with `in` is awaited as it is.
          then(
            resolve: (v: { data: object[]; error: null }) => unknown,
            reject: (e: unknown) => unknown,
          ) {
            requests.push(`getMany ${filter.keys?.length}`);
            return tick()
              .then(() => ({
                data: (filter.keys ?? [])
                  .filter((k) => rows.has(k))
                  .map((key) => ({ key, value: rows.get(key) })),
                error: null,
              }))
              .then(resolve, reject);
          },
        };
        return query;
      },
      async upsert(row: { key: string; value: string }) {
        requests.push(`set ${row.key}`);
        await tick();
        rows.set(row.key, row.value);
        return { error: null };
      },
      delete: () => {
        let key = '';
        const query = {
          eq(column: string, value: string) {
            if (column === 'key') key = value;
            return query;
          },
          then(resolve: (v: { error: null }) => unknown) {
            requests.push(`remove ${key}`);
            rows.delete(key);
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return query;
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, rows, requests };
}

describe('the account store', () => {
  it('gets, sets and removes a key', async () => {
    const { client } = fakeClient();
    const store = createSupabaseStore(client, 'u1');
    expect(await store.get('a')).toBeNull();
    await store.set('a', '1');
    expect(await store.get('a')).toBe('1');
    await store.remove('a');
    expect(await store.get('a')).toBeNull();
  });

  it('answers the same key asked at the same moment with one request', async () => {
    const { client, requests } = fakeClient({ w: '[80]' });
    const store = createSupabaseStore(client, 'u1');
    const answers = await Promise.all([
      store.get('w'),
      store.get('w'),
      store.get('w'),
      store.get('other'),
    ]);
    expect(answers).toEqual(['[80]', '[80]', '[80]', null]);
    expect(requests).toEqual(['get w', 'get other']);
    // Once answered, the next read asks again: nothing is kept.
    await store.get('w');
    expect(requests).toHaveLength(3);
  });

  it('a read issued after a write never shares a read from before it', async () => {
    const { client, requests } = fakeClient({ k: 'old' });
    const store = createSupabaseStore(client, 'u1');
    const before = store.get('k');
    const writing = store.set('k', 'new');
    const after = writing.then(() => store.get('k'));
    expect(await before).toBe('old');
    expect(await after).toBe('new');
    expect(requests.filter((r) => r === 'get k')).toHaveLength(2);
  });

  it('a failed read is not shared with the next one', async () => {
    const { client } = fakeClient({ k: 'v' });
    const store = createSupabaseStore(client, 'u1');
    const table = client.from('user_kv');
    let fail = true;
    (client as unknown as { from: () => unknown }).from = () => ({
      ...table,
      select: () => {
        const q = table.select('value') as unknown as {
          maybeSingle: () => Promise<unknown>;
        };
        const real = q.maybeSingle.bind(q);
        q.maybeSingle = async () =>
          fail ? { data: null, error: new Error('offline') } : real();
        return q;
      },
    });
    await expect(store.get('k')).rejects.toThrow('offline');
    fail = false;
    expect(await store.get('k')).toBe('v');
  });

  it('reads many keys in one request, in the order asked', async () => {
    const { client, requests } = fakeClient({ a: '1', c: '3' });
    const store = createSupabaseStore(client, 'u1');
    expect(await store.getMany?.(['c', 'b', 'a'])).toEqual(['3', null, '1']);
    expect(requests).toEqual(['getMany 3']);
  });

  it('splits a long list into requests of a hundred keys', async () => {
    const seed = Object.fromEntries(
      Array.from({ length: 250 }, (_, i) => [`k${i}`, String(i)]),
    );
    const { client, requests } = fakeClient(seed);
    const store = createSupabaseStore(client, 'u1');
    const keys = Object.keys(seed);
    expect(await store.getMany?.(keys)).toEqual(Object.values(seed));
    expect(requests.sort()).toEqual([
      'getMany 100',
      'getMany 100',
      'getMany 50',
    ]);
  });
});

describe('moving a device’s data up on first sign in', () => {
  /** Browser storage holding `items`, and fresh modules that see it. */
  async function device(items: Record<string, string>) {
    const map = new Map(Object.entries(items));
    (globalThis as { localStorage?: unknown }).localStorage = {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
    let mod!: typeof import('./supabase-kv');
    await jest.isolateModulesAsync(async () => {
      const kv = await import('../kv');
      mod = await import('./supabase-kv');
      kv.setDeviceScope('u1');
    });
    return { map, mod };
  }

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('makes no request when the device holds nothing to move', async () => {
    const { mod } = await device({ 'grain.u1.consent.v1': '2026-11-09' });
    const { client, requests } = fakeClient();
    await mod.migrateLocalToCloud(mod.createSupabaseStore(client, 'u1'));
    expect(requests).toEqual([]);
  });

  it('moves the device’s data to an empty account, then never asks again', async () => {
    const { map, mod } = await device({
      'deficit.profile.v1': '{"age":30}',
      'deficit.log.v1.2026-11-01': '[]',
    });
    const { client, rows, requests } = fakeClient();
    const cloud = mod.createSupabaseStore(client, 'u1');
    await mod.migrateLocalToCloud(cloud);
    expect(rows.get('deficit.profile.v1')).toBe('{"age":30}');
    expect(rows.get('deficit.log.v1.2026-11-01')).toBe('[]');
    expect(map.get('grain.u1.migrated.v1')).toBe('1');

    requests.length = 0;
    await mod.migrateLocalToCloud(cloud);
    expect(requests).toEqual([]);
  });

  it('leaves an account that already has a profile alone, once', async () => {
    const { mod } = await device({ 'deficit.profile.v1': '{"age":30}' });
    const { client, rows, requests } = fakeClient({
      'deficit.profile.v1': '{"age":41}',
    });
    const cloud = mod.createSupabaseStore(client, 'u1');
    await mod.migrateLocalToCloud(cloud);
    expect(rows.get('deficit.profile.v1')).toBe('{"age":41}');
    expect(requests).toEqual(['get deficit.profile.v1']);
    await mod.migrateLocalToCloud(cloud);
    expect(requests).toHaveLength(1);
  });

  it('asks again on a later launch if the account couldn’t be reached', async () => {
    const { map, mod } = await device({ 'deficit.profile.v1': '{"age":30}' });
    const down = {
      get: async () => Promise.reject(new Error('offline')),
      set: async () => undefined,
      remove: async () => undefined,
    };
    await expect(mod.migrateLocalToCloud(down)).rejects.toThrow('offline');
    expect(map.has('grain.u1.migrated.v1')).toBe(false);
  });
});

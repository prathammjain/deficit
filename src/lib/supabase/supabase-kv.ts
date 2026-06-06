/**
 * supabase-kv.ts — a KVStore backed by a per-user `user_kv` table.
 *
 * Same three methods as every other store, so the whole app (profile, logs,
 * workouts, weigh-ins) syncs to the cloud the moment we point the `kv` façade
 * here. Row-level security scopes every row to the signed-in user.
 *
 * Also includes a one-time local → cloud migration so a user's on-device data
 * isn't lost the first time they sign in on a device.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { localStore, type KVStore } from '../kv';

const TABLE = 'user_kv';
const LOCAL_PREFIX = 'deficit.';

export function createSupabaseStore(
  client: SupabaseClient,
  userId: string,
): KVStore {
  return {
    async get(key) {
      const { data, error } = await client
        .from(TABLE)
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string | undefined) ?? null;
    },
    async set(key, value) {
      const { error } = await client.from(TABLE).upsert(
        { user_id: userId, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' },
      );
      if (error) throw error;
    },
    async remove(key) {
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('key', key);
      if (error) throw error;
    },
  };
}

/** All `deficit.*` keys currently in localStorage (web only). */
function localKeys(): string[] {
  try {
    const ls = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (!ls) return [];
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(LOCAL_PREFIX)) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}

/**
 * If the cloud has no profile for this user yet, push the device's local data
 * up. Runs once per device on first authenticated load; safe to call again
 * (it no-ops once a cloud profile exists).
 */
export async function migrateLocalToCloud(cloud: KVStore): Promise<void> {
  const alreadySynced = await cloud.get('deficit.profile.v1');
  if (alreadySynced != null) return;

  for (const key of localKeys()) {
    const value = await localStore.get(key);
    if (value != null) await cloud.set(key, value);
  }
}

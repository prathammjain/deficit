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

import { deviceKey, localStore, type KVStore } from '../kv';

const TABLE = 'user_kv';
const LOCAL_PREFIX = 'deficit.';
/** Keys per request in a batched read, which keeps the address short. */
const CHUNK = 100;

export function createSupabaseStore(
  client: SupabaseClient,
  userId: string,
): KVStore {
  // Screens ask for the same key at the same moment (weigh ins, the
  // profile). Those share one request. A write forgets the read in flight,
  // so a read issued after it never gets the answer from before it.
  const inflight = new Map<string, Promise<string | null>>();

  async function read(key: string): Promise<string | null> {
    const { data, error } = await client
      .from(TABLE)
      .select('value')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return (data?.value as string | undefined) ?? null;
  }

  return {
    get(key) {
      const pending = inflight.get(key);
      if (pending) return pending;
      const request = read(key).finally(() => {
        if (inflight.get(key) === request) inflight.delete(key);
      });
      inflight.set(key, request);
      return request;
    },
    async getMany(keys) {
      const found = new Map<string, string>();
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += CHUNK) {
        chunks.push(keys.slice(i, i + CHUNK));
      }
      await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await client
            .from(TABLE)
            .select('key, value')
            .eq('user_id', userId)
            .in('key', chunk);
          if (error) throw error;
          for (const row of data ?? []) {
            found.set(row.key as string, row.value as string);
          }
        }),
      );
      return keys.map((k) => found.get(k) ?? null);
    },
    async set(key, value) {
      inflight.delete(key);
      const { error } = await client
        .from(TABLE)
        .upsert(
          { user_id: userId, key, value, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,key' },
        );
      if (error) throw error;
    },
    async remove(key) {
      inflight.delete(key);
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
    const ls = (globalThis as unknown as { localStorage?: Storage })
      .localStorage;
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
 *
 * Sign in waits for this, so it stays off the network whenever it can: with
 * nothing on the device to move, or once this account has been settled on
 * this device (a mark per account, so it never asks again).
 */
export async function migrateLocalToCloud(cloud: KVStore): Promise<void> {
  const keys = localKeys();
  if (keys.length === 0) return;
  const settled = deviceKey('migrated.v1');
  if ((await localStore.get(settled)) != null) return;

  const alreadySynced = await cloud.get('deficit.profile.v1');
  if (alreadySynced == null) {
    for (const key of keys) {
      const value = await localStore.get(key);
      if (value != null) await cloud.set(key, value);
    }
  }
  await localStore.set(settled, '1');
}

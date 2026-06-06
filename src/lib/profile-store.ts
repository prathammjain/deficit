/**
 * profile-store.ts — persistence for the user's profile (white paper §6).
 *
 * The profile is the only input the deterministic engine needs. We store it
 * once at the end of onboarding and reload it on every launch. All functions
 * take a `KVStore` so they're trivially testable; app code passes the default
 * `kv`.
 */

import { getJSON, kv, type KVStore, setJSON } from './kv';
import type { ProfileInput } from './targets';

const PROFILE_KEY = 'deficit.profile.v1';

/** What we actually persist: the engine input plus light bookkeeping. */
export interface StoredProfile extends ProfileInput {
  /** ISO timestamp of first save — handy for "member since" and migrations. */
  createdAt: string;
  /** ISO timestamp of the last edit. */
  updatedAt: string;
  /** Schema version, so future migrations have something to branch on. */
  version: 1;
}

export async function loadProfile(
  store: KVStore = kv,
): Promise<StoredProfile | null> {
  return getJSON<StoredProfile>(store, PROFILE_KEY);
}

export async function saveProfile(
  input: ProfileInput,
  store: KVStore = kv,
): Promise<StoredProfile> {
  const now = new Date().toISOString();
  const existing = await loadProfile(store);
  const profile: StoredProfile = {
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: 1,
  };
  await setJSON(store, PROFILE_KEY, profile);
  return profile;
}

export async function clearProfile(store: KVStore = kv): Promise<void> {
  await store.remove(PROFILE_KEY);
}

export async function hasProfile(store: KVStore = kv): Promise<boolean> {
  return (await loadProfile(store)) !== null;
}

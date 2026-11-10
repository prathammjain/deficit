/**
 * supabase/consent.ts: the one time agreement before anyone uses Grain.
 *
 * Each agreement is a row in `consents` that can't be edited. Raising
 * CONSENT_VERSION (when the terms or privacy policy change materially) asks
 * everyone again. A copy of the agreed version is kept on the device, so the
 * check costs nothing after the first time.
 *
 * Agreeing never depends on the network. The person has agreed the moment
 * they tick the boxes, so the app opens; if the account can't take the row
 * right then (no signal, or the table not set up yet), the agreement waits on
 * the device and is sent on a later launch.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { deviceKey } from '../kv';
import { supabase } from './client';

export const CONSENT_VERSION = '2026-11-09';

const cacheKey = () => deviceKey('consent.v1');
const pendingKey = () => deviceKey('consent.pending.v1');

function storage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value == null) storage()?.removeItem(key);
    else storage()?.setItem(key, value);
  } catch {
    // Storage blocked: the account check runs again next time.
  }
}

/** True when this device already knows the current version was agreed. */
export function consentCached(): boolean {
  return read(cacheKey()) === CONSENT_VERSION;
}

/** An agreement given on this device that the account hasn't stored yet. */
export function consentPending(): boolean {
  return read(pendingKey()) != null;
}

async function insertConsent(db: SupabaseClient, version: string) {
  const { error } = await db.from('consents').insert({
    version,
    adult: true,
    terms: true,
    health: true,
  });
  if (error) throw error;
}

/**
 * Whether the signed in user has agreed to the current version. Any doubt
 * (offline, a failed read) reads as no: agreeing again is harmless.
 */
export async function checkConsent(
  db: SupabaseClient | null = supabase,
): Promise<boolean> {
  if (!db) return true;
  if (consentCached()) return true;
  try {
    const { data, error } = await db
      .from('consents')
      .select('id')
      .eq('version', CONSENT_VERSION)
      .limit(1);
    if (error || !data?.length) return false;
    write(cacheKey(), CONSENT_VERSION);
    return true;
  } catch {
    return false;
  }
}

/**
 * Records the agreement. The app may open straight after: when the row
 * can't be stored now, it is kept on the device for sendPendingConsent.
 */
export async function recordConsent(
  db: SupabaseClient | null = supabase,
): Promise<void> {
  write(cacheKey(), CONSENT_VERSION);
  if (!db) return;
  try {
    await insertConsent(db, CONSENT_VERSION);
    write(pendingKey(), null);
  } catch (e) {
    write(pendingKey(), CONSENT_VERSION);
    console.warn('Consent kept on this device until the account takes it', e);
  }
}

/** Sends an agreement that is waiting on the device. Safe to call anytime. */
export async function sendPendingConsent(
  db: SupabaseClient | null = supabase,
): Promise<void> {
  const version = read(pendingKey());
  if (!db || !version) return;
  try {
    await insertConsent(db, version);
    write(pendingKey(), null);
  } catch {
    // Still not reachable: it goes on a later launch.
  }
}

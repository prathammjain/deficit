/**
 * supabase/consent.ts: the one time agreement before anyone uses Grain.
 *
 * Each agreement is a row in `consents` that can't be edited. Raising
 * CONSENT_VERSION (when the terms or privacy policy change materially) asks
 * everyone again. A copy of the agreed version is kept on the device, so the
 * check costs nothing after the first time.
 */

import { deviceKey } from '../kv';
import { supabase } from './client';

export const CONSENT_VERSION = '2026-11-09';

const cacheKey = () => deviceKey('consent.v1');

function readCache(): string | null {
  try {
    return (
      (globalThis as { localStorage?: Storage }).localStorage?.getItem(
        cacheKey(),
      ) ?? null
    );
  } catch {
    return null;
  }
}

function writeCache(): void {
  try {
    (globalThis as { localStorage?: Storage }).localStorage?.setItem(
      cacheKey(),
      CONSENT_VERSION,
    );
  } catch {
    // Storage blocked: the account check runs again next time.
  }
}

/** True when this device already knows the current version was agreed. */
export function consentCached(): boolean {
  return readCache() === CONSENT_VERSION;
}

/**
 * Whether the signed in user has agreed to the current version. Any doubt
 * (offline, a failed read) reads as no: agreeing again is harmless.
 */
export async function checkConsent(): Promise<boolean> {
  if (!supabase) return true;
  if (consentCached()) return true;
  try {
    const { data, error } = await supabase
      .from('consents')
      .select('id')
      .eq('version', CONSENT_VERSION)
      .limit(1);
    if (error || !data?.length) return false;
    writeCache();
    return true;
  } catch {
    return false;
  }
}

/** Records the agreement. Throws when it couldn't be saved. */
export async function recordConsent(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('consents').insert({
    version: CONSENT_VERSION,
    adult: true,
    terms: true,
    health: true,
  });
  if (error) throw error;
  writeCache();
}

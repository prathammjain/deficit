import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CONSENT_VERSION,
  checkConsent,
  consentCached,
  consentPending,
  recordConsent,
  sendPendingConsent,
} from './consent';

// The real client pulls in React Native; these tests pass their own.
jest.mock('./client', () => ({ supabase: null }));

/** A localStorage stand in for node. */
function memoryStorage() {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  return map;
}

/** A client whose consents table works, is missing, or is unreachable. */
function fakeDb(mode: 'ok' | 'missing' | 'throws', rows: object[] = []) {
  const inserted: object[] = [];
  const fail = {
    message: "Could not find the table 'public.consents'",
    code: 'PGRST205',
  };
  const db = {
    from: () => ({
      insert: async (row: object) => {
        if (mode === 'throws') throw new Error('network down');
        if (mode === 'missing') return { error: fail };
        inserted.push(row);
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          limit: async () =>
            mode === 'ok'
              ? { data: rows, error: null }
              : { data: null, error: fail },
        }),
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, inserted };
}

beforeEach(() => {
  memoryStorage();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('recordConsent', () => {
  it('stores the agreement when the account takes it', async () => {
    const { db, inserted } = fakeDb('ok');
    await recordConsent(db);
    expect(inserted).toEqual([
      { version: CONSENT_VERSION, adult: true, terms: true, health: true },
    ]);
    expect(consentCached()).toBe(true);
    expect(consentPending()).toBe(false);
  });

  it('never blocks: a missing table or no signal keeps it on the device', async () => {
    for (const mode of ['missing', 'throws'] as const) {
      memoryStorage();
      await expect(recordConsent(fakeDb(mode).db)).resolves.toBeUndefined();
      expect(consentCached()).toBe(true);
      expect(consentPending()).toBe(true);
    }
  });
});

describe('sendPendingConsent', () => {
  it('sends a waiting agreement once the account can take it', async () => {
    await recordConsent(fakeDb('missing').db);
    await sendPendingConsent(fakeDb('missing').db);
    expect(consentPending()).toBe(true);
    const { db, inserted } = fakeDb('ok');
    await sendPendingConsent(db);
    expect(inserted).toHaveLength(1);
    expect(consentPending()).toBe(false);
  });

  it('does nothing when nothing waits', async () => {
    const { db, inserted } = fakeDb('ok');
    await sendPendingConsent(db);
    expect(inserted).toHaveLength(0);
  });
});

describe('checkConsent', () => {
  it('asks when the account has no agreement for this version', async () => {
    expect(await checkConsent(fakeDb('ok').db)).toBe(false);
    expect(await checkConsent(fakeDb('missing').db)).toBe(false);
  });

  it('remembers an agreement found in the account', async () => {
    expect(await checkConsent(fakeDb('ok', [{ id: 'c1' }]).db)).toBe(true);
    expect(consentCached()).toBe(true);
    expect(await checkConsent(fakeDb('missing').db)).toBe(true);
  });
});

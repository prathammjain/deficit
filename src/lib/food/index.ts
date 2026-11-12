/**
 * food/index.ts — the single place the app gets its food provider.
 *
 * With Supabase configured, "Describe a meal" routes through the USDA-grounded
 * Edge Function while type-ahead search stays on the offline Indian table; both
 * fall back to the local table automatically. Without Supabase, it's the local
 * table directly. Same interface either way.
 */

import { supabase } from '../supabase/client';
import { LocalFoodProvider } from './local-provider';
import { RemoteFoodProvider } from './remote-provider';
import type { FoodProvider } from './types';

const local = new LocalFoodProvider();

/**
 * When Supabase is configured we route meal parsing through the USDA-grounded
 * Edge Function, with the local Indian table as an automatic fallback. Otherwise
 * we use the local table directly. Same interface either way.
 */
export const foodProvider: FoodProvider = supabase
  ? new RemoteFoodProvider(supabase, local)
  : local;

/** How often the Log screen may ask whether the engine is up. */
const PROBE_EVERY_MS = 5 * 60 * 1000;
let lastProbe = 0;

/**
 * Ask the live engine whether it's ready so the UI can show the offline line
 * when it isn't. At most once every few minutes: the Log screen asks on every
 * visit, each ask is a function call, and every Match reports the engine's
 * state on its own anyway. No-op for the local provider, which is always
 * ready.
 */
export async function probeProvider(now = Date.now()): Promise<void> {
  if (!(foodProvider instanceof RemoteFoodProvider)) return;
  if (now - lastProbe < PROBE_EVERY_MS) return;
  lastProbe = now;
  await foodProvider.health();
}

export * from './types';

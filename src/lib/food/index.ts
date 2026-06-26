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

/**
 * Ask the live engine whether it's ready (cheap, no AI/DB calls) so the UI can
 * show "AI grounding active" vs "offline — local foods". No-op for the local
 * provider, which is always ready.
 */
export async function probeProvider(): Promise<void> {
  if (foodProvider instanceof RemoteFoodProvider) {
    await foodProvider.health();
  }
}

export * from './types';

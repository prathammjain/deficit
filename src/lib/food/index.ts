/**
 * food/index.ts — the single place the app gets its food provider.
 *
 * Today this is the offline Indian table. When the FatSecret + Gemini backend
 * lands, swap this one line for the composite provider (AI parse → FatSecret
 * lookup → AI sanity-check) and nothing else in the app changes.
 */

import { supabase } from '../supabase/client';
import { LocalFoodProvider } from './local-provider';
import { RemoteFoodProvider } from './remote-provider';
import type { FoodProvider } from './types';

const local = new LocalFoodProvider();

/**
 * When Supabase is configured we route lookups through the Edge Function
 * (Gemini + FatSecret), with the local Indian table as an automatic fallback.
 * Otherwise we use the local table directly. Same interface either way.
 */
export const foodProvider: FoodProvider = supabase
  ? new RemoteFoodProvider(supabase, local)
  : local;

export * from './types';

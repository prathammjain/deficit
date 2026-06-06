/**
 * food/index.ts — the single place the app gets its food provider.
 *
 * Today this is the offline Indian table. When the FatSecret + Gemini backend
 * lands, swap this one line for the composite provider (AI parse → FatSecret
 * lookup → AI sanity-check) and nothing else in the app changes.
 */

import { LocalFoodProvider } from './local-provider';
import type { FoodProvider } from './types';

export const foodProvider: FoodProvider = new LocalFoodProvider();

export * from './types';

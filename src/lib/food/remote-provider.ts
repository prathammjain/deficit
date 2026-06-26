/**
 * remote-provider.ts — FoodProvider backed by the Supabase `food` Edge Function
 * (USDA-grounded, AI-judged meal parsing). Type-ahead search stays on the
 * instant local Indian table; only "Describe a meal" goes to the engine.
 * Everything falls back to the local table if the function errors or isn't
 * deployed, so logging never hard-fails.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { setProviderStatus } from './provider-status';
import type { FoodItem, FoodProvider, ParsedMeal } from './types';

export class RemoteFoodProvider implements FoodProvider {
  readonly name = 'remote';

  constructor(
    private readonly client: SupabaseClient,
    private readonly fallback: FoodProvider,
  ) {}

  /**
   * Readiness probe (no model/DB call). Marks the engine `online` only when the
   * function is reachable and both the Gemini and USDA keys are set; otherwise
   * the app is on the local table, so we mark it `offline`.
   */
  async health(): Promise<void> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: { action: 'health' },
      });
      if (error || !data?.ok) throw error ?? new Error('no data');
      setProviderStatus(data.gemini && data.usda ? 'online' : 'offline');
    } catch {
      setProviderStatus('offline');
    }
  }

  /** Type-ahead search uses the instant local Indian table (no model latency). */
  async search(query: string, limit = 12): Promise<FoodItem[]> {
    return this.fallback.search(query, limit);
  }

  async parseMeal(text: string): Promise<ParsedMeal> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: { action: 'parse', text },
      });
      if (error || !data?.items) throw error ?? new Error('no data');
      setProviderStatus('online');
      return data as ParsedMeal;
    } catch {
      setProviderStatus('offline');
      // Local heuristic parse is a reasonable degraded experience.
      return this.fallback.parseMeal
        ? this.fallback.parseMeal(text)
        : { items: [], total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } };
    }
  }
}

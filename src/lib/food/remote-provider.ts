/**
 * remote-provider.ts — FoodProvider backed by the Supabase `food` Edge Function
 * (Gemini parse + FatSecret lookup). Falls back to the local Indian table if the
 * function errors or isn't deployed yet, so logging never hard-fails.
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
   * Readiness probe (no Gemini/FatSecret calls). Marks the engine `online` only
   * when the function is reachable *and* both secrets are set; otherwise the app
   * is silently using the local table, so we mark it `offline`.
   */
  async health(): Promise<void> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: { action: 'health' },
      });
      if (error || !data?.ok) throw error ?? new Error('no data');
      setProviderStatus(data.gemini && data.fatsecret ? 'online' : 'offline');
    } catch {
      setProviderStatus('offline');
    }
  }

  async search(query: string, limit = 12): Promise<FoodItem[]> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: { action: 'search', query, limit },
      });
      if (error || !data?.items) throw error ?? new Error('no data');
      setProviderStatus('online');
      return data.items as FoodItem[];
    } catch {
      setProviderStatus('offline');
      return this.fallback.search(query, limit);
    }
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

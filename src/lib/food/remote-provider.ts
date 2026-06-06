/**
 * remote-provider.ts — FoodProvider backed by the Supabase `food` Edge Function
 * (Gemini parse + FatSecret lookup). Falls back to the local Indian table if the
 * function errors or isn't deployed yet, so logging never hard-fails.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { FoodItem, FoodProvider, ParsedMeal } from './types';

export class RemoteFoodProvider implements FoodProvider {
  readonly name = 'remote';

  constructor(
    private readonly client: SupabaseClient,
    private readonly fallback: FoodProvider,
  ) {}

  async search(query: string, limit = 12): Promise<FoodItem[]> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: { action: 'search', query, limit },
      });
      if (error || !data?.items) throw error ?? new Error('no data');
      return data.items as FoodItem[];
    } catch {
      return this.fallback.search(query, limit);
    }
  }

  async parseMeal(text: string): Promise<ParsedMeal> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: { action: 'parse', text },
      });
      if (error || !data?.items) throw error ?? new Error('no data');
      return data as ParsedMeal;
    } catch {
      // Local heuristic parse is a reasonable degraded experience.
      return this.fallback.parseMeal
        ? this.fallback.parseMeal(text)
        : { items: [], total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } };
    }
  }
}

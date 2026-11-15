/**
 * remote-provider.ts — FoodProvider backed by the Supabase `food` Edge Function
 * (USDA-grounded, AI-judged meal parsing). Type-ahead search stays on the
 * instant local Indian table; only "Describe a meal" goes to the engine.
 * Everything falls back to the local table if the function errors or isn't
 * deployed, so logging never hard-fails.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { todayKey } from '../log-store';
import { noteAiGate, noteAiUsage, type AiGateReason } from './ai-access';
import { setProviderStatus } from './provider-status';

import type {
  FoodItem,
  FoodProvider,
  LoggedItem,
  ParsedMeal,
  RoastInput,
} from './types';

const EMPTY_TOTAL = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
const GATES: AiGateReason[] = ['invite_only', 'daily_limit', 'unavailable'];

/** The refusal behind a failed call, when it was GrainAI saying no. */
async function gateOf(
  error: unknown,
): Promise<{ reason: AiGateReason; limit: number | null } | null> {
  const res = (error as { context?: Response } | null)?.context;
  if (!res || typeof res.json !== 'function') return null;
  if (res.status !== 403 && res.status !== 429) return null;
  try {
    const body = await res.clone().json();
    return GATES.includes(body?.error)
      ? {
          reason: body.error,
          limit: typeof body.limit === 'number' ? body.limit : null,
        }
      : null;
  } catch {
    return null;
  }
}

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
      setProviderStatus(data.provider && data.usda ? 'online' : 'offline');
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
        body: { action: 'parse', text, localDate: todayKey() },
      });
      // GrainAI said no: show why. Falling back to the local table here
      // would hand out what the invite and the limit hold back.
      const gate = error ? await gateOf(error) : null;
      if (gate) {
        noteAiGate(gate.reason, gate.limit);
        return { items: [], total: EMPTY_TOTAL, gate: gate.reason };
      }
      if (error || !data?.items) throw error ?? new Error('no data');
      setProviderStatus('online');
      if (data.usage) noteAiUsage(data.usage);
      return data as ParsedMeal;
    } catch {
      setProviderStatus('offline');
      // Local heuristic parse is a reasonable degraded experience.
      return this.fallback.parseMeal
        ? this.fallback.parseMeal(text)
        : { items: [], total: EMPTY_TOTAL };
    }
  }

  async transcribe(wavBase64: string): Promise<string | null> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: {
          action: 'transcribe',
          audio: wavBase64,
          mime: 'audio/wav',
          localDate: todayKey(),
        },
      });
      const gate = error ? await gateOf(error) : null;
      if (gate) noteAiGate(gate.reason, gate.limit);
      if (error || typeof data?.text !== 'string') return null;
      return data.text;
    } catch {
      return null;
    }
  }

  async roast(input: RoastInput): Promise<string | null> {
    try {
      const { data, error } = await this.client.functions.invoke('food', {
        body: { action: 'roast', ...input, localDate: todayKey() },
      });
      if (error || typeof data?.line !== 'string') return null;
      return data.line;
    } catch {
      return null;
    }
  }

  /** Every edit before logging is the engine being corrected: the run log
   *  keeps it next to the engine's own answer. */
  reportLogged(runId: string, logged: LoggedItem[]): void {
    this.client.functions
      .invoke('food', { body: { action: 'correction', runId, logged } })
      .catch(() => {});
  }
}

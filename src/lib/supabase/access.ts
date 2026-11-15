/**
 * supabase/access.ts: asks the database what the signed in user may use.
 * Null when that can't be known (local mode, offline, or the access SQL not
 * run yet), so the app simply shows nothing extra.
 */

import { toAccess, type Access } from '../access';
import { setAiAccessFromServer } from '../food/ai-access';
import { todayKey } from '../log-store';
import { supabase } from './client';

/** Asks whether this person has GrainAI and how many meals are left today,
 *  and mirrors the answer into the ai-access store. Silent on failure. */
export async function refreshAiAccess(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.rpc('my_ai', { p_day: todayKey() });
    if (!error) setAiAccessFromServer(data);
  } catch {
    // Unknown stays "assume yes"; the server still enforces.
  }
}

export async function fetchAccess(): Promise<Access | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('my_access');
    return error || data == null ? null : toAccess(data);
  } catch {
    return null;
  }
}

/**
 * supabase/access.ts: asks the database what the signed in user may use.
 * Null when that can't be known (local mode, offline, or the access SQL not
 * run yet), so the app simply shows nothing extra.
 */

import { toAccess, type Access } from '../access';
import { supabase } from './client';

export async function fetchAccess(): Promise<Access | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('my_access');
    return error || data == null ? null : toAccess(data);
  } catch {
    return null;
  }
}

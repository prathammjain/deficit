/**
 * supabase/account.ts: everything a user can do with their whole account:
 * take a copy of all of it, or delete all of it.
 */

import { clearDeviceKeys } from '../kv';
import { supabase } from './client';

function parse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Every row stored for the signed in user, as one JSON document: the logs,
 * weigh ins, workouts and settings, consents, programs written and follows.
 */
export async function exportMyData(email: string | null): Promise<string> {
  if (!supabase) throw new Error('Sign in to download your data.');
  const { data: user, error: userError } = await supabase.auth.getUser();
  const id = user.user?.id;
  if (userError || !id) throw userError ?? new Error('Not signed in.');
  const [kv, consents, programs, follows] = await Promise.all([
    supabase.from('user_kv').select('key, value, updated_at').order('key'),
    supabase.from('consents').select('version, created_at').order('created_at'),
    // Only what this account wrote or joined; a coach's view of others isn't theirs.
    supabase.from('programs').select('*').eq('owner_id', id),
    supabase
      .from('follows')
      .select('program_id, display_name, share_stats, stats, started_at')
      .eq('follower_id', id),
  ]);
  if (kv.error) throw kv.error;
  const doc = {
    exported_at: new Date().toISOString(),
    account: { id, email },
    data: Object.fromEntries(
      (kv.data ?? []).map((r) => [r.key, parse(r.value)]),
    ),
    consents: consents.data ?? [],
    programs: programs.data ?? [],
    follows: follows.data ?? [],
  };
  return JSON.stringify(doc, null, 2);
}

/** Deletes the account and everything in it, then clears this device. */
export async function deleteMyAccount(): Promise<void> {
  if (!supabase) throw new Error('No account to delete.');
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  clearDeviceKeys();
}

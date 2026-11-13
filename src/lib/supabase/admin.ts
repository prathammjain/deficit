/**
 * supabase/admin.ts: every read and write the admin screens make.
 *
 * The database decides who may: the admin_* functions refuse anyone who is
 * not in `admins`, and the CRM and premium tables only open to admins (row
 * level security). Nothing here is trusted to keep anyone out.
 */

import type { MetricRow, Stage } from '../admin/format';
import { supabase } from './client';

export interface AdminStats {
  today: string;
  users: { total: number; today: number; week: number; month: number };
  signups_by_day: number[];
  loggers: { today: number; week: number; month: number };
  loggers_by_day: number[];
  meals_by_day: number[];
  activation: { joined: number; logged: number };
  retention: { joined: number; returned: number };
  engine: {
    runs_by_day: number[];
    week_runs: number;
    week_degraded: number;
    week_cached: number;
    week_median_ms: number | null;
  };
  premium: { paywall: boolean; gifted: number; paid: number };
}

export interface AdminUser {
  user_id: string;
  email: string;
  joined_at: string;
  last_active_at: string | null;
  days_logged: number;
  meals_logged: number;
  premium_source: 'gift' | 'subscription' | null;
  premium_ends_at: string | null;
}

export interface Creator {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  niche: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  stage: Stage;
  next_follow_up: string | null;
  grain_user_id: string | null;
  track_record: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** What the creator form edits. */
export type CreatorFields = Omit<Creator, 'id' | 'created_at' | 'updated_at'>;

export interface Touch {
  id: string;
  creator_id: string;
  happened_on: string;
  channel: string | null;
  summary: string;
  created_at: string;
}

function db() {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  return supabase;
}

const now = () => new Date().toISOString();

// ---- Stats and users ----------------------------------------------------------

export async function fetchStats(): Promise<AdminStats> {
  const { data, error } = await db().rpc('admin_stats');
  if (error) throw error;
  return data as AdminStats;
}

/** Up to 500 users, newest first. Search matches part of an email or an id. */
export async function fetchUsers(search: string): Promise<AdminUser[]> {
  const { data, error } = await db().rpc('admin_users', {
    search: search.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function giftPremium(
  userId: string,
  endsAt: string | null,
  note: string,
  grantedBy: string,
): Promise<void> {
  const { error } = await db()
    .from('premium_access')
    .upsert(
      {
        user_id: userId,
        source: 'gift',
        ends_at: endsAt,
        note: note.trim() || null,
        granted_by: grantedBy,
        updated_at: now(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

/** Removes a gift. A paid subscription is left alone. */
export async function removeGift(userId: string): Promise<void> {
  const { error } = await db()
    .from('premium_access')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'gift');
  if (error) throw error;
}

export async function setPaywall(on: boolean): Promise<void> {
  const { error } = await db()
    .from('app_settings')
    .update({ paywall_enabled: on, updated_at: now() })
    .eq('id', 1);
  if (error) throw error;
}

// ---- CRM ------------------------------------------------------------------------

export async function listCreators(): Promise<Creator[]> {
  const { data, error } = await db()
    .from('crm_creators')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Creator[];
}

/** Every snapshot for every creator. Small: a few per creator. */
export async function listMetrics(): Promise<MetricRow[]> {
  const { data, error } = await db().from('crm_metrics').select('*');
  if (error) throw error;
  return (data ?? []) as MetricRow[];
}

export async function saveCreator(
  fields: CreatorFields,
  id?: string,
): Promise<Creator> {
  const query = id
    ? db()
        .from('crm_creators')
        .update({ ...fields, updated_at: now() })
        .eq('id', id)
    : db().from('crm_creators').insert(fields);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as Creator;
}

/** Many new creators in one request: the import from a WhatsApp chat. */
export async function addCreators(rows: CreatorFields[]): Promise<Creator[]> {
  if (!rows.length) return [];
  const { data, error } = await db().from('crm_creators').insert(rows).select();
  if (error) throw error;
  return (data ?? []) as Creator[];
}

export async function deleteCreator(id: string): Promise<void> {
  const { error } = await db().from('crm_creators').delete().eq('id', id);
  if (error) throw error;
}

/** The same change to several creators at once: stage, follow up, and so on. */
export async function updateCreators(
  ids: string[],
  patch: Partial<CreatorFields>,
): Promise<void> {
  const { error } = await db()
    .from('crm_creators')
    .update({ ...patch, updated_at: now() })
    .in('id', ids);
  if (error) throw error;
}

export async function addMetrics(
  row: Omit<MetricRow, 'id' | 'created_at'>,
): Promise<MetricRow> {
  const { data, error } = await db()
    .from('crm_metrics')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as MetricRow;
}

export async function listTouches(creatorId: string): Promise<Touch[]> {
  const { data, error } = await db()
    .from('crm_touches')
    .select('*')
    .eq('creator_id', creatorId)
    .order('happened_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Touch[];
}

/** Every touch for every creator, newest first. Small: a few per creator. */
export async function listAllTouches(): Promise<Touch[]> {
  const { data, error } = await db()
    .from('crm_touches')
    .select('*')
    .order('happened_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Touch[];
}

export async function addTouch(
  row: Omit<Touch, 'id' | 'created_at'>,
): Promise<Touch> {
  const { data, error } = await db()
    .from('crm_touches')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as Touch;
}

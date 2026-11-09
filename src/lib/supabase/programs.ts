/**
 * supabase/programs.ts: programs people write, find by code and follow.
 *
 * Programs and follows live only in the account (they are shared between
 * people). The program someone follows is also kept on the device, so the
 * Train tab shows today's day at once and offline.
 */

import { deviceKey } from '../kv';
import type { Exercise } from '../train/exercises';
import {
  cleanCode,
  newCode,
  type Follow,
  type MealPlan,
  type Program,
  type ProgramDay,
} from '../train/program';
import { supabase } from './client';

interface ProgramRow {
  id: string;
  owner_id: string;
  code: string;
  title: string;
  author_name: string;
  description: string;
  weeks: number;
  days: ProgramDay[] | null;
  nutrition: MealPlan | null;
  exercises: Exercise[] | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface FollowRow {
  id: string;
  program_id: string;
  coach_id: string;
  display_name: string;
  share_stats: boolean;
  stats: unknown;
  stats_at: string | null;
  started_at: string;
}

export interface Following {
  follow: Follow;
  program: Program;
}

const toProgram = (r: ProgramRow): Program => ({
  id: r.id,
  ownerId: r.owner_id,
  code: r.code,
  title: r.title,
  authorName: r.author_name,
  description: r.description,
  weeks: r.weeks,
  days: Array.isArray(r.days) ? r.days : [],
  nutrition: r.nutrition ?? null,
  exercises: Array.isArray(r.exercises) ? r.exercises : [],
  published: r.published,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toFollow = (r: FollowRow): Follow => ({
  id: r.id,
  programId: r.program_id,
  coachId: r.coach_id,
  displayName: r.display_name,
  shareStats: r.share_stats,
  stats: r.stats,
  statsAt: r.stats_at,
  startedAt: r.started_at,
});

function client() {
  if (!supabase) throw new Error('Programs need an account.');
  return supabase;
}

async function myId(): Promise<string> {
  const { data } = await client().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Sign in first.');
  return id;
}

// Device copy of the followed program

const cacheKey = () => deviceKey('follow.v1');

function storage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** The followed program as last seen, or null. Instant and offline. */
export function cachedFollowing(): Following | null {
  try {
    const raw = storage()?.getItem(cacheKey());
    return raw ? (JSON.parse(raw) as Following) : null;
  } catch {
    return null;
  }
}

function cache(f: Following | null): void {
  try {
    if (f) storage()?.setItem(cacheKey(), JSON.stringify(f));
    else storage()?.removeItem(cacheKey());
  } catch {
    // Storage blocked: the account copy is read again next time.
  }
}

// Programs

/** Programs the signed in user wrote, newest change first. */
export async function myPrograms(): Promise<Program[]> {
  const db = client();
  const { data, error } = await db
    .from('programs')
    .select('*')
    .eq('owner_id', await myId())
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as ProgramRow[]).map(toProgram);
}

/** A program by its share code, if it is published (or yours, or followed). */
export async function findProgram(code: string): Promise<Program | null> {
  const clean = cleanCode(code);
  if (clean.length !== 6) return null;
  const { data, error } = await client()
    .from('programs')
    .select('*')
    .eq('code', clean)
    .maybeSingle();
  if (error) throw error;
  return data ? toProgram(data as ProgramRow) : null;
}

export async function getProgram(id: string): Promise<Program | null> {
  const { data, error } = await client()
    .from('programs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toProgram(data as ProgramRow) : null;
}

/**
 * Creates or updates a program. A new one gets a fresh code if its code is
 * already taken (one in a billion, but cheap to handle).
 */
export async function saveProgram(p: Program): Promise<Program> {
  const db = client();
  const fields = {
    title: p.title,
    author_name: p.authorName,
    description: p.description,
    weeks: p.weeks,
    days: p.days,
    nutrition: p.nutrition,
    exercises: p.exercises,
    published: p.published,
  };
  if (p.id) {
    const { data, error } = await db
      .from('programs')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', p.id)
      .select('*')
      .single();
    if (error) throw error;
    return toProgram(data as ProgramRow);
  }
  let code = p.code;
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await db
      .from('programs')
      .insert({ ...fields, code })
      .select('*')
      .single();
    if (!error) return toProgram(data as ProgramRow);
    if (error.code !== '23505' || attempt >= 4) throw error;
    code = newCode();
  }
}

/** Deletes a program; everyone following it stops following. */
export async function deleteProgram(id: string): Promise<void> {
  const { error } = await client().from('programs').delete().eq('id', id);
  if (error) throw error;
}

/** How many people follow each of your programs, sharing or not. */
export async function followerCounts(): Promise<Map<string, number>> {
  const { data, error } = await client().rpc('my_program_followers');
  if (error) throw error;
  return new Map(
    ((data ?? []) as { program_id: string; followers: number }[]).map((r) => [
      r.program_id,
      r.followers,
    ]),
  );
}

/** Followers of one of your programs who chose to share their summary. */
export async function sharingFollowers(programId: string): Promise<Follow[]> {
  const db = client();
  const { data, error } = await db
    .from('follows')
    .select('*')
    .eq('program_id', programId)
    .eq('coach_id', await myId())
    .eq('share_stats', true)
    .order('display_name');
  if (error) throw error;
  return (data as FollowRow[]).map(toFollow);
}

// Following

/** The program the signed in user follows, from the account. */
export async function loadFollowing(): Promise<Following | null> {
  const db = client();
  const { data, error } = await db
    .from('follows')
    .select('*, program:programs(*)')
    .eq('follower_id', await myId())
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data as (FollowRow & { program: ProgramRow | null })[])[0];
  const f = row?.program
    ? { follow: toFollow(row), program: toProgram(row.program) }
    : null;
  cache(f);
  return f;
}

/** Follows a published program by its code, replacing any other. */
export async function followProgram(
  code: string,
  share: boolean,
  name: string,
): Promise<Following> {
  const { error } = await client().rpc('follow_program', {
    p_code: cleanCode(code),
    p_share: share,
    p_name: name,
  });
  if (error) throw error;
  const f = await loadFollowing();
  if (!f) throw new Error('The program could not be loaded.');
  return f;
}

/** Changes sharing or the name the coach sees, or sends a new summary. */
export async function updateFollow(
  id: string,
  patch: { share?: boolean; name?: string; stats?: unknown },
): Promise<void> {
  const { error } = await client().rpc('update_follow', {
    p_id: id,
    p_share: patch.share ?? null,
    p_name: patch.name ?? null,
    p_stats: patch.stats ?? null,
  });
  if (error) throw error;
  const f = cachedFollowing();
  if (f?.follow.id !== id) return;
  // The same rule the database applies: no sharing, no summary.
  const share = patch.share ?? f.follow.shareStats;
  const sent = share && patch.stats != null;
  cache({
    ...f,
    follow: {
      ...f.follow,
      shareStats: share,
      displayName: patch.name ?? f.follow.displayName,
      stats: share ? (sent ? patch.stats : f.follow.stats) : null,
      statsAt: share
        ? sent
          ? new Date().toISOString()
          : f.follow.statsAt
        : null,
    },
  });
}

export async function leaveProgram(id: string): Promise<void> {
  const { error } = await client().rpc('unfollow', { p_id: id });
  if (error) throw error;
  cache(null);
}

// Share links opened before signing in

const AFTER_SIGN_IN = 'grain.after_signin';

/**
 * Remembers the code of a program link opened while signed out. Signing in
 * with Google lands back on Home, which then opens the program.
 */
export function rememberProgramLink(pathname: string, search: string): void {
  if (pathname.replace(/\/$/, '') !== '/program') return;
  const code = cleanCode(new URLSearchParams(search).get('code') ?? '');
  if (code.length !== 6) return;
  try {
    storage()?.setItem(AFTER_SIGN_IN, code);
  } catch {
    // Storage blocked: they land on Home and can type the code.
  }
}

/** The remembered program code, once; null when there is none. */
export function takeProgramLink(): string | null {
  try {
    const code = cleanCode(storage()?.getItem(AFTER_SIGN_IN) ?? '');
    storage()?.removeItem(AFTER_SIGN_IN);
    return code.length === 6 ? code : null;
  } catch {
    return null;
  }
}

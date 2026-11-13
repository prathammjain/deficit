/**
 * crm.ts: the decisions behind the laptop CRM. Who needs you first, when
 * someone was last contacted, how fast they are growing, how the pipeline
 * converts, how big the roster is, sorting and CSV export. Pure, so all of
 * it is unit tested.
 */

import {
  STAGES,
  latestByPlatform,
  totalFollowers,
  type MetricRow,
  type Stage,
} from './format';

/** The creator fields these helpers read. */
export interface CreatorLike {
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
  created_at: string;
}

export interface TouchLike {
  creator_id: string;
  happened_on: string;
}

/** Whole days from one YYYY-MM-DD to another (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    +from.slice(0, 4),
    +from.slice(5, 7) - 1,
    +from.slice(8, 10),
  );
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** "today", "yesterday", "tomorrow", "3d ago", "in 5d". Empty for no day. */
export function relativeDay(day: string | null, today: string): string {
  if (!day) return '';
  const d = daysBetween(today, day);
  if (d === 0) return 'today';
  if (d === -1) return 'yesterday';
  if (d === 1) return 'tomorrow';
  return d < 0 ? `${-d}d ago` : `in ${d}d`;
}

/** The latest touch per creator. */
export function lastTouchByCreator(touches: TouchLike[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of touches) {
    const seen = out.get(t.creator_id);
    if (!seen || t.happened_on > seen) out.set(t.creator_id, t.happened_on);
  }
  return out;
}

/**
 * Follower change since each platform's previous snapshot, as a percent of
 * the earlier total. Only platforms with two snapshots count. Null when
 * there is nothing to compare.
 */
export function followerGrowth(rows: MetricRow[]): number | null {
  let now = 0;
  let before = 0;
  for (const { latest, previous } of latestByPlatform(rows)) {
    if (previous?.followers == null || latest.followers == null) continue;
    now += latest.followers;
    before += previous.followers;
  }
  if (!before) return null;
  return ((now - before) / before) * 100;
}

/** Engagement on the biggest platform, from its newest snapshot. */
export function engagement(rows: MetricRow[]): number | null {
  const top = latestByPlatform(rows)[0];
  return top?.latest.engagement_rate ?? null;
}

export const VIEWS = [
  { value: 'action', label: 'Needs action' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'all', label: 'All' },
  { value: 'roster', label: 'Roster' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'declined', label: 'Declined' },
] as const;
export type View = (typeof VIEWS)[number]['value'];

const ROSTER: Stage[] = ['onboarded', 'active', 'partner'];
const REPLIED_ON: Stage[] = ['replied', ...ROSTER];

/**
 * Whether a creator is waiting on you: a follow up due today or overdue, or
 * they replied and nothing is scheduled.
 */
export function needsAction(c: CreatorLike, today: string): boolean {
  if (c.stage === 'declined') return false;
  if (c.next_follow_up && c.next_follow_up <= today) return true;
  return c.stage === 'replied' && !c.next_follow_up;
}

/**
 * Waiting: a prospect nobody has started on yet. No touch logged and no
 * follow up set, which is how links from Telegram and imports arrive. Any
 * touch, follow up or stage change moves them on.
 */
export function isWaiting(c: CreatorLike, touched: boolean): boolean {
  return c.stage === 'prospect' && !c.next_follow_up && !touched;
}

export function inView(
  view: View,
  c: CreatorLike,
  today: string,
  /** Whether any touch is logged for them (only Waiting needs it). */
  touched = false,
): boolean {
  switch (view) {
    case 'action':
      return needsAction(c, today);
    case 'waiting':
      return isWaiting(c, touched);
    case 'all':
      return c.stage !== 'declined';
    case 'roster':
      return ROSTER.includes(c.stage);
    case 'prospects':
      return c.stage === 'prospect';
    case 'declined':
      return c.stage === 'declined';
  }
}

/**
 * How urgently someone needs you; lower comes first. Overdue, then due
 * today, then replied with nothing scheduled, then upcoming by date, then
 * no follow up, with declined last.
 */
export function urgency(c: CreatorLike, today: string): number {
  if (c.stage === 'declined') return 900;
  if (c.next_follow_up) {
    const d = daysBetween(today, c.next_follow_up);
    if (d < 0) return d; // more overdue sorts first
    if (d === 0) return 1;
    return 10 + Math.min(d, 365);
  }
  return c.stage === 'replied' ? 5 : 500;
}

/** One table row: the creator plus everything worked out about them. */
export interface CreatorRow<C extends CreatorLike = CreatorLike> {
  creator: C;
  followers: number;
  growth: number | null;
  engagement: number | null;
  lastTouch: string | null;
  urgency: number;
}

export function buildRows<C extends CreatorLike>(
  creators: C[],
  metrics: MetricRow[],
  touches: TouchLike[],
  today: string,
): CreatorRow<C>[] {
  const byCreator = new Map<string, MetricRow[]>();
  for (const m of metrics) {
    const list = byCreator.get(m.creator_id);
    if (list) list.push(m);
    else byCreator.set(m.creator_id, [m]);
  }
  const last = lastTouchByCreator(touches);
  return creators.map((c) => {
    const rows = byCreator.get(c.id) ?? [];
    return {
      creator: c,
      followers: totalFollowers(rows),
      growth: followerGrowth(rows),
      engagement: engagement(rows),
      lastTouch: last.get(c.id) ?? null,
      urgency: urgency(c, today),
    };
  });
}

export type SortKey =
  | 'urgency'
  | 'name'
  | 'stage'
  | 'followers'
  | 'growth'
  | 'engagement'
  | 'lastTouch'
  | 'followUp'
  | 'added'
  | 'niche';

/** The sort menu: every way the table can be ordered, in plain words. */
export const SORTS: { key: SortKey; dir: 1 | -1; label: string }[] = [
  { key: 'urgency', dir: 1, label: 'Needs you first' },
  { key: 'added', dir: -1, label: 'Newest added' },
  { key: 'added', dir: 1, label: 'Oldest added' },
  { key: 'followers', dir: -1, label: 'Most followers' },
  { key: 'followers', dir: 1, label: 'Fewest followers' },
  { key: 'growth', dir: -1, label: 'Fastest growing' },
  { key: 'engagement', dir: -1, label: 'Best engagement' },
  { key: 'niche', dir: 1, label: 'Niche, A to Z' },
  { key: 'name', dir: 1, label: 'Name, A to Z' },
  { key: 'stage', dir: 1, label: 'Stage' },
  { key: 'lastTouch', dir: -1, label: 'Contacted most recently' },
  { key: 'followUp', dir: 1, label: 'Next follow up' },
];

/** Missing values always sort last, whichever way the column runs. */
function compareMaybe<T>(
  a: T | null,
  b: T | null,
  cmp: (x: T, y: T) => number,
  dir: 1 | -1,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return cmp(a, b) * dir;
}

const num = (x: number, y: number) => x - y;
const text = (x: string, y: string) => x.localeCompare(y);

export function sortRows<C extends CreatorLike>(
  rows: CreatorRow<C>[],
  key: SortKey,
  dir: 1 | -1,
): CreatorRow<C>[] {
  const by: Record<SortKey, (a: CreatorRow<C>, b: CreatorRow<C>) => number> = {
    urgency: (a, b) => (a.urgency - b.urgency) * dir,
    name: (a, b) => text(a.creator.name, b.creator.name) * dir,
    stage: (a, b) =>
      (STAGES.indexOf(a.creator.stage) - STAGES.indexOf(b.creator.stage)) * dir,
    followers: (a, b) => (a.followers - b.followers) * dir,
    growth: (a, b) => compareMaybe(a.growth, b.growth, num, dir),
    engagement: (a, b) => compareMaybe(a.engagement, b.engagement, num, dir),
    lastTouch: (a, b) => compareMaybe(a.lastTouch, b.lastTouch, text, dir),
    followUp: (a, b) =>
      compareMaybe(
        a.creator.next_follow_up,
        b.creator.next_follow_up,
        text,
        dir,
      ),
    added: (a, b) => text(a.creator.created_at, b.creator.created_at) * dir,
    niche: (a, b) =>
      compareMaybe(a.creator.niche || null, b.creator.niche || null, text, dir),
  };
  // Ties fall back to the biggest audience, then the name.
  return [...rows].sort(
    (a, b) =>
      by[key](a, b) ||
      b.followers - a.followers ||
      text(a.creator.name, b.creator.name),
  );
}

/** Counts per stage, and how the pipeline converts. */
export function funnel(creators: CreatorLike[]): {
  counts: Record<Stage, number>;
  reached: number;
  replied: number;
  onboarded: number;
  /** Of everyone contacted, the share who replied. Null before anyone is. */
  replyRate: number | null;
} {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<
    Stage,
    number
  >;
  for (const c of creators) counts[c.stage]++;
  const reached = creators.filter((c) => c.stage !== 'prospect').length;
  const replied = creators.filter((c) => REPLIED_ON.includes(c.stage)).length;
  const onboarded = creators.filter((c) => ROSTER.includes(c.stage)).length;
  return {
    counts,
    reached,
    replied,
    onboarded,
    replyRate: reached ? replied / reached : null,
  };
}

/** Followers across everyone onboarded, active or a partner. */
export function rosterReach(rows: CreatorRow[]): number {
  return rows
    .filter((r) => ROSTER.includes(r.creator.stage))
    .reduce((sum, r) => sum + r.followers, 0);
}

/** A CSV file's text, quoting whatever needs it. */
export function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

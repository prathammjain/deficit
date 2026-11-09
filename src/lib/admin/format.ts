/**
 * format.ts: the pure parts of the admin screens. Counts the way platforms
 * show them, growth between two snapshots, CRM stages, follow ups and gift
 * lengths. No React and no network, so all of it is unit tested.
 */

export const STAGES = [
  'prospect',
  'contacted',
  'replied',
  'onboarded',
  'active',
  'partner',
  'declined',
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  replied: 'Replied',
  onboarded: 'Onboarded',
  active: 'Active',
  partner: 'Partner',
  declined: 'Declined',
};

export const PLATFORMS = ['instagram', 'youtube', 'x', 'other'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  other: 'Other',
};

/** One metrics snapshot, as stored in `crm_metrics`. */
export interface MetricRow {
  id: string;
  creator_id: string;
  platform: string;
  recorded_on: string;
  followers: number | null;
  reach: number | null;
  weekly_views: number | null;
  total_views: number | null;
  engagement_rate: number | null;
  created_at: string;
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** 950 → "950", 48200 → "48.2k", 1250000 → "1.25M". */
export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'none';
  const a = Math.abs(n);
  if (a < 1000) return String(Math.round(n));
  if (a < 1_000_000) return `${trim(n / 1000, a < 10_000 ? 2 : 1)}k`;
  return `${trim(n / 1_000_000, 2)}M`;
}

/**
 * Reads a count the way platforms display it: "48.2K", "1,250", "1.2M".
 * NaN when the text isn't a count.
 */
export function parseCount(text: string): number {
  const m = /^\s*([\d,]*\.?\d+)\s*([kKmM]?)\s*$/.exec(text);
  if (!m) return NaN;
  const base = Number(m[1].replace(/,/g, ''));
  const mult = /k/i.test(m[2]) ? 1000 : /m/i.test(m[2]) ? 1_000_000 : 1;
  return Math.round(base * mult);
}

/** "up 1.2k", "down 300" or "no change". Null without both numbers. */
export function growth(
  latest: number | null,
  previous: number | null,
): string | null {
  if (latest == null || previous == null) return null;
  const d = latest - previous;
  if (d === 0) return 'no change';
  return `${d > 0 ? 'up' : 'down'} ${compact(Math.abs(d))}`;
}

const newestFirst = (a: MetricRow, b: MetricRow) =>
  b.recorded_on.localeCompare(a.recorded_on) ||
  b.created_at.localeCompare(a.created_at);

/**
 * The newest snapshot per platform, each with the one before it, biggest
 * audience first.
 */
export function latestByPlatform(
  rows: MetricRow[],
): { latest: MetricRow; previous: MetricRow | null }[] {
  const byPlatform = new Map<string, MetricRow[]>();
  for (const r of [...rows].sort(newestFirst)) {
    const list = byPlatform.get(r.platform) ?? [];
    list.push(r);
    byPlatform.set(r.platform, list);
  }
  return [...byPlatform.values()]
    .map((list) => ({ latest: list[0], previous: list[1] ?? null }))
    .sort((a, b) => (b.latest.followers ?? 0) - (a.latest.followers ?? 0));
}

/** Followers across every platform, newest snapshot of each. */
export function totalFollowers(rows: MetricRow[]): number {
  return latestByPlatform(rows).reduce(
    (sum, p) => sum + (p.latest.followers ?? 0),
    0,
  );
}

/** Where a follow up stands against today (both YYYY-MM-DD). */
export function followUp(
  date: string | null,
  today: string,
): 'overdue' | 'today' | 'later' | null {
  if (!date) return null;
  if (date < today) return 'overdue';
  return date === today ? 'today' : 'later';
}

/** A YYYY-MM-DD some days after another, for the quick follow up buttons. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** True for a real calendar day written as YYYY-MM-DD. */
export function isDay(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  return addDays(text, 0) === text;
}

export const GIFT_LENGTHS: { label: string; months: number | null }[] = [
  { label: 'No end date', months: null },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '12 months', months: 12 },
];

/** When a gift of this length ends (ISO), or null for no end date. */
export function giftEndsAt(
  months: number | null,
  now: Date = new Date(),
): string | null {
  if (months == null) return null;
  const end = new Date(now);
  end.setMonth(end.getMonth() + months);
  return end.toISOString();
}

/** "63% (25 of 40)", or "no one yet" when there is nobody to count. */
export function share(part: number, whole: number): string {
  if (!whole) return 'no one yet';
  return `${Math.round((part / whole) * 100)}% (${part} of ${whole})`;
}

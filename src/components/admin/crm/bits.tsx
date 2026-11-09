/**
 * bits.tsx: small pieces the laptop CRM screens share. Plain web elements:
 * these files only load on the web, where a native select is the fastest,
 * most keyboard friendly control there is.
 */

import { STAGES, STAGE_LABEL, addDays, type Stage } from '@/lib/admin/format';
import { daysBetween, relativeDay } from '@/lib/admin/crm';

import css from './crm.module.css';

/** Joins class names, skipping the empty ones. */
export const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ');

/** True while the user is typing somewhere, so shortcuts stay out of the way. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

export function Kbd({ children }: { children: string }) {
  return <span className={css.kbd}>{children}</span>;
}

export function StageSelect({
  value,
  onChange,
}: {
  value: Stage;
  onChange: (stage: Stage) => void;
}) {
  return (
    <select
      className={css.stage}
      data-stage={value}
      value="current"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        if (e.target.value !== 'current') onChange(e.target.value as Stage);
      }}
    >
      {/* The closed pill shows the plain stage; the list shows each stage
          with the number key that sets it. */}
      <option value="current" hidden>
        {STAGE_LABEL[value]}
      </option>
      {STAGES.map((s, i) => (
        <option key={s} value={s}>
          {i + 1} {STAGE_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export const FOLLOW_UPS: { days: number | null; label: string }[] = [
  { days: 0, label: 'Today' },
  { days: 1, label: 'Tomorrow' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In a week' },
  { days: 14, label: 'In 2 weeks' },
  { days: null, label: 'None' },
];

/** The follow up day for a quick option, or null for none. */
export const followUpDay = (days: number | null, today: string) =>
  days == null ? null : addDays(today, days);

/** How a follow up reads in the table: "overdue 2d", "today", "in 3d". */
export function followText(day: string | null, today: string): string {
  if (!day) return 'none';
  if (day < today) return `overdue ${daysBetween(day, today)}d`;
  return relativeDay(day, today);
}

/**
 * Follow up as a select: it shows the current day, and picking an option
 * sets a new one.
 */
export function FollowSelect({
  value,
  today,
  onChange,
}: {
  value: string | null;
  today: string;
  onChange: (day: string | null) => void;
}) {
  const hot = value != null && value <= today;
  return (
    <select
      className={cx(css.follow, hot && css.followHot, !value && css.followNone)}
      value="current"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const f = FOLLOW_UPS[Number(e.target.value)];
        if (f) onChange(followUpDay(f.days, today));
      }}
    >
      <option value="current" hidden>
        {followText(value, today)}
      </option>
      {FOLLOW_UPS.map((f, i) => (
        <option key={f.label} value={i}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

/** A tiny line of followers over time. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="#191715"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A creator's profile link on their platform, when the handle allows it. */
export function profileUrl(
  platform: string | null,
  handle: string | null,
): string | null {
  const h = handle?.trim().replace(/^@/, '');
  if (!h || /\s/.test(h)) return null;
  if (platform === 'instagram') return `https://instagram.com/${h}`;
  if (platform === 'youtube') return `https://youtube.com/@${h}`;
  if (platform === 'x') return `https://x.com/${h}`;
  return null;
}

/** Hands the browser a file to save. */
export function downloadFile(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

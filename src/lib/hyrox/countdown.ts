/**
 * countdown.ts: days to race day, in words. Pure.
 */

export interface Countdown {
  /** Days from today to the race; negative once it has passed. */
  days: number;
  /** The big line: "23 days", "Tomorrow", "Race day". */
  headline: string;
  /** A smaller line under it, or null. */
  detail: string | null;
}

const DAY_MS = 86_400_000;
const dayIndex = (iso: string) =>
  Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

export function countdown(raceDate: string, today: string): Countdown {
  const days = dayIndex(raceDate) - dayIndex(today);
  if (days < 0) {
    return {
      days,
      headline: 'Race done',
      detail: 'Set your next race to count down to it.',
    };
  }
  if (days === 0) {
    return { days, headline: 'Race day', detail: 'Trust the training.' };
  }
  if (days === 1) return { days, headline: 'Tomorrow', detail: null };
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  return {
    days,
    headline: `${days} days`,
    detail:
      weeks >= 2
        ? `${weeks} weeks${rest ? ` and ${rest} ${rest === 1 ? 'day' : 'days'}` : ''}`
        : null,
  };
}

/** Present date for screen headers, e.g. "Wed, 9 Jul 2026" (local time). */
export function formatToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

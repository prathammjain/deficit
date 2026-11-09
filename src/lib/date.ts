/** Present date for screen headers, e.g. "Wed, 9 Jul 2026" (local time). */
export function formatToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * A day as "8 Feb 2027". Takes a timestamp, or a plain YYYY-MM-DD, which is
 * read as that local day rather than as UTC midnight.
 */
export function shortDate(value: string): string {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = plain
    ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]))
    : new Date(value);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

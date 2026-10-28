/**
 * week-report.ts — the numbers on the shareable weekly card. Pure, so they
 * are unit tested; drawing the card lives in week-card.ts.
 */

import {
  summarizeHistory,
  type DayRecord,
  type HistoryTargets,
} from './history-stats';

export interface WeekReport {
  /** First and last day covered, YYYY-MM-DD. */
  from: string;
  to: string;
  daysLogged: number;
  /** Sum of maintenance minus intake over logged days; negative is a surplus. */
  totalDeficitKcal: number;
  /** Fat the deficit is worth, in kg (negative for a surplus). */
  estFatLossKg: number;
  avgKcal: number | null;
  targetKcal: number;
  /** Logged days that reached the protein target. */
  proteinDays: number;
  avgProteinG: number | null;
  /** Last weigh in minus first, within the week. */
  weightChangeKg: number | null;
}

/** The report for the last seven days of `days` (oldest first). */
export function weekReport(days: DayRecord[], t: HistoryTargets): WeekReport {
  const week = days.slice(-7);
  const s = summarizeHistory(week, t);
  return {
    from: week[0]?.date ?? '',
    to: week[week.length - 1]?.date ?? '',
    daysLogged: s.daysLogged,
    totalDeficitKcal: s.totalDeficitKcal,
    estFatLossKg: s.estFatLossKg,
    avgKcal: s.avgKcal,
    targetKcal: t.targetKcal,
    proteinDays: week.filter((d) => d.logged && d.proteinG >= t.proteinG)
      .length,
    avgProteinG: s.avgProteinG,
    weightChangeKg: s.weightChangeKg,
  };
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "22 to 28 Oct", or "29 Sep to 5 Oct" across a month boundary. */
export function formatWeekRange(from: string, to: string): string {
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  return fm === tm
    ? `${fd} to ${td} ${MONTHS[tm - 1]}`
    : `${fd} ${MONTHS[fm - 1]} to ${td} ${MONTHS[tm - 1]}`;
}

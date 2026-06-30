import { StyleSheet } from 'react-native';

import { palette, radius, space, type as typo } from '@/constants/palette';

/** Shared styles for the History feature (journey dashboard + day-by-day list). */
export const st = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  rangePill: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    alignItems: 'center',
  },
  rangePillActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentBorder,
  },
  rangeText: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  rangeTextActive: { color: palette.accent },

  emptyCard: { marginTop: space.xl, gap: space.sm },
  emptyTitle: { ...typo.heading, color: palette.text },
  emptyText: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },

  heroCard: {
    marginTop: space.xl,
    shadowColor: palette.accent,
    shadowOpacity: 0.3,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
  },
  heroLabel: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    marginTop: space.sm,
  },
  heroNumber: { ...typo.hero, fontSize: 48, color: palette.text },
  heroUnit: { color: palette.textFaint, fontSize: 16, fontWeight: '600' },
  heroSub: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xl,
  },
  heroStat: { flex: 1 },
  heroStatValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroStatLabel: { color: palette.textFaint, fontSize: 11, marginTop: space.xxs },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: palette.hairline,
    marginHorizontal: space.md,
  },

  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  statBig: { ...typo.stat, fontSize: 24, color: palette.text },
  statUnit: { color: palette.textFaint, fontSize: 12, marginTop: 2 },

  legend: { alignItems: 'flex-end', gap: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: palette.textFaint, fontSize: 11 },

  weightDelta: { fontSize: 16, fontWeight: '700' },

  splitBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: palette.surface2,
  },
  macroRow: { flexDirection: 'row', marginTop: space.lg },
  macroCell: { flex: 1 },
  macroCellHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { color: palette.textFaint, fontSize: 12 },
  macroValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  macroSub: { color: palette.textFaint, fontSize: 12, fontWeight: '500' },

  dayCard: { marginTop: space.xs, overflow: 'hidden' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  dayRowBorder: { borderTopWidth: 1, borderTopColor: palette.hairline },
  dayDate: { width: 40, alignItems: 'center' },
  dayNum: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dayMon: {
    color: palette.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dayMain: { flex: 1, gap: space.xs },
  dayTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  dayWeekday: { color: palette.textFaint, fontSize: 12, fontWeight: '600' },
  dayKcal: { color: palette.text, fontSize: 15, fontWeight: '700' },
  dayKcalUnit: { color: palette.textFaint, fontSize: 11, fontWeight: '600' },
  dayBarTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.surface2,
    overflow: 'hidden',
  },
  dayBarFill: { height: 4, borderRadius: radius.pill },
  dayMacros: { color: palette.textFaint, fontSize: 11, letterSpacing: 0.2 },
  dayRight: { alignItems: 'flex-end', minWidth: 52 },
  dayDeficit: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  dayDeficitLabel: { color: palette.textDim, fontSize: 10, marginTop: space.xxs },
  footnote: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 17,
    marginTop: space.xl,
  },
});

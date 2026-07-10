import { StyleSheet } from 'react-native';

import { palette, radius, space, type as typo } from '@/constants/palette';

/** Shared styles for the History feature (journey dashboard + month calendar). */
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
    borderColor: palette.hairline,
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
  },
  heroLabel: {
    ...typo.label,
    color: palette.textMuted,
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
    color: palette.textMuted,
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
    fontVariant: ['tabular-nums'],
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
  statBig: {
    ...typo.stat,
    fontSize: 24,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
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
    fontVariant: ['tabular-nums'],
  },
  macroSub: { color: palette.textFaint, fontSize: 12, fontWeight: '500' },

  footnote: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 17,
    marginTop: space.xl,
  },

  // ---- Month calendar ----
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  calNavBtn: { width: 32, alignItems: 'center' },
  calNav: { color: palette.accent, fontSize: 24, fontWeight: '700' },
  calNavOff: { color: palette.textDim },
  calMonth: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  calWeekRow: { flexDirection: 'row', marginBottom: space.sm },
  calWeekCell: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: palette.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayToday: { borderWidth: 1.5, borderColor: palette.accentBorder },
  calDaySel: { backgroundColor: palette.accent },
  calDayNum: { color: palette.text, fontSize: 14, fontWeight: '600' },
  calDayNumFaint: { color: palette.textDim, fontWeight: '500' },
  calDayNumSel: { color: palette.accentText, fontWeight: '700' },
  calDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
  calDotOn: { backgroundColor: palette.accent },
  calDivider: { marginTop: space.lg, marginBottom: space.lg },

  calSumTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  calSumDate: { color: palette.text, fontSize: 15, fontWeight: '700' },
  calSumDeficit: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  calSumDeficitUnit: {
    color: palette.textFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  calSumKcalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.md,
    marginBottom: space.sm,
  },
  calSumKcal: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  calSumKcalUnit: {
    color: palette.textFaint,
    fontSize: 13,
    fontWeight: '600',
  },
  calSumWeight: { color: palette.textFaint, fontSize: 13, fontWeight: '600' },
  calMacros: { flexDirection: 'row', marginTop: space.lg },
  calMacro: { flex: 1 },
  calMacroHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  calMacroDot: { width: 8, height: 8, borderRadius: 4 },
  calMacroLabel: { color: palette.textFaint, fontSize: 12 },
  calMacroValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  calEmpty: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: space.sm,
  },
});

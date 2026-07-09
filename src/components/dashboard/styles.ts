import { StyleSheet } from 'react-native';

import { palette, radius, space, type as typo } from '@/constants/palette';

/** Shared styles for the Dashboard (home) feature. */
export const st = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editLink: { color: palette.accent, fontSize: 14, fontWeight: '600' },
  dateLine: {
    ...typo.label,
    color: palette.textFaint,
    marginTop: space.xs,
  },

  heroCard: {
    marginTop: space.lg,
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
  heroNumber: { ...typo.hero, fontSize: 56, color: palette.text },
  heroUnit: { color: palette.textFaint, fontSize: 17, fontWeight: '600' },
  heroDivider: { marginVertical: space.lg },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1 },
  heroStatValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroStatLabel: {
    color: palette.textFaint,
    fontSize: 12,
    marginTop: space.xxs,
    letterSpacing: 0.2,
  },
  heroStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: palette.hairline,
    marginHorizontal: space.lg,
  },
  tile: { flex: 1, alignItems: 'center', paddingVertical: space.lg },
  tileLabel: {
    color: palette.textFaint,
    fontSize: 12,
    marginTop: space.sm,
    letterSpacing: 0.2,
  },
  macroRow: { flexDirection: 'row', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: space.sm },
  macroGrams: { ...typo.stat, fontSize: 22, color: palette.text },

  weighCard: {},
  weighRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  weighInput: {
    flex: 1,
    minWidth: 0, // let the field shrink so the unit + Save stay on-screen (RNW)
    color: palette.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    padding: 0,
  },
  weighUnit: { color: palette.textFaint, fontSize: 16, marginRight: space.sm },
  weighBtn: { paddingHorizontal: space.xl },
  weighHint: {
    color: palette.textFaint,
    fontSize: 13,
    marginTop: space.md,
    lineHeight: 18,
  },

  adaptiveLead: {
    ...typo.heading,
    color: palette.text,
    fontSize: 16,
  },
  adaptiveBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.sm,
  },
  adaptiveProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
  adaptiveProgressText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  adaptiveProgressDot: { color: palette.textDim },
  adaptiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceChip: {
    backgroundColor: palette.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  confidenceText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  adaptiveBig: { marginTop: space.lg },
  adaptiveTdee: { ...typo.stat, fontSize: 40, color: palette.text },
  adaptiveTdeeUnit: { color: palette.textFaint, fontSize: 13, marginTop: 2 },
  adaptiveStatsRow: {
    flexDirection: 'row',
    gap: space.xl,
    marginTop: space.lg,
  },
  adaptiveStat: {},
  adaptiveStatValue: { fontSize: 17, fontWeight: '600' },
  adaptiveStatLabel: { color: palette.textFaint, fontSize: 12, marginTop: 2 },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.lg,
  },
  suggestLabel: { color: palette.textMuted, fontSize: 14 },
  suggestValue: { color: palette.accent, fontSize: 18, fontWeight: '700' },

  metaCard: { marginTop: space.xl, paddingHorizontal: space.xl },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.lg,
  },
  metaDivider: { marginVertical: 0 },
  metaLabel: { color: palette.textMuted, fontSize: 14 },
  metaValue: { color: palette.text, fontSize: 14, fontWeight: '600' },

  safety: {
    color: palette.warn,
    fontSize: 14,
    marginTop: space.xl,
    lineHeight: 20,
  },
  disclaimer: {
    color: palette.textDim,
    fontSize: 12,
    marginTop: space.xl,
    lineHeight: 18,
  },

  // ---- "This week" prediction card ----
  weekTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekLabel: { ...typo.label, color: palette.textMuted },
  weekValue: { ...typo.stat, color: palette.text, marginTop: space.sm },
  weekGoal: { color: palette.textFaint, fontSize: 12, marginTop: space.xxs },
  weekBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.sm,
  },
  weekDots: { flexDirection: 'row', gap: space.xs + 2 },
  weekDot: { width: 8, height: 8, borderRadius: 4 },
  weekDotOn: { backgroundColor: palette.text },
  weekDotOff: { borderWidth: 1, borderColor: palette.hairline },
});

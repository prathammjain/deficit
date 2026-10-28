import { StyleSheet } from 'react-native';

import { palette, radius, space, type as typo } from '@/constants/palette';

/** Shared styles for the Log feature (daily-log screen + meal composer/rows). */
export const st = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: space.xl,
    marginBottom: space.md,
  },
  modeBtn: { paddingVertical: space.xs },
  modeText: { color: palette.textFaint, fontSize: 15, fontWeight: '600' },
  modeTextActive: { color: palette.text },

  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  engineDot: { width: 6, height: 6, borderRadius: 3 },
  engineText: { color: palette.textMuted, fontSize: 13 },
  sourceTag: { color: palette.textFaint, fontSize: 13 },
  loadingRoot: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  dateLine: { ...typo.label, color: palette.textFaint },

  noProfile: { marginTop: space.lg },
  noProfileText: { color: palette.textMuted, fontSize: 15, lineHeight: 21 },

  summaryCard: { marginTop: space.xl },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.lg,
  },
  remainingLabel: {
    ...typo.label,
    color: palette.textMuted,
  },
  remaining: {
    ...typo.hero,
    fontSize: 56,
    color: palette.accent,
    marginTop: 2,
  },
  consumed: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  consumedLabel: { color: palette.textFaint, fontSize: 10, marginTop: 1 },

  macroLine: {
    flexDirection: 'row',
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  macroStat: { flex: 1 },
  macroStatValue: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroStatLabel: { color: palette.textFaint, fontSize: 12, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: 16,
    paddingVertical: space.lg,
  },
  resultsCard: { marginTop: space.sm, overflow: 'hidden' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: palette.hairline },
  resultName: { color: palette.text, fontSize: 15, fontWeight: '600' },
  resultMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.md,
    marginTop: 2,
  },
  resultSub: { color: palette.textFaint, fontSize: 12 },
  resultKcal: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  describeCard: { gap: space.lg },
  describeInput: {
    color: palette.text,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 72,
    textAlignVertical: 'top',
    padding: 0,
  },
  describeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  calcBtn: { paddingHorizontal: space.xl, paddingVertical: space.md },

  voiceRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  micBtnLive: { backgroundColor: palette.accent, borderColor: palette.accent },
  voiceText: { flexShrink: 1, color: palette.textFaint, fontSize: 13 },
  voiceTextLive: { color: palette.accent, fontVariant: ['tabular-nums'] },
  breakdown: {
    gap: space.xs,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  changeHint: { color: palette.accent, fontSize: 13, fontWeight: '600' },
  confidence: { fontSize: 13, fontWeight: '500' },

  altPanel: {
    backgroundColor: palette.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginVertical: space.sm,
  },
  altReason: {
    color: palette.textFaint,
    fontSize: 12,
    paddingVertical: space.sm,
    lineHeight: 17,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  altRowBorder: { borderTopWidth: 1, borderTopColor: palette.hairline },
  altName: { color: palette.text, fontSize: 14, fontWeight: '500' },
  altSub: { color: palette.textFaint, fontSize: 12, marginTop: 1 },
  altKcal: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
  breakdownNote: { color: palette.warn, fontSize: 12, lineHeight: 17 },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
  },
  breakdownTotalLabel: { color: palette.textMuted, fontSize: 14 },
  breakdownTotalValue: { color: palette.text, fontSize: 15, fontWeight: '700' },
  breakdownTotalSub: { color: palette.textFaint, fontWeight: '500' },

  manualCard: { gap: space.md },
  manualLabelInput: {
    backgroundColor: palette.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: palette.text,
    fontSize: 15,
  },
  manualRow: { flexDirection: 'row', gap: space.sm },
  manualNumInput: {
    minWidth: 0, // shrink with flex:1 so the Add button stays on-screen (RNW)
    backgroundColor: palette.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: palette.text,
    fontSize: 15,
  },
  manualBtn: { paddingHorizontal: space.lg },

  empty: { color: palette.textDim, fontSize: 14, paddingVertical: space.sm },
  foodLine: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    gap: space.sm,
  },
  foodTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  foodName: {
    flexShrink: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  foodFlag: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.warn,
  },
  foodKcal: {
    marginLeft: 'auto',
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  foodBottom: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  foodMeta: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.md,
    rowGap: 2,
  },
  foodMetaText: { color: palette.textFaint, fontSize: 13 },
  // The icon's edge lines up with the calories above it.
  removeBtn: { padding: space.xs, marginRight: -space.xs },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: palette.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepBtn: { minWidth: 16, alignItems: 'center', justifyContent: 'center' },
  stepQty: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
    // Wide enough for "1000 g" / "250 ml". The stepper is right-aligned, so a
    // label that resizes as it steps ("100 g" to "5 g") would slide the minus
    // button out from under a thumb mid tap. Tabular digits keep the number
    // itself from shimmying inside that width.
    minWidth: 52,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

/**
 * palette.ts — the Deficit design system.
 *
 * Direction: ultra-premium, ultra-minimal. A near-black canvas, warm off-white
 * type, hairline separation instead of heavy borders, one restrained mint
 * accent reserved for the single most important thing on each screen. Big,
 * light-weight numerals; wide-tracked micro-labels; generous negative space.
 *
 * Existing color keys are kept so older screens keep working; values were
 * refined and new tokens (hairline, surface2, accentSoft, positive/negative,
 * the `space` / `radius` / `type` scales) were added.
 */

export const palette = {
  // Canvas & surfaces (elevation by subtle lightening, not borders)
  bg: '#08080A',
  bgElevated: '#0D0D10',
  surface: '#131316',
  surface2: '#1A1A1E',
  surfaceBorder: 'rgba(255,255,255,0.06)', // legacy alias for hairline
  hairline: 'rgba(255,255,255,0.07)',

  // Text
  text: '#F4F4F2',
  textMuted: '#9C9CA3',
  textFaint: '#67676E',
  textDim: '#43434A',

  // The one accent — refined mint, used sparingly
  accent: '#5EEAD4',
  accentSoft: 'rgba(94,234,212,0.12)',
  accentBorder: 'rgba(94,234,212,0.30)',
  accentText: '#04261F', // text/icon on an accent fill

  // Macro + semantic
  carb: '#9AA0AA',
  fat: '#F2A65A',
  protein: '#5EEAD4',
  warn: '#F4B740',
  danger: '#F2655F',
  negative: '#F2655F',
  good: '#5CD08A',
  positive: '#5CD08A',
} as const;

/** 4px base spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radii. Soft, not bubbly. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Type tokens used across screens for a consistent hierarchy. */
export const type = {
  /** Wide-tracked uppercase micro-label. */
  eyebrow: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 2.5 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  /** The single big number. Light weight + tight tracking reads premium. */
  hero: { fontSize: 76, fontWeight: '600' as const, letterSpacing: -3 },
  stat: { fontSize: 26, fontWeight: '600' as const, letterSpacing: -0.5 },
} as const;

export const maxContentWidth = 480;

export type Palette = typeof palette;

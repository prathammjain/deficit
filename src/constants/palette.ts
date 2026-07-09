/**
 * palette.ts — the Deficit design system: "Warm Instrument".
 *
 * Direction (see docs/superpowers/specs/2026-07-09-warm-instrument-redesign):
 * a warm bone canvas with near-black warm ink, content on soft outlined
 * warm-white cards (hairline + one low shadow). Near-monochrome: the ONLY hue
 * in the app is one vermillion orange — attention, the key number, the action
 * pill. Calm/good states are confident ink; loud means "look here". Macros are
 * ink tints (protein darkest), not colors. Hero numbers render in a dot-matrix
 * display face; everything else is a neutral grotesque with tiny utility
 * labels over strong values.
 *
 * Legacy keys (glass*, blob*, surface*Solid) are kept so every screen keeps
 * compiling; their values are remapped into this system.
 */

const INK = '25,23,21'; // #191715 warm ink, used at several alphas

export const palette = {
  // Canvas — warm bone, calm and unlit.
  bg: '#EDEAE4',
  bgElevated: '#F2F0EB',

  // Surfaces — raised warm-white cards and inset wells.
  surface: '#F7F5F1', // raised card
  surfaceSolid: '#F7F5F1',
  surface2: '#E7E4DD', // inset well (inputs, tracks, pressed)
  surface2Solid: '#E7E4DD',
  surfaceBorder: `rgba(${INK},0.12)`, // legacy alias for hairline
  hairline: `rgba(${INK},0.12)`,

  // Legacy glass keys — remapped to the outlined-card treatment.
  glass: '#F7F5F1',
  glassBorder: `rgba(${INK},0.12)`,
  glassHighlight: 'rgba(255,255,255,0.85)',
  glassDark: '#F7F5F1', // tab bar is warm white now

  // Background blobs are gone — the canvas is plain.
  blobA: 'transparent',
  blobB: 'transparent',
  blobC: 'transparent',

  // Text — warm ink steps.
  text: '#191715',
  textMuted: `rgba(${INK},0.60)`,
  textFaint: `rgba(${INK},0.38)`,
  textDim: `rgba(${INK},0.24)`,

  // The one color in the app — vermillion, sampled from the reference.
  accent: '#F4511E',
  accentSoft: 'rgba(244,81,30,0.10)',
  accentBorder: 'rgba(244,81,30,0.45)',
  accentText: '#FFFFFF',
  accentGlow: 'rgba(244,81,30,0.25)',

  // Macros are ink tints, not hues: protein carries the most weight.
  protein: '#191715',
  carb: `rgba(${INK},0.55)`,
  fat: `rgba(${INK},0.30)`,

  // Semantics: attention = orange, calm/good = ink. No green, no red.
  warn: '#F4511E',
  danger: '#F4511E',
  negative: '#F4511E',
  good: '#191715',
  positive: '#191715',
} as const;

/** 4px base spacing scale. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radii. Soft cards, full pills for actions. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

/**
 * Light-canvas elevation: one soft low umbra per level (plus the hairline
 * border cards carry). Warm-tinted so shadows don't go blue on the bone bg.
 */
export const shadow = {
  soft: {
    shadowColor: '#3D3831',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  card: {
    shadowColor: '#3D3831',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  raised: {
    shadowColor: '#3D3831',
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

/**
 * Type tokens — the references' voice: tiny utility labels over strong values,
 * heavy tight titles, and a dot-matrix display face for hero numerals only.
 * (Faces load in global.css on web: Inter app-wide, Doto via [data-font].)
 */
export const type = {
  /** Wide-tracked uppercase micro-label — brand + section markers. */
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.6 },
  /** Sentence-case card label — the "Current range" pattern. */
  label: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.1 },
  /** The "167 km" value under a label. */
  value: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  title: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  /** The dot-matrix hero numeral (pair with the DotMatrix primitive). */
  hero: { fontSize: 64, fontWeight: '900' as const, letterSpacing: 1 },
  stat: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
} as const;

export const maxContentWidth = 480;

export type Palette = typeof palette;

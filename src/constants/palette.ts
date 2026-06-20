/**
 * palette.ts — the Deficit design system.
 *
 * Direction: warm, light, Apple-glass. A soft cream canvas, near-black warm
 * type, content on rounded warm-white cards lifted by soft shadows (not
 * borders), and Apple-style glass on the floating chrome (tab bar, search/add
 * bar, hero). One restrained peach/terracotta accent carries emphasis — the
 * filled gauge, the active control, the key number. Bold numerals, generous
 * negative space.
 *
 * Existing color keys are kept so every screen keeps working off the same
 * tokens; only the values changed (dark → light) and `shadow` was added.
 */

export const palette = {
  // Canvas — deep charcoal→indigo night, lit from behind by color glows.
  bg: '#0F0D17', // deep indigo-charcoal canvas
  bgElevated: '#16131F',

  // Frosted DARK glass — white at low alpha over the dark canvas, so the color
  // glows bleed through. Solid variants for the rare opaque need.
  surface: 'rgba(255,255,255,0.11)', // frosted dark-glass card
  surfaceSolid: '#1A1726', // opaque dark panel
  surface2: 'rgba(255,255,255,0.075)', // frosted inset / secondary fill
  surface2Solid: '#221E30', // opaque inset
  surfaceBorder: 'rgba(255,255,255,0.10)', // legacy alias for hairline
  hairline: 'rgba(255,255,255,0.10)',

  // Glass — floating chrome (cards, tab bar, hero) with backdrop blur.
  glass: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.24)', // crisp light edge
  glassHighlight: 'rgba(255,255,255,0.38)', // top sheen
  glassDark: 'rgba(255,255,255,0.10)', // tab bar (frosted on dark)

  // Background color glows the frosted surfaces refract. Vivid on the dark base.
  blobA: 'rgba(244,169,104,0.62)', // neon peach (accent)
  blobB: 'rgba(123,108,246,0.58)', // indigo / violet
  blobC: 'rgba(232,104,150,0.46)', // rose

  // Text — near-white, warm.
  text: '#F5F2EC',
  textMuted: 'rgba(245,242,236,0.64)',
  textFaint: 'rgba(245,242,236,0.44)',
  textDim: 'rgba(245,242,236,0.26)',

  // The one accent — neon peach/amber, glowing on dark.
  accent: '#F4A968',
  accentSoft: 'rgba(244,169,104,0.22)',
  accentBorder: 'rgba(244,169,104,0.55)',
  accentText: '#221404', // dark text/icon on an accent fill
  accentGlow: 'rgba(244,169,104,0.45)', // for hero-card glow

  // Macro + semantic — brightened to read on dark glass.
  carb: '#CDBB95', // warm taupe
  fat: '#F2AC63', // amber
  protein: '#7FCBA8', // sage
  warn: '#E8B45C',
  danger: '#F26A60',
  negative: '#F26A60',
  good: '#76D89D',
  positive: '#76D89D',
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

/** Corner radii. Soft and rounded, Apple-like. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

/**
 * Elevation shadows for the dark theme. RN keys; react-native-web maps these to
 * box-shadow. Deep near-black drops give frosted cards their lift off the night
 * canvas (the crisp light borders + color glows do the rest).
 */
export const shadow = {
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    elevation: 14,
  },
} as const;

/** Type tokens used across screens for a consistent hierarchy. */
export const type = {
  /** Wide-tracked uppercase micro-label. */
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.6 },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  /** The single big number. Bold + tight tracking reads premium on light. */
  hero: { fontSize: 64, fontWeight: '800' as const, letterSpacing: -2 },
  stat: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
} as const;

export const maxContentWidth = 480;

export type Palette = typeof palette;

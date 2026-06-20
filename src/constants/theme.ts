/**
 * theme.ts — native navigation color tokens.
 *
 * `Colors.dark` drives the native tab bar (see app-tabs.tsx). The app is
 * dark-only; the full design system lives in `palette.ts`.
 */

export const Colors = {
  light: {
    text: '#221E1A',
    background: '#EFE7DC',
    backgroundElement: '#F1EADF',
    backgroundSelected: '#E3D9CB',
    textSecondary: '#6E665C',
  },
  dark: {
    text: '#F5F2EC',
    background: '#0F0D17',
    backgroundElement: '#1A1726',
    backgroundSelected: '#221E30',
    textSecondary: 'rgba(245,242,236,0.64)',
  },
} as const;

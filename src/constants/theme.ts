/**
 * theme.ts — native navigation color tokens.
 *
 * `Colors.dark` drives the native tab bar (see app-tabs.tsx). The app is
 * light-only ("Warm Instrument"); both entries carry the same warm values so
 * whichever the OS asks for renders the bone/ink skin. The full design system
 * lives in `palette.ts`.
 */

export const Colors = {
  light: {
    text: '#191715',
    background: '#EDEAE4',
    backgroundElement: '#F7F5F1',
    backgroundSelected: '#E7E4DD',
    textSecondary: 'rgba(25,23,21,0.60)',
  },
  dark: {
    text: '#191715',
    background: '#EDEAE4',
    backgroundElement: '#F7F5F1',
    backgroundSelected: '#E7E4DD',
    textSecondary: 'rgba(25,23,21,0.60)',
  },
} as const;

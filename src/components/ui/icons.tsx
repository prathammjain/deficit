/**
 * icons.tsx — the app's few line icons, drawn in one stroke weight so they
 * match the tab bar. Text glyphs (⌕ ✕ ＋ −) render differently in every font
 * and never sit on the text baseline, so the UI uses these instead.
 */

import Svg, { Path, Rect } from 'react-native-svg';

import { palette } from '@/constants/palette';

type Props = { size?: number; color?: string };

const line = (color: string) => ({
  stroke: color,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

export function SearchIcon({ size = 18, color = palette.textFaint }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20"
        {...line(color)}
      />
    </Svg>
  );
}

export function MicIcon({ size = 20, color = palette.text }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM6 11.5a6 6 0 0 0 12 0M12 17.5v3"
        {...line(color)}
      />
    </Svg>
  );
}

export function StopIcon({ size = 14, color = palette.accentText }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={5} width={14} height={14} rx={3} fill={color} />
    </Svg>
  );
}

export function CloseIcon({ size = 14, color = palette.textFaint }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6 6 18" {...line(color)} />
    </Svg>
  );
}

export function PlusIcon({ size = 14, color = palette.text }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" {...line(color)} />
    </Svg>
  );
}

export function MinusIcon({ size = 14, color = palette.text }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12h14" {...line(color)} />
    </Svg>
  );
}

export function ChevronIcon({
  size = 16,
  color = palette.text,
  direction = 'left',
}: Props & { direction?: 'left' | 'right' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        {...line(color)}
      />
    </Svg>
  );
}

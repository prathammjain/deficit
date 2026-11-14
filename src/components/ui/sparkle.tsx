/**
 * sparkle.tsx — GrainAI's mark: two four point stars. On the web they
 * twinkle (the keyframes live in global.css, keyed off data-sparkle, the
 * same way DotMatrix picks its font); anywhere else they sit still.
 */

import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { palette } from '@/constants/palette';

export function Sparkle({
  size = 16,
  color = palette.accent,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View {...({ dataSet: { sparkle: 'on' } } as any)}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M10 2.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5Z"
          fill={color}
        />
        <Path
          d="M18.5 14c.4 2.1 1.4 3.1 3.5 3.5-2.1.4-3.1 1.4-3.5 3.5-.4-2.1-1.4-3.1-3.5-3.5 2.1-.4 3.1-1.4 3.5-3.5Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

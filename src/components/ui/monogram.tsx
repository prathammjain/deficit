/**
 * monogram.tsx — the circular account mark: the first letter of the user's
 * email on a warm-white card circle. Small in headers (opens Profile), large
 * as the Profile hero. Falls back to "D" (Deficit) in local, no-account mode.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, shadow } from '@/constants/palette';

export function Monogram({
  letter,
  size = 34,
  style,
}: {
  letter?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const mark = (letter ?? 'D').trim().charAt(0).toUpperCase() || 'D';
  return (
    <View
      style={[
        s.circle,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[s.letter, { fontSize: size * 0.42 }]}>{mark}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  circle: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  letter: { color: palette.text, fontWeight: '700' },
});

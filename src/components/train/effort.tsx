/**
 * effort.tsx: "How hard was it?" for a whole session, 1 to 10 on Foster's
 * scale. One tap; it feeds the training load chart (see lib/train/load.ts).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, space } from '@/constants/palette';
import { rpeLabel, SESSION_RPE } from '@/lib/train/load';

import { tr } from './styles';

export function SessionRpe({
  value,
  onChange,
  title = 'How hard was it overall?',
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  title?: string;
}) {
  return (
    <View>
      <Text style={tr.label}>{title.toUpperCase()}</Text>
      <View style={rs.row} accessibilityRole="radiogroup">
        {SESSION_RPE.map(({ v }) => {
          const on = value === v;
          return (
            <Pressable
              key={v}
              onPress={() => onChange(on ? null : v)}
              accessibilityRole="radio"
              aria-checked={on}
              accessibilityLabel={`${v}, ${rpeLabel(v)}`}
              style={({ pressed }) => [
                rs.cell,
                on && rs.cellOn,
                pressed && tr.pressed,
              ]}
            >
              <Text style={[rs.num, on && rs.numOn]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[tr.faint, rs.hint]}>
        {value
          ? `${value}: ${rpeLabel(value)}`
          : '1 is very, very easy and 10 is all you had. Rate the whole session.'}
      </Text>
    </View>
  );
}

const rs = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginTop: space.sm },
  cell: {
    flex: 1,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface2,
  },
  cellOn: { backgroundColor: palette.text },
  num: { fontSize: 14, fontWeight: '700', color: palette.textMuted },
  numOn: { color: palette.surface },
  hint: { marginTop: space.sm },
});

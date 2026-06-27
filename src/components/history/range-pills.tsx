import { Pressable, Text, View } from 'react-native';

import { st } from './styles';

export const RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 365 },
];

export function RangePills({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <View style={st.rangeRow}>
      {RANGES.map((r) => {
        const active = r.days === value;
        return (
          <Pressable
            key={r.label}
            onPress={() => onChange(r.days)}
            style={[st.rangePill, active && st.rangePillActive]}
          >
            <Text style={[st.rangeText, active && st.rangeTextActive]}>
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

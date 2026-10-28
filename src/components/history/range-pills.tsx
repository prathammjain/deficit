import { Pressable, Text, View } from 'react-native';

import { st } from './styles';

export const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Year', days: 365 },
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
            style={st.rangePill}
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

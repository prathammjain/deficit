import { Pressable, Text, View } from 'react-native';

import { st } from './styles';

export const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Year', days: 365 },
];

/** A number of days, or everything since coming back from a break. */
export type Range = number | 'since';

export function RangePills({
  value,
  onChange,
  since,
}: {
  value: Range;
  onChange: (r: Range) => void;
  /** Label for the fresh start range ("Since 5 Nov"), when there is one. */
  since?: string | null;
}) {
  const options: { label: string; value: Range }[] = [
    ...(since ? [{ label: since, value: 'since' as const }] : []),
    ...RANGES.map((r) => ({ label: r.label, value: r.days })),
  ];
  return (
    <View style={[st.rangeRow, since ? st.rangeRowTight : null]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange(o.value)}
            style={st.rangePill}
            accessibilityRole="tab"
            aria-selected={active}
          >
            <Text style={[st.rangeText, active && st.rangeTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { Confidence } from '@/lib/food';

import { st } from './styles';

/** ± quantity control shared by the describe-breakdown and logged rows. */
export function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={st.stepper}>
      <Pressable
        onPress={() => onChange(value - 0.5)}
        hitSlop={8}
        style={st.stepBtn}
      >
        <Text style={st.stepText}>−</Text>
      </Pressable>
      <Text style={st.stepQty}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 0.5)}
        hitSlop={8}
        style={st.stepBtn}
      >
        <Text style={st.stepText}>＋</Text>
      </Pressable>
    </View>
  );
}

const CONFIDENCE: Record<Confidence, { label: string; color: string }> = {
  high: { label: '✓ good match', color: palette.good },
  medium: { label: '≈ likely', color: palette.textFaint },
  low: { label: '⚠ check this', color: palette.warn },
};

/** A tiny trust signal on each parsed item — never hide a guess. */
export function ConfidenceBadge({ confidence }: { confidence?: Confidence }) {
  if (!confidence) return null;
  const c = CONFIDENCE[confidence];
  return <Text style={[st.confidence, { color: c.color }]}>{c.label}</Text>;
}

export function MacroChip({
  text,
  color,
  muted,
}: {
  text: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <View style={st.chip}>
      {!muted ? (
        <View style={[st.chipDot, { backgroundColor: color }]} />
      ) : null}
      <Text style={[st.chipText, muted && { color: palette.fat }]}>{text}</Text>
    </View>
  );
}

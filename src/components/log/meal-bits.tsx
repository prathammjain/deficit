import { Pressable, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { Confidence } from '@/lib/food';

import { st } from './styles';

/**
 * ± quantity control shared by the describe-breakdown and logged rows.
 *
 * Deliberately dumb: it shows a label and reports a direction. What a press
 * means depends on the serving — 5 g for a weighed food, half a serving for a
 * countable one — so callers work it out with stepQuantity in lib/quantity.ts.
 * This used to add a flat 0.5, which for a weighed food is 50 g.
 */
export function Stepper({
  label,
  onStep,
}: {
  label: string;
  onStep: (dir: 1 | -1) => void;
}) {
  return (
    <View style={st.stepper}>
      <Pressable onPress={() => onStep(-1)} hitSlop={8} style={st.stepBtn}>
        <Text style={st.stepText}>−</Text>
      </Pressable>
      <Text style={st.stepQty}>{label}</Text>
      <Pressable onPress={() => onStep(1)} hitSlop={8} style={st.stepBtn}>
        <Text style={st.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const CONFIDENCE: Record<Confidence, { label: string; color: string }> = {
  high: { label: '✓ good match', color: palette.good },
  medium: { label: '≈ likely', color: palette.textFaint },
  low: { label: 'check this', color: palette.warn },
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

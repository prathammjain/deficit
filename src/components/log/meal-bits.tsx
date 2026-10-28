import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CloseIcon, MinusIcon, PlusIcon } from '@/components/ui/icons';
import { palette } from '@/constants/palette';
import type { Confidence } from '@/lib/food';

import { st } from './styles';

/**
 * Quantity control shared by the describe breakdown and logged rows.
 *
 * Deliberately dumb: it shows a label and reports a direction. What a press
 * means depends on the serving (5 g for a weighed food, half a serving for a
 * countable one), so callers work it out with stepQuantity in lib/quantity.ts.
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
      <Pressable
        onPress={() => onStep(-1)}
        hitSlop={8}
        style={st.stepBtn}
        accessibilityLabel="Less"
      >
        <MinusIcon color={palette.textMuted} />
      </Pressable>
      <Text style={st.stepQty}>{label}</Text>
      <Pressable
        onPress={() => onStep(1)}
        hitSlop={8}
        style={st.stepBtn}
        accessibilityLabel="More"
      >
        <PlusIcon color={palette.textMuted} />
      </Pressable>
    </View>
  );
}

const CONFIDENCE: Record<Confidence, { label: string; color: string }> = {
  high: { label: 'Matched', color: palette.textMuted },
  medium: { label: 'Likely', color: palette.textFaint },
  low: { label: 'Unsure', color: palette.warn },
};

/** A tiny trust signal on each parsed item: never hide a guess. */
export function ConfidenceBadge({ confidence }: { confidence?: Confidence }) {
  if (!confidence) return null;
  const c = CONFIDENCE[confidence];
  return <Text style={[st.confidence, { color: c.color }]}>{c.label}</Text>;
}

/** One macro under the day's summary: the amount, then what it is. */
export function MacroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={st.macroStat}>
      <Text style={st.macroStatValue}>{value}</Text>
      <Text style={st.macroStatLabel}>{label}</Text>
    </View>
  );
}

/**
 * One food in a list: name and calories on top, details and controls below.
 * Two lines give the name the full width, so it isn't cut to "Chicken brea…"
 * by a stepper sitting beside it.
 */
export function FoodLine({
  name,
  kcal,
  meta,
  tag,
  flagged,
  onPress,
  stepper,
  onRemove,
}: {
  name: string;
  kcal: number;
  /** Short details, laid out with even gaps. Falsy items are skipped. */
  meta: ReactNode[];
  /** A word that belongs with the name, like how sure the match is. */
  tag?: ReactNode;
  flagged?: boolean;
  onPress?: () => void;
  stepper?: { label: string; onStep: (dir: 1 | -1) => void };
  onRemove: () => void;
}) {
  return (
    <View style={st.foodLine}>
      <Pressable onPress={onPress} disabled={!onPress} style={st.foodTop}>
        <Text style={st.foodName} numberOfLines={1}>
          {name}
        </Text>
        {tag}
        {flagged ? <View style={st.foodFlag} /> : null}
        <Text style={st.foodKcal}>{kcal}</Text>
      </Pressable>
      <View style={st.foodBottom}>
        <Pressable onPress={onPress} disabled={!onPress} style={st.foodMeta}>
          {meta.filter(Boolean).map((m, i) =>
            typeof m === 'string' ? (
              <Text key={i} style={st.foodMetaText}>
                {m}
              </Text>
            ) : (
              <View key={i}>{m}</View>
            ),
          )}
        </Pressable>
        {stepper ? <Stepper {...stepper} /> : null}
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          style={st.removeBtn}
          accessibilityLabel="Remove"
        >
          <CloseIcon />
        </Pressable>
      </View>
    </View>
  );
}

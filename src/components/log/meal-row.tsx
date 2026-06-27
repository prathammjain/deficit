import { Pressable, Text, View } from 'react-native';

import type { LogEntry } from '@/lib/log-store';

import { SourceTag } from './engine-status';
import { ConfidenceBadge, Stepper } from './meal-bits';
import { st } from './styles';

export function MealRow({
  entry,
  onQty,
  onRemove,
}: {
  entry: LogEntry;
  onQty: (q: number) => void;
  onRemove: () => void;
}) {
  const portioned = entry.unitKcal != null && entry.quantity != null;
  return (
    <View style={st.entryRow}>
      <View style={st.flex1}>
        <View style={st.breakdownNameRow}>
          <Text style={st.entryLabel}>{entry.label}</Text>
          {/* Flag only the uncertain ones — a clean match stays quiet. */}
          {entry.confidence && entry.confidence !== 'high' ? (
            <ConfidenceBadge confidence={entry.confidence} />
          ) : null}
          <SourceTag source={entry.source} />
        </View>
        <Text style={st.entrySub}>
          {portioned
            ? `${entry.quantity} × ${entry.serving}`
            : entry.proteinG
              ? `${entry.proteinG}g protein`
              : 'custom'}
        </Text>
      </View>
      {portioned ? (
        <Stepper value={entry.quantity as number} onChange={onQty} />
      ) : null}
      <Text style={st.entryKcal}>{entry.kcal}</Text>
      <Pressable onPress={onRemove} hitSlop={10} style={st.removeBtn}>
        <Text style={st.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

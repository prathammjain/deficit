import { Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { FoodItem } from '@/lib/food';
import {
  useProviderStatus,
  type ProviderStatus,
} from '@/lib/food/provider-status';

import { st } from './styles';

const STATUS_COPY: Record<ProviderStatus, { dot: string; text: string }> = {
  'local-only': { dot: palette.textFaint, text: 'Local food table' },
  checking: { dot: palette.textFaint, text: 'Checking AI engine…' },
  online: { dot: palette.good, text: 'AI-grounded · USDA' },
  offline: { dot: palette.warn, text: 'AI engine offline — using local foods' },
};

/** A quiet line that tells the user which food engine is actually answering. */
export function EngineStatus() {
  const status = useProviderStatus();
  const c = STATUS_COPY[status];
  return (
    <View style={st.engineRow}>
      <View style={[st.engineDot, { backgroundColor: c.dot }]} />
      <Text style={st.engineText}>{c.text}</Text>
    </View>
  );
}

const SOURCE_LABEL: Record<NonNullable<FoodItem['source']>, string> = {
  local: 'local',
  usda: 'USDA',
  ai: 'AI est.',
};

/** Where a food's numbers came from — shown only for the grounded sources. */
export function SourceTag({ source }: { source?: FoodItem['source'] }) {
  if (!source || source === 'local') return null;
  return <Text style={st.sourceTag}>{SOURCE_LABEL[source]}</Text>;
}

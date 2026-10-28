import { Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { FoodItem } from '@/lib/food';
import { useProviderStatus } from '@/lib/food/provider-status';

import { st } from './styles';

/**
 * Quiet unless something is wrong: when the AI engine is down and meals are
 * matched against the local table only, say so. Otherwise the engine is
 * simply how the app works and needs no label.
 */
export function EngineStatus() {
  const status = useProviderStatus();
  if (status !== 'offline') return null;
  return (
    <View style={st.engineRow}>
      <View style={[st.engineDot, { backgroundColor: palette.warn }]} />
      <Text style={st.engineText}>
        AI engine offline, matching from local foods
      </Text>
    </View>
  );
}

const SOURCE_LABEL: Record<NonNullable<FoodItem['source']>, string> = {
  local: 'local',
  usda: 'USDA',
  ifct: 'IFCT',
  ai: 'AI estimate',
};

/** Where a food's numbers came from, shown only for the grounded sources. */
export function SourceTag({ source }: { source?: FoodItem['source'] }) {
  if (!source || source === 'local') return null;
  return <Text style={st.sourceTag}>{SOURCE_LABEL[source]}</Text>;
}

import { Text, View } from 'react-native';

import { st } from './styles';

export function MacroTile({ label, grams }: { label: string; grams: number }) {
  return (
    <View style={st.tile}>
      <Text style={st.macroGrams}>{grams} g</Text>
      <Text style={st.tileLabel}>{label}</Text>
    </View>
  );
}

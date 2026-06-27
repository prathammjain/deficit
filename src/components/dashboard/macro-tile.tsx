import { Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';

import { st } from './styles';

export function MacroTile({
  label,
  grams,
  color,
}: {
  label: string;
  grams: number;
  color: string;
}) {
  return (
    <Card style={st.tile}>
      <View style={[st.dot, { backgroundColor: color }]} />
      <Text style={st.macroGrams}>{grams}g</Text>
      <Text style={st.tileLabel}>{label}</Text>
    </Card>
  );
}

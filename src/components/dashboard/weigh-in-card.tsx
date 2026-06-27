import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { GlassSurface, PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';

import { st } from './styles';

export function WeighInCard({
  last,
  onSave,
}: {
  last: number | null;
  onSave: (kg: number) => void;
}) {
  const [val, setVal] = useState('');
  const num = Number(val);
  const valid = val !== '' && num >= 30 && num <= 300;

  return (
    <GlassSurface padded style={st.weighCard}>
      <View style={st.weighRow}>
        <TextInput
          style={st.weighInput}
          placeholder={last != null ? String(last) : 'kg'}
          placeholderTextColor={palette.textDim}
          keyboardType="decimal-pad"
          inputMode="decimal"
          value={val}
          onChangeText={(t) => setVal(t.replace(/[^0-9.]/g, ''))}
        />
        <Text style={st.weighUnit}>kg</Text>
        <PrimaryButton
          label="Save"
          disabled={!valid}
          style={st.weighBtn}
          onPress={() => {
            if (!valid) return;
            onSave(Math.round(num * 10) / 10);
            setVal('');
          }}
        />
      </View>
      <Text style={st.weighHint}>
        {last != null
          ? `Last logged ${last} kg. Weigh in each morning for the best read.`
          : 'Weigh in each morning — same time, same conditions.'}
      </Text>
    </GlassSurface>
  );
}

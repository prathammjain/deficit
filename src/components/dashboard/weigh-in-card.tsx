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
  /** Saves the weigh in; a rejection keeps the number typed, with an error. */
  onSave: (kg: number) => Promise<void>;
}) {
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          disabled={!valid || saving}
          style={st.weighBtn}
          onPress={() => {
            if (!valid || saving) return;
            setSaving(true);
            setError(null);
            onSave(Math.round(num * 10) / 10)
              .then(() => setVal(''))
              .catch(() =>
                setError(
                  'That weigh in didn’t save. Check your connection and try again.',
                ),
              )
              .finally(() => setSaving(false));
          }}
        />
      </View>
      <Text style={[st.weighHint, error ? { color: palette.accent } : null]}>
        {error ??
          (last != null
            ? `Last logged ${last} kg. Weigh in each morning for the best read.`
            : 'Weigh in each morning, same time, same conditions.')}
      </Text>
    </GlassSurface>
  );
}

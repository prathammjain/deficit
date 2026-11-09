/**
 * plan.tsx: the meals in a followed program's meal plan, each logged
 * in one tap. Logged as a one serving entry, so the quantity can still be
 * changed in the list like any other food.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { portionedEntry, type LogEntry } from '@/lib/log-store';
import type { PlanMeal } from '@/lib/train/program';

import { st } from './styles';

export function planEntry(m: PlanMeal): Omit<LogEntry, 'id' | 'at'> {
  return portionedEntry(
    {
      name: m.name,
      serving: '1 serving',
      kcal: m.kcal,
      proteinG: m.proteinG,
      carbsG: m.carbsG ?? 0,
      fatG: m.fatG ?? 0,
    },
    1,
  );
}

export function PlanMeals({
  meals,
  eaten,
  onLog,
}: {
  meals: PlanMeal[];
  /** Today's entries, to mark plan meals already logged. */
  eaten: LogEntry[];
  onLog: (m: PlanMeal) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const logged = new Set(eaten.map((e) => e.label));
  return (
    <Card padded={false} style={st.resultsCard}>
      {meals.map((m, i) => {
        const done = logged.has(m.name);
        return (
          <View key={m.id} style={[st.resultRow, i > 0 && st.resultRowBorder]}>
            <View style={st.flex1}>
              <Text style={st.resultName} numberOfLines={2}>
                {m.name}
              </Text>
              <View style={st.resultMeta}>
                <Text style={st.resultSub}>{m.kcal.toLocaleString()} kcal</Text>
                <Text style={st.resultSub}>{m.proteinG} g protein</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                setBusy(m.id);
                void onLog(m).finally(() => setBusy(null));
              }}
              disabled={busy != null}
              accessibilityLabel={`Log ${m.name}`}
              style={({ pressed }) => [
                {
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  backgroundColor: done ? palette.surface2 : palette.accent,
                },
                (pressed || busy === m.id) && st.pressed,
              ]}
            >
              <Text
                style={{
                  color: done ? palette.text : palette.accentText,
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {done ? 'Log again' : 'Log'}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

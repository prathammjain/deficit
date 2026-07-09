import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { MacroChip } from '@/components/log/meal-bits';
import { MealComposer } from '@/components/log/meal-composer';
import { MealRow } from '@/components/log/meal-row';
import { st } from '@/components/log/styles';
import { ArcGauge } from '@/components/charts';
import {
  Card,
  DotMatrix,
  Eyebrow,
  GlassSurface,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { computeBudget } from '@/lib/budget';
import { probeProvider } from '@/lib/food';
import {
  addEntry,
  loadDay,
  removeEntry,
  summarize,
  todayKey,
  updateEntryQuantity,
  type LogEntry,
} from '@/lib/log-store';
import { loadProfile } from '@/lib/profile-store';
import { computeTargets } from '@/lib/targets';

export default function LogScreen() {
  const [loading, setLoading] = useState(true);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [proteinTarget, setProteinTarget] = useState<number | null>(null);
  const [meals, setMeals] = useState<LogEntry[]>([]);
  const date = todayKey();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void probeProvider(); // refresh the "is the AI engine live?" signal
      (async () => {
        const [profile, day] = await Promise.all([
          loadProfile(),
          loadDay(date),
        ]);
        if (!alive) return;
        if (profile) {
          const t = computeTargets(profile);
          setTargetKcal(t.targetKcal);
          setProteinTarget(t.proteinG);
        } else {
          setTargetKcal(null);
          setProteinTarget(null);
        }
        setMeals(day);
        setLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, [date]),
  );

  const onAddMeal = useCallback(
    async (entry: Omit<LogEntry, 'id' | 'at'>) =>
      setMeals(await addEntry(date, entry)),
    [date],
  );
  const onAddMeals = useCallback(
    async (entries: Omit<LogEntry, 'id' | 'at'>[]) => {
      let latest = meals;
      for (const e of entries) latest = await addEntry(date, e);
      setMeals(latest);
    },
    [date, meals],
  );
  const onMealQty = useCallback(
    async (id: string, qty: number) =>
      setMeals(await updateEntryQuantity(date, id, qty)),
    [date],
  );
  const onRemoveMeal = useCallback(
    async (id: string) => setMeals(await removeEntry(date, id)),
    [date],
  );

  if (loading) {
    return (
      <View style={st.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const sum = summarize(meals);
  const budget =
    targetKcal != null
      ? computeBudget({
          targetKcal,
          consumedKcal: sum.kcal,
          burnedKcal: 0,
          eatBackFactor: 0,
        })
      : null;

  return (
    <Screen>
      <Eyebrow>Today</Eyebrow>
      <Title>Daily log</Title>

      {budget == null ? (
        <Card style={st.noProfile}>
          <Text style={st.noProfileText}>
            Set up your profile on the Home tab to see your target.
          </Text>
        </Card>
      ) : (
        <GlassSurface padded style={st.summaryCard}>
          <View style={st.summaryTopRow}>
            <View>
              <Text style={st.remainingLabel}>
                {budget.isOver ? 'Over by' : 'Left to eat'}
              </Text>
              <DotMatrix
                style={[
                  st.remaining,
                  budget.isOver && { color: palette.danger },
                ]}
              >
                {Math.abs(budget.remainingKcal).toLocaleString()}
              </DotMatrix>
            </View>
            <ArcGauge
              fraction={budget.fraction}
              size={96}
              color={budget.isOver ? palette.danger : palette.accent}
            >
              <Text style={st.consumed}>
                {budget.consumedKcal.toLocaleString()}
              </Text>
              <Text style={st.consumedLabel}>
                of {budget.targetKcal.toLocaleString()}
              </Text>
            </ArcGauge>
          </View>
          <View style={st.macroLine}>
            <MacroChip
              text={`P ${sum.proteinG}${proteinTarget ? ` / ${proteinTarget}` : ''}g`}
              color={palette.protein}
            />
            <MacroChip text={`C ${sum.carbsG}g`} color={palette.carb} />
            <MacroChip text={`F ${sum.fatG}g`} color={palette.fat} />
          </View>
        </GlassSurface>
      )}

      {/* Meals: add + list on one screen */}
      <SectionLabel>
        {meals.length ? `Meals · ${sum.kcal} kcal` : 'Meals'}
      </SectionLabel>
      <MealComposer onAdd={onAddMeal} onAddMany={onAddMeals} />

      <View style={st.list}>
        {meals.map((e) => (
          <MealRow
            key={e.id}
            entry={e}
            onQty={(q) => onMealQty(e.id, q)}
            onRemove={() => onRemoveMeal(e.id)}
          />
        ))}
        {meals.length === 0 ? (
          <Text style={st.empty}>
            Nothing logged yet — add your first meal above.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

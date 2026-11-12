import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MacroStat } from '@/components/log/meal-bits';
import { MealComposer } from '@/components/log/meal-composer';
import { MealRow } from '@/components/log/meal-row';
import { PlanMeals, planEntry } from '@/components/log/plan';
import { st } from '@/components/log/styles';
import { ArcGauge } from '@/components/charts';
import { useFollowing } from '@/components/train/follow';
import {
  Card,
  DotMatrix,
  GlassSurface,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { computeBudget } from '@/lib/budget';
import { formatToday } from '@/lib/date';
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
import { computeTargets, type Goal } from '@/lib/targets';

export default function LogScreen() {
  const [loading, setLoading] = useState(true);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [proteinTarget, setProteinTarget] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal>('lose');
  const [meals, setMeals] = useState<LogEntry[]>([]);
  // Meals that failed to save (offline, say), kept so nothing typed is lost.
  const [unsaved, setUnsaved] = useState<
    { date: string; entry: Omit<LogEntry, 'id' | 'at'> }[]
  >([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { following } = useFollowing();
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
          setGoal(t.goal);
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

  /** Saves entries one by one; any that fail wait in `unsaved` for a retry. */
  const save = useCallback(
    async (list: { date: string; entry: Omit<LogEntry, 'id' | 'at'> }[]) => {
      const failed: typeof list = [];
      for (const item of list) {
        try {
          const day = await addEntry(item.date, item.entry);
          if (item.date === date) setMeals(day);
        } catch {
          failed.push(item);
        }
      }
      if (failed.length) setUnsaved((u) => [...u, ...failed]);
    },
    [date],
  );
  const onAddMeal = useCallback(
    (entry: Omit<LogEntry, 'id' | 'at'>) => save([{ date, entry }]),
    [date, save],
  );
  const onAddMeals = useCallback(
    (entries: Omit<LogEntry, 'id' | 'at'>[]) =>
      save(entries.map((entry) => ({ date, entry }))),
    [date, save],
  );
  const retryUnsaved = useCallback(() => {
    const list = unsaved;
    setUnsaved([]);
    return save(list);
  }, [unsaved, save]);
  const onMealQty = useCallback(
    async (id: string, qty: number) => {
      try {
        setMeals(await updateEntryQuantity(date, id, qty));
        setSaveError(null);
      } catch {
        setSaveError(
          'That change didn’t save. Check your connection and try again.',
        );
      }
    },
    [date],
  );
  const onRemoveMeal = useCallback(
    async (id: string) => {
      try {
        setMeals(await removeEntry(date, id));
        setSaveError(null);
      } catch {
        setSaveError(
          'That meal wasn’t removed. Check your connection and try again.',
        );
      }
    },
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
      <Text style={st.dateLine}>{formatToday()}</Text>
      <Title>Today</Title>

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
            <MacroStat
              value={`${sum.proteinG} g`}
              label={proteinTarget ? `Protein of ${proteinTarget}` : 'Protein'}
            />
            <MacroStat value={`${sum.carbsG} g`} label="Carbs" />
            <MacroStat value={`${sum.fatG} g`} label="Fat" />
          </View>
        </GlassSurface>
      )}

      {/* Meals: add and list on one screen */}
      <SectionLabel>Add a meal</SectionLabel>
      <MealComposer
        onAdd={onAddMeal}
        onAddMany={onAddMeals}
        day={{
          eatenKcal: sum.kcal,
          targetKcal: targetKcal ?? 0,
          proteinG: sum.proteinG,
          proteinTargetG: proteinTarget ?? 0,
          goal,
        }}
      />

      {unsaved.length ? (
        <Card style={st.unsavedCard}>
          <Text style={st.unsavedText}>
            {unsaved.length === 1
              ? `${unsaved[0].entry.label} didn’t save.`
              : `${unsaved.length} meals didn’t save.`}{' '}
            Check your connection, then try again.
          </Text>
          <View style={st.unsavedRow}>
            <Pressable
              onPress={() => void retryUnsaved()}
              style={({ pressed }) => [st.unsavedBtn, pressed && st.pressed]}
            >
              <Text style={st.unsavedBtnText}>Try again</Text>
            </Pressable>
            <Pressable onPress={() => setUnsaved([])} hitSlop={8}>
              <Text style={st.unsavedDiscard}>Discard</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
      {saveError ? <Text style={st.saveError}>{saveError}</Text> : null}

      {following?.program.nutrition?.meals.length ? (
        <>
          <SectionLabel>From your plan</SectionLabel>
          <PlanMeals
            meals={following.program.nutrition.meals}
            eaten={meals}
            onLog={(m) => onAddMeal(planEntry(m))}
          />
        </>
      ) : null}

      <SectionLabel>Eaten</SectionLabel>
      <View>
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
            Nothing yet. Describe your first meal above.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MacroStat } from '@/components/log/meal-bits';
import { MealComposer } from '@/components/log/meal-composer';
import { MealRow } from '@/components/log/meal-row';
import { PlanMeals, planEntry } from '@/components/log/plan';
import { st } from '@/components/log/styles';
import { ArcGauge } from '@/components/charts';
import { useFollowing } from '@/components/train/follow';
import { tr } from '@/components/train/styles';
import { ChevronIcon } from '@/components/ui/icons';
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
import { addDays } from '@/lib/train/progress';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Before this hour a late dinner most likely belongs to the day before. */
const LATE_NIGHT_HOUR = 4;

const localDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "Today", "Yesterday", or the weekday and date of an earlier day. */
function dayTitle(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return localDay(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

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
  // The day being logged. Today unless the user steps back to catch up on an
  // earlier one, or arrives from a "finish this day" link with ?date=.
  const today = todayKey();
  const [date, setDate] = useState(today);
  const shown = useRef(today);
  // Another day's meals are never shown under the new day's name while the
  // new day loads.
  const show = useCallback((day: string) => {
    shown.current = day;
    setMeals([]);
    setDate(day);
  }, []);
  // Bumped to empty the composer, so a meal drafted for one day is never
  // logged to another by the same button.
  const [draft, setDraft] = useState(0);
  const params = useLocalSearchParams<{ date?: string }>();
  const arrived = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const asked = params.date;
      if (asked) {
        if (DAY.test(asked) && asked <= todayKey()) show(asked);
        // Used once: coming back to the tab later must not reopen that day.
        arrived.current = true;
        router.setParams({ date: undefined });
        return;
      }
      // This run is only the param being cleared just above.
      if (arrived.current) {
        arrived.current = false;
        return;
      }
      // Coming back to the tab always starts on today with an empty box, so
      // the next meal typed in a hurry can't land on an old day by accident.
      if (shown.current !== todayKey()) {
        setDraft((n) => n + 1);
        show(todayKey());
      }
    }, [params.date, show]),
  );

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

  const past = date !== today;
  const title = dayTitle(date, today);
  const yesterday = addDays(today, -1);

  return (
    <Screen>
      <View style={st.dayRow}>
        <View>
          <Text style={st.dateLine}>{formatToday(localDay(date))}</Text>
          <Title>{title}</Title>
        </View>
        <View style={st.dayArrows}>
          <Pressable
            onPress={() => show(addDays(date, -1))}
            hitSlop={8}
            accessibilityLabel="A day earlier"
            style={({ pressed }) => [
              tr.iconBtn,
              tr.iconBtnRing,
              pressed && tr.pressed,
            ]}
          >
            <ChevronIcon color={palette.text} />
          </Pressable>
          <Pressable
            onPress={() => show(addDays(date, 1))}
            disabled={!past}
            hitSlop={8}
            accessibilityLabel="A day later"
            style={({ pressed }) => [
              tr.iconBtn,
              tr.iconBtnRing,
              !past && tr.disabled,
              pressed && tr.pressed,
            ]}
          >
            <ChevronIcon color={palette.text} direction="right" />
          </Pressable>
        </View>
      </View>
      {past ? (
        <Pressable onPress={() => show(today)} hitSlop={8}>
          <Text style={st.dayLink}>
            Filling in an earlier day. Back to today
          </Text>
        </Pressable>
      ) : new Date().getHours() < LATE_NIGHT_HOUR ? (
        <Pressable onPress={() => show(yesterday)} hitSlop={8}>
          <Text style={st.dayLink}>
            Past midnight. Still on{' '}
            {localDay(yesterday).toLocaleDateString('en-GB', {
              weekday: 'long',
            })}
            ? Log it there
          </Text>
        </Pressable>
      ) : null}

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
                {budget.isOver ? 'Over by' : past ? 'Under by' : 'Left to eat'}
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
        key={draft}
        onAdd={onAddMeal}
        onAddMany={onAddMeals}
        day={{
          eatenKcal: sum.kcal,
          targetKcal: targetKcal ?? 0,
          proteinG: sum.proteinG,
          proteinTargetG: proteinTarget ?? 0,
          goal,
        }}
        pastDay={past ? title : undefined}
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
            {past
              ? 'Nothing logged this day. Tell GrainAI what you ate above.'
              : 'Nothing yet. Tell GrainAI what you ate above.'}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

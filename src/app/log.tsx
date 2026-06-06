import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Card,
  Eyebrow,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { computeBudget } from '@/lib/budget';
import { foodProvider, type FoodItem } from '@/lib/food';
import {
  addEntry,
  loadDay,
  portionedEntry,
  removeEntry,
  summarize,
  todayKey,
  updateEntryQuantity,
  type LogEntry,
} from '@/lib/log-store';
import { loadProfile } from '@/lib/profile-store';
import { computeTargets } from '@/lib/targets';
import {
  addWorkout,
  loadWorkouts,
  removeWorkout,
  sumBurned,
  type WorkoutEntry,
} from '@/lib/workout-store';

export default function LogScreen() {
  const [loading, setLoading] = useState(true);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [proteinTarget, setProteinTarget] = useState<number | null>(null);
  const [meals, setMeals] = useState<LogEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const date = todayKey();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [profile, day, sessions] = await Promise.all([
          loadProfile(),
          loadDay(date),
          loadWorkouts(date),
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
        setWorkouts(sessions);
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
  const onAddWorkout = useCallback(
    async (entry: Omit<WorkoutEntry, 'id' | 'at'>) =>
      setWorkouts(await addWorkout(date, entry)),
    [date],
  );
  const onRemoveWorkout = useCallback(
    async (id: string) => setWorkouts(await removeWorkout(date, id)),
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
  const burned = sumBurned(workouts);
  const budget =
    targetKcal != null
      ? computeBudget({
          targetKcal,
          consumedKcal: sum.kcal,
          burnedKcal: burned,
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
        <Card style={st.summaryCard}>
          <View style={st.summaryTopRow}>
            <View>
              <Text style={st.remainingLabel}>
                {budget.isOver ? 'Over by' : 'Left to eat'}
              </Text>
              <Text
                style={[st.remaining, budget.isOver && { color: palette.danger }]}>
                {Math.abs(budget.remainingKcal).toLocaleString()}
              </Text>
            </View>
            <View style={st.consumedBox}>
              <Text style={st.consumed}>
                {budget.consumedKcal.toLocaleString()}
              </Text>
              <Text style={st.consumedLabel}>
                of {budget.targetKcal.toLocaleString()}
              </Text>
            </View>
          </View>
          <ProgressBar fraction={budget.fraction} over={budget.isOver} />
          <View style={st.macroLine}>
            <MacroChip
              text={`P ${sum.proteinG}${proteinTarget ? ` / ${proteinTarget}` : ''}g`}
              color={palette.protein}
            />
            <MacroChip text={`C ${sum.carbsG}g`} color={palette.carb} />
            <MacroChip text={`F ${sum.fatG}g`} color={palette.fat} />
            {burned > 0 ? (
              <MacroChip text={`🔥 ${burned} burned`} color={palette.fat} muted />
            ) : null}
          </View>
        </Card>
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
          <Text style={st.empty}>Nothing logged yet — add your first meal above.</Text>
        ) : null}
      </View>

      {/* Workouts */}
      <SectionLabel>Workouts</SectionLabel>
      <ManualWorkoutAdd onAdd={onAddWorkout} />
      <View style={st.list}>
        {workouts.map((w) => (
          <WorkoutRow
            key={w.id}
            entry={w}
            onRemove={() => onRemoveWorkout(w.id)}
          />
        ))}
        {workouts.length === 0 ? (
          <Text style={st.empty}>No workouts logged yet.</Text>
        ) : null}
      </View>
      <Text style={st.workoutNote}>
        Workouts are logged for awareness — they don’t change your target (your
        activity level already accounts for training).
      </Text>
    </Screen>
  );
}

/* ---------------- meal composer ---------------- */

function MealComposer({
  onAdd,
  onAddMany,
}: {
  onAdd: (e: Omit<LogEntry, 'id' | 'at'>) => void;
  onAddMany: (e: Omit<LogEntry, 'id' | 'at'>[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [panel, setPanel] = useState<'none' | 'describe' | 'custom'>('none');

  useEffect(() => {
    let alive = true;
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    foodProvider.search(query).then((r) => {
      if (alive) setResults(r);
    });
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <View>
      {/* Primary: search a food, tap to add (stays open for the next one) */}
      <View style={st.searchWrap}>
        <Text style={st.searchIcon}>⌕</Text>
        <TextInput
          style={st.searchInput}
          placeholder="Add a food — roti, dal, paneer…"
          placeholderTextColor={palette.textDim}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Text style={st.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {results.length > 0 ? (
        <Card style={st.resultsCard} padded={false}>
          {results.map((f, i) => (
            <Pressable
              key={f.id}
              onPress={() => {
                onAdd(portionedEntry(f, 1));
                setQuery('');
              }}
              style={({ pressed }) => [
                st.resultRow,
                i > 0 && st.resultRowBorder,
                pressed && st.pressed,
              ]}>
              <View style={st.flex1}>
                <Text style={st.resultName}>{f.name}</Text>
                <Text style={st.resultSub}>
                  {f.serving} · P{f.proteinG} C{f.carbsG} F{f.fatG}
                </Text>
              </View>
              <Text style={st.resultKcal}>{f.kcal}</Text>
              <Text style={st.resultAdd}>＋</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* Secondary actions */}
      {query.length === 0 ? (
        <View style={st.secondaryRow}>
          <Pressable
            onPress={() => setPanel(panel === 'describe' ? 'none' : 'describe')}
            style={[st.pill, panel === 'describe' && st.pillActive]}>
            <Text
              style={[
                st.pillText,
                panel === 'describe' && st.pillTextActive,
              ]}>
              ✦ Describe a meal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPanel(panel === 'custom' ? 'none' : 'custom')}
            style={[st.pill, panel === 'custom' && st.pillActive]}>
            <Text
              style={[st.pillText, panel === 'custom' && st.pillTextActive]}>
              ＋ Custom
            </Text>
          </Pressable>
        </View>
      ) : null}

      {panel === 'describe' ? (
        <DescribeMeal
          onLog={(entries) => {
            onAddMany(entries);
            setPanel('none');
          }}
        />
      ) : null}
      {panel === 'custom' ? (
        <CustomMeal
          onAdd={(e) => {
            onAdd(e);
            setPanel('none');
          }}
        />
      ) : null}
    </View>
  );
}

function DescribeMeal({
  onLog,
}: {
  onLog: (entries: Omit<LogEntry, 'id' | 'at'>[]) => void;
}) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<{ item: FoodItem; quantity: number }[]>([]);
  const [note, setNote] = useState<string | undefined>();
  const [calculated, setCalculated] = useState(false);
  const [busy, setBusy] = useState(false);

  const calc = async () => {
    if (!text.trim() || !foodProvider.parseMeal) return;
    setBusy(true);
    const parsed = await foodProvider.parseMeal(text);
    setItems(parsed.items);
    setNote(parsed.note);
    setCalculated(true);
    setBusy(false);
  };

  const setQty = (idx: number, q: number) =>
    setItems((arr) =>
      arr.map((it, i) =>
        i === idx ? { ...it, quantity: Math.max(0.5, Math.round(q * 2) / 2) } : it,
      ),
    );
  const removeItem = (idx: number) =>
    setItems((arr) => arr.filter((_, i) => i !== idx));

  const total = items.reduce(
    (a, { item, quantity }) => ({
      kcal: a.kcal + Math.round(item.kcal * quantity),
      proteinG: a.proteinG + Math.round(item.proteinG * quantity),
    }),
    { kcal: 0, proteinG: 0 },
  );

  return (
    <Card style={st.describeCard}>
      <TextInput
        style={st.describeInput}
        placeholder="“2 roti, mom’s dal, 1 katori rice, salad” — say it your way"
        placeholderTextColor={palette.textDim}
        value={text}
        onChangeText={setText}
        multiline
      />
      <View style={st.describeFooter}>
        <Text style={st.describeHint}>
          We match each item — review and adjust portions before logging.
        </Text>
        <PrimaryButton
          label={busy ? '…' : 'Match'}
          disabled={busy || text.trim().length === 0}
          style={st.calcBtn}
          onPress={calc}
        />
      </View>

      {calculated ? (
        <View style={st.breakdown}>
          {items.map((it, idx) => (
            <View key={`${it.item.id}-${idx}`} style={st.breakdownRow}>
              <View style={st.flex1}>
                <Text style={st.breakdownName}>{it.item.name}</Text>
                <Text style={st.breakdownSub}>
                  {it.item.serving} · {Math.round(it.item.kcal * it.quantity)} kcal
                </Text>
              </View>
              <Stepper value={it.quantity} onChange={(q) => setQty(idx, q)} />
              <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                <Text style={st.removeText}>✕</Text>
              </Pressable>
            </View>
          ))}
          {items.length === 0 ? (
            <Text style={st.empty}>
              Couldn’t match anything — try simpler names or use Custom.
            </Text>
          ) : null}
          {note ? <Text style={st.breakdownNote}>{note}</Text> : null}
          {items.length > 0 ? (
            <>
              <View style={st.breakdownTotalRow}>
                <Text style={st.breakdownTotalLabel}>Total</Text>
                <Text style={st.breakdownTotalValue}>
                  {total.kcal} kcal · {total.proteinG}g protein
                </Text>
              </View>
              <PrimaryButton
                label={`Log ${items.length} item${items.length > 1 ? 's' : ''}`}
                onPress={() =>
                  onLog(items.map(({ item, quantity }) => portionedEntry(item, quantity)))
                }
              />
            </>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function CustomMeal({
  onAdd,
}: {
  onAdd: (e: Omit<LogEntry, 'id' | 'at'>) => void;
}) {
  const [label, setLabel] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const valid = label.trim().length > 0 && Number(kcal) > 0;

  return (
    <Card style={st.manualCard}>
      <TextInput
        style={st.manualLabelInput}
        placeholder="What did you eat?"
        placeholderTextColor={palette.textDim}
        value={label}
        onChangeText={setLabel}
      />
      <View style={st.manualRow}>
        <TextInput
          style={[st.manualNumInput, st.flex1]}
          placeholder="kcal"
          placeholderTextColor={palette.textDim}
          keyboardType="number-pad"
          inputMode="numeric"
          value={kcal}
          onChangeText={(t) => setKcal(t.replace(/[^0-9]/g, ''))}
        />
        <TextInput
          style={[st.manualNumInput, st.flex1]}
          placeholder="protein (g)"
          placeholderTextColor={palette.textDim}
          keyboardType="number-pad"
          inputMode="numeric"
          value={protein}
          onChangeText={(t) => setProtein(t.replace(/[^0-9]/g, ''))}
        />
        <PrimaryButton
          label="Add"
          disabled={!valid}
          style={st.manualBtn}
          onPress={() => {
            if (!valid) return;
            onAdd({
              label: label.trim(),
              kcal: Math.round(Number(kcal)),
              proteinG: protein ? Math.round(Number(protein)) : undefined,
            });
            setLabel('');
            setKcal('');
            setProtein('');
          }}
        />
      </View>
    </Card>
  );
}

function ManualWorkoutAdd({
  onAdd,
}: {
  onAdd: (e: Omit<WorkoutEntry, 'id' | 'at'>) => void;
}) {
  const [label, setLabel] = useState('');
  const [kcal, setKcal] = useState('');
  const [minutes, setMinutes] = useState('');
  const valid = label.trim().length > 0 && Number(kcal) > 0;

  return (
    <Card style={st.manualCard}>
      <TextInput
        style={st.manualLabelInput}
        placeholder="Workout — Run, Gym, Cycling…"
        placeholderTextColor={palette.textDim}
        value={label}
        onChangeText={setLabel}
      />
      <View style={st.manualRow}>
        <TextInput
          style={[st.manualNumInput, st.flex1]}
          placeholder="kcal burned"
          placeholderTextColor={palette.textDim}
          keyboardType="number-pad"
          inputMode="numeric"
          value={kcal}
          onChangeText={(t) => setKcal(t.replace(/[^0-9]/g, ''))}
        />
        <TextInput
          style={[st.manualNumInput, st.flex1]}
          placeholder="minutes"
          placeholderTextColor={palette.textDim}
          keyboardType="number-pad"
          inputMode="numeric"
          value={minutes}
          onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))}
        />
        <PrimaryButton
          label="Add"
          disabled={!valid}
          style={st.manualBtn}
          onPress={() => {
            if (!valid) return;
            onAdd({
              label: label.trim(),
              kcalBurned: Math.round(Number(kcal)),
              minutes: minutes ? Math.round(Number(minutes)) : undefined,
            });
            setLabel('');
            setKcal('');
            setMinutes('');
          }}
        />
      </View>
    </Card>
  );
}

/* ---------------- rows & bits ---------------- */

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={st.stepper}>
      <Pressable onPress={() => onChange(value - 0.5)} hitSlop={8} style={st.stepBtn}>
        <Text style={st.stepText}>−</Text>
      </Pressable>
      <Text style={st.stepQty}>{value}</Text>
      <Pressable onPress={() => onChange(value + 0.5)} hitSlop={8} style={st.stepBtn}>
        <Text style={st.stepText}>＋</Text>
      </Pressable>
    </View>
  );
}

function MealRow({
  entry,
  onQty,
  onRemove,
}: {
  entry: LogEntry;
  onQty: (q: number) => void;
  onRemove: () => void;
}) {
  const portioned = entry.unitKcal != null && entry.quantity != null;
  return (
    <View style={st.entryRow}>
      <View style={st.flex1}>
        <Text style={st.entryLabel}>{entry.label}</Text>
        <Text style={st.entrySub}>
          {portioned
            ? `${entry.quantity} × ${entry.serving}`
            : entry.proteinG
              ? `${entry.proteinG}g protein`
              : 'custom'}
        </Text>
      </View>
      {portioned ? (
        <Stepper value={entry.quantity as number} onChange={onQty} />
      ) : null}
      <Text style={st.entryKcal}>{entry.kcal}</Text>
      <Pressable onPress={onRemove} hitSlop={10} style={st.removeBtn}>
        <Text style={st.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

function WorkoutRow({
  entry,
  onRemove,
}: {
  entry: WorkoutEntry;
  onRemove: () => void;
}) {
  return (
    <View style={st.entryRow}>
      <View style={st.flex1}>
        <Text style={st.entryLabel}>{entry.label}</Text>
        {entry.minutes ? (
          <Text style={st.entrySub}>{entry.minutes} min</Text>
        ) : null}
      </View>
      <Text style={[st.entryKcal, { color: palette.fat }]}>
        +{entry.kcalBurned}
      </Text>
      <Pressable onPress={onRemove} hitSlop={10} style={st.removeBtn}>
        <Text style={st.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

function MacroChip({
  text,
  color,
  muted,
}: {
  text: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <View style={st.chip}>
      {!muted ? <View style={[st.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[st.chipText, muted && { color: palette.fat }]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },

  noProfile: { marginTop: space.xl },
  noProfileText: { color: palette.textMuted, fontSize: 15, lineHeight: 21 },

  summaryCard: { marginTop: space.xl },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.lg,
  },
  remainingLabel: { color: palette.textFaint, fontSize: 13, letterSpacing: 0.2 },
  remaining: { ...typo.hero, fontSize: 56, color: palette.accent, marginTop: 2 },
  consumedBox: { alignItems: 'flex-end', paddingTop: space.sm },
  consumed: { color: palette.text, fontSize: 22, fontWeight: '600' },
  consumedLabel: { color: palette.textFaint, fontSize: 13, marginTop: 2 },

  macroLine: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: palette.bg,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.hairline,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  searchIcon: { color: palette.textFaint, fontSize: 18 },
  searchInput: { flex: 1, color: palette.text, fontSize: 16, paddingVertical: space.lg },
  searchClear: { color: palette.textFaint, fontSize: 14 },

  resultsCard: { marginTop: space.sm, overflow: 'hidden' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: palette.hairline },
  resultName: { color: palette.text, fontSize: 15, fontWeight: '600' },
  resultSub: { color: palette.textFaint, fontSize: 12, marginTop: 2 },
  resultKcal: { color: palette.text, fontSize: 15, fontWeight: '700' },
  resultAdd: { color: palette.accent, fontSize: 18, fontWeight: '700' },

  secondaryRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  pill: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  pillActive: { backgroundColor: palette.accentSoft, borderColor: palette.accentBorder },
  pillText: { color: palette.textMuted, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: palette.accent },

  describeCard: { gap: space.md, marginTop: space.md },
  describeInput: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  describeFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  describeHint: { flex: 1, color: palette.textFaint, fontSize: 12, lineHeight: 17 },
  calcBtn: { paddingHorizontal: space.xl },
  breakdown: { gap: space.sm, marginTop: space.sm },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  breakdownName: { color: palette.text, fontSize: 15, fontWeight: '600' },
  breakdownSub: { color: palette.textFaint, fontSize: 12, marginTop: 2 },
  breakdownNote: { color: palette.warn, fontSize: 12, lineHeight: 17 },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  breakdownTotalLabel: { color: palette.textMuted, fontSize: 14 },
  breakdownTotalValue: { color: palette.text, fontSize: 14, fontWeight: '600' },

  manualCard: { gap: space.md, marginTop: space.md },
  manualLabelInput: {
    backgroundColor: palette.bg,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: palette.text,
    fontSize: 15,
  },
  manualRow: { flexDirection: 'row', gap: space.sm },
  manualNumInput: {
    backgroundColor: palette.bg,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: palette.text,
    fontSize: 15,
  },
  manualBtn: { paddingHorizontal: space.lg },

  list: { marginTop: space.md },
  empty: { color: palette.textDim, fontSize: 14, paddingVertical: space.sm },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    gap: space.md,
  },
  entryLabel: { color: palette.text, fontSize: 15, fontWeight: '500' },
  entrySub: { color: palette.textFaint, fontSize: 13, marginTop: 2 },
  entryKcal: { color: palette.text, fontSize: 15, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  removeBtn: { paddingHorizontal: space.xs },
  removeText: { color: palette.textFaint, fontSize: 15 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.bg,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  stepBtn: { minWidth: 16, alignItems: 'center' },
  stepText: { color: palette.accent, fontSize: 16, fontWeight: '700' },
  stepQty: { color: palette.text, fontSize: 14, fontWeight: '600', minWidth: 24, textAlign: 'center' },

  workoutNote: { color: palette.textDim, fontSize: 12, marginTop: space.md, lineHeight: 17 },
});

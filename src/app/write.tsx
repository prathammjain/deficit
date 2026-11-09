/**
 * Write a program: its days (exercises, sets and rep ranges), how many
 * weeks it runs, and an optional meal plan. Saved as a draft; publishing
 * happens on the program page.
 */

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Chip, NumField } from '@/components/train/bits';
import { recentIds, useTraining } from '@/components/train/data';
import { useAccountName } from '@/components/train/follow';
import { ExercisePicker } from '@/components/train/picker';
import { namer } from '@/components/train/program';
import { tr } from '@/components/train/styles';
import { CloseIcon } from '@/components/ui/icons';
import {
  Card,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import {
  deleteProgram,
  getProgram,
  saveProgram,
} from '@/lib/supabase/programs';
import { newId, type Exercise } from '@/lib/train/exercises';
import {
  blankProgram,
  dayFromRoutine,
  newDay,
  programExercise,
  programProblems,
  tidyProgram,
  type PlanMeal,
  type Program,
  type ProgramDay,
  type ProgramExercise,
} from '@/lib/train/program';
import { addCustomExercise } from '@/lib/train/store';
import { lastSets } from '@/lib/train/workout';

export default function WriteScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, setData } = useTraining();
  const accountName = useAccountName();
  const [draft, setDraft] = useState<{
    key: string;
    program: Program | null;
  } | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const key = id ?? 'new';

  // Screens stay mounted, so every visit starts from the saved program (or
  // a blank one) rather than whatever was left here last time.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = id
        ? getProgram(id)
        : Promise.resolve(blankProgram(accountName));
      load
        .then((program) => {
          if (!alive) return;
          setDraft({ key: id ?? 'new', program });
          setProblems([]);
          setError(null);
          setConfirmDelete(false);
          setPicking(null);
        })
        .catch(() => {
          if (alive) setDraft({ key: id ?? 'new', program: null });
        });
      return () => {
        alive = false;
      };
    }, [id, accountName]),
  );

  const workouts = data?.workouts;
  const recent = useMemo(() => recentIds(workouts ?? []), [workouts]);
  const previous = useMemo(() => lastSets(workouts ?? []), [workouts]);

  if (!data || !draft || draft.key !== key) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const p = draft.program;
  if (!p) {
    return (
      <Screen>
        <Text style={[tr.nameInput, { marginTop: space.xl }]}>
          Program not found
        </Text>
        <Text style={[tr.emptyText, { marginTop: space.md }]}>
          It may have been deleted, or the connection dropped. Check your
          connection and try again.
        </Text>
        <PrimaryButton
          label="Back to programs"
          style={{ marginTop: space.xl }}
          onPress={() => router.navigate('/programs')}
        />
      </Screen>
    );
  }

  const set = (next: Partial<Program>) => {
    setDraft({ key, program: { ...p, ...next } });
    setProblems([]);
  };
  const setDay = (i: number, next: Partial<ProgramDay>) =>
    set({ days: p.days.map((d, j) => (j === i ? { ...d, ...next } : d)) });
  const setEx = (i: number, j: number, next: Partial<ProgramExercise>) =>
    setDay(i, {
      exercises: p.days[i].exercises.map((e, k) =>
        k === j ? { ...e, ...next } : e,
      ),
    });
  const plan = p.nutrition;
  const setMeal = (i: number, next: Partial<PlanMeal>) =>
    plan &&
    set({
      nutrition: {
        ...plan,
        meals: plan.meals.map((m, j) => (j === i ? { ...m, ...next } : m)),
      },
    });

  const name = namer(p, data.exById);
  const custom = [
    ...data.exercises.filter((e) => e.custom),
    ...p.exercises.filter((e) => !data.exById.has(e.id)),
  ];

  const save = async () => {
    const found = programProblems(p);
    if (found.length) {
      setProblems(found);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveProgram(tidyProgram(p, custom));
      router.navigate({ pathname: '/program', params: { id: saved.id } });
    } catch {
      setError(
        'Couldn’t save the program. Check your connection and try again.',
      );
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteProgram(p.id);
      router.navigate('/programs');
    } catch {
      setError('Couldn’t delete it. Check your connection and try again.');
    }
    setBusy(false);
  };

  const leave = () =>
    router.navigate(
      p.id ? { pathname: '/program', params: { id: p.id } } : '/programs',
    );

  return (
    <View style={tr.flex1}>
      <Screen>
        <View style={[tr.row, { justifyContent: 'space-between' }]}>
          <Pressable
            onPress={leave}
            hitSlop={8}
            style={({ pressed }) => pressed && tr.pressed}
          >
            <Text style={tr.linkText}>Cancel</Text>
          </Pressable>
          <Text style={tr.eyebrow}>
            {p.id ? 'EDIT PROGRAM' : 'NEW PROGRAM'}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <TextInput
          style={[tr.nameInput, { marginTop: space.xl }]}
          value={p.title}
          onChangeText={(t) => set({ title: t })}
          placeholder="Program name"
          placeholderTextColor={palette.textDim}
          maxLength={80}
          accessibilityLabel="Program name"
        />
        <TextInput
          style={[tr.input, { marginTop: space.lg }]}
          value={p.authorName}
          onChangeText={(t) => set({ authorName: t })}
          placeholder="Your name, as followers see it"
          placeholderTextColor={palette.textDim}
          maxLength={60}
          accessibilityLabel="Author name"
        />
        <TextInput
          style={[tr.describeInput, { marginTop: space.sm, minHeight: 96 }]}
          value={p.description}
          onChangeText={(t) => set({ description: t })}
          placeholder="Who it’s for, how to run it, how to progress"
          placeholderTextColor={palette.textDim}
          multiline
          maxLength={2000}
          accessibilityLabel="Description"
        />

        <View style={[tr.row, { gap: space.md, marginTop: space.lg }]}>
          <Text style={[tr.body, tr.flex1]}>Runs for</Text>
          <NumField
            value={p.weeks}
            label="Weeks"
            style={wr.num}
            maxLength={2}
            onChange={(n) => set({ weeks: n ?? 1 })}
          />
          <Text style={tr.body}>{p.weeks === 1 ? 'week' : 'weeks'}</Text>
        </View>

        <SectionLabel>Days</SectionLabel>
        <Text style={[tr.faint, { marginBottom: space.md }]}>
          One round of these days is a week. Followers always get the day after
          the one they last did, so a missed session never gets skipped.
        </Text>
        <View style={{ gap: space.md }}>
          {p.days.map((d, i) => (
            <Card key={d.id} padded={false}>
              <View style={wr.dayHead}>
                <TextInput
                  style={[tr.strong, tr.flex1, wr.dayName]}
                  value={d.name}
                  onChangeText={(t) => setDay(i, { name: t })}
                  placeholder={`Day ${i + 1}`}
                  placeholderTextColor={palette.textDim}
                  maxLength={40}
                  accessibilityLabel={`Day ${i + 1} name`}
                />
                {p.days.length > 1 ? (
                  <Pressable
                    onPress={() =>
                      set({ days: p.days.filter((_, j) => j !== i) })
                    }
                    hitSlop={8}
                  >
                    <Text style={[tr.linkText, tr.accentText]}>Remove day</Text>
                  </Pressable>
                ) : null}
              </View>
              {d.exercises.map((e, j) => (
                <View key={`${e.exerciseId}:${j}`} style={wr.exRow}>
                  <View style={[tr.row, { gap: space.sm }]}>
                    <Text style={[wr.exName, tr.flex1]} numberOfLines={1}>
                      {name(e.exerciseId)}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setDay(i, {
                          exercises: d.exercises.filter((_, k) => k !== j),
                        })
                      }
                      hitSlop={8}
                      accessibilityLabel={`Remove ${name(e.exerciseId)}`}
                      style={tr.iconBtn}
                    >
                      <CloseIcon />
                    </Pressable>
                  </View>
                  <View style={[tr.row, { gap: space.sm }]}>
                    <NumField
                      value={e.sets}
                      label={`${name(e.exerciseId)} sets`}
                      style={wr.num}
                      maxLength={2}
                      onChange={(n) => setEx(i, j, { sets: n ?? 1 })}
                    />
                    <Text style={tr.muted}>
                      {e.sets === 1 ? 'set of' : 'sets of'}
                    </Text>
                    <NumField
                      value={e.repsMin}
                      label={`${name(e.exerciseId)} fewest reps`}
                      style={wr.num}
                      onChange={(n) => setEx(i, j, { repsMin: n ?? 1 })}
                    />
                    <Text style={tr.muted}>to</Text>
                    <NumField
                      value={e.repsMax}
                      label={`${name(e.exerciseId)} most reps`}
                      style={wr.num}
                      onChange={(n) => setEx(i, j, { repsMax: n ?? 1 })}
                    />
                    <Text style={tr.muted}>reps</Text>
                  </View>
                  <TextInput
                    style={wr.noteInput}
                    value={e.note ?? ''}
                    onChangeText={(t) => setEx(i, j, { note: t || undefined })}
                    placeholder="Note for followers (optional)"
                    placeholderTextColor={palette.textDim}
                    maxLength={140}
                  />
                </View>
              ))}
              <Pressable
                onPress={() => setPicking(i)}
                style={({ pressed }) => [wr.addRow, pressed && tr.pressed]}
              >
                <Text style={[tr.linkText, tr.accentText]}>
                  {d.exercises.length
                    ? 'Add exercises'
                    : 'Add the first exercise'}
                </Text>
              </Pressable>
            </Card>
          ))}
        </View>

        <Pressable
          onPress={() => set({ days: [...p.days, newDay(p.days.length)] })}
          style={({ pressed }) => [
            tr.ghostBtn,
            { marginTop: space.md },
            pressed && tr.pressed,
          ]}
        >
          <Text style={tr.ghostText}>Add a day</Text>
        </Pressable>
        {data.routines.length ? (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            <Text style={tr.faint}>Or add a day from one of your routines</Text>
            <View style={tr.chips}>
              {data.routines.map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  onPress={() => {
                    const day = dayFromRoutine(r.name, r.exercises);
                    // Replace the untouched first day instead of adding after it.
                    const blank =
                      p.days.length === 1 && !p.days[0].exercises.length;
                    set({ days: blank ? [day] : [...p.days, day] });
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <SectionLabel>Meal plan</SectionLabel>
        {plan ? (
          <Card style={{ gap: space.md }}>
            <View style={[tr.row, { gap: space.sm }]}>
              <Text style={[tr.body, tr.flex1]}>Calories a day</Text>
              <NumField
                value={plan.kcal}
                label="Calories a day"
                style={[wr.num, { width: 72 }]}
                maxLength={4}
                onChange={(n) => set({ nutrition: { ...plan, kcal: n } })}
              />
            </View>
            <View style={[tr.row, { gap: space.sm }]}>
              <Text style={[tr.body, tr.flex1]}>Protein a day</Text>
              <NumField
                value={plan.proteinG}
                label="Protein a day in grams"
                style={[wr.num, { width: 72 }]}
                onChange={(n) => set({ nutrition: { ...plan, proteinG: n } })}
              />
              <Text style={tr.muted}>g</Text>
            </View>
            {plan.meals.map((m, i) => (
              <View key={m.id} style={wr.mealRow}>
                <View style={[tr.row, { gap: space.sm }]}>
                  <TextInput
                    style={[tr.input, tr.flex1]}
                    value={m.name}
                    onChangeText={(t) => setMeal(i, { name: t })}
                    placeholder="Meal, like oats with whey and banana"
                    placeholderTextColor={palette.textDim}
                    maxLength={80}
                    accessibilityLabel={`Meal ${i + 1} name`}
                  />
                  <Pressable
                    onPress={() =>
                      set({
                        nutrition: {
                          ...plan,
                          meals: plan.meals.filter((_, j) => j !== i),
                        },
                      })
                    }
                    hitSlop={8}
                    accessibilityLabel={`Remove meal ${i + 1}`}
                    style={tr.iconBtn}
                  >
                    <CloseIcon />
                  </Pressable>
                </View>
                <View style={wr.macroRow}>
                  {(
                    [
                      ['kcal', 'kcal'],
                      ['proteinG', 'protein g'],
                      ['carbsG', 'carbs g'],
                      ['fatG', 'fat g'],
                    ] as const
                  ).map(([field, unit]) => (
                    <View key={field} style={wr.macro}>
                      <NumField
                        value={m[field] ?? null}
                        label={`Meal ${i + 1} ${unit}`}
                        style={[wr.num, { width: '100%' }]}
                        maxLength={4}
                        onChange={(n) =>
                          setMeal(i, {
                            // Calories and protein are always numbers; carbs and fat may be left out.
                            [field]:
                              field === 'kcal' || field === 'proteinG'
                                ? (n ?? 0)
                                : (n ?? undefined),
                          } as Partial<PlanMeal>)
                        }
                      />
                      <Text style={wr.macroUnit}>{unit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <Pressable
              onPress={() =>
                set({
                  nutrition: {
                    ...plan,
                    meals: [
                      ...plan.meals,
                      { id: newId('m_'), name: '', kcal: 0, proteinG: 0 },
                    ],
                  },
                })
              }
              hitSlop={6}
            >
              <Text style={[tr.linkText, tr.accentText]}>Add a meal</Text>
            </Pressable>
            <Pressable onPress={() => set({ nutrition: null })} hitSlop={6}>
              <Text style={tr.linkText}>Remove the meal plan</Text>
            </Pressable>
          </Card>
        ) : (
          <Card style={{ gap: space.md }}>
            <Text style={tr.emptyText}>
              Optional. Daily calories and protein, plus meals followers can log
              in one tap on Today.
            </Text>
            <Pressable
              onPress={() =>
                set({ nutrition: { kcal: null, proteinG: null, meals: [] } })
              }
              style={({ pressed }) => [tr.ghostBtn, pressed && tr.pressed]}
            >
              <Text style={tr.ghostText}>Add a meal plan</Text>
            </Pressable>
          </Card>
        )}

        <View style={{ marginTop: space.xl, gap: space.md }}>
          {problems.map((t) => (
            <Text key={t} style={[tr.readWarn, { fontSize: 14 }]}>
              {t}
            </Text>
          ))}
          {error ? (
            <Text style={[tr.readWarn, { fontSize: 14 }]}>{error}</Text>
          ) : null}
          {busy ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <PrimaryButton label="Save program" onPress={() => void save()} />
          )}
          {p.id && !busy ? (
            confirmDelete ? (
              <View style={{ gap: space.sm }}>
                <Text style={tr.emptyText}>
                  Delete {p.title || 'this program'}? Everyone following it
                  stops following. This can’t be undone.
                </Text>
                <View style={tr.chips}>
                  <Chip
                    label="Delete program"
                    danger
                    on
                    onPress={() => void remove()}
                  />
                  <Chip
                    label="Keep it"
                    onPress={() => setConfirmDelete(false)}
                  />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setConfirmDelete(true)}
                hitSlop={6}
                style={{ alignSelf: 'center', padding: space.sm }}
              >
                <Text style={[tr.linkText, tr.accentText]}>Delete program</Text>
              </Pressable>
            )
          ) : null}
        </View>
      </Screen>

      {picking != null ? (
        <ExercisePicker
          exercises={data.exercises}
          recent={recent}
          last={previous}
          bodyKg={data.bodyKg}
          single={false}
          onClose={() => setPicking(null)}
          onCreate={async (ex: Exercise) => {
            const mine = await addCustomExercise(ex);
            const exercises = [
              ...data.exercises.filter((e) => !e.custom),
              ...mine,
            ];
            setData({
              ...data,
              exercises,
              exById: new Map(exercises.map((e) => [e.id, e])),
            });
          }}
          onPick={(ids) => {
            setDay(picking, {
              exercises: [
                ...p.days[picking].exercises,
                ...ids.map(programExercise),
              ],
            });
            setPicking(null);
          }}
        />
      ) : null}
    </View>
  );
}

const wr = StyleSheet.create({
  num: {
    width: 52,
    textAlign: 'center',
    backgroundColor: palette.surface2,
    borderRadius: 10,
    paddingVertical: 8,
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  // minWidth 0 lets the name shrink on web, keeping Remove day in the card.
  dayName: { paddingVertical: 4, paddingHorizontal: 0, minWidth: 0 },
  exRow: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  exName: { color: palette.text, fontSize: 15, fontWeight: '600' },
  noteInput: { color: palette.textMuted, fontSize: 13, paddingVertical: 4 },
  addRow: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  mealRow: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  macroRow: { flexDirection: 'row', gap: space.sm },
  macro: { flex: 1, alignItems: 'center', gap: 2 },
  macroUnit: { color: palette.textFaint, fontSize: 11 },
});

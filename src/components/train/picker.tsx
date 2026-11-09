/**
 * picker.tsx: choosing exercises. Recent ones first, a search that reads
 * gym shorthand ("rdl", "db bench"), muscle filters, several at once, and
 * a new exercise made in two taps when the library doesn't have it.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CheckIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/ui/icons';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  EQUIPMENT_LABEL,
  MUSCLES,
  MUSCLE_LABEL,
  customExercise,
  exerciseMap,
  matchExercise,
  searchExercises,
  type Exercise,
  type ExerciseKind,
  type Muscle,
} from '@/lib/train/exercises';
import { setScore, setText, type WorkSet } from '@/lib/train/workout';

import { Chip } from './bits';
import { tr } from './styles';

export function ExercisePicker({
  exercises,
  recent,
  last,
  bodyKg,
  single,
  onPick,
  onCreate,
  onClose,
}: {
  exercises: Exercise[];
  /** Exercise ids, most recently done first. */
  recent: string[];
  /** Last time's sets per exercise, to show the top set beside each name. */
  last: Map<string, WorkSet[]>;
  bodyKg: number;
  /** Replace mode: one tap picks and closes. */
  single: boolean;
  onPick: (ids: string[]) => void;
  onCreate: (ex: Exercise) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState<Muscle | null>(null);
  const [newKind, setNewKind] = useState<ExerciseKind>('weighted');

  const byId = useMemo(() => exerciseMap(exercises), [exercises]);
  const results = useMemo(
    () => searchExercises(query, exercises, muscle),
    [query, exercises, muscle],
  );
  const recentList = useMemo(
    () =>
      recent
        .map((id) => byId.get(id))
        .filter((e): e is Exercise => !!e)
        .slice(0, 8),
    [recent, byId],
  );
  const typed = query.trim();
  // "bench" is already Bench press, so don't offer to create it.
  const exact = !!typed && matchExercise(typed, exercises, 100) != null;

  const toggle = (id: string) => {
    if (single) {
      onPick([id]);
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const topSet = (ex: Exercise) => {
    const sets = last.get(ex.id)?.filter((s) => s.type !== 'warmup') ?? [];
    let best: WorkSet | null = null;
    for (const s of sets) {
      if (!best || setScore(s, ex, bodyKg) > setScore(best, ex, bodyKg))
        best = s;
    }
    return best;
  };

  const row = (ex: Exercise, section: string) => {
    const on = picked.includes(ex.id);
    const top = topSet(ex);
    return (
      <Pressable
        key={`${section}:${ex.id}`}
        onPress={() => toggle(ex.id)}
        accessibilityRole={single ? 'button' : 'checkbox'}
        aria-checked={single ? undefined : on}
        style={({ pressed }) => [
          tr.pickRow,
          pressed && { backgroundColor: palette.surface2 },
        ]}
      >
        <View style={tr.flex1}>
          <Text style={tr.pickName}>{ex.name}</Text>
          <Text style={tr.pickMeta} numberOfLines={1}>
            {[
              MUSCLE_LABEL[ex.muscle],
              EQUIPMENT_LABEL[ex.equipment],
              top ? `last ${setText(top, ex)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {single ? null : (
          <View style={[tr.tickCircle, on && tr.tickCircleDone]}>
            {on ? <CheckIcon size={14} color={palette.surface} /> : null}
          </View>
        )}
      </Pressable>
    );
  };

  const create = async () => {
    if (!newMuscle || !typed) return;
    const ex = customExercise(typed, newMuscle, newKind);
    await onCreate(ex);
    setCreating(false);
    setQuery('');
    toggle(ex.id);
  };

  return (
    <View style={tr.sheet}>
      <SafeAreaView style={tr.flex1}>
        <View style={tr.sheetInner}>
          <View style={tr.topBar}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={tr.linkText}>Cancel</Text>
            </Pressable>
            <Text style={tr.strong}>
              {single ? 'Replace exercise' : 'Add exercises'}
            </Text>
            {single ? (
              <View style={{ width: 52 }} />
            ) : (
              <Pressable
                onPress={() => onPick(picked)}
                disabled={!picked.length}
                style={({ pressed }) => [
                  tr.smallPill,
                  !picked.length && tr.disabled,
                  pressed && tr.pressed,
                ]}
              >
                <Text style={tr.smallPillText}>
                  {picked.length ? `Add ${picked.length}` : 'Add'}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={tr.searchWrap}>
            <SearchIcon />
            <TextInput
              style={tr.searchInput}
              placeholder="Search: bench, rdl, lat pulldown"
              placeholderTextColor={palette.textDim}
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setCreating(false);
              }}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityLabel="Clear search"
              >
                <CloseIcon />
              </Pressable>
            ) : null}
          </View>

          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={tr.muscleRow}
              keyboardShouldPersistTaps="handled"
            >
              <Chip
                label="All"
                on={muscle == null}
                onPress={() => setMuscle(null)}
              />
              {MUSCLES.map((m) => (
                <Chip
                  key={m.id}
                  label={m.label}
                  on={muscle === m.id}
                  onPress={() => setMuscle(muscle === m.id ? null : m.id)}
                />
              ))}
            </ScrollView>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 64 }}
          >
            {typed && !exact ? (
              creating ? (
                <Card style={tr.createCard}>
                  <Text style={tr.strong}>
                    {typed.charAt(0).toUpperCase() + typed.slice(1)}
                  </Text>
                  <Text style={tr.menuLabel}>MAIN MUSCLE</Text>
                  <View style={tr.chips}>
                    {MUSCLES.map((m) => (
                      <Chip
                        key={m.id}
                        label={m.label}
                        on={newMuscle === m.id}
                        onPress={() => setNewMuscle(m.id)}
                      />
                    ))}
                  </View>
                  <Text style={tr.menuLabel}>LOGGED AS</Text>
                  <View style={tr.chips}>
                    <Chip
                      label="Weight and reps"
                      on={newKind === 'weighted'}
                      onPress={() => setNewKind('weighted')}
                    />
                    <Chip
                      label="Bodyweight reps"
                      on={newKind === 'bodyweight'}
                      onPress={() => setNewKind('bodyweight')}
                    />
                  </View>
                  <PrimaryButton
                    label={
                      newMuscle ? 'Create exercise' : 'Pick the main muscle'
                    }
                    disabled={!newMuscle}
                    onPress={() => void create()}
                  />
                </Card>
              ) : (
                <Pressable
                  onPress={() => setCreating(true)}
                  style={({ pressed }) => [
                    tr.pickRow,
                    { borderTopWidth: 0 },
                    pressed && tr.pressed,
                  ]}
                >
                  <PlusIcon color={palette.accent} />
                  <Text style={[tr.pickName, tr.accentText]}>
                    Create “{typed}”
                  </Text>
                </Pressable>
              )
            ) : null}

            {!typed && !muscle && recentList.length ? (
              <>
                <Text style={tr.listSection}>RECENT</Text>
                {recentList.map((e) => row(e, 'recent'))}
              </>
            ) : null}

            <Text style={tr.listSection}>
              {typed
                ? 'RESULTS'
                : muscle
                  ? MUSCLE_LABEL[muscle].toUpperCase()
                  : 'ALL EXERCISES'}
            </Text>
            {results.map((e) => row(e, 'all'))}
            {results.length === 0 ? (
              <Text style={[tr.faint, { paddingHorizontal: 16 }]}>
                Nothing matches. Create it above.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

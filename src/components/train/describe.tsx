/**
 * describe.tsx: log a workout by writing it down or saying it, for today or
 * any day before. Read on the device as you type, so what will be saved is
 * on screen before you save it. This is also how old training notes get in.
 */

import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { VoiceButton } from '@/components/log/meal-composer';
import { CloseIcon } from '@/components/ui/icons';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { todayKey } from '@/lib/log-store';
import { describeWorkout } from '@/lib/train/describe';
import { newId, searchExercises, type Exercise } from '@/lib/train/exercises';
import { saveWorkout } from '@/lib/train/store';
import {
  autoName,
  canTick,
  setText,
  type SetValues,
  type Workout,
  type WorkoutExercise,
} from '@/lib/train/workout';

import { DayStepper, nb } from './bits';
import type { Training } from './data';
import { tr } from './styles';

const EXAMPLE = 'bench 80x8, 80x8, 85x6\nsquat 100kg 5x5\npull ups 3x10';

interface Item {
  key: string;
  name: string;
  ex: Exercise | null;
  sets: SetValues[];
}

export function DescribePanel({
  data,
  onSaved,
  onClose,
}: {
  data: Training;
  onSaved: (w: Workout) => void;
  onClose: () => void;
}) {
  const today = todayKey();
  const [day, setDay] = useState(today);
  const [input, setInput] = useState('');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(
    () => describeWorkout(input, data.exercises),
    [input, data.exercises],
  );
  const items: Item[] = parsed.exercises
    .map((e, i) => {
      const key = `${i}:${e.name}`;
      const picked = picks[key] ? data.exById.get(picks[key]) : undefined;
      return { key, name: e.name, ex: picked ?? e.exercise, sets: e.sets };
    })
    .filter((it) => !removed.includes(it.key));

  const complete = (it: Item) =>
    it.ex ? it.sets.filter((s) => canTick(s, it.ex!)) : [];
  const sets = items.reduce((n, it) => n + complete(it).length, 0);
  const lifts = items.filter((it) => complete(it).length > 0).length;
  const unpicked = items.filter((it) => !it.ex).length;
  const canSave = sets > 0 && unpicked === 0 && !saving;

  const save = async () => {
    setSaving(true);
    const exercises: WorkoutExercise[] = items
      .filter((it) => it.ex && complete(it).length)
      .map((it) => ({
        id: newId('e_'),
        exerciseId: it.ex!.id,
        sets: complete(it).map((s) => ({
          id: newId('s_'),
          kg: s.kg,
          reps: s.reps,
          type: 'working' as const,
          done: true,
        })),
      }));
    // The time of day isn't known for an earlier day; noon keeps the date safe.
    const [y, m, d] = day.split('-').map(Number);
    const at = (
      day === today ? new Date() : new Date(y, m - 1, d, 12)
    ).toISOString();
    const w: Workout = {
      id: newId('w_'),
      name: parsed.title ?? autoName(exercises, data.exById) ?? 'Workout',
      date: day,
      startedAt: at,
      endedAt: at,
      exercises,
      source: 'described',
    };
    await saveWorkout(w);
    setSaving(false);
    onSaved(w);
  };

  return (
    <Card style={tr.describeCard}>
      <View style={[tr.row, { justifyContent: 'space-between' }]}>
        <Text style={tr.strong}>Describe a workout</Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
          <CloseIcon />
        </Pressable>
      </View>

      <DayStepper value={day} today={today} onChange={setDay} />

      <TextInput
        style={tr.describeInput}
        multiline
        value={input}
        onChangeText={setInput}
        placeholder={EXAMPLE}
        placeholderTextColor={palette.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Your workout, one exercise per line"
      />

      <View style={[tr.row, { gap: 12 }]}>
        <VoiceButton
          what="workout"
          onHeard={(heard) =>
            setInput((t) => (t.trim() ? `${t.trim()}\n${heard}` : heard))
          }
        />
      </View>

      {!input.trim() ? (
        <Text style={tr.faint}>
          One exercise per line. 80x8, 5x5 at 100, 3 sets of 12 at 60, and 50
          for 8 8 7 all read. Pounds turn into kilograms.
        </Text>
      ) : null}

      {items.length ? (
        <View>
          {items.map((it) => {
            // Until the exercise is picked, show the sets as read.
            const kind = it.ex ?? { kind: 'weighted' as const };
            const ok = it.ex ? complete(it) : it.sets;
            const missing = it.ex ? it.sets.length - ok.length : 0;
            const shown = ok.filter((s) => (s.reps ?? 0) > 0);
            return (
              <View key={it.key}>
                <View style={tr.readRow}>
                  <View style={tr.flex1}>
                    {it.ex ? (
                      <Pressable
                        onPress={() => {
                          setPicking(picking === it.key ? null : it.key);
                          setSearch(it.name);
                        }}
                      >
                        <Text style={tr.strong}>{it.ex.name}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setPicking(it.key);
                          setSearch(it.name);
                        }}
                      >
                        <Text style={[tr.strong, tr.accentText]}>
                          “{it.name}”: pick the exercise
                        </Text>
                      </Pressable>
                    )}
                    <Text style={tr.readSets}>
                      {shown.length
                        ? shown.map((s) => nb(setText(s, kind))).join(',  ')
                        : 'No sets read yet'}
                    </Text>
                    {missing > 0 ? (
                      <Text style={tr.readWarn}>
                        {missing} {missing === 1 ? 'set needs' : 'sets need'} a{' '}
                        {it.sets.some((s) => s.reps == null)
                          ? 'rep count'
                          : 'weight'}{' '}
                        and won’t be saved
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => setRemoved([...removed, it.key])}
                    hitSlop={8}
                    accessibilityLabel={`Leave out ${it.ex?.name ?? it.name}`}
                    style={tr.iconBtn}
                  >
                    <CloseIcon size={12} />
                  </Pressable>
                </View>
                {picking === it.key ? (
                  <View style={{ gap: 6, paddingBottom: 8 }}>
                    <TextInput
                      style={tr.input}
                      value={search}
                      onChangeText={setSearch}
                      autoFocus
                      autoCapitalize="none"
                      placeholder="Search exercises"
                      placeholderTextColor={palette.textDim}
                    />
                    {searchExercises(search, data.exercises)
                      .slice(0, 5)
                      .map((ex) => (
                        <Pressable
                          key={ex.id}
                          onPress={() => {
                            setPicks({ ...picks, [it.key]: ex.id });
                            setPicking(null);
                          }}
                          style={({ pressed }) => [
                            tr.quickRow,
                            pressed && tr.pressed,
                          ]}
                        >
                          <Text style={tr.quickTitle}>{ex.name}</Text>
                        </Pressable>
                      ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {parsed.unread.length ? (
        <Text style={tr.faint}>Couldn’t read: {parsed.unread.join(', ')}</Text>
      ) : null}

      {input.trim() ? (
        <PrimaryButton
          label={
            unpicked
              ? `Pick ${unpicked === 1 ? 'the exercise' : `${unpicked} exercises`} first`
              : sets
                ? `Save ${lifts} ${lifts === 1 ? 'exercise' : 'exercises'}, ${sets} ${sets === 1 ? 'set' : 'sets'}`
                : 'Nothing to save yet'
          }
          disabled={!canSave}
          onPress={() => void save()}
        />
      ) : null}
    </Card>
  );
}

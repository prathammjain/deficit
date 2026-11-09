/**
 * summary.tsx: what a finished workout shows. The numbers first, records
 * called out, then one tap to keep the layout as a routine.
 */

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { formatToday } from '@/lib/date';
import type { Exercise } from '@/lib/train/exercises';
import {
  durationText,
  formatKg,
  prSets,
  setScore,
  setText,
  workoutStats,
  type Bests,
  type Workout,
} from '@/lib/train/workout';

import { nb, Stat } from './bits';
import { tr } from './styles';

export interface RecordLine {
  name: string;
  set: string;
  score: number;
  before: number;
}

/** The best record each exercise set in a workout. */
export function workoutRecords(
  w: Workout,
  exById: Map<string, Exercise>,
  bests: Map<string, Bests>,
  bodyKg: number,
): RecordLine[] {
  const out: RecordLine[] = [];
  for (const we of w.exercises) {
    const ex = exById.get(we.exerciseId);
    if (!ex) continue;
    const ids = prSets(we.sets, ex, bodyKg, bests.get(ex.id));
    const top = we.sets
      .filter((s) => ids.has(s.id))
      .sort((a, b) => setScore(b, ex, bodyKg) - setScore(a, ex, bodyKg))[0];
    if (top) {
      out.push({
        name: ex.name,
        set: nb(setText(top, ex)),
        score: setScore(top, ex, bodyKg),
        before: bests.get(ex.id)?.score ?? 0,
      });
    }
  }
  return out;
}

export function StatsRow({ w, records }: { w: Workout; records: number }) {
  const st = workoutStats(w);
  return (
    <View style={[tr.row, { marginTop: 4 }]}>
      <Stat value={String(st.sets)} label="Hard sets" flex={0.8} />
      <Stat
        value={`${st.volume.toLocaleString()} kg`}
        label="Volume"
        flex={1.4}
      />
      <Stat
        value={st.ms > 0 ? durationText(st.ms) : 'Not timed'}
        label="Time"
        flex={1.3}
      />
      <Stat
        value={String(records)}
        label={records === 1 ? 'Record' : 'Records'}
        flex={0.9}
      />
    </View>
  );
}

export function RecordsCard({ lines }: { lines: RecordLine[] }) {
  if (!lines.length) return null;
  return (
    <>
      <SectionLabel>Records</SectionLabel>
      <Card padded={false}>
        {lines.map((r, i) => (
          <View
            key={r.name}
            style={[tr.liftRow, i === 0 && { borderTopWidth: 0 }]}
          >
            <View style={tr.flex1}>
              <Text style={tr.liftName}>{r.name}</Text>
              <Text style={tr.liftMeta}>
                Est. 1RM {formatKg(r.score)} kg, best before{' '}
                {formatKg(r.before)} kg
              </Text>
            </View>
            <Text style={[tr.liftScore, tr.accentText]}>{r.set}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

export function FinishSummary({
  workout,
  exById,
  bests,
  bodyKg,
  onDone,
  onSaveRoutine,
}: {
  workout: Workout;
  exById: Map<string, Exercise>;
  bests: Map<string, Bests>;
  bodyKg: number;
  onDone: () => void;
  /** Saves the layout; resolves when stored. */
  onSaveRoutine: (name: string) => Promise<void>;
}) {
  const lines = workoutRecords(workout, exById, bests, bodyKg);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(workout.name);
  const [saved, setSaved] = useState<string | null>(null);
  const update = !!workout.routineId;

  return (
    <View>
      <Text style={tr.eyebrowAccent}>WORKOUT SAVED</Text>
      <Text style={[tr.nameInput, { marginTop: 6 }]}>{workout.name}</Text>
      <Text style={tr.sessionMeta}>
        {formatToday(new Date(workout.startedAt))}
      </Text>

      <Card style={{ marginTop: 20 }}>
        <StatsRow w={workout} records={lines.length} />
      </Card>

      <RecordsCard lines={lines} />

      <SectionLabel>Logged</SectionLabel>
      <Card padded={false}>
        {workout.exercises.map((we, i) => {
          const ex = exById.get(we.exerciseId);
          return (
            <View
              key={we.id}
              style={[tr.liftRow, i === 0 && { borderTopWidth: 0 }]}
            >
              <View style={tr.flex1}>
                <Text style={tr.liftName}>
                  {ex?.name ?? 'Unknown exercise'}
                </Text>
                <Text style={tr.readSets}>
                  {we.sets
                    .map((s) => nb(setText(s, ex ?? { kind: 'weighted' })))
                    .join(',  ')}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      <View style={{ gap: 12, marginTop: 28 }}>
        <PrimaryButton label="Done" onPress={onDone} />
        {saved ? (
          <Text style={[tr.muted, { textAlign: 'center' }]}>{saved}</Text>
        ) : naming ? (
          <Card style={{ gap: 12 }}>
            <Text style={tr.menuLabel}>ROUTINE NAME</Text>
            <TextInput
              style={tr.input}
              value={name}
              onChangeText={setName}
              autoFocus
              placeholder="Push A"
              placeholderTextColor={palette.textDim}
            />
            <Pressable
              onPress={async () => {
                await onSaveRoutine(name);
                setSaved(
                  `Saved as the routine “${name.trim() || workout.name}”.`,
                );
              }}
              style={({ pressed }) => [tr.ghostBtn, pressed && tr.pressed]}
            >
              <Text style={tr.ghostText}>Save routine</Text>
            </Pressable>
          </Card>
        ) : (
          <Pressable
            onPress={async () => {
              if (update) {
                await onSaveRoutine(workout.name);
                setSaved('Routine updated to match this workout.');
              } else setNaming(true);
            }}
            style={({ pressed }) => [tr.ghostBtn, pressed && tr.pressed]}
          >
            <Text style={tr.ghostText}>
              {update ? 'Update the routine to match' : 'Save as a routine'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

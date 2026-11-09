/**
 * mapping.tsx: which Grain exercise each imported name becomes. Clear
 * matches are already set; anything new is shown first, with a muscle
 * guessed, so a big import is checked in a minute.
 */

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  MUSCLES,
  MUSCLE_LABEL,
  searchExercises,
  type Exercise,
} from '@/lib/train/exercises';
import type { Mapping } from '@/lib/train/importer';

import { Chip } from './bits';
import { tr } from './styles';

export type Choice = Mapping | 'skip';

export function MappingList({
  names,
  choices,
  exercises,
  exById,
  onChange,
}: {
  names: { name: string; sets: number }[];
  choices: Map<string, Choice>;
  exercises: Exercise[];
  exById: Map<string, Exercise>;
  onChange: (name: string, choice: Choice) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const isNew = (n: string) => {
    const c = choices.get(n);
    return c != null && c !== 'skip' && c.to === 'new';
  };
  const sorted = [...names].sort(
    (a, b) => Number(isNew(b.name)) - Number(isNew(a.name)) || b.sets - a.sets,
  );
  const fresh = names.filter((n) => isNew(n.name)).length;

  return (
    <View>
      <Text style={[tr.faint, { marginBottom: 8 }]}>
        {names.length} {names.length === 1 ? 'exercise' : 'exercises'}
        {fresh ? `, ${fresh} new to Grain` : ''}. Tap one to change it.
      </Text>
      <Card padded={false}>
        {sorted.map((n, i) => (
          <Row
            key={n.name}
            first={i === 0}
            name={n.name}
            sets={n.sets}
            choice={choices.get(n.name) ?? 'skip'}
            open={open === n.name}
            exercises={exercises}
            exById={exById}
            onToggle={() => setOpen(open === n.name ? null : n.name)}
            onChange={(c) => onChange(n.name, c)}
          />
        ))}
      </Card>
    </View>
  );
}

function Row({
  first,
  name,
  sets,
  choice,
  open,
  exercises,
  exById,
  onToggle,
  onChange,
}: {
  first: boolean;
  name: string;
  sets: number;
  choice: Choice;
  open: boolean;
  exercises: Exercise[];
  exById: Map<string, Exercise>;
  onToggle: () => void;
  onChange: (c: Choice) => void;
}) {
  const [query, setQuery] = useState('');
  const target =
    choice === 'skip'
      ? 'Left out'
      : choice.to === 'existing'
        ? (exById.get(choice.exerciseId)?.name ?? 'Unknown exercise')
        : `New: ${choice.name} · ${MUSCLE_LABEL[choice.muscle]}`;
  const fresh = choice !== 'skip' && choice.to === 'new';
  const draft =
    choice !== 'skip' && choice.to === 'new'
      ? choice
      : {
          to: 'new' as const,
          name,
          muscle: 'chest' as const,
          kind: 'weighted' as const,
        };

  return (
    <View style={[tr.histRow, first && { borderTopWidth: 0 }]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [tr.row, { gap: 12 }, pressed && tr.pressed]}
      >
        <View style={tr.flex1}>
          <Text style={tr.histName} numberOfLines={1}>
            {name}
          </Text>
          <Text
            style={[
              tr.histLifts,
              fresh && tr.accentText,
              choice === 'skip' && tr.faint,
            ]}
            numberOfLines={1}
          >
            {choice !== 'skip' && choice.to === 'existing'
              ? `Becomes ${target}`
              : target}
          </Text>
        </View>
        <Text style={tr.histStat}>{sets} sets</Text>
      </Pressable>

      {open ? (
        <View style={{ gap: 10, marginTop: 12 }}>
          <TextInput
            style={tr.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Find a Grain exercise"
            placeholderTextColor={palette.textDim}
            autoCapitalize="none"
          />
          {(query ? searchExercises(query, exercises) : [])
            .slice(0, 5)
            .map((ex) => (
              <Pressable
                key={ex.id}
                onPress={() => {
                  onChange({ to: 'existing', exerciseId: ex.id });
                  setQuery('');
                  onToggle();
                }}
                style={({ pressed }) => [tr.quickRow, pressed && tr.pressed]}
              >
                <View style={tr.flex1}>
                  <Text style={tr.quickTitle}>{ex.name}</Text>
                  <Text style={tr.quickMeta}>{MUSCLE_LABEL[ex.muscle]}</Text>
                </View>
              </Pressable>
            ))}

          <Text style={tr.menuLabel}>OR KEEP IT AS A NEW EXERCISE</Text>
          <TextInput
            style={tr.input}
            value={draft.name}
            onChangeText={(t) => onChange({ ...draft, name: t })}
            placeholder="Name"
            placeholderTextColor={palette.textDim}
          />
          <View style={tr.chips}>
            {MUSCLES.map((m) => (
              <Chip
                key={m.id}
                label={m.label}
                on={fresh && draft.muscle === m.id}
                onPress={() => onChange({ ...draft, muscle: m.id })}
              />
            ))}
          </View>
          <View style={tr.chips}>
            <Chip
              label="Weight and reps"
              on={fresh && draft.kind === 'weighted'}
              onPress={() => onChange({ ...draft, kind: 'weighted' })}
            />
            <Chip
              label="Bodyweight reps"
              on={fresh && draft.kind === 'bodyweight'}
              onPress={() => onChange({ ...draft, kind: 'bodyweight' })}
            />
          </View>
          <View style={tr.chips}>
            <Chip
              label={choice === 'skip' ? 'Left out' : 'Leave it out'}
              danger
              on={choice === 'skip'}
              onPress={() => onChange('skip')}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

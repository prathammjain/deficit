/**
 * Import history: a Strong or Hevy export, any training spreadsheet saved
 * as CSV, or pasted notes. Read on the phone, checked on one screen, saved
 * in one go. Importing the same file again updates instead of doubling.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Chip, DayStepper, Tabs } from '@/components/train/bits';
import { useTraining } from '@/components/train/data';
import { MappingList, type Choice } from '@/components/train/mapping';
import { tr } from '@/components/train/styles';
import { ChevronIcon } from '@/components/ui/icons';
import {
  Card,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { shortDate } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import {
  buildImport,
  importNames,
  readCsv,
  readNotes,
  suggestMappings,
  type ImportResult,
  type Mapping,
} from '@/lib/train/importer';
import { addCustomExercises, importWorkouts } from '@/lib/train/store';

type Tab = 'file' | 'notes';

const SOURCE_LABEL: Record<ImportResult['source'], string> = {
  strong: 'Strong export',
  hevy: 'Hevy export',
  csv: 'Spreadsheet',
  notes: 'Your notes',
};

const NOTES_EXAMPLE = `Mon 3 Nov: Push
bench 80x8, 85x6
ohp 50 for 8 8 7

5 Nov
squat 100 5x5
rdl 90 3x8`;

export default function ImportScreen() {
  const { data, reload } = useTraining();
  const today = todayKey();
  const [tab, setTab] = useState<Tab>('file');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [notes, setNotes] = useState('');
  const [undated, setUndated] = useState(today);
  const [overrides, setOverrides] = useState<Record<string, Choice>>({});
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exercises = data?.exercises;
  const result = useMemo(() => {
    if (!exercises) return null;
    if (tab === 'file') return file ? readCsv(file.text, unit) : null;
    return notes.trim() ? readNotes(notes, exercises, today, undated) : null;
  }, [tab, file, unit, notes, exercises, today, undated]);

  const suggested = useMemo(
    () =>
      result && exercises
        ? suggestMappings(result, exercises)
        : new Map<string, Mapping>(),
    [result, exercises],
  );
  const names = useMemo(() => (result ? importNames(result) : []), [result]);

  if (!data) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const choices = new Map<string, Choice>(
    names.map((n) => [
      n.name,
      overrides[n.name] ?? suggested.get(n.name) ?? 'skip',
    ]),
  );
  const mappings = new Map<string, Mapping>(
    [...choices].filter((e): e is [string, Mapping] => e[1] !== 'skip'),
  );
  const built = result ? buildImport(result, mappings) : null;
  const known = new Set(data.workouts.map((w) => w.id));
  const already = built?.workouts.filter((w) => known.has(w.id)).length ?? 0;
  const sets =
    built?.workouts.reduce(
      (n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0),
      0,
    ) ?? 0;
  const first = built?.workouts[0]?.date;
  const last = built?.workouts[built.workouts.length - 1]?.date;

  const pickFile = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      void f.text().then((text) => {
        setOverrides({});
        setDone(null);
        if (!readCsv(text)) {
          setFile(null);
          setError(
            'This file has no columns Grain knows. It needs a date, an exercise and reps, like a Strong or Hevy export.',
          );
          return;
        }
        setError(null);
        setFile({ name: f.name, text });
      });
    };
    input.click();
  };

  const save = async () => {
    if (!built?.workouts.length) return;
    setError(null);
    setSaving({ done: 0, total: built.workouts.length });
    try {
      if (built.exercises.length) await addCustomExercises(built.exercises);
      await importWorkouts(built.workouts, (d, total) =>
        setSaving({ done: d, total }),
      );
      await reload();
      setDone(built.workouts.length);
      setFile(null);
      setNotes('');
      setOverrides({});
    } catch {
      setError(
        'The import stopped partway. Check your connection and import again; nothing will be doubled.',
      );
    }
    setSaving(null);
  };

  return (
    <Screen>
      <Pressable
        onPress={() => router.navigate('/train')}
        hitSlop={8}
        style={({ pressed }) => [
          tr.row,
          { gap: 4, alignSelf: 'flex-start' },
          pressed && tr.pressed,
        ]}
      >
        <ChevronIcon color={palette.textMuted} />
        <Text style={tr.linkText}>Train</Text>
      </Pressable>
      <Text style={[tr.nameInput, { marginTop: 16 }]}>Import history</Text>
      <Text style={tr.sessionMeta}>
        Bring your past training in, so records, progress and last time’s
        numbers start from where you really are.
      </Text>

      {done != null ? (
        <Card style={{ marginTop: 20, gap: 12 }}>
          <Text style={tr.eyebrowAccent}>IMPORTED</Text>
          <Text style={tr.resumeName}>
            {done} {done === 1 ? 'workout' : 'workouts'} added
          </Text>
          <Text style={tr.emptyText}>
            Records, progress and the numbers the logger suggests now include
            them.
          </Text>
          <PrimaryButton
            label="Back to Train"
            onPress={() => router.navigate('/train')}
          />
        </Card>
      ) : null}

      <Tabs
        options={[
          { id: 'file', label: 'From a file' },
          { id: 'notes', label: 'From notes' },
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setOverrides({});
          setError(null);
        }}
      />

      {tab === 'file' ? (
        <Card style={{ marginTop: 16, gap: 12 }}>
          <Text style={tr.body}>
            Strong: Settings, Export data. Hevy: Settings, Export and import
            data, Export workouts. Or any spreadsheet saved as CSV with date,
            exercise, weight and reps columns.
          </Text>
          <Pressable
            onPress={pickFile}
            style={({ pressed }) => [tr.ghostBtn, pressed && tr.pressed]}
          >
            <Text style={tr.ghostText}>
              {file ? 'Choose another file' : 'Choose a CSV file'}
            </Text>
          </Pressable>
          {file ? <Text style={tr.faint}>{file.name}</Text> : null}
        </Card>
      ) : (
        <Card style={{ marginTop: 16, gap: 12 }}>
          <Text style={tr.body}>
            Paste a training log. Put a date on its own line before each day;
            the sets are read the same way as Describe a workout.
          </Text>
          <TextInput
            style={[tr.describeInput, { minHeight: 180 }]}
            multiline
            value={notes}
            onChangeText={(t) => {
              setNotes(t);
              setDone(null);
            }}
            placeholder={NOTES_EXAMPLE}
            placeholderTextColor={palette.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Your training notes"
          />
          <Text style={tr.menuLabel}>NOTES WITHOUT A DATE GO ON</Text>
          <DayStepper value={undated} today={today} onChange={setUndated} />
        </Card>
      )}

      {error ? (
        <Text style={[tr.readWarn, { marginTop: 12, fontSize: 13 }]}>
          {error}
        </Text>
      ) : null}

      {result && built ? (
        <>
          <SectionLabel>What will be imported</SectionLabel>
          <Card style={{ gap: 8 }}>
            <Text style={tr.menuLabel}>
              {SOURCE_LABEL[result.source].toUpperCase()}
            </Text>
            <Text style={tr.summaryValue}>
              {built.workouts.length}{' '}
              {built.workouts.length === 1 ? 'workout' : 'workouts'},{' '}
              {sets.toLocaleString()} sets
            </Text>
            {first && last ? (
              <Text style={tr.summarySub}>
                {first === last
                  ? shortDate(first)
                  : `${shortDate(first)} to ${shortDate(last)}`}
              </Text>
            ) : null}
            {already ? (
              <Text style={tr.summarySub}>
                {already} of these are already in Grain and will be updated, not
                doubled.
              </Text>
            ) : null}
            {result.skipped ? (
              <Text style={tr.summarySub}>
                {result.skipped} {result.skipped === 1 ? 'row' : 'rows'} left
                out: timed or distance work, rest timers or lines that weren’t
                sets.
              </Text>
            ) : null}
            {result.unit === 'unknown' ? (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={tr.label}>
                  The file doesn’t say its unit. Weights are in
                </Text>
                <View style={tr.chips}>
                  <Chip
                    label="kg"
                    on={unit === 'kg'}
                    onPress={() => setUnit('kg')}
                  />
                  <Chip
                    label="lb"
                    on={unit === 'lb'}
                    onPress={() => setUnit('lb')}
                  />
                </View>
              </View>
            ) : null}
          </Card>

          {names.length ? (
            <>
              <SectionLabel>Exercises</SectionLabel>
              <MappingList
                names={names}
                choices={choices}
                exercises={data.exercises}
                exById={data.exById}
                onChange={(name, choice) =>
                  setOverrides({ ...overrides, [name]: choice })
                }
              />
            </>
          ) : null}

          <View style={{ marginTop: 24, gap: 12 }}>
            {saving ? (
              <View style={{ gap: 8 }}>
                <Text style={tr.muted}>
                  Saving {saving.done} of {saving.total}
                </Text>
                <ProgressBar
                  fraction={saving.total ? saving.done / saving.total : 0}
                />
              </View>
            ) : (
              <PrimaryButton
                label={
                  built.workouts.length
                    ? `Import ${built.workouts.length} ${built.workouts.length === 1 ? 'workout' : 'workouts'}`
                    : 'Nothing to import'
                }
                disabled={!built.workouts.length}
                onPress={() => void save()}
              />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

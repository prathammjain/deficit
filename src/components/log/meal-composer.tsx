import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  CloseIcon,
  MicIcon,
  PlusIcon,
  SearchIcon,
  StopIcon,
} from '@/components/ui/icons';
import { Card, GlassSurface, PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  foodProvider,
  swapParsedItem,
  type FoodItem,
  type ParsedItem,
  type RoastInput,
} from '@/lib/food';
import { portionedEntry, type LogEntry } from '@/lib/log-store';
import { isWeighed, stepperLabel, stepQuantity } from '@/lib/quantity';
import { loadRoastMode, saveRoastMode } from '@/lib/roast-setting';
import {
  canRecord,
  MAX_SECONDS,
  startRecording,
  type Recording,
} from '@/lib/voice';

import { EngineStatus, SourceTag } from './engine-status';
import { ConfidenceBadge, FoodLine } from './meal-bits';
import { st } from './styles';

type Mode = 'describe' | 'search' | 'custom';
const MODES: { id: Mode; label: string }[] = [
  { id: 'describe', label: 'Describe' },
  { id: 'search', label: 'Search' },
  { id: 'custom', label: 'Custom' },
];

/** The day so far, which GrainAI roasts against. */
type DaySoFar = Omit<RoastInput['day'], 'hour'>;

export function MealComposer({
  onAdd,
  onAddMany,
  day,
}: {
  onAdd: (e: Omit<LogEntry, 'id' | 'at'>) => void;
  onAddMany: (e: Omit<LogEntry, 'id' | 'at'>[]) => void;
  day: DaySoFar;
}) {
  // Describing the meal is the main way to log, so it is open by default.
  const [mode, setMode] = useState<Mode>('describe');
  const [roastOn, setRoastOn] = useState(false);
  useEffect(() => {
    loadRoastMode().then(setRoastOn);
  }, []);
  const toggleRoast = () => {
    setRoastOn(!roastOn);
    void saveRoastMode(!roastOn);
  };

  return (
    <View>
      <View style={st.modeRow}>
        {MODES.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMode(m.id)}
            hitSlop={6}
            style={st.modeBtn}
          >
            <Text style={[st.modeText, mode === m.id && st.modeTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
        {mode === 'describe' && foodProvider.roast ? (
          <Pressable
            onPress={toggleRoast}
            hitSlop={6}
            accessibilityRole="switch"
            accessibilityState={{ checked: roastOn }}
            style={[st.roastToggle, roastOn && st.roastToggleOn]}
          >
            <Text style={[st.roastToggleText, roastOn && st.roastToggleTextOn]}>
              Roast me
            </Text>
          </Pressable>
        ) : null}
      </View>
      <EngineStatus />

      {mode === 'describe' ? (
        <DescribeMeal
          onLog={onAddMany}
          day={day}
          roastOn={roastOn && !!foodProvider.roast}
        />
      ) : null}
      {mode === 'search' ? <SearchFood onAdd={onAdd} /> : null}
      {mode === 'custom' ? <CustomMeal onAdd={onAdd} /> : null}
    </View>
  );
}

function SearchFood({
  onAdd,
}: {
  onAdd: (e: Omit<LogEntry, 'id' | 'at'>) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);

  useEffect(() => {
    let alive = true;
    const q = query.trim();
    // Debounce search as you type: fewer redundant lookups, and it keeps
    // setState out of the synchronous effect body (no cascading renders).
    const id = setTimeout(() => {
      if (!alive) return;
      if (q.length < 1) {
        setResults([]);
        return;
      }
      foodProvider.search(q).then((r) => {
        if (alive) setResults(r);
      });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query]);

  return (
    <View>
      <GlassSurface style={st.searchWrap}>
        <SearchIcon />
        <TextInput
          style={st.searchInput}
          placeholder="Roti, dal, paneer"
          placeholderTextColor={palette.textDim}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityLabel="Clear"
          >
            <CloseIcon />
          </Pressable>
        ) : null}
      </GlassSurface>

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
              ]}
            >
              <View style={st.flex1}>
                <Text style={st.resultName}>{f.name}</Text>
                <View style={st.resultMeta}>
                  <Text style={st.resultSub}>{f.serving}</Text>
                  <Text style={st.resultSub}>
                    P {f.proteinG} C {f.carbsG} F {f.fatG}
                  </Text>
                  <SourceTag source={f.source} />
                </View>
              </View>
              <Text style={st.resultKcal}>{f.kcal}</Text>
              <PlusIcon color={palette.accent} />
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function DescribeMeal({
  onLog,
  day,
  roastOn,
}: {
  onLog: (entries: Omit<LogEntry, 'id' | 'at'>[]) => void;
  day: DaySoFar;
  roastOn: boolean;
}) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);
  // Which engine item each row came from, kept in step with `items` so the
  // correction sent on Log can say what was removed.
  const [origins, setOrigins] = useState<number[]>([]);
  const [runId, setRunId] = useState<string | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const [calculated, setCalculated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [roast, setRoast] = useState<string | null>(null);

  const calc = async () => {
    if (!text.trim() || !foodProvider.parseMeal) return;
    setBusy(true);
    setRoast(null);
    const parsed = await foodProvider.parseMeal(text);
    // GrainAI's line arrives a moment after the numbers; it never holds
    // them up.
    if (roastOn) {
      foodProvider
        .roast?.({
          meal: text,
          items: parsed.items.map(({ item, quantity }) => ({
            name: item.name,
            kcal: Math.round(item.kcal * quantity),
            proteinG: Math.round(item.proteinG * quantity),
          })),
          day: { ...day, hour: new Date().getHours() },
        })
        .then(setRoast);
    }
    setItems(parsed.items);
    setOrigins(parsed.items.map((_, i) => i));
    setRunId(parsed.runId);
    setNote(parsed.note);
    setCalculated(true);
    setExpanded(null);
    setBusy(false);
  };

  const reset = () => {
    setText('');
    setRoast(null);
    setItems([]);
    setOrigins([]);
    setRunId(undefined);
    setNote(undefined);
    setCalculated(false);
    setExpanded(null);
  };

  // A spoken meal lands in the box, where it can be read and fixed before
  // matching. A second note adds to the first.
  const onHeard = (heard: string) =>
    setText((t) => (t.trim() ? `${t.trim()}, ${heard}` : heard));

  const stepItem = (idx: number, dir: 1 | -1) =>
    setItems((arr) =>
      arr.map((it, i) =>
        i === idx
          ? { ...it, quantity: stepQuantity(it.item.serving, it.quantity, dir) }
          : it,
      ),
    );
  const removeItem = (idx: number) => {
    setItems((arr) => arr.filter((_, i) => i !== idx));
    setOrigins((arr) => arr.filter((_, i) => i !== idx));
  };
  // Swap a wrong match for one of its alternates. The rules live in
  // swapParsedItem so they can be tested: getting them wrong logs a
  // fabricated number under a confident badge.
  const swapItem = (idx: number, alt: FoodItem) => {
    setItems((arr) =>
      arr.map((it, i) => (i === idx ? swapParsedItem(it, alt) : it)),
    );
    setExpanded(null);
  };

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
        placeholder="2 roti, 1 katori dal, 200g chicken breast"
        placeholderTextColor={palette.textDim}
        value={text}
        onChangeText={setText}
        multiline
      />
      <View style={st.describeFooter}>
        <VoiceButton onHeard={onHeard} />
        <PrimaryButton
          label={busy ? 'Matching' : 'Match'}
          disabled={busy || text.trim().length === 0}
          style={st.calcBtn}
          onPress={calc}
        />
      </View>

      {calculated ? (
        <View style={st.breakdown}>
          {roast ? (
            <View style={st.roast}>
              <Text style={st.roastLabel}>GRAINAI</Text>
              <Text style={st.roastLine}>{roast}</Text>
            </View>
          ) : null}
          {items.map((it, idx) => {
            const alts = it.alternates ?? [];
            const canSwap = alts.length > 0;
            const open = expanded === idx;
            return (
              <View key={`${it.item.id}-${idx}`}>
                <FoodLine
                  name={it.item.name}
                  kcal={Math.round(it.item.kcal * it.quantity)}
                  tag={<ConfidenceBadge confidence={it.confidence} />}
                  meta={[
                    isWeighed(it.item.serving) ? null : it.item.serving,
                    it.item.source && it.item.source !== 'local' ? (
                      <SourceTag key="s" source={it.item.source} />
                    ) : null,
                    canSwap ? (
                      <Text key="x" style={st.changeHint}>
                        {open ? 'Close' : 'Change'}
                      </Text>
                    ) : null,
                  ]}
                  onPress={
                    canSwap ? () => setExpanded(open ? null : idx) : undefined
                  }
                  stepper={{
                    label: stepperLabel(it.item.serving, it.quantity),
                    onStep: (dir) => stepItem(idx, dir),
                  }}
                  onRemove={() => removeItem(idx)}
                />
                {open ? (
                  <View style={st.altPanel}>
                    {it.reason ? (
                      <Text style={st.altReason}>{it.reason}</Text>
                    ) : null}
                    {alts.map((alt, ai) => (
                      <Pressable
                        key={alt.id}
                        onPress={() => swapItem(idx, alt)}
                        style={({ pressed }) => [
                          st.altRow,
                          (ai > 0 || !!it.reason) && st.altRowBorder,
                          pressed && st.pressed,
                        ]}
                      >
                        <View style={st.flex1}>
                          <Text style={st.altName}>{alt.name}</Text>
                          <Text style={st.altSub}>{alt.serving}</Text>
                        </View>
                        <Text style={st.altKcal}>{alt.kcal}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
          {items.length === 0 && !note ? (
            <Text style={st.empty}>
              Couldn’t match anything. Try simpler names, or use Custom.
            </Text>
          ) : null}
          {note ? <Text style={st.breakdownNote}>{note}</Text> : null}
          {items.length > 0 ? (
            <>
              <View style={st.breakdownTotalRow}>
                <Text style={st.breakdownTotalLabel}>Total</Text>
                <Text style={st.breakdownTotalValue}>
                  {total.kcal} kcal{'   '}
                  <Text style={st.breakdownTotalSub}>
                    {total.proteinG} g protein
                  </Text>
                </Text>
              </View>
              <PrimaryButton
                label={`Log ${items.length} item${items.length > 1 ? 's' : ''}`}
                onPress={() => {
                  if (runId) {
                    foodProvider.reportLogged?.(
                      runId,
                      items.map(({ item, quantity }, i) => ({
                        from: origins[i],
                        id: item.id,
                        name: item.name,
                        serving: item.serving,
                        source: item.source,
                        quantity,
                        kcal: Math.round(item.kcal * quantity),
                        proteinG: Math.round(item.proteinG * quantity),
                      })),
                    );
                  }
                  onLog(
                    items.map(({ item, quantity, confidence }) =>
                      portionedEntry(item, quantity, confidence),
                    ),
                  );
                  reset();
                }}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Tap to talk, tap again to stop. The note is transcribed by the engine and
 * handed back as text. Hidden where the browser can't record or there is no
 * engine to transcribe (local mode).
 */
function VoiceButton({ onHeard }: { onHeard: (text: string) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recording = useRef<Recording | null>(null);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = async () => {
    const rec = recording.current;
    if (!rec) return;
    recording.current = null;
    if (limit.current) clearTimeout(limit.current);
    setState('working');
    try {
      const heard = await foodProvider.transcribe?.(await rec.stop());
      if (heard) onHeard(heard);
      else setError('Didn’t catch that. Try again.');
    } catch {
      setError('Didn’t catch that. Try again.');
    }
    setState('idle');
  };

  useEffect(() => {
    if (state !== 'recording') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  // Leaving the screen mid note discards it.
  useEffect(
    () => () => {
      recording.current?.cancel();
      if (limit.current) clearTimeout(limit.current);
    },
    [],
  );

  if (!foodProvider.transcribe || !canRecord())
    return <View style={st.flex1} />;

  const start = async () => {
    setError(null);
    try {
      recording.current = await startRecording();
      // A forgotten recording stops itself.
      limit.current = setTimeout(() => void finish(), MAX_SECONDS * 1000);
      setSeconds(0);
      setState('recording');
    } catch {
      setError('Allow the microphone to speak your meal.');
    }
  };

  const recordingNow = state === 'recording';
  return (
    <View style={st.voiceRow}>
      <Pressable
        onPress={recordingNow ? finish : start}
        disabled={state === 'working'}
        hitSlop={6}
        accessibilityLabel={recordingNow ? 'Stop recording' : 'Speak your meal'}
        style={({ pressed }) => [
          st.micBtn,
          recordingNow && st.micBtnLive,
          pressed && st.pressed,
        ]}
      >
        {state === 'working' ? (
          <ActivityIndicator size="small" color={palette.textMuted} />
        ) : recordingNow ? (
          <StopIcon />
        ) : (
          <MicIcon />
        )}
      </Pressable>
      <Text
        style={[st.voiceText, recordingNow && st.voiceTextLive]}
        numberOfLines={1}
      >
        {recordingNow
          ? `Listening  ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
          : state === 'working'
            ? 'Writing it down'
            : (error ?? 'Speak it')}
      </Text>
    </View>
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

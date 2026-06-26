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
  GlassSurface,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { computeBudget } from '@/lib/budget';
import {
  foodProvider,
  probeProvider,
  type Confidence,
  type FoodItem,
  type ParsedItem,
} from '@/lib/food';
import {
  useProviderStatus,
  type ProviderStatus,
} from '@/lib/food/provider-status';
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

export default function LogScreen() {
  const [loading, setLoading] = useState(true);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [proteinTarget, setProteinTarget] = useState<number | null>(null);
  const [meals, setMeals] = useState<LogEntry[]>([]);
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
      <Eyebrow>Today</Eyebrow>
      <Title>Daily log</Title>

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
              <Text
                style={[
                  st.remaining,
                  budget.isOver && { color: palette.danger },
                ]}
              >
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
          </View>
        </GlassSurface>
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
          <Text style={st.empty}>
            Nothing logged yet — add your first meal above.
          </Text>
        ) : null}
      </View>
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
    const q = query.trim();
    // Debounce search-as-you-type — fewer redundant lookups, and it keeps
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
      <EngineStatus />
      {/* Primary: search a food, tap to add (stays open for the next one) */}
      <GlassSurface style={st.searchWrap}>
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
                <View style={st.resultNameRow}>
                  <Text style={st.resultName}>{f.name}</Text>
                  <SourceTag source={f.source} />
                </View>
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
            style={[st.pill, panel === 'describe' && st.pillActive]}
          >
            <Text
              style={[st.pillText, panel === 'describe' && st.pillTextActive]}
            >
              ✦ Describe a meal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPanel(panel === 'custom' ? 'none' : 'custom')}
            style={[st.pill, panel === 'custom' && st.pillActive]}
          >
            <Text
              style={[st.pillText, panel === 'custom' && st.pillTextActive]}
            >
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
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [note, setNote] = useState<string | undefined>();
  const [calculated, setCalculated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const calc = async () => {
    if (!text.trim() || !foodProvider.parseMeal) return;
    setBusy(true);
    const parsed = await foodProvider.parseMeal(text);
    setItems(parsed.items);
    setNote(parsed.note);
    setCalculated(true);
    setExpanded(null);
    setBusy(false);
  };

  const setQty = (idx: number, q: number) =>
    setItems((arr) =>
      arr.map((it, i) =>
        i === idx
          ? { ...it, quantity: Math.max(0.5, Math.round(q * 2) / 2) }
          : it,
      ),
    );
  const removeItem = (idx: number) =>
    setItems((arr) => arr.filter((_, i) => i !== idx));
  // Swap a wrong match for one of its alternates — the chosen food becomes
  // user-confirmed ('high'), and the one it replaced moves into the alternates.
  const swapItem = (idx: number, alt: FoodItem) => {
    setItems((arr) =>
      arr.map((it, i) => {
        if (i !== idx) return it;
        const others = [
          it.item,
          ...(it.alternates ?? []).filter((a) => a.id !== alt.id),
        ];
        return {
          ...it,
          item: alt,
          confidence: 'high',
          reason: undefined,
          alternates: others,
        };
      }),
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
        placeholder="“2 roti, mom’s dal, 1 katori rice, salad” — say it your way"
        placeholderTextColor={palette.textDim}
        value={text}
        onChangeText={setText}
        multiline
      />
      <View style={st.describeFooter}>
        <Text style={st.describeHint}>
          We match each item — tap a flagged one to swap it, adjust portions,
          then log.
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
          {items.map((it, idx) => {
            const alts = it.alternates ?? [];
            const canSwap = alts.length > 0;
            const open = expanded === idx;
            return (
              <View key={`${it.item.id}-${idx}`}>
                <View style={st.breakdownRow}>
                  <Pressable
                    style={st.flex1}
                    disabled={!canSwap}
                    onPress={() => setExpanded(open ? null : idx)}
                  >
                    <View style={st.breakdownNameRow}>
                      <Text style={st.breakdownName}>{it.item.name}</Text>
                      <ConfidenceBadge confidence={it.confidence} />
                      <SourceTag source={it.item.source} />
                    </View>
                    <Text style={st.breakdownSub}>
                      {it.item.serving} ·{' '}
                      {Math.round(it.item.kcal * it.quantity)} kcal
                      {canSwap ? (
                        <Text style={st.changeHint}>
                          {open ? '  · close' : '  · change'}
                        </Text>
                      ) : null}
                    </Text>
                  </Pressable>
                  <Stepper
                    value={it.quantity}
                    onChange={(q) => setQty(idx, q)}
                  />
                  <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                    <Text style={st.removeText}>✕</Text>
                  </Pressable>
                </View>
                {open ? (
                  <View style={st.altPanel}>
                    {it.reason ? (
                      <Text style={st.altReason}>{it.reason}</Text>
                    ) : null}
                    {alts.map((alt) => (
                      <Pressable
                        key={alt.id}
                        onPress={() => swapItem(idx, alt)}
                        style={({ pressed }) => [
                          st.altRow,
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
                  onLog(
                    items.map(({ item, quantity }) =>
                      portionedEntry(item, quantity),
                    ),
                  )
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
      <Pressable
        onPress={() => onChange(value - 0.5)}
        hitSlop={8}
        style={st.stepBtn}
      >
        <Text style={st.stepText}>−</Text>
      </Pressable>
      <Text style={st.stepQty}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 0.5)}
        hitSlop={8}
        style={st.stepBtn}
      >
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

const CONFIDENCE: Record<Confidence, { label: string; color: string }> = {
  high: { label: '✓ good match', color: palette.good },
  medium: { label: '≈ likely', color: palette.textFaint },
  low: { label: '⚠ check this', color: palette.warn },
};

/** A tiny trust signal on each parsed item — never hide a guess. */
function ConfidenceBadge({ confidence }: { confidence?: Confidence }) {
  if (!confidence) return null;
  const c = CONFIDENCE[confidence];
  return <Text style={[st.confidence, { color: c.color }]}>{c.label}</Text>;
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
      {!muted ? (
        <View style={[st.chipDot, { backgroundColor: color }]} />
      ) : null}
      <Text style={[st.chipText, muted && { color: palette.fat }]}>{text}</Text>
    </View>
  );
}

const STATUS_COPY: Record<
  ProviderStatus,
  { dot: string; text: string }
> = {
  'local-only': { dot: palette.textFaint, text: 'Local food table' },
  checking: { dot: palette.textFaint, text: 'Checking AI engine…' },
  online: { dot: palette.good, text: 'AI-grounded · USDA' },
  offline: { dot: palette.warn, text: 'AI engine offline — using local foods' },
};

/** A quiet line that tells the user which food engine is actually answering. */
function EngineStatus() {
  const status = useProviderStatus();
  const c = STATUS_COPY[status];
  return (
    <View style={st.engineRow}>
      <View style={[st.engineDot, { backgroundColor: c.dot }]} />
      <Text style={st.engineText}>{c.text}</Text>
    </View>
  );
}

const SOURCE_LABEL: Record<NonNullable<FoodItem['source']>, string> = {
  local: 'local',
  usda: 'USDA',
  ai: 'AI est.',
};

/** Where a food's numbers came from — shown only for the grounded sources. */
function SourceTag({ source }: { source?: FoodItem['source'] }) {
  if (!source || source === 'local') return null;
  return <Text style={st.sourceTag}>{SOURCE_LABEL[source]}</Text>;
}

const st = StyleSheet.create({
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
    paddingHorizontal: space.xs,
  },
  engineDot: { width: 7, height: 7, borderRadius: 4 },
  engineText: {
    color: palette.textFaint,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sourceTag: {
    color: palette.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
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
  remainingLabel: {
    color: palette.textFaint,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  remaining: {
    ...typo.hero,
    fontSize: 56,
    color: palette.accent,
    marginTop: 2,
  },
  consumedBox: { alignItems: 'flex-end', paddingTop: space.sm },
  consumed: { color: palette.text, fontSize: 22, fontWeight: '600' },
  consumedLabel: { color: palette.textFaint, fontSize: 13, marginTop: 2 },

  macroLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: palette.surface2,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  searchIcon: { color: palette.textFaint, fontSize: 18 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: 16,
    paddingVertical: space.lg,
  },
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
  pillActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentBorder,
  },
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
  describeFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
  },
  describeHint: {
    flex: 1,
    color: palette.textFaint,
    fontSize: 12,
    lineHeight: 17,
  },
  calcBtn: { paddingHorizontal: space.xl },
  breakdown: { gap: space.sm, marginTop: space.sm },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  breakdownNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  breakdownName: { color: palette.text, fontSize: 15, fontWeight: '600' },
  breakdownSub: { color: palette.textFaint, fontSize: 12, marginTop: 2 },
  changeHint: { color: palette.accent, fontSize: 12, fontWeight: '600' },
  confidence: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  altPanel: {
    backgroundColor: palette.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginBottom: space.sm,
  },
  altReason: {
    color: palette.textFaint,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: space.sm,
    lineHeight: 16,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  altName: { color: palette.text, fontSize: 14, fontWeight: '500' },
  altSub: { color: palette.textFaint, fontSize: 12, marginTop: 1 },
  altKcal: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
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
    backgroundColor: palette.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: palette.text,
    fontSize: 15,
  },
  manualRow: { flexDirection: 'row', gap: space.sm },
  manualNumInput: {
    minWidth: 0, // shrink with flex:1 so the Add button stays on-screen (RNW)
    backgroundColor: palette.surface2,
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
  entryKcal: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
  },
  removeBtn: { paddingHorizontal: space.xs },
  removeText: { color: palette.textFaint, fontSize: 15 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  stepBtn: { minWidth: 16, alignItems: 'center' },
  stepText: { color: palette.accent, fontSize: 16, fontWeight: '700' },
  stepQty: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
});

import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, GlassSurface, PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { foodProvider, type FoodItem, type ParsedItem } from '@/lib/food';
import { portionedEntry, type LogEntry } from '@/lib/log-store';

import { EngineStatus, SourceTag } from './engine-status';
import { ConfidenceBadge, Stepper } from './meal-bits';
import { st } from './styles';

export function MealComposer({
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
                    items.map(({ item, quantity, confidence }) =>
                      portionedEntry(item, quantity, confidence),
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

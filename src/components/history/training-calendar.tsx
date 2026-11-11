import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraining } from '@/components/train/data';
import { ChevronIcon } from '@/components/ui/icons';
import { Card, Hairline } from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import { todayKey } from '@/lib/log-store';
import { recordCounts } from '@/lib/train/progress';
import { durationText, workoutStats, type Workout } from '@/lib/train/workout';

import { st } from './styles';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday first
const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * The training month: days with a workout are filled, a dot marks a record,
 * and the card below lists the chosen day's workouts. Each opens in full.
 */
export function TrainingCalendar() {
  const { data } = useTraining();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(todayKey());

  const byDay = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of data?.workouts ?? []) {
      const list = m.get(w.date) ?? [];
      list.push(w);
      m.set(w.date, list);
    }
    return m;
  }, [data]);
  const records = useMemo(
    () =>
      data
        ? recordCounts(data.workouts, data.exById, data.bodyKg)
        : new Map<string, number>(),
    [data],
  );

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today = todayKey();
  const prefix = `${year}-${pad(month + 1)}`;

  const shift = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setAnchor(next);
    // Land on the last workout of that month, or its first day.
    const p = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
    const inMonth = [...byDay.keys()].filter((d) => d.startsWith(p)).sort();
    setSelected(
      inMonth[inMonth.length - 1] ??
        key(next.getFullYear(), next.getMonth(), 1),
    );
  };

  // The month in numbers.
  let count = 0;
  let sets = 0;
  let volume = 0;
  for (const [d, list] of byDay) {
    if (!d.startsWith(prefix)) continue;
    for (const w of list) {
      const s = workoutStats(w);
      count += 1;
      sets += s.sets;
      volume += s.volume;
    }
  }

  const chosen = byDay.get(selected) ?? [];
  const label = new Date(`${selected}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Card padded>
      <View style={st.calHead}>
        <Pressable
          onPress={() => shift(-1)}
          hitSlop={10}
          style={st.calNavBtn}
          accessibilityLabel="Previous month"
        >
          <ChevronIcon direction="left" />
        </Pressable>
        <Text style={st.calMonth}>
          {anchor.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          onPress={() => !isCurrentMonth && shift(1)}
          hitSlop={10}
          disabled={isCurrentMonth}
          style={st.calNavBtn}
          accessibilityLabel="Next month"
        >
          <ChevronIcon
            direction="right"
            color={isCurrentMonth ? palette.textDim : palette.text}
          />
        </Pressable>
      </View>

      <View style={tc.totals}>
        <Total
          value={String(count)}
          label={count === 1 ? 'Workout' : 'Workouts'}
        />
        <Total value={String(sets)} label="Hard sets" />
        <Total value={`${volume.toLocaleString()} kg`} label="Volume" />
      </View>

      <View style={st.calWeekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={st.calWeekCell}>
            {d}
          </Text>
        ))}
      </View>

      <View style={st.calGrid}>
        {Array.from({ length: lead }).map((_, i) => (
          <View key={`b${i}`} style={st.calCell} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const d = key(year, month, i + 1);
          const list = byDay.get(d);
          const trained = !!list?.length;
          const pr = list?.some((w) => (records.get(w.id) ?? 0) > 0);
          const isSel = d === selected;
          const future = d > today;
          return (
            <Pressable
              key={d}
              style={st.calCell}
              onPress={() => !future && setSelected(d)}
              disabled={future}
              accessibilityLabel={`${d}${trained ? `, ${list!.length} workout` : ''}`}
            >
              <View
                style={[
                  st.calDay,
                  trained && tc.dayOn,
                  d === today && !isSel && st.calDayToday,
                  isSel && tc.daySel,
                ]}
              >
                <Text
                  style={[
                    st.calDayNum,
                    !trained && st.calDayNumFaint,
                    isSel && st.calDayNumSel,
                  ]}
                >
                  {i + 1}
                </Text>
              </View>
              <View style={[st.calDot, pr && st.calDotOn]} />
            </Pressable>
          );
        })}
      </View>

      <View style={tc.legend}>
        <View style={[tc.legendSwatch, tc.dayOn]} />
        <Text style={tc.legendText}>Workout</Text>
        <View style={[st.calDot, st.calDotOn, tc.legendDot]} />
        <Text style={tc.legendText}>Record</Text>
      </View>

      <Hairline style={st.calDivider} />

      <Text style={st.calSumDate}>{label}</Text>
      {chosen.length === 0 ? (
        <View style={tc.restRow}>
          <Text style={st.calEmpty}>
            {selected === today ? 'No workout yet today.' : 'Rest day.'}
          </Text>
          {selected === today ? (
            <Pressable onPress={() => router.navigate('/train')} hitSlop={8}>
              <Text style={tc.link}>Start a workout</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        chosen.map((w) => {
          const s = workoutStats(w);
          const prs = records.get(w.id) ?? 0;
          const lifts = w.exercises
            .map((e) => data?.exById.get(e.exerciseId)?.name)
            .filter(Boolean) as string[];
          return (
            <Pressable
              key={w.id}
              onPress={() =>
                router.navigate({ pathname: '/workout', params: { id: w.id } })
              }
              style={({ pressed }) => [tc.workout, pressed && tc.pressed]}
            >
              <View style={tc.workoutMain}>
                <Text style={tc.workoutName} numberOfLines={1}>
                  {w.name}
                </Text>
                {lifts.length ? (
                  <Text style={tc.workoutLifts} numberOfLines={1}>
                    {lifts.slice(0, 3).join(', ')}
                    {lifts.length > 3 ? ` and ${lifts.length - 3} more` : ''}
                  </Text>
                ) : null}
                <Text style={tc.workoutStats}>
                  {s.sets} sets · {s.volume.toLocaleString()} kg
                  {s.ms > 0 ? ` · ${durationText(s.ms)}` : ''}
                  {prs ? (
                    <Text style={tc.pr}>
                      {' '}
                      · {prs} {prs === 1 ? 'record' : 'records'}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <ChevronIcon direction="right" color={palette.textFaint} />
            </Pressable>
          );
        })
      )}
    </Card>
  );
}

function Total({ value, label }: { value: string; label: string }) {
  return (
    <View style={tc.total}>
      <Text style={tc.totalValue}>{value}</Text>
      <Text style={tc.totalLabel}>{label}</Text>
    </View>
  );
}

const tc = StyleSheet.create({
  pressed: { opacity: 0.7 },
  totals: {
    flexDirection: 'row',
    marginBottom: space.lg,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },
  total: { flex: 1 },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: palette.text,
  },
  totalLabel: { fontSize: 12, color: palette.textFaint, marginTop: 2 },
  dayOn: { backgroundColor: palette.surface2 },
  daySel: { backgroundColor: palette.text },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.sm,
  },
  legendSwatch: { width: 12, height: 12, borderRadius: 6 },
  legendDot: { marginTop: 0, marginLeft: space.md },
  legendText: { fontSize: 12, color: palette.textFaint },
  restRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  link: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  workout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
    marginTop: space.md,
  },
  workoutMain: { flex: 1 },
  workoutName: { fontSize: 15, fontWeight: '700', color: palette.text },
  workoutLifts: { fontSize: 13, color: palette.textMuted, marginTop: 2 },
  workoutStats: { fontSize: 12, color: palette.textFaint, marginTop: 4 },
  pr: { color: palette.accent, fontWeight: '700' },
});

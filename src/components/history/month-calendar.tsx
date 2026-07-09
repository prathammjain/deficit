import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, Hairline, ProgressBar } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { gatherMonthRecords } from '@/lib/history';
import {
  dayDeficit,
  type DayRecord,
  type HistoryTargets,
} from '@/lib/history-stats';
import { todayKey } from '@/lib/log-store';

import { st } from './styles';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday-first
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/**
 * A month grid the user can page through to inspect any single day's totals.
 * Logged days carry an accent dot; the selected day fills orange; today gets a
 * ring. The card below shows the selected day's calories, macros, and deficit —
 * the overall day stats, not the individual meals.
 */
export function MonthCalendar({ targets }: { targets: HistoryTargets }) {
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(todayKey());

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const recs = await gatherMonthRecords(anchor);
        if (!alive) return;
        setRecords(recs);
        // Keep a sensible day selected for whichever month we're viewing.
        setSelected((cur) => {
          if (cur && recs.some((r) => r.date === cur)) return cur;
          const today = todayKey();
          if (recs.some((r) => r.date === today)) return today;
          const lastLogged = [...recs].reverse().find((r) => r.logged);
          return lastLogged?.date ?? recs[0]?.date ?? null;
        });
      })();
      return () => {
        alive = false;
      };
    }, [anchor]),
  );

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first blanks
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today = todayKey();

  const shift = (delta: number) =>
    setAnchor(new Date(year, month + delta, 1));

  const selectedRec = records.find((r) => r.date === selected) ?? null;

  return (
    <Card padded>
      <View style={st.calHead}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} style={st.calNavBtn}>
          <Text style={st.calNav}>‹</Text>
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
        >
          <Text style={[st.calNav, isCurrentMonth && st.calNavOff]}>›</Text>
        </Pressable>
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
        {records.map((rec) => {
          const dayNum = new Date(`${rec.date}T00:00:00`).getDate();
          const isSel = rec.date === selected;
          const isToday = rec.date === today;
          return (
            <Pressable
              key={rec.date}
              style={st.calCell}
              onPress={() => setSelected(rec.date)}
            >
              <View
                style={[
                  st.calDay,
                  isToday && !isSel && st.calDayToday,
                  isSel && st.calDaySel,
                ]}
              >
                <Text
                  style={[
                    st.calDayNum,
                    !rec.logged && st.calDayNumFaint,
                    isSel && st.calDayNumSel,
                  ]}
                >
                  {dayNum}
                </Text>
              </View>
              <View
                style={[
                  st.calDot,
                  rec.logged && !isSel && st.calDotOn,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <Hairline style={st.calDivider} />

      {selectedRec ? (
        <DaySummary rec={selectedRec} targets={targets} />
      ) : (
        <Text style={st.calEmpty}>Tap a day to see its totals.</Text>
      )}
    </Card>
  );
}

function DaySummary({
  rec,
  targets,
}: {
  rec: DayRecord;
  targets: HistoryTargets;
}) {
  const label = new Date(`${rec.date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (!rec.logged) {
    return (
      <View>
        <Text style={st.calSumDate}>{label}</Text>
        <Text style={st.calEmpty}>Nothing logged this day.</Text>
      </View>
    );
  }

  const def = dayDeficit(rec, targets); // maintenance − intake
  const over = rec.kcal > targets.targetKcal;

  return (
    <View>
      <View style={st.calSumTop}>
        <Text style={st.calSumDate}>{label}</Text>
        <Text
          style={[
            st.calSumDeficit,
            { color: def >= 0 ? palette.good : palette.danger },
          ]}
        >
          {def >= 0 ? '+' : ''}
          {def.toLocaleString()}
          <Text style={st.calSumDeficitUnit}> deficit</Text>
        </Text>
      </View>

      <View style={st.calSumKcalRow}>
        <Text style={st.calSumKcal}>
          {rec.kcal.toLocaleString()}
          <Text style={st.calSumKcalUnit}>
            {' '}
            / {targets.targetKcal.toLocaleString()} kcal
          </Text>
        </Text>
        {rec.weightKg != null ? (
          <Text style={st.calSumWeight}>{rec.weightKg} kg</Text>
        ) : null}
      </View>
      <ProgressBar
        fraction={rec.kcal / targets.targetKcal}
        over={over}
      />

      <View style={st.calMacros}>
        <Macro label="Protein" value={rec.proteinG} color={palette.protein} />
        <Macro label="Carbs" value={rec.carbsG} color={palette.carb} />
        <Macro label="Fat" value={rec.fatG} color={palette.fat} />
      </View>
    </View>
  );
}

function Macro({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={st.calMacro}>
      <View style={st.calMacroHead}>
        <View style={[st.calMacroDot, { backgroundColor: color }]} />
        <Text style={st.calMacroLabel}>{label}</Text>
      </View>
      <Text style={st.calMacroValue}>{value}g</Text>
    </View>
  );
}

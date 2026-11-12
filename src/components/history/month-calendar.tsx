import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ChevronIcon } from '@/components/ui/icons';
import { Card, Hairline, ProgressBar } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { gatherMonthRecords } from '@/lib/history';
import {
  dayDeficit,
  dayStatus,
  UNFINISHED_SHARE,
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
export function MonthCalendar({
  targets,
  complete,
  onToggleComplete,
}: {
  targets: HistoryTargets;
  /** Low days the user confirmed as full. */
  complete: ReadonlySet<string>;
  onToggleComplete: (date: string, complete: boolean) => Promise<void>;
}) {
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

  const shift = (delta: number) => setAnchor(new Date(year, month + delta, 1));

  const selectedRec = records.find((r) => r.date === selected) ?? null;

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
          const unfinished =
            dayStatus(rec, targets.targetKcal, complete) === 'unfinished';
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
                  rec.logged &&
                    !isSel &&
                    (unfinished ? st.calDotHalf : st.calDotOn),
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <Hairline style={st.calDivider} />

      {selectedRec ? (
        <DaySummary
          rec={selectedRec}
          targets={targets}
          today={today}
          confirmed={complete.has(selectedRec.date)}
          onToggleComplete={onToggleComplete}
        />
      ) : (
        <Text style={st.calEmpty}>Tap a day to see its totals.</Text>
      )}
    </Card>
  );
}

function DaySummary({
  rec,
  targets,
  today,
  confirmed,
  onToggleComplete,
}: {
  rec: DayRecord;
  targets: HistoryTargets;
  today: string;
  confirmed: boolean;
  onToggleComplete: (date: string, complete: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
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

  const def = dayDeficit(rec, targets); // maintenance minus intake
  // Over the target is only a warning when the plan is to stay under it.
  const over =
    targets.goal !== 'gain' &&
    rec.kcal > targets.targetKcal * (targets.goal === 'maintain' ? 1.1 : 1);
  const low = rec.kcal < targets.targetKcal * UNFINISHED_SHARE;
  const counts = !low || confirmed;
  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      await onToggleComplete(rec.date, on);
    } catch {
      // Offline: the day stays as it was; tapping again retries.
    }
    setBusy(false);
  };

  return (
    <View>
      <View style={st.calSumTop}>
        <Text style={st.calSumDate}>{label}</Text>
        {counts ? (
          <Text
            style={[
              st.calSumDeficit,
              { color: def >= 0 ? palette.good : palette.danger },
            ]}
          >
            {Math.abs(def).toLocaleString()}
            <Text style={st.calSumDeficitUnit}>
              {def >= 0 ? ' deficit' : ' surplus'}
            </Text>
          </Text>
        ) : (
          <Text style={st.calSumDeficitUnit}>Not counted</Text>
        )}
      </View>

      <View style={st.calSumKcalRow}>
        <Text style={st.calSumKcal}>
          {rec.kcal.toLocaleString()}
          <Text style={st.calSumKcalUnit}>
            {' '}
            of {targets.targetKcal.toLocaleString()} kcal
          </Text>
        </Text>
        {rec.weightKg != null ? (
          <Text style={st.calSumWeight}>{rec.weightKg} kg</Text>
        ) : null}
      </View>
      <ProgressBar fraction={rec.kcal / targets.targetKcal} over={over} />

      <View style={st.calMacros}>
        <Macro label="Protein" value={rec.proteinG} color={palette.protein} />
        <Macro label="Carbs" value={rec.carbsG} color={palette.carb} />
        <Macro label="Fat" value={rec.fatG} color={palette.fat} />
      </View>

      {low && rec.date === today && !confirmed ? (
        <View style={st.calNote}>
          <Text style={st.calNoteText}>
            Today so far. It counts once it’s a full day: at least half your
            target, or confirmed by you.
          </Text>
        </View>
      ) : low ? (
        <View style={st.calNote}>
          <Text style={st.calNoteText}>
            {confirmed
              ? 'You confirmed this was a full day, so it counts even though it’s under half your target.'
              : 'This looks unfinished: under half your target, so it isn’t counted. If it really was everything you ate, confirm it.'}
          </Text>
          <Pressable
            onPress={() => void toggle(!confirmed)}
            disabled={busy}
            hitSlop={6}
            style={[st.calNoteBtn, busy && { opacity: 0.5 }]}
          >
            <Text style={st.calNoteBtnText}>
              {confirmed ? 'Undo' : 'It was a full day'}
            </Text>
          </Pressable>
        </View>
      ) : null}
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
      <Text style={st.calMacroValue}>{value} g</Text>
    </View>
  );
}

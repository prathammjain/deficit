/**
 * One exercise over time: the best estimated max and its trend, records,
 * the heaviest weight moved for each rep count, and every session.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { nb } from '@/components/train/bits';
import { useTraining } from '@/components/train/data';
import { tr } from '@/components/train/styles';
import { ChevronIcon } from '@/components/ui/icons';
import {
  Card,
  DotMatrix,
  Screen,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { shortDate } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/lib/train/exercises';
import {
  addDays,
  changeText,
  exerciseHistory,
  records,
  trend,
} from '@/lib/train/progress';
import { formatKg, setText } from '@/lib/train/workout';

export default function ExerciseScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { data } = useTraining();
  const back = () =>
    router.navigate(from === 'workout' ? '/workout' : '/train');

  if (!data) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const ex = data.exById.get(id);
  const header = (
    <Pressable
      onPress={back}
      hitSlop={8}
      accessibilityLabel={
        from === 'workout' ? 'Back to the workout' : 'Back to Train'
      }
      style={({ pressed }) => [
        tr.row,
        { gap: 4, alignSelf: 'flex-start' },
        pressed && tr.pressed,
      ]}
    >
      <ChevronIcon color={palette.textMuted} />
      <Text style={tr.linkText}>
        {from === 'workout' ? 'Workout' : 'Train'}
      </Text>
    </Pressable>
  );

  if (!ex) {
    return (
      <Screen>
        {header}
        <Text style={[tr.nameInput, { marginTop: 16 }]}>
          Exercise not found
        </Text>
      </Screen>
    );
  }

  const today = todayKey();
  const sessions = exerciseHistory(data.workouts, ex, data.bodyKg);
  const rec = records(sessions, ex, data.bodyKg);
  const change = trend(sessions, today);
  const recent = sessions.filter((s) => s.date >= addDays(today, -27));
  const chart = [...sessions]
    .reverse()
    .slice(-24)
    .map((s) => s.best || null);
  const bw = ex.kind === 'bodyweight';

  return (
    <Screen>
      {header}
      <Text style={[tr.nameInput, { marginTop: 16 }]}>{ex.name}</Text>
      <Text style={tr.sessionMeta}>
        {MUSCLE_LABEL[ex.muscle]} · {EQUIPMENT_LABEL[ex.equipment]}
        {ex.custom ? ' · your exercise' : ''}
      </Text>

      {!sessions.length ? (
        <Card style={{ marginTop: 24 }}>
          <Text style={tr.emptyText}>
            Not logged yet. After the first session this page shows your
            estimated max, records and every set.
          </Text>
        </Card>
      ) : (
        <>
          <Card style={{ marginTop: 24, gap: 6 }}>
            <Text style={tr.label}>
              {bw
                ? `Best estimated 1RM, bodyweight ${formatKg(data.bodyKg)} kg included`
                : 'Best estimated 1RM'}
            </Text>
            <View style={[tr.row, { alignItems: 'baseline', gap: 8 }]}>
              <DotMatrix style={tr.heroNum}>
                {rec.best ? formatKg(Math.round(rec.best.score)) : '0'}
              </DotMatrix>
              <Text style={tr.heroUnit}>kg</Text>
            </View>
            {rec.best ? (
              <Text style={tr.muted}>
                From {nb(setText(rec.best.set, ex))} on{' '}
                {shortDate(rec.best.date)}
              </Text>
            ) : null}
            <Text style={[tr.muted, { marginTop: 4 }]}>
              {recent.length === 0
                ? 'Not done in the last 4 weeks.'
                : change == null
                  ? 'Last 4 weeks: the first sessions, nothing to compare yet.'
                  : `Last 4 weeks against the 4 before: `}
              {recent.length && change != null ? (
                <Text style={change <= -0.005 ? tr.down : tr.up}>
                  {changeText(change)}
                </Text>
              ) : null}
            </Text>
            {chart.length > 1 ? (
              <View style={{ marginTop: 16 }}>
                <LineChart
                  values={chart}
                  height={130}
                  color={palette.text}
                  showDots
                />
                <View style={tr.barLabels}>
                  <Text style={tr.faint}>
                    {shortDate(
                      sessions[Math.min(sessions.length, 24) - 1].date,
                    )}
                  </Text>
                  <Text style={tr.faint}>{shortDate(sessions[0].date)}</Text>
                </View>
              </View>
            ) : null}
          </Card>

          <SectionLabel>Records</SectionLabel>
          <Card>
            <View style={tr.recordGrid}>
              {rec.heaviest && (!bw || (rec.heaviest.set.kg ?? 0) > 0) ? (
                <Record
                  label={bw ? 'Most added weight' : 'Heaviest'}
                  value={nb(setText(rec.heaviest.set, ex))}
                  date={rec.heaviest.date}
                />
              ) : null}
              {rec.mostReps ? (
                <Record
                  label="Most reps"
                  value={nb(setText(rec.mostReps.set, ex))}
                  date={rec.mostReps.date}
                />
              ) : null}
              {rec.bestVolume ? (
                <Record
                  label="Best session"
                  value={`${rec.bestVolume.volume.toLocaleString()} kg`}
                  date={rec.bestVolume.date}
                />
              ) : null}
              <Record
                label="Sessions"
                value={String(sessions.length)}
                date={sessions[sessions.length - 1].date}
                prefix="since"
              />
            </View>
          </Card>

          {!bw && rec.repMaxes.length ? (
            <>
              <SectionLabel>Heaviest for each rep count</SectionLabel>
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {rec.repMaxes.map((r, i) => (
                  <View
                    key={r.reps}
                    style={[tr.tableRow, i === 0 && { borderTopWidth: 0 }]}
                  >
                    <Text style={tr.tableKey}>
                      {r.reps} {r.reps === 1 ? 'rep' : 'reps'}
                    </Text>
                    <Text style={tr.tableVal}>{formatKg(r.kg)} kg</Text>
                    <Text style={tr.tableDate}>{shortDate(r.date)}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionLabel>Every session</SectionLabel>
          <Card padded={false}>
            {sessions.map((s, i) => (
              <Pressable
                key={`${s.workoutId}:${i}`}
                onPress={() =>
                  router.navigate({
                    pathname: '/workout',
                    params: { id: s.workoutId },
                  })
                }
                style={({ pressed }) => [
                  tr.liftRow,
                  i === 0 && { borderTopWidth: 0 },
                  pressed && tr.pressed,
                ]}
              >
                <View style={tr.flex1}>
                  <Text style={tr.liftName}>{shortDate(s.date)}</Text>
                  <Text style={tr.readSets}>
                    {s.sets.map((x) => nb(setText(x, ex))).join(',  ')}
                  </Text>
                </View>
                <Text style={tr.liftScore}>
                  {s.best ? `${formatKg(s.best)} kg` : ' '}
                </Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Record({
  label,
  value,
  date,
  prefix,
}: {
  label: string;
  value: string;
  date: string;
  prefix?: string;
}) {
  return (
    <View style={tr.recordCell}>
      <Text style={tr.statLabel}>{label}</Text>
      <Text style={[tr.statValue, { marginTop: 2 }]}>{value}</Text>
      <Text style={tr.tableDate}>
        {prefix ? `${prefix} ` : ''}
        {shortDate(date)}
      </Text>
    </View>
  );
}

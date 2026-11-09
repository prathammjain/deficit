/**
 * progress.tsx: progressive overload by week or month, with what was eaten
 * and what the scale said beside it. One read line on top says what the
 * three together mean.
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BarChart } from '@/components/charts';
import { ChevronIcon } from '@/components/ui/icons';
import { Card, SectionLabel } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { gatherRange } from '@/lib/history';
import type { DayRecord } from '@/lib/history-stats';
import { loadProfile } from '@/lib/profile-store';
import { computeTargets } from '@/lib/targets';
import {
  addDays,
  bodySummary,
  changeText,
  foodSummary,
  liftBoard,
  periodDays,
  periodLabel,
  periodOf,
  periodRead,
  periodTick,
  shiftPeriod,
  trainingSeries,
  trainingSummary,
  type PeriodKind,
} from '@/lib/train/progress';
import { durationText, formatKg, setText } from '@/lib/train/workout';
import { loadWeights, type WeightEntry } from '@/lib/weight-store';

import { nb, Tabs } from './bits';
import type { Training } from './data';
import { tr } from './styles';

const minDay = (a: string, b: string) => (a < b ? a : b);

/** Lifts listed before "Show all". */
const LIFTS_SHOWN = 8;

/** Hard sets per muscle per week that most programmes aim for. */
const GUIDE_SETS = 10;

function Change({ value }: { value: number | null }) {
  if (value == null) return null;
  const text = changeText(value);
  return (
    <Text style={value <= -0.005 ? tr.down : value >= 0.005 ? tr.up : tr.faint}>
      {text}
    </Text>
  );
}

export function ProgressView({
  data,
  today,
}: {
  data: Training;
  today: string;
}) {
  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState(0);
  const [food, setFood] = useState<{ key: string; days: DayRecord[] } | null>(
    null,
  );
  const [targets, setTargets] = useState<{
    targetKcal: number;
    proteinG: number;
  } | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [allLifts, setAllLifts] = useState(false);

  const period = shiftPeriod(periodOf(kind, today), offset);
  const before = shiftPeriod(period, -1);
  const foodEnd = period.end < today ? period.end : today;
  const foodKey = `${before.start}:${foodEnd}`;

  useEffect(() => {
    loadProfile()
      .then((p) => {
        if (!p) return;
        const t = computeTargets(p);
        setTargets({ targetKcal: t.targetKcal, proteinG: t.proteinG });
      })
      .catch(() => {});
    loadWeights()
      .then(setWeights)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    gatherRange(before.start, foodEnd)
      .then((days) => {
        if (alive) setFood({ key: foodKey, days });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [before.start, foodEnd, foodKey]);

  // A period still running is compared with the same days of the one
  // before, so a Monday isn't judged against a whole week.
  const running = offset === 0;
  const elapsed = running ? periodDays({ ...period, end: today }).length : 0;
  const sameDays = running
    ? { ...before, end: minDay(addDays(before.start, elapsed - 1), before.end) }
    : before;

  // Cheap enough to count on every render, even with years of history.
  const { workouts, exById, bodyKg } = data;
  const training = trainingSummary(workouts, exById, period);
  const previous = trainingSummary(workouts, exById, sameDays);
  const lifts = liftBoard(workouts, exById, bodyKg, period);
  const series = trainingSeries(
    workouts,
    exById,
    period,
    kind === 'week' ? 8 : 6,
  );

  const days = food?.key === foodKey ? food.days : [];
  const fs = foodSummary(days, period, today, targets);
  const body = bodySummary(weights, period);
  const read = periodRead({
    kind,
    current: running,
    training,
    previous,
    lifts,
    food: fs,
    body,
  });
  const weeks = Math.max(1, periodDays(period).length / 7);
  const volumeChange =
    previous.volume > 0 && training.volume > 0
      ? training.volume / previous.volume - 1
      : null;
  const topMuscle = Math.max(
    GUIDE_SETS * 1.5,
    ...training.muscles.map((m) => m.sets / weeks),
  );
  const span = kind === 'week' ? 'week' : 'month';
  const against = running ? `the same days last ${span}` : `the ${span} before`;
  const thisSpan = `${running ? 'this' : 'that'} ${span}`;

  return (
    <View>
      <Tabs
        options={[
          { id: 'week', label: 'Week' },
          { id: 'month', label: 'Month' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setOffset(0);
        }}
      />

      <View style={tr.periodRow}>
        <Pressable
          onPress={() => setOffset(offset - 1)}
          hitSlop={8}
          accessibilityLabel={`Previous ${span}`}
          style={[tr.iconBtn, tr.iconBtnRing]}
        >
          <ChevronIcon color={palette.text} />
        </Pressable>
        <Text style={tr.periodLabel}>{periodLabel(period, today)}</Text>
        <Pressable
          onPress={() => setOffset(offset + 1)}
          disabled={offset >= 0}
          hitSlop={8}
          accessibilityLabel={`Next ${span}`}
          style={[tr.iconBtn, tr.iconBtnRing, offset >= 0 && tr.disabled]}
        >
          <ChevronIcon color={palette.text} direction="right" />
        </Pressable>
      </View>

      <Card style={tr.summaryCard}>
        <Text style={tr.readLine}>{read}</Text>

        <View style={tr.summaryBlock}>
          <Text style={tr.menuLabel}>TRAINING</Text>
          <Text style={tr.summaryValue}>
            {training.volume.toLocaleString()} kg moved
          </Text>
          <Text style={tr.summarySub}>
            {training.sessions}{' '}
            {training.sessions === 1 ? 'workout' : 'workouts'} · {training.sets}{' '}
            hard sets
            {training.minutes > 0
              ? ` · ${durationText(training.minutes * 60000)}`
              : ''}
          </Text>
          {volumeChange != null ? (
            <Text style={tr.summarySub}>
              <Change value={volumeChange} /> on {against}
            </Text>
          ) : null}
        </View>

        <View style={tr.summaryBlock}>
          <Text style={tr.menuLabel}>FOOD</Text>
          {fs.daysLogged ? (
            <>
              <Text style={tr.summaryValue}>
                {fs.avgKcal?.toLocaleString()} kcal · {fs.avgProtein} g protein
              </Text>
              <Text style={tr.summarySub}>
                A day on average
                {fs.targetKcal && fs.proteinTarget
                  ? `, against ${fs.targetKcal.toLocaleString()} kcal and ${fs.proteinTarget} g`
                  : ''}
                . {fs.daysLogged} of {fs.days} days logged.
              </Text>
            </>
          ) : (
            <Text style={tr.faint}>
              {food?.key === foodKey
                ? `No meals logged ${thisSpan}.`
                : 'Loading meals'}
            </Text>
          )}
        </View>

        <View style={tr.summaryBlock}>
          <Text style={tr.menuLabel}>BODYWEIGHT</Text>
          {body.endKg != null ? (
            <>
              <Text style={tr.summaryValue}>{formatKg(body.endKg)} kg</Text>
              <Text style={tr.summarySub}>
                {body.changeKg == null
                  ? `First weigh in ${thisSpan}.`
                  : Math.abs(body.changeKg) < 0.1
                    ? `Steady ${thisSpan}.`
                    : `${body.changeKg < 0 ? 'Down' : 'Up'} ${Math.abs(body.changeKg)} kg ${thisSpan}.`}
              </Text>
            </>
          ) : (
            <Text style={tr.faint}>
              No weigh ins {thisSpan}. Log one on Home.
            </Text>
          )}
        </View>
      </Card>

      <SectionLabel>{`Volume by ${span}`}</SectionLabel>
      <Card>
        <BarChart
          values={series.map((s) => s.summary.volume)}
          height={110}
          positiveColor={palette.text}
        />
        <View style={tr.barLabels}>
          <Text style={tr.faint}>{periodTick(series[0].period)}</Text>
          <Text style={[tr.faint, { color: palette.text }]}>
            {periodTick(series[series.length - 1].period)}
          </Text>
        </View>
      </Card>

      <SectionLabel>
        {kind === 'week'
          ? 'Hard sets per muscle'
          : 'Hard sets per muscle, a week'}
      </SectionLabel>
      <Card>
        {training.muscles.length ? (
          <>
            {training.muscles.map((m) => {
              const perWeek = m.sets / weeks;
              return (
                <View key={m.muscle} style={tr.muscleBarRow}>
                  <Text style={tr.muscleName}>{m.label}</Text>
                  <View style={tr.muscleTrack}>
                    <View
                      style={[
                        tr.muscleFill,
                        {
                          width: `${Math.min(100, (perWeek / topMuscle) * 100)}%`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        tr.muscleGuide,
                        { left: `${(GUIDE_SETS / topMuscle) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={tr.muscleCount}>
                    {Number.isInteger(perWeek) ? perWeek : perWeek.toFixed(1)}
                  </Text>
                </View>
              );
            })}
            <Text style={[tr.faint, { marginTop: 8 }]}>
              The orange mark is {GUIDE_SETS} sets a week, where most muscle
              building programmes start.
            </Text>
          </>
        ) : (
          <Text style={tr.faint}>No hard sets this {span}.</Text>
        )}
      </Card>

      <SectionLabel>Lifts</SectionLabel>
      <Card padded={false}>
        {lifts.length ? (
          (allLifts ? lifts : lifts.slice(0, LIFTS_SHOWN)).map((l, i) => (
            <Pressable
              key={l.exercise.id}
              onPress={() =>
                router.navigate({
                  pathname: '/exercise',
                  params: { id: l.exercise.id },
                })
              }
              style={({ pressed }) => [
                tr.liftRow,
                i === 0 && { borderTopWidth: 0 },
                pressed && tr.pressed,
              ]}
            >
              <View style={tr.flex1}>
                <Text style={tr.liftName} numberOfLines={1}>
                  {l.exercise.name}
                </Text>
                <Text style={tr.liftMeta}>
                  {l.sets} {l.sets === 1 ? 'set' : 'sets'} · best{' '}
                  {nb(setText(l.best, l.exercise))}
                </Text>
              </View>
              <View>
                <Text style={tr.liftScore}>
                  {l.score ? `${formatKg(l.score)} kg` : ' '}
                </Text>
                <Text style={tr.liftChange}>
                  {l.change == null ? (
                    <Text style={tr.faint}>{l.before ? 'level' : 'new'}</Text>
                  ) : (
                    <Change value={l.change} />
                  )}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={[tr.faint, { padding: 16 }]}>No lifts this {span}.</Text>
        )}
      </Card>
      {!allLifts && lifts.length > LIFTS_SHOWN ? (
        <Pressable
          onPress={() => setAllLifts(true)}
          style={{ alignSelf: 'center', padding: 12 }}
        >
          <Text style={tr.linkText}>Show all {lifts.length} lifts</Text>
        </Pressable>
      ) : null}
      <Text style={[tr.faint, { marginTop: 8 }]}>
        kg is the best estimated one rep max, compared with the {span} before.
      </Text>
    </View>
  );
}

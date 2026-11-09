/**
 * start.tsx: the top of the Train tab. One tap to start, repeat the last
 * workout, run a routine, or get back to the one in progress.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronIcon, DotsIcon } from '@/components/ui/icons';
import { Card, GlassSurface, PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { addDays, periodOf, trainingSummary } from '@/lib/train/progress';
import {
  clock,
  tally,
  type Routine,
  type Session,
  type Workout,
} from '@/lib/train/workout';

import { Chip, Stat } from './bits';
import type { Training } from './data';
import { tr } from './styles';

/** "today", "yesterday", "3 days ago", "9 Nov". */
export function relativeDay(day: string, today: string): string {
  if (day === today) return 'today';
  if (day === addDays(today, -1)) return 'yesterday';
  for (let n = 2; n <= 6; n++)
    if (day === addDays(today, -n)) return `${n} days ago`;
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function ResumeCard({
  session,
  now,
  onResume,
}: {
  session: Session;
  now: number;
  onResume: () => void;
}) {
  const t = tally(session.exercises);
  return (
    <GlassSurface padded style={tr.startCard}>
      <View style={tr.resumeTop}>
        <Text style={tr.eyebrowAccent}>IN PROGRESS</Text>
        <Text style={[tr.strong, tr.num]}>
          {clock(now - Date.parse(session.startedAt))}
        </Text>
      </View>
      <View>
        <Text style={tr.resumeName}>{session.name}</Text>
        <Text style={tr.muted}>
          {session.exercises.length}{' '}
          {session.exercises.length === 1 ? 'exercise' : 'exercises'} · {t.done}{' '}
          of {t.total} sets
        </Text>
      </View>
      <PrimaryButton label="Resume" onPress={onResume} />
    </GlassSurface>
  );
}

function QuickRow({
  title,
  meta,
  onPress,
  onMore,
}: {
  title: string;
  meta: string;
  onPress: () => void;
  onMore?: () => void;
}) {
  return (
    <View style={tr.quickRow}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [tr.flex1, pressed && tr.pressed]}
        accessibilityRole="button"
      >
        <Text style={tr.quickTitle}>{title}</Text>
        <Text style={tr.quickMeta} numberOfLines={1}>
          {meta}
        </Text>
      </Pressable>
      {onMore ? (
        <Pressable
          onPress={onMore}
          hitSlop={6}
          accessibilityLabel={`${title} options`}
          style={tr.iconBtn}
        >
          <DotsIcon />
        </Pressable>
      ) : (
        <ChevronIcon direction="right" color={palette.textFaint} />
      )}
    </View>
  );
}

export function StartCard({
  data,
  today,
  onStart,
  onRepeat,
  onRoutine,
  onDeleteRoutine,
  onDescribe,
}: {
  data: Training;
  today: string;
  onStart: () => void;
  onRepeat: (w: Workout) => void;
  onRoutine: (r: Routine) => void;
  onDeleteRoutine: (r: Routine) => void;
  onDescribe: () => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const last = data.workouts[data.workouts.length - 1];
  const names = (ids: string[]) =>
    ids
      .map((id) => data.exById.get(id)?.name)
      .filter(Boolean)
      .join(', ');
  const routines = [...data.routines].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <GlassSurface padded style={tr.startCard}>
      <PrimaryButton label="Start a workout" onPress={onStart} />
      <View>
        {last ? (
          <QuickRow
            title={`Repeat ${last.name}`}
            meta={`${relativeDay(last.date, today)} · ${names(last.exercises.map((e) => e.exerciseId))}`}
            onPress={() => onRepeat(last)}
          />
        ) : null}
        {routines.map((r) => (
          <View key={r.id}>
            <QuickRow
              title={r.name}
              meta={`Routine · ${r.exercises.length} ${r.exercises.length === 1 ? 'exercise' : 'exercises'} · ${names(r.exercises.map((e) => e.exerciseId))}`}
              onPress={() => onRoutine(r)}
              onMore={() => setMenu(menu === r.id ? null : r.id)}
            />
            {menu === r.id ? (
              <View style={[tr.chips, { paddingBottom: 12 }]}>
                <Chip label="Start" on onPress={() => onRoutine(r)} />
                <Chip
                  label="Delete routine"
                  danger
                  onPress={() => onDeleteRoutine(r)}
                />
              </View>
            ) : null}
          </View>
        ))}
        <QuickRow
          title="Describe a workout"
          meta="Type it or say it, for today or any day before"
          onPress={onDescribe}
        />
      </View>
    </GlassSurface>
  );
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This week at a glance: which days were trained, and how much. */
export function WeekStrip({
  data,
  today,
  onPress,
}: {
  data: Training;
  today: string;
  onPress: () => void;
}) {
  const week = periodOf('week', today);
  const t = trainingSummary(data.workouts, data.exById, week);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="This week, open progress"
    >
      <Card style={tr.weekCard}>
        <View style={tr.weekDays}>
          {LETTERS.map((letter, i) => {
            const day = addDays(week.start, i);
            const on = t.days.includes(day);
            return (
              <View key={day} style={tr.weekDay}>
                <Text
                  style={[
                    tr.weekDayText,
                    day === today && { color: palette.text },
                  ]}
                >
                  {letter}
                </Text>
                <View
                  style={[
                    tr.weekDot,
                    on && tr.weekDotOn,
                    day === today && !on && tr.weekDotToday,
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={tr.weekStats}>
          <Stat
            value={String(t.sessions)}
            label={t.sessions === 1 ? 'Workout' : 'Workouts'}
          />
          <Stat value={String(t.sets)} label="Hard sets" />
          <Stat
            value={`${t.volume.toLocaleString()} kg`}
            label="Volume this week"
          />
        </View>
      </Card>
    </Pressable>
  );
}

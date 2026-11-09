/**
 * program.tsx: how a program reads everywhere it appears. Its days and
 * prescriptions, its meal plan, the Train card for today's day, and the
 * summary a coach sees for each follower who shares.
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  GlassSurface,
  PrimaryButton,
  ProgressBar,
} from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import type { Following } from '@/lib/supabase/programs';
import { readAdherence, WINDOW, workoutRate } from '@/lib/train/adherence';
import type { Exercise } from '@/lib/train/exercises';
import {
  position,
  prescription,
  type Follow,
  type MealPlan,
  type Program,
} from '@/lib/train/program';
import type { Workout } from '@/lib/train/workout';

import { nb, Stat } from './bits';
import { relativeDay } from './start';
import { tr } from './styles';

/** Names for a program's exercises: the user's list, then the author's own. */
export function namer(program: Program, exById: Map<string, Exercise>) {
  const own = new Map(program.exercises.map((e) => [e.id, e.name]));
  return (id: string) => exById.get(id)?.name ?? own.get(id) ?? 'Exercise';
}

export const daysAWeek = (p: Program) =>
  `${p.days.length} ${p.days.length === 1 ? 'day' : 'days'} a week`;

export const weeksText = (p: Program) =>
  `${p.weeks} ${p.weeks === 1 ? 'week' : 'weeks'}`;

/** "just now", "3 hours ago", "2 days ago". */
export function ago(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 60) return mins < 2 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** "down 1.2 kg", "up 0.4 kg", "level". */
export function kgChange(kg: number): string {
  if (Math.abs(kg) < 0.05) return 'level';
  return `${kg > 0 ? 'up' : 'down'} ${Math.abs(kg).toFixed(1)} kg`;
}

export function ProgramHeader({
  program,
  eyebrow,
}: {
  program: Program;
  eyebrow: string;
}) {
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={tr.eyebrowAccent}>{eyebrow}</Text>
      <Text style={[tr.nameInput, { marginTop: space.sm }]}>
        {program.title}
      </Text>
      <Text style={tr.sessionMeta}>
        {[
          program.authorName ? `by ${program.authorName}` : null,
          weeksText(program),
          daysAWeek(program),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {program.description ? (
        <Text
          style={[tr.body, { marginTop: space.md, color: palette.textMuted }]}
        >
          {program.description}
        </Text>
      ) : null}
    </View>
  );
}

/** Every day with its exercises and prescriptions. */
export function ProgramDays({
  program,
  name,
  next,
}: {
  program: Program;
  name: (id: string) => string;
  /** The day to train next, marked. */
  next?: number;
}) {
  return (
    <View style={{ gap: space.md }}>
      {program.days.map((d, i) => (
        <Card key={d.id} padded={false}>
          <View style={pu.dayHead}>
            <Text style={tr.strong}>{d.name}</Text>
            <Text style={next === i ? [pu.dayTag, tr.accentText] : pu.dayTag}>
              {next === i ? 'Next' : `Day ${i + 1}`}
            </Text>
          </View>
          {d.exercises.map((e, j) => (
            <View key={`${e.exerciseId}:${j}`} style={pu.exLine}>
              <View style={tr.flex1}>
                <Text style={pu.exName}>{name(e.exerciseId)}</Text>
                {e.note ? <Text style={tr.faint}>{e.note}</Text> : null}
              </View>
              <Text style={pu.rx}>{nb(prescription(e))}</Text>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

export function MealPlanView({ plan }: { plan: MealPlan }) {
  return (
    <Card style={{ gap: space.md }}>
      {plan.kcal || plan.proteinG ? (
        <View style={tr.row}>
          {plan.kcal ? (
            <Stat value={plan.kcal.toLocaleString()} label="Calories a day" />
          ) : null}
          {plan.proteinG ? (
            <Stat value={`${plan.proteinG} g`} label="Protein a day" />
          ) : null}
        </View>
      ) : null}
      {plan.meals.map((m) => (
        <View key={m.id} style={pu.mealLine}>
          <Text style={[pu.exName, tr.flex1]}>{m.name}</Text>
          <Text style={pu.rx}>
            {nb(`${m.kcal.toLocaleString()} kcal · ${m.proteinG} g protein`)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** The top of Train while following: today's day, one tap to start it. */
export function ProgramCard({
  following,
  workouts,
  name,
  onStart,
}: {
  following: Following;
  workouts: Workout[];
  name: (id: string) => string;
  onStart: (dayIndex: number) => void;
}) {
  const { program, follow } = following;
  const open = () =>
    router.navigate({ pathname: '/program', params: { id: program.id } });
  if (!program.days.length) return null;
  const pos = position(program, workouts, follow.startedAt);
  const day = program.days[pos.dayIndex];

  if (pos.complete) {
    return (
      <GlassSurface padded style={tr.startCard}>
        <Text style={tr.eyebrowAccent}>PROGRAM COMPLETE</Text>
        <View>
          <Text style={tr.resumeName}>{program.title}</Text>
          <Text style={tr.muted}>
            {pos.done} workouts over {weeksText(program)}. Run it again from day
            one, or find your next program.
          </Text>
        </View>
        <PrimaryButton
          label={`Start ${day.name}`}
          onPress={() => onStart(pos.dayIndex)}
        />
        <Pressable onPress={open} hitSlop={6} style={{ alignSelf: 'center' }}>
          <Text style={tr.linkText}>Open program</Text>
        </Pressable>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface padded style={tr.startCard}>
      <View style={tr.resumeTop}>
        <Text style={tr.eyebrowAccent}>
          WEEK {pos.week} OF {program.weeks}
        </Text>
        <Pressable onPress={open} hitSlop={8} accessibilityRole="link">
          <Text style={tr.linkText}>{program.title}</Text>
        </Pressable>
      </View>
      <View>
        <Text style={tr.resumeName}>{day.name}</Text>
        <Text style={tr.muted} numberOfLines={2}>
          {day.exercises.map((e) => name(e.exerciseId)).join(', ')}
        </Text>
      </View>
      <PrimaryButton
        label={`Start ${day.name}`}
        onPress={() => onStart(pos.dayIndex)}
      />
    </GlassSurface>
  );
}

/** One follower who shares, as their coach sees them. */
export function FollowerRow({
  follow,
  today,
  first,
}: {
  follow: Follow;
  today: string;
  first: boolean;
}) {
  const a = readAdherence(follow.stats);
  const who = follow.displayName || 'A follower';
  return (
    <View
      style={[tr.histRow, first && { borderTopWidth: 0 }, { gap: space.sm }]}
    >
      <View style={tr.histTop}>
        <Text style={tr.histName} numberOfLines={1}>
          {who}
        </Text>
        {a ? (
          <Text style={tr.histDate}>
            Week {a.week} of {a.weeks}
          </Text>
        ) : null}
      </View>
      {a && a.days === 0 ? (
        <Text style={tr.histLifts}>
          {a.lastWorkout
            ? `Followed today and trained ${relativeDay(a.lastWorkout, today)}. Their first full day shows here tomorrow.`
            : 'Followed today. Their first full day shows here tomorrow.'}
        </Text>
      ) : a ? (
        <>
          <View style={pu.rateRow}>
            <Text style={pu.rateText}>
              {nb(`${a.doneRecent} of ${a.plannedRecent} workouts`)}
            </Text>
            <View style={tr.flex1}>
              <ProgressBar fraction={workoutRate(a)} />
            </View>
          </View>
          <Text style={tr.histLifts}>
            {[
              a.lastWorkout
                ? `Trained ${relativeDay(a.lastWorkout, today)}`
                : 'No program workouts yet',
              `food logged ${a.foodDays} of ${a.days} ${a.days === 1 ? 'day' : 'days'}`,
            ].join(' · ')}
          </Text>
          {a.avgKcal != null || a.weightChangeKg != null ? (
            <Text style={tr.histLifts}>
              {[
                a.avgKcal != null
                  ? `${a.avgKcal.toLocaleString()} kcal and ${a.avgProteinG ?? 0} g protein a day`
                  : null,
                a.weightChangeKg != null
                  ? `weight ${kgChange(a.weightChangeKg)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          <Text style={tr.faint}>
            {a.days >= WINDOW ? 'Last 4 weeks' : 'Since following'} · updated{' '}
            {ago(a.at)}
          </Text>
        </>
      ) : (
        <Text style={tr.faint}>
          Sharing is on. Their summary arrives after they next open Grain.
        </Text>
      )}
    </View>
  );
}

const pu = StyleSheet.create({
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  dayTag: { color: palette.textFaint, fontSize: 12, fontWeight: '600' },
  exLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  exName: { color: palette.text, fontSize: 15 },
  rx: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  mealLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rateText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

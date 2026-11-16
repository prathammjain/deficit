/**
 * training.tsx: "Training" on Home. This week's workouts at a glance, the
 * next program day when following one, and one tap to Train.
 */

import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import type { CardioSession } from '@/lib/cardio/cardio';
import { countdown } from '@/lib/hyrox/countdown';
import type { Sim } from '@/lib/hyrox/race';
import type { Following } from '@/lib/supabase/programs';
import type { Exercise } from '@/lib/train/exercises';
import { activity, activityText } from '@/lib/train/activity';
import { position } from '@/lib/train/program';
import { addDays, periodOf, trainingSummary } from '@/lib/train/progress';
import type { Workout } from '@/lib/train/workout';

import { st } from './styles';

// Counting sessions, sets and kilograms needs no exercise details.
const NO_EXERCISES = new Map<string, Exercise>();

export function TrainCard({
  workouts,
  sims = [],
  cardio = [],
  following,
  today,
  race,
}: {
  workouts: Workout[];
  /** HYROX sims count as training too. */
  sims?: Sim[];
  /** So do cardio sessions. */
  cardio?: CardioSession[];
  following: Following | null;
  today: string;
  /** A HYROX race on the calendar, counted down under the week. */
  race?: { date: string; name?: string } | null;
}) {
  const c = race ? countdown(race.date, today) : null;
  const raceLine =
    race && c && c.days >= 0
      ? `${race.name || 'Your HYROX race'} ${
          c.days === 0
            ? 'is today'
            : c.days === 1
              ? 'is tomorrow'
              : `in ${c.days} days`
        }`
      : null;
  const week = periodOf('week', today);
  const t = trainingSummary(workouts, NO_EXERCISES, week);
  const a = activity(workouts, sims, week, cardio);
  const program = following?.program;
  const next =
    program && program.days.length
      ? program.days[
          position(program, workouts, following.follow.startedAt).dayIndex
        ]
      : null;

  return (
    <Pressable
      onPress={() => router.navigate('/train')}
      accessibilityRole="button"
      accessibilityLabel="Training this week, open Train"
    >
      <Card padded>
        <View style={st.weekTopRow}>
          <Text style={st.weekLabel}>Training this week</Text>
          <View style={st.weekDots}>
            {Array.from({ length: 7 }, (_, i) => addDays(week.start, i)).map(
              (day) => (
                <View
                  key={day}
                  style={[
                    st.weekDot,
                    a.days.includes(day) ? st.weekDotOn : st.weekDotOff,
                  ]}
                />
              ),
            )}
          </View>
        </View>

        {workouts.length === 0 && sims.length === 0 && cardio.length === 0 ? (
          <Text style={st.weekBody}>
            No workouts yet. Log one on Train and it shows up here, beside your
            food.
          </Text>
        ) : (
          <>
            <Text style={st.weekValue}>
              {a.sessions} {a.sessions === 1 ? 'session' : 'sessions'}
            </Text>
            <Text style={st.weekGoal}>
              {a.workouts
                ? `${activityText(a)} · ${t.sets} hard sets · ${t.volume.toLocaleString()} kg moved`
                : activityText(a)}
            </Text>
          </>
        )}

        {next && program ? (
          <Text style={[st.weekBody, { marginTop: space.md }]}>
            Next:{' '}
            <Text style={{ color: palette.text, fontWeight: '700' }}>
              {next.name}
            </Text>{' '}
            · {program.title}
          </Text>
        ) : null}

        {raceLine ? (
          <Text style={[st.weekBody, { marginTop: space.md }]}>
            <Text style={{ color: palette.accent, fontWeight: '700' }}>
              {raceLine}
            </Text>
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

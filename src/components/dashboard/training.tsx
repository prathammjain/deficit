/**
 * training.tsx: "Training" on Home. This week's workouts at a glance, the
 * next program day when following one, and one tap to Train.
 */

import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import type { Following } from '@/lib/supabase/programs';
import type { Exercise } from '@/lib/train/exercises';
import { position } from '@/lib/train/program';
import { addDays, periodOf, trainingSummary } from '@/lib/train/progress';
import type { Workout } from '@/lib/train/workout';

import { st } from './styles';

// Counting sessions, sets and kilograms needs no exercise details.
const NO_EXERCISES = new Map<string, Exercise>();

export function TrainCard({
  workouts,
  following,
  today,
}: {
  workouts: Workout[];
  following: Following | null;
  today: string;
}) {
  const week = periodOf('week', today);
  const t = trainingSummary(workouts, NO_EXERCISES, week);
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
                    t.days.includes(day) ? st.weekDotOn : st.weekDotOff,
                  ]}
                />
              ),
            )}
          </View>
        </View>

        {workouts.length === 0 ? (
          <Text style={st.weekBody}>
            No workouts yet. Log one on Train and it shows up here, beside your
            food.
          </Text>
        ) : (
          <>
            <Text style={st.weekValue}>
              {t.sessions} {t.sessions === 1 ? 'workout' : 'workouts'}
            </Text>
            <Text style={st.weekGoal}>
              {t.sets} hard sets · {t.volume.toLocaleString()} kg moved
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
      </Card>
    </Pressable>
  );
}

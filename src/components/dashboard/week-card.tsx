/**
 * week-card.tsx — "This week" on Home: the weight the user is on pace to
 * lose, from the trailing-7-day deficit average (see weekly-prediction.ts).
 * A 7-dot strip shows logged/missed days; below 5 logged days the card asks
 * for more logging; after a fully unlogged week it starts fresh. Gains are
 * shown honestly, in accent.
 */

import { Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import type { WeeklyPrediction } from '@/lib/weekly-prediction';

import { st } from './styles';

export function WeekCard({
  prediction,
  goalRateKgWeek,
}: {
  prediction: WeeklyPrediction;
  goalRateKgWeek: number;
}) {
  const { state, loggedDays, predictedKgPerWeek } = prediction;
  const gaining = state === 'ready' && (predictedKgPerWeek as number) < 0;

  return (
    <Card padded>
      <View style={st.weekTopRow}>
        <Text style={st.weekLabel}>
          {state !== 'ready'
            ? 'Weekly prediction'
            : gaining
              ? 'Predicted gain'
              : 'Predicted loss'}
        </Text>
        <View style={st.weekDots}>
          {prediction.days.map((d) => (
            <View
              key={d.date}
              style={[st.weekDot, d.logged ? st.weekDotOn : st.weekDotOff]}
            />
          ))}
        </View>
      </View>

      {state === 'ready' ? (
        <>
          <Text style={[st.weekValue, gaining && { color: palette.accent }]}>
            {formatKg(predictedKgPerWeek as number)}
          </Text>
          <Text style={st.weekGoal}>
            goal −{goalRateKgWeek.toFixed(2)} kg / week
          </Text>
        </>
      ) : state === 'building' ? (
        <Text style={st.weekBody}>
          {loggedDays} of 7 days logged — log {5 - loggedDays} more to see
          your weekly prediction.
        </Text>
      ) : (
        <Text style={st.weekBody}>
          Starting fresh — log today to begin a new week.
        </Text>
      )}
    </Card>
  );
}

/** Positive = loss → "−0.48 kg"; negative = gain → "+0.21 kg". */
function formatKg(kgPerWeek: number): string {
  if (kgPerWeek === 0) return '0.00 kg';
  const abs = Math.abs(kgPerWeek).toFixed(2);
  return kgPerWeek > 0 ? `−${abs} kg` : `+${abs} kg`;
}

import { Text, View } from 'react-native';

import { Card, Hairline } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { recommendedTarget, type AdaptiveTdee } from '@/lib/adaptive-tdee';
import { ABSOLUTE_KCAL_FLOOR } from '@/lib/targets';

import { st } from './styles';

const CONFIDENCE_COPY: Record<AdaptiveTdee['confidence'], string> = {
  none: '',
  low: 'Early read',
  medium: 'Getting confident',
  high: 'High confidence',
};

export function AdaptiveCard({
  adaptive,
  formulaTdee,
  dailyDeficit,
  bmr,
}: {
  adaptive: AdaptiveTdee | null;
  formulaTdee: number;
  dailyDeficit: number;
  bmr: number;
}) {
  // Enough data, but too many days in it went unlogged to trust the maths.
  if (
    adaptive &&
    adaptive.confidence === 'none' &&
    adaptive.intakeDays >= 7 &&
    adaptive.weighIns >= 3 &&
    adaptive.coverage != null &&
    adaptive.coverage < 0.7
  ) {
    const span = adaptive.spanDays + 1;
    return (
      <Card>
        <Text style={st.adaptiveLead}>Waiting for steadier logging</Text>
        <Text style={st.adaptiveBody}>
          {Math.round(adaptive.coverage * span)} of {span} days between weigh
          ins were logged in full. The estimate waits for most days, so gaps
          can’t pass for a slower metabolism.
        </Text>
      </Card>
    );
  }

  if (!adaptive || adaptive.confidence === 'none') {
    const days = adaptive?.intakeDays ?? 0;
    const weighIns = adaptive?.weighIns ?? 0;
    return (
      <Card>
        <Text style={st.adaptiveLead}>Learning your real maintenance</Text>
        <Text style={st.adaptiveBody}>
          Your target starts from a formula. After about a week of meals and
          weigh ins, Grain works out what you really burn and adjusts it.
        </Text>
        <View style={st.adaptiveProgressRow}>
          <Text style={st.adaptiveProgressText}>{days} of 7 days logged</Text>
          <Text style={st.adaptiveProgressText}>{weighIns} of 3 weigh ins</Text>
        </View>
      </Card>
    );
  }

  const est = adaptive.estimatedTdeeKcal as number;
  const suggested = recommendedTarget(
    est,
    dailyDeficit,
    Math.max(bmr, ABSOLUTE_KCAL_FLOOR),
  );
  const delta = est - formulaTdee;
  const trend = adaptive.trendKgPerWeek ?? 0;

  return (
    <Card>
      <View style={st.adaptiveHeader}>
        <Text style={st.adaptiveLead}>
          From your last {adaptive.intakeDays} days
        </Text>
        <Text style={st.confidenceText}>
          {CONFIDENCE_COPY[adaptive.confidence]}
        </Text>
      </View>

      <View style={st.adaptiveBig}>
        <Text style={st.adaptiveTdee}>{est.toLocaleString()}</Text>
        <Text style={st.adaptiveTdeeUnit}>kcal real maintenance</Text>
      </View>

      <View style={st.adaptiveStatsRow}>
        <AdaptiveStat
          label={
            trend < 0
              ? 'Losing weight'
              : trend > 0
                ? 'Gaining weight'
                : 'Weight steady'
          }
          value={`${Math.abs(trend).toFixed(2)} kg a week`}
          tone={trend > 0 ? palette.danger : palette.text}
        />
        <AdaptiveStat
          label={delta >= 0 ? 'Above formula' : 'Below formula'}
          value={`${Math.abs(delta).toLocaleString()} kcal`}
          tone={palette.text}
        />
      </View>

      <Hairline style={st.metaDivider} />
      <View style={st.suggestRow}>
        <Text style={st.suggestLabel}>Suggested target</Text>
        <Text style={st.suggestValue}>{suggested.toLocaleString()} kcal</Text>
      </View>
    </Card>
  );
}

function AdaptiveStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={st.adaptiveStat}>
      <Text style={[st.adaptiveStatValue, { color: tone }]}>{value}</Text>
      <Text style={st.adaptiveStatLabel}>{label}</Text>
    </View>
  );
}

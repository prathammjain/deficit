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
  if (!adaptive || adaptive.confidence === 'none') {
    const days = adaptive?.intakeDays ?? 0;
    const weighIns = adaptive?.weighIns ?? 0;
    return (
      <Card>
        <Text style={st.adaptiveLead}>Learning your real maintenance</Text>
        <Text style={st.adaptiveBody}>
          The formula is a starting estimate. Keep logging meals and weighing
          in. After about a week I’ll back out your true expenditure from the
          data and fine-tune this target.
        </Text>
        <View style={st.adaptiveProgressRow}>
          <Text style={st.adaptiveProgressText}>{days}/7 days logged</Text>
          <Text style={st.adaptiveProgressDot}>·</Text>
          <Text style={st.adaptiveProgressText}>{weighIns}/3 weigh-ins</Text>
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
        <View style={st.confidenceChip}>
          <Text style={st.confidenceText}>
            {CONFIDENCE_COPY[adaptive.confidence]}
          </Text>
        </View>
      </View>

      <View style={st.adaptiveBig}>
        <Text style={st.adaptiveTdee}>{est.toLocaleString()}</Text>
        <Text style={st.adaptiveTdeeUnit}>kcal real maintenance</Text>
      </View>

      <View style={st.adaptiveStatsRow}>
        <AdaptiveStat
          label="Weight trend"
          value={`${trend > 0 ? '+' : ''}${trend.toFixed(2)} kg/wk`}
          tone={
            trend < 0
              ? palette.good
              : trend > 0
                ? palette.danger
                : palette.textMuted
          }
        />
        <AdaptiveStat
          label="vs formula"
          value={`${delta >= 0 ? '+' : ''}${delta} kcal`}
          tone={palette.textMuted}
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

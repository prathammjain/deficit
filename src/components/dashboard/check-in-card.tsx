import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface, Hairline } from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import type { AdaptiveTdee } from '@/lib/adaptive-tdee';

/**
 * The weekly check in, on the day it happened: what moved, why, and one tap
 * to keep last week's number for another week.
 */
export function CheckInCard({
  maintenanceBefore,
  maintenanceNow,
  targetBefore,
  targetNow,
  adaptive,
  onKeepLastWeek,
}: {
  maintenanceBefore: number;
  maintenanceNow: number;
  targetBefore: number;
  targetNow: number;
  adaptive: AdaptiveTdee | null;
  onKeepLastWeek: () => void;
}) {
  const up = maintenanceNow > maintenanceBefore;
  const trend = adaptive?.trendKgPerWeek;
  return (
    <GlassSurface padded style={cs.card}>
      <Text style={cs.eyebrow}>WEEKLY CHECK IN</Text>
      <Text style={cs.title}>
        {up ? 'You burn more than we thought' : 'You burn less than we thought'}
      </Text>

      <View style={cs.rows}>
        <Row label="Daily target" before={targetBefore} now={targetNow} />
        <Hairline />
        <Row
          label="Maintenance"
          before={maintenanceBefore}
          now={maintenanceNow}
        />
      </View>

      {adaptive?.avgIntakeKcal != null && trend != null ? (
        <Text style={cs.body}>
          Over your last {adaptive.intakeDays} logged days you averaged{' '}
          {adaptive.avgIntakeKcal.toLocaleString()} kcal, and your weight trend
          is{' '}
          {trend === 0
            ? 'flat'
            : `${Math.abs(trend).toFixed(1)} kg a week ${trend < 0 ? 'down' : 'up'}`}
          . Grain moves toward that a step at a time, so one odd week can’t
          swing your plan.
        </Text>
      ) : null}

      <Pressable onPress={onKeepLastWeek} hitSlop={8} style={cs.link}>
        <Text style={cs.linkText}>Keep last week’s target</Text>
      </Pressable>
    </GlassSurface>
  );
}

function Row({
  label,
  before,
  now,
}: {
  label: string;
  before: number;
  now: number;
}) {
  return (
    <View style={cs.row}>
      <Text style={cs.rowLabel}>{label}</Text>
      <Text style={cs.rowValue}>
        <Text style={cs.before}>{before.toLocaleString()}</Text>
        {'  →  '}
        <Text style={cs.now}>{now.toLocaleString()}</Text>
        <Text style={cs.unit}> kcal</Text>
      </Text>
    </View>
  );
}

const cs = StyleSheet.create({
  card: { marginTop: space.xl },
  eyebrow: { ...typo.eyebrow, fontSize: 10.5, color: palette.accent },
  title: {
    ...typo.heading,
    fontSize: 18,
    color: palette.text,
    marginTop: space.sm,
  },
  rows: { marginTop: space.lg, gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  rowLabel: { color: palette.textMuted, fontSize: 14 },
  rowValue: { color: palette.textFaint, fontSize: 15 },
  before: { color: palette.textFaint, textDecorationLine: 'line-through' },
  now: { color: palette.text, fontWeight: '700' },
  unit: { color: palette.textFaint, fontSize: 13 },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.textMuted,
    marginTop: space.lg,
  },
  link: { alignSelf: 'center', paddingTop: space.lg },
  linkText: { color: palette.accent, fontSize: 14, fontWeight: '600' },
});

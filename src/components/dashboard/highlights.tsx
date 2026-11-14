/**
 * highlights.tsx: the three cards at the top of Home. Where the user stands
 * after a break, how this week went, and the total deficit so far. Each
 * opens the screen with the detail.
 */

import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { dayName, openDay } from '@/components/history/continuity';
import { ChevronIcon } from '@/components/ui/icons';
import {
  Card,
  DotMatrix,
  GlassSurface,
  Hairline,
  PrimaryButton,
} from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import {
  balanceNote,
  type Continuity,
  type HistorySummary,
  type Slip,
} from '@/lib/history-stats';
import { todayKey } from '@/lib/log-store';
import type { Goal } from '@/lib/targets';
import { addDays } from '@/lib/train/progress';
import { drawWeekCard, shareWeekCard } from '@/lib/week-card';
import { formatWeekRange, type WeekReport } from '@/lib/week-report';

/** After a break: away while it runs, a fresh start for two weeks after. */
export function ComebackCard({ flow }: { flow: Continuity }) {
  if (flow.away) {
    return (
      <GlassSurface padded style={hs.flow}>
        <Text style={hs.eyebrow}>
          LAST FULL DAY · {dayName(flow.away.lastCounted).toUpperCase()}
        </Text>
        <Text style={hs.flowTitle}>{flow.away.days} days without logging</Text>
        <Text style={hs.flowBody}>
          Nothing is counted while you’re away. Log a full day and your numbers
          pick up from there.
        </Text>
        <PrimaryButton
          label="Log today"
          onPress={() => router.navigate('/log')}
          style={hs.flowButton}
        />
        <Pressable
          onPress={() => openDay(addDays(todayKey(), -1))}
          hitSlop={8}
          style={hs.flowLink}
        >
          <Text style={hs.flowLinkText}>Or fill in a day you missed</Text>
        </Pressable>
      </GlassSurface>
    );
  }
  if (!flow.restart) return null;
  const { brk, since } = flow.restart;
  return (
    <Pressable
      onPress={() => router.navigate('/history')}
      style={({ pressed }) => pressed && hs.pressed}
      accessibilityRole="button"
      accessibilityLabel={`Fresh start since ${dayName(since)}. Open History.`}
    >
      <Card style={hs.flow}>
        <Text style={[hs.eyebrow, hs.accent]}>
          FRESH START · SINCE {dayName(since).toUpperCase()}
        </Text>
        <View style={hs.row}>
          <Text style={hs.flowTitle}>Back after {brk.days} days away</Text>
          <ChevronIcon direction="right" color={palette.textFaint} />
        </View>
        <Text style={hs.flowBody}>
          Your numbers count from your return.{' '}
          {formatWeekRange(brk.from, brk.to)} counts as nothing either way.
        </Text>
      </Card>
    </Pressable>
  );
}

/** The morning after a day slipped: one tap to finish it, no telling off. */
export function CatchUpCard({ slip }: { slip: Slip }) {
  const unfinished = slip.status === 'unfinished';
  return (
    <Pressable
      onPress={() => openDay(slip.date)}
      style={({ pressed }) => pressed && hs.pressed}
      accessibilityRole="button"
      accessibilityLabel={`${unfinished ? 'Finish' : 'Fill in'} yesterday. Open Log.`}
    >
      <Card style={hs.flow}>
        <Text style={hs.eyebrow}>
          YESTERDAY · {dayName(slip.date).toUpperCase()}
        </Text>
        <View style={hs.row}>
          <Text style={hs.flowTitle}>
            {unfinished ? 'Yesterday looks unfinished' : 'Yesterday is blank'}
          </Text>
          <ChevronIcon direction="right" color={palette.textFaint} />
        </View>
        <Text style={hs.flowBody}>
          {unfinished
            ? `${slip.kcal.toLocaleString()} kcal logged. Add what’s missing and the day counts.`
            : 'Still remember what you ate? Add it and the day counts.'}
        </Text>
      </Card>
    </Pressable>
  );
}

/** The last seven days, with the share image drawn ahead for one tap. */
export function useWeekShare(report: WeekReport) {
  const key = JSON.stringify(report);
  const [card, setCard] = useState<{
    blob: Blob;
    url: string;
    key: string;
  } | null>(null);
  useEffect(() => {
    const r = JSON.parse(key) as WeekReport;
    if (Platform.OS !== 'web' || r.daysLogged === 0) return;
    let url: string | null = null;
    let alive = true;
    // Drawn ahead of the tap: the share sheet only opens straight from one.
    drawWeekCard(r)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url, key });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);
  // A card drawn for other numbers, or a week with nothing in it, has no share.
  if (!card || card.key !== key || report.daysLogged === 0) return null;
  return () => void shareWeekCard(card.blob, `grain-week-${report.to}.png`);
}

export function WeekSummary({ report }: { report: WeekReport }) {
  const range = formatWeekRange(report.from, report.to);
  if (report.daysLogged === 0) {
    return (
      <Card>
        <Text style={hs.label}>{range}</Text>
        <Text style={hs.emptyTitle}>No full days yet this week</Text>
        <Text style={hs.flowBody}>
          Log a full day and your week fills in here, ready to share.
        </Text>
      </Card>
    );
  }
  const surplus = report.totalDeficitKcal < 0;
  const w = report.weightChangeKg;
  const note = balanceNote(
    report.goal,
    report.totalDeficitKcal,
    report.daysOnTarget,
    report.daysLogged,
  );
  return (
    <Card>
      <Text style={hs.label}>
        {range} ·{' '}
        {report.goal === 'maintain'
          ? 'Balance'
          : surplus
            ? 'Surplus'
            : 'Deficit'}
      </Text>
      <View style={hs.bigRow}>
        <Text style={hs.big}>
          {Math.abs(report.totalDeficitKcal).toLocaleString()}
        </Text>
        <Text style={hs.unit}>kcal</Text>
      </View>
      <Text style={hs.sub}>
        {note ??
          `${surplus ? 'About' : 'Worth about'} ${Math.abs(report.estFatLossKg).toFixed(1)} kg ${surplus ? 'gained' : 'of fat'}`}
      </Text>
      <Hairline style={hs.divider} />
      <View style={hs.grid}>
        <Stat value={`${report.daysLogged} of 7`} label="Full days" />
        <Stat
          value={`${report.proteinDays} of ${report.daysLogged}`}
          label="Protein target hit"
        />
        <Stat
          value={report.avgKcal != null ? report.avgKcal.toLocaleString() : '0'}
          label={`Average kcal of ${report.targetKcal.toLocaleString()}`}
        />
        <Stat
          value={w != null ? `${Math.abs(w).toFixed(1)} kg` : 'No change'}
          label={
            w == null || w === 0
              ? 'Weight'
              : w < 0
                ? 'Weight down'
                : 'Weight up'
          }
        />
      </View>
    </Card>
  );
}

/** Total deficit over the History default range: since a return, or 30 days. */
export function DeficitSummary({
  summary,
  since,
  goal = 'lose',
}: {
  summary: HistorySummary;
  /** The day of the return, when the range starts there. */
  since: string | null;
  goal?: Goal;
}) {
  const surplus = summary.totalDeficitKcal < 0;
  const note = balanceNote(
    goal,
    summary.totalDeficitKcal,
    summary.daysOnTarget,
    summary.daysCounted,
  );
  const days = `${summary.daysCounted} of ${summary.daysInRange} full days`;
  return (
    <Pressable
      onPress={() => router.navigate('/history')}
      style={({ pressed }) => pressed && hs.pressed}
      accessibilityRole="button"
      accessibilityLabel={`Total ${goal === 'maintain' ? 'energy balance' : surplus ? 'surplus' : 'deficit'}. Open History.`}
    >
      <GlassSurface padded>
        <View style={hs.row}>
          <Text style={hs.label}>
            {since ? `Since ${dayName(since)}` : 'Last 30 days'}
          </Text>
          <Text style={hs.label}>
            {surplus && goal !== 'maintain' ? 'Surplus' : 'Full days only'}
          </Text>
        </View>
        <View style={hs.bigRow}>
          <DotMatrix style={hs.hero}>
            {Math.abs(summary.totalDeficitKcal).toLocaleString()}
          </DotMatrix>
          <Text style={hs.unit}>kcal</Text>
        </View>
        <Text style={hs.sub}>
          {summary.daysCounted === 0
            ? 'No full days in this range yet'
            : goal === 'maintain' && note
              ? note
              : `${note ?? `About ${Math.abs(summary.estFatLossKg).toFixed(1)} kg ${surplus ? 'gained' : 'of fat'}`} · ${days}`}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={hs.stat}>
      <Text style={hs.statValue}>{value}</Text>
      <Text style={hs.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const hs = StyleSheet.create({
  pressed: { opacity: 0.75 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  flow: { marginTop: space.xl },
  flowButton: { marginTop: space.lg },
  flowLink: { alignSelf: 'center', paddingTop: space.md },
  flowLinkText: { color: palette.accent, fontSize: 14, fontWeight: '600' },
  eyebrow: { ...typo.eyebrow, fontSize: 10.5, color: palette.textFaint },
  accent: { color: palette.accent },
  flowTitle: {
    ...typo.heading,
    fontSize: 18,
    color: palette.text,
    marginTop: space.sm,
    flexShrink: 1,
  },
  flowBody: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.textMuted,
    marginTop: space.xs,
  },
  label: { ...typo.label, color: palette.textMuted },
  emptyTitle: {
    ...typo.value,
    color: palette.text,
    marginTop: space.sm,
  },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    marginTop: space.sm,
  },
  big: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
    color: palette.text,
  },
  hero: { ...typo.hero, fontSize: 52, color: palette.text },
  unit: { color: palette.textFaint, fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 14, color: palette.textMuted, marginTop: space.xs },
  divider: { marginVertical: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  stat: { width: '50%', paddingRight: space.sm },
  statValue: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: palette.text,
  },
  statLabel: { fontSize: 12, color: palette.textFaint, marginTop: 2 },
});

/**
 * continuity.tsx: what History says when logging stopped, and when it
 * started again. Plain facts, no cheering and no guilt: the missing days are
 * named, nothing is filled in, and the way back is one full day.
 */

import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { Card, GlassSurface, PrimaryButton } from '@/components/ui/primitives';
import type { Continuity } from '@/lib/history-stats';
import { todayKey } from '@/lib/log-store';
import { addDays } from '@/lib/train/progress';
import { formatWeekRange } from '@/lib/week-report';

import { st } from './styles';

/** Opens Log on a day other than today, to finish or fill it in. */
export function openDay(date: string) {
  router.navigate({ pathname: '/log', params: { date } });
}

/** "5 Nov". */
export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/** "Sun 1 Nov". */
export function dayName(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function AwayCard({ away }: { away: NonNullable<Continuity['away']> }) {
  return (
    <GlassSurface padded style={st.flowCard}>
      <Text style={st.flowEyebrow}>
        LAST FULL DAY · {dayName(away.lastCounted).toUpperCase()}
      </Text>
      <Text style={st.flowTitle}>{away.days} days without logging</Text>
      <Text style={st.flowBody}>
        Nothing is counted for those days, either way. Log a full day and your
        numbers start again from there; everything before stays as it was.
      </Text>
      <PrimaryButton
        label="Log today"
        onPress={() => router.navigate('/log')}
      />
      <Pressable
        onPress={() => openDay(addDays(todayKey(), -1))}
        hitSlop={8}
        style={st.flowLink}
      >
        <Text style={st.flowLinkText}>Or fill in a day you missed</Text>
      </Pressable>
    </GlassSurface>
  );
}

export function RestartCard({
  restart,
  showing,
  onShow,
}: {
  restart: NonNullable<Continuity['restart']>;
  /** Whether the numbers below already start from the return. */
  showing: boolean;
  onShow: () => void;
}) {
  const { brk, since } = restart;
  return (
    <Card style={st.flowCard}>
      <Text style={st.flowEyebrow}>
        FRESH START · SINCE {dayName(since).toUpperCase()}
      </Text>
      <Text style={st.flowTitle}>Back after {brk.days} days away</Text>
      <Text style={st.flowBody}>
        {formatWeekRange(brk.from, brk.to)} counts as nothing either way.{' '}
        {showing
          ? 'These numbers start from your return; the longer ranges show everything.'
          : 'See your numbers from your return on their own.'}
      </Text>
      {showing ? null : (
        <Pressable onPress={onShow} hitSlop={8} style={st.flowLink}>
          <Text style={st.flowLinkText}>Show since {dayName(since)}</Text>
        </Pressable>
      )}
    </Card>
  );
}

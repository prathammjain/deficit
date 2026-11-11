import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  AwayCard,
  RestartCard,
  shortDay,
} from '@/components/history/continuity';
import { Journey } from '@/components/history/journey';
import { MonthCalendar } from '@/components/history/month-calendar';
import { RangePills, type Range } from '@/components/history/range-pills';
import { st } from '@/components/history/styles';
import { TrainingCalendar } from '@/components/history/training-calendar';
import { Card, Screen, SectionLabel, Title } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { loadCompleteDays, setDayComplete } from '@/lib/fulldays';
import { gatherDailyRecords } from '@/lib/history';
import {
  continuity,
  summarizeHistory,
  type DayRecord,
  type HistoryTargets,
} from '@/lib/history-stats';
import { todayKey } from '@/lib/log-store';
import { loadProfile } from '@/lib/profile-store';
import { computeTargets } from '@/lib/targets';

/** Days always loaded, so a break and the return after it can be seen. */
const LOOKBACK = 45;

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  // null until the user picks: then the fresh start range leads after a break.
  const [picked, setPicked] = useState<Range | null>(null);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [targets, setTargets] = useState<HistoryTargets | null>(null);
  const [complete, setComplete] = useState<Set<string>>(() => new Set());
  const loadDays = Math.max(typeof picked === 'number' ? picked : 30, LOOKBACK);

  const refresh = useCallback(async () => {
    const profile = await loadProfile();
    if (!profile) {
      setTargets(null);
      setRecords([]);
      setLoading(false);
      return;
    }
    const t = computeTargets(profile);
    setTargets({
      targetKcal: t.targetKcal,
      maintenanceKcal: t.maintenanceKcal,
      proteinG: t.proteinG,
    });
    const [recs, marks] = await Promise.all([
      gatherDailyRecords(loadDays),
      loadCompleteDays().catch(() => new Set<string>()),
    ]);
    setRecords(recs);
    setComplete(marks);
    setLoading(false);
  }, [loadDays]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        await refresh();
        if (!alive) return;
      })();
      return () => {
        alive = false;
      };
    }, [refresh]),
  );

  const toggleComplete = useCallback(async (date: string, on: boolean) => {
    setComplete(await setDayComplete(date, on));
  }, []);

  if (loading) {
    return (
      <View style={st.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const today = todayKey();
  const flow = targets
    ? continuity(records, targets.targetKcal, complete, today)
    : null;
  const restart = flow?.restart ?? null;
  const range: Range =
    picked === 'since' && !restart ? 30 : (picked ?? (restart ? 'since' : 30));
  const shown =
    range === 'since' && restart
      ? records.filter((r) => r.date >= restart.since)
      : records.slice(-(range as number));
  const summary = targets ? summarizeHistory(shown, targets, complete) : null;
  const everLogged = records.some((r) => r.logged);

  return (
    <Screen>
      <Title>History</Title>

      {/* Calendars first: any day's food, any day's training */}
      {targets ? (
        <>
          <SectionLabel>Food</SectionLabel>
          <MonthCalendar
            targets={targets}
            complete={complete}
            onToggleComplete={toggleComplete}
          />
        </>
      ) : null}
      <SectionLabel>Training</SectionLabel>
      <TrainingCalendar />

      <SectionLabel>Trends</SectionLabel>
      {flow?.away ? <AwayCard away={flow.away} /> : null}
      {restart ? (
        <RestartCard
          restart={restart}
          showing={range === 'since'}
          onShow={() => setPicked('since')}
        />
      ) : null}

      <RangePills
        value={range}
        onChange={setPicked}
        since={restart ? `Since ${shortDay(restart.since)}` : null}
      />

      {!targets ? (
        <Card style={st.emptyCard}>
          <Text style={st.emptyText}>
            Set up your profile on the Home tab to start tracking your journey.
          </Text>
        </Card>
      ) : !summary || summary.daysLogged === 0 ? (
        <Card style={st.emptyCard}>
          <Text style={st.emptyTitle}>
            {everLogged ? 'Nothing logged in this range' : 'No history yet'}
          </Text>
          <Text style={st.emptyText}>
            {everLogged
              ? 'Pick a longer range to see earlier days, or log today to start this one.'
              : 'Log your meals on the Log tab and your trends and deficit build up here.'}
          </Text>
        </Card>
      ) : (
        <Journey
          records={shown}
          targets={targets}
          summary={summary}
          complete={complete}
        />
      )}
    </Screen>
  );
}

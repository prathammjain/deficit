import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Journey } from '@/components/history/journey';
import { RangePills } from '@/components/history/range-pills';
import { st } from '@/components/history/styles';
import { Card, Eyebrow, Screen, Title } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { gatherDailyRecords } from '@/lib/history';
import {
  summarizeHistory,
  type DayRecord,
  type HistoryTargets,
} from '@/lib/history-stats';
import { loadProfile } from '@/lib/profile-store';
import { computeTargets } from '@/lib/targets';

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [targets, setTargets] = useState<HistoryTargets | null>(null);

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
    setRecords(await gatherDailyRecords(rangeDays));
    setLoading(false);
  }, [rangeDays]);

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

  if (loading) {
    return (
      <View style={st.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const summary = targets ? summarizeHistory(records, targets) : null;

  return (
    <Screen>
      <Eyebrow>Deficit</Eyebrow>
      <Title>Your journey</Title>

      <RangePills value={rangeDays} onChange={setRangeDays} />

      {!targets ? (
        <Card style={st.emptyCard}>
          <Text style={st.emptyText}>
            Set up your profile on the Home tab to start tracking your journey.
          </Text>
        </Card>
      ) : !summary || summary.daysLogged === 0 ? (
        <Card style={st.emptyCard}>
          <Text style={st.emptyTitle}>No history yet</Text>
          <Text style={st.emptyText}>
            Log your meals on the Log tab — your trends, deficit, and a
            day-by-day breakdown will build up here.
          </Text>
        </Card>
      ) : (
        <Journey records={records} targets={targets} summary={summary} />
      )}
    </Screen>
  );
}

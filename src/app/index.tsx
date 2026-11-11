import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdaptiveCard } from '@/components/dashboard/adaptive-card';
import {
  ComebackCard,
  DeficitSummary,
  useWeekShare,
  WeekSummary,
} from '@/components/dashboard/highlights';
import { TrainCard } from '@/components/dashboard/training';
import { MacroTile } from '@/components/dashboard/macro-tile';
import { st } from '@/components/dashboard/styles';
import { WeekCard } from '@/components/dashboard/week-card';
import { WeighInCard } from '@/components/dashboard/weigh-in-card';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { useFollowing } from '@/components/train/follow';
import { Monogram } from '@/components/ui/monogram';
import {
  Card,
  DotMatrix,
  GlassSurface,
  Hairline,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  estimateAdaptiveTdee,
  type AdaptiveTdee,
  type DailyDatum,
} from '@/lib/adaptive-tdee';
import { formatToday } from '@/lib/date';
import { loadCompleteDays } from '@/lib/fulldays';
import { gatherDailyRecords, gatherHistory } from '@/lib/history';
import {
  continuity,
  fullDaysOnly,
  summarizeHistory,
  type DayRecord,
  type HistoryTargets,
} from '@/lib/history-stats';
import { todayKey } from '@/lib/log-store';
import {
  loadProfile,
  saveProfile,
  type StoredProfile,
} from '@/lib/profile-store';
import { useAuth } from '@/lib/supabase/auth';
import { takeProgramLink } from '@/lib/supabase/programs';
import { computeTargets, type ProfileInput } from '@/lib/targets';
import { predictWeeklyLoss } from '@/lib/weekly-prediction';
import { loadWorkouts } from '@/lib/train/store';
import type { Workout } from '@/lib/train/workout';
import { weekReport } from '@/lib/week-report';
import { latestWeight, setWeight } from '@/lib/weight-store';

/** Days read for the top cards: enough to see a break and the return. */
const LOOKBACK = 45;

/**
 * The last three weeks with unfinished days (under half the target, not
 * confirmed) blanked out, so a forgotten dinner never reads as a deficit in
 * the weekly prediction or the adaptive maintenance.
 */
async function honestHistory(targetKcal: number): Promise<DailyDatum[]> {
  const [hist, complete] = await Promise.all([
    gatherHistory(21),
    loadCompleteDays().catch(() => new Set<string>()),
  ]);
  return fullDaysOnly(hist, targetKcal, complete);
}

/** Today isn't over, so its intake so far stays out of the maintenance math. */
const closedDays = (hist: DailyDatum[]) => {
  const today = todayKey();
  return hist.map((d) => (d.date === today ? { ...d, intakeKcal: null } : d));
};

export default function HomeScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [adaptive, setAdaptive] = useState<AdaptiveTdee | null>(null);
  const [history, setHistory] = useState<DailyDatum[]>([]);
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [complete, setComplete] = useState<Set<string>>(() => new Set());
  const { following } = useFollowing();

  // Arrived from a program link that needed signing in first: open it.
  useEffect(() => {
    const code = takeProgramLink();
    if (code) router.navigate({ pathname: '/program', params: { code } });
  }, []);

  const refresh = useCallback(async () => {
    const p = await loadProfile();
    setProfile(p);
    if (p) {
      const [hist, lw, ws, recs, marks] = await Promise.all([
        honestHistory(computeTargets(p).targetKcal),
        latestWeight(),
        loadWorkouts().catch(() => [] as Workout[]),
        gatherDailyRecords(LOOKBACK).catch(() => [] as DayRecord[]),
        loadCompleteDays().catch(() => new Set<string>()),
      ]);
      setAdaptive(estimateAdaptiveTdee(closedDays(hist)));
      setHistory(hist);
      setLastWeight(lw?.kg ?? null);
      setWorkouts(ws);
      setRecords(recs);
      setComplete(marks);
    }
    setLoading(false);
  }, []);

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

  const handleComplete = useCallback(
    async (input: ProfileInput) => {
      await saveProfile(input);
      await refresh();
    },
    [refresh],
  );

  const handleWeighIn = useCallback(
    async (kg: number) => {
      await setWeight(todayKey(), kg);
      if (profile) {
        // Keep the formula fresh: BMR depends on current weight.
        const updated = await saveProfile({ ...profile, weightKg: kg });
        setProfile(updated);
      }
      setLastWeight(kg);
      if (profile) {
        const hist = await honestHistory(
          computeTargets({ ...profile, weightKg: kg }).targetKcal,
        );
        setAdaptive(estimateAdaptiveTdee(closedDays(hist)));
        setHistory(hist);
      }
    },
    [profile],
  );

  // The top cards use the same numbers as History.
  const targets: HistoryTargets | null = profile
    ? (({ targetKcal, maintenanceKcal, proteinG }) => ({
        targetKcal,
        maintenanceKcal,
        proteinG,
      }))(computeTargets(profile))
    : null;
  const report = targets ? weekReport(records, targets, complete) : null;
  const share = useWeekShare(
    report ?? {
      from: todayKey(),
      to: todayKey(),
      daysLogged: 0,
      totalDeficitKcal: 0,
      estFatLossKg: 0,
      avgKcal: null,
      targetKcal: 0,
      proteinDays: 0,
      avgProteinG: null,
      weightChangeKg: null,
    },
  );

  if (loading) {
    return (
      <View style={st.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  // First-run setup. Editing an existing profile lives on the Profile screen.
  if (!profile) {
    return <OnboardingFlow onComplete={handleComplete} />;
  }

  const t = computeTargets(profile);
  const today = todayKey();
  const flow = targets
    ? continuity(records, targets.targetKcal, complete, today)
    : null;
  const since = flow?.restart?.since ?? null;
  const shown = since
    ? records.filter((r) => r.date >= since)
    : records.slice(-30);
  const summary = targets ? summarizeHistory(shown, targets, complete) : null;
  const everLogged = records.some((r) => r.logged);

  return (
    <Screen>
      <View style={st.headerRow}>
        <View>
          <Text style={st.dateLine}>{formatToday()}</Text>
          <Title>Overview</Title>
        </View>
        <Pressable
          onPress={() => router.push('/profile')}
          hitSlop={8}
          accessibilityLabel="Open profile"
        >
          <Monogram letter={session?.user?.email} size={34} />
        </Pressable>
      </View>

      {/* The three hooks: where you stand, this week, the total so far */}
      {flow ? <ComebackCard flow={flow} /> : null}

      {report && everLogged && !flow?.away ? (
        <>
          <SectionLabel
            action={share ? { label: 'Share', onPress: share } : undefined}
          >
            Your week
          </SectionLabel>
          <WeekSummary report={report} />
        </>
      ) : null}

      {summary && everLogged ? (
        <>
          <SectionLabel
            action={{
              label: 'History',
              onPress: () => router.navigate('/history'),
            }}
          >
            Total deficit maintained
          </SectionLabel>
          <DeficitSummary summary={summary} since={since} />
        </>
      ) : null}

      {/* The plan: the one number the day is built around */}
      <SectionLabel>Your plan</SectionLabel>
      <GlassSurface padded>
        <Text style={st.heroLabel}>Your daily target</Text>
        <View style={st.heroNumberRow}>
          <DotMatrix style={st.heroNumber}>
            {t.targetKcal.toLocaleString()}
          </DotMatrix>
          <Text style={st.heroUnit}>kcal</Text>
        </View>
        <Hairline style={st.heroDivider} />
        <View style={st.heroStatsRow}>
          <View style={st.heroStat}>
            <Text style={st.heroStatValue}>
              {t.maintenanceKcal.toLocaleString()}
            </Text>
            <Text style={st.heroStatLabel}>Maintenance</Text>
          </View>
          <View style={st.heroStatDivider} />
          <View style={st.heroStat}>
            <Text style={st.heroStatValue}>
              {t.dailyDeficitKcal.toLocaleString()}
            </Text>
            <Text style={st.heroStatLabel}>Daily deficit</Text>
          </View>
        </View>
      </GlassSurface>

      <SectionLabel>Forecast</SectionLabel>
      <WeekCard
        prediction={predictWeeklyLoss(
          history,
          adaptive?.estimatedTdeeKcal ?? t.maintenanceKcal,
        )}
        goalRateKgWeek={t.appliedRateKgWeek}
      />

      <SectionLabel
        action={{ label: 'Train', onPress: () => router.navigate('/train') }}
      >
        Training
      </SectionLabel>
      <TrainCard workouts={workouts} following={following} today={today} />

      {/* Macros */}
      <SectionLabel>Macros</SectionLabel>
      <Card style={st.macroRow}>
        <MacroTile label="Protein" grams={t.proteinG} />
        <MacroTile label="Carbs" grams={t.carbsG} />
        <MacroTile label="Fat" grams={t.fatG} />
      </Card>

      <SectionLabel>Weigh in</SectionLabel>
      <WeighInCard last={lastWeight} onSave={handleWeighIn} />

      {/* Adaptive TDEE */}
      <SectionLabel>Adaptive target</SectionLabel>
      <AdaptiveCard
        adaptive={adaptive}
        formulaTdee={t.maintenanceKcal}
        dailyDeficit={t.dailyDeficitKcal}
        bmr={t.bmr}
      />

      {/* Meta */}
      <Card style={st.metaCard} padded={false}>
        <MetaRow
          label="Resting burn (BMR)"
          value={`${t.bmr.toLocaleString()} kcal`}
        />
        <Hairline style={st.metaDivider} />
        <MetaRow
          label="Pace"
          value={`${t.appliedRateKgWeek.toFixed(2)} kg a week`}
        />
      </Card>

      {t.safetyNote ? <Text style={st.safety}>{t.safetyNote}</Text> : null}

      <Text style={st.disclaimer}>
        An estimate, not medical advice. Consult a professional for medical
        conditions, pregnancy, or a history of eating disorders.
      </Text>
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.metaRow}>
      <Text style={st.metaLabel}>{label}</Text>
      <Text style={st.metaValue}>{value}</Text>
    </View>
  );
}

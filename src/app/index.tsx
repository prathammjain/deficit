import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdaptiveCard } from '@/components/dashboard/adaptive-card';
import { MacroTile } from '@/components/dashboard/macro-tile';
import { st } from '@/components/dashboard/styles';
import { WeekCard } from '@/components/dashboard/week-card';
import { WeighInCard } from '@/components/dashboard/weigh-in-card';
import { OnboardingFlow } from '@/components/onboarding-flow';
import {
  Card,
  DotMatrix,
  Eyebrow,
  GlassSurface,
  Hairline,
  Screen,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  estimateAdaptiveTdee,
  type AdaptiveTdee,
  type DailyDatum,
} from '@/lib/adaptive-tdee';
import { formatToday } from '@/lib/date';
import { gatherHistory } from '@/lib/history';
import { todayKey } from '@/lib/log-store';
import {
  loadProfile,
  saveProfile,
  type StoredProfile,
} from '@/lib/profile-store';
import { computeTargets, type ProfileInput } from '@/lib/targets';
import { predictWeeklyLoss } from '@/lib/weekly-prediction';
import { latestWeight, setWeight } from '@/lib/weight-store';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [adaptive, setAdaptive] = useState<AdaptiveTdee | null>(null);
  const [history, setHistory] = useState<DailyDatum[]>([]);
  const [lastWeight, setLastWeight] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const p = await loadProfile();
    setProfile(p);
    if (p) {
      const [hist, lw] = await Promise.all([
        gatherHistory(21),
        latestWeight(),
      ]);
      setAdaptive(estimateAdaptiveTdee(hist));
      setHistory(hist);
      setLastWeight(lw?.kg ?? null);
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
      setEditing(false);
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
      const hist = await gatherHistory(21);
      setAdaptive(estimateAdaptiveTdee(hist));
      setHistory(hist);
    },
    [profile],
  );

  if (loading) {
    return (
      <View style={st.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!profile || editing) {
    return (
      <OnboardingFlow
        initial={profile ?? undefined}
        onComplete={handleComplete}
        onCancel={profile ? () => setEditing(false) : undefined}
      />
    );
  }

  const t = computeTargets(profile);

  return (
    <Screen>
      <View style={st.headerRow}>
        <Eyebrow>Deficit</Eyebrow>
        <Pressable onPress={() => setEditing(true)} hitSlop={10}>
          <Text style={st.editLink}>Edit</Text>
        </Pressable>
      </View>
      <Text style={st.dateLine}>{formatToday()}</Text>
      {/* Hero balance card — the focal point, lifted by an accent glow */}
      <GlassSurface padded style={st.heroCard}>
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
            <Text style={[st.heroStatValue, { color: palette.accent }]}>
              −{t.dailyDeficitKcal}
            </Text>
            <Text style={st.heroStatLabel}>Daily deficit</Text>
          </View>
        </View>
      </GlassSurface>

      {/* This week — on pace to lose */}
      <SectionLabel>This week</SectionLabel>
      <WeekCard
        prediction={predictWeeklyLoss(
          history,
          adaptive?.estimatedTdeeKcal ?? t.maintenanceKcal,
        )}
        goalRateKgWeek={t.appliedRateKgWeek}
      />

      {/* Macros */}
      <SectionLabel>Macros</SectionLabel>
      <View style={st.macroRow}>
        <MacroTile label="Protein" grams={t.proteinG} color={palette.protein} />
        <MacroTile label="Carbs" grams={t.carbsG} color={palette.carb} />
        <MacroTile label="Fat" grams={t.fatG} color={palette.fat} />
      </View>

      {/* Weigh-in */}
      <SectionLabel>Today’s weigh-in</SectionLabel>
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
        <MetaRow label="BMR · Mifflin-St Jeor" value={`${t.bmr} kcal`} />
        <Hairline style={st.metaDivider} />
        <MetaRow
          label="Pace"
          value={`${t.appliedRateKgWeek.toFixed(2)} kg / week`}
        />
      </Card>

      {t.safetyNote ? <Text style={st.safety}>⚠︎ {t.safetyNote}</Text> : null}

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

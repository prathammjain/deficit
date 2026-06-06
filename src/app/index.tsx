import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OnboardingFlow } from '@/components/onboarding-flow';
import {
  Card,
  Eyebrow,
  GhostButton,
  Hairline,
  PrimaryButton,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import {
  estimateAdaptiveTdee,
  recommendedTarget,
  type AdaptiveTdee,
} from '@/lib/adaptive-tdee';
import { gatherHistory } from '@/lib/history';
import {
  loadProfile,
  saveProfile,
  type StoredProfile,
} from '@/lib/profile-store';
import {
  ABSOLUTE_KCAL_FLOOR,
  computeTargets,
  type ProfileInput,
} from '@/lib/targets';
import { latestWeight, setWeight } from '@/lib/weight-store';
import { todayKey } from '@/lib/log-store';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [adaptive, setAdaptive] = useState<AdaptiveTdee | null>(null);
  const [lastWeight, setLastWeight] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const p = await loadProfile();
    setProfile(p);
    if (p) {
      const [history, lw] = await Promise.all([
        gatherHistory(21),
        latestWeight(),
      ]);
      setAdaptive(estimateAdaptiveTdee(history));
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
      const history = await gatherHistory(21);
      setAdaptive(estimateAdaptiveTdee(history));
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
      <Title>Your daily target</Title>

      {/* Hero */}
      <View style={st.hero}>
        <Text style={st.heroNumber}>{t.targetKcal.toLocaleString()}</Text>
        <Text style={st.heroUnit}>kcal / day</Text>
      </View>

      {/* Maintenance / deficit */}
      <View style={st.statRow}>
        <StatTile label="Maintenance" value={t.maintenanceKcal.toLocaleString()} />
        <StatTile label="Daily deficit" value={`−${t.dailyDeficitKcal}`} accent />
      </View>

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

/* ---------------- subcomponents ---------------- */

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card style={st.tile}>
      <Text style={[st.tileValue, accent && { color: palette.accent }]}>
        {value}
      </Text>
      <Text style={st.tileLabel}>{label}</Text>
    </Card>
  );
}

function MacroTile({
  label,
  grams,
  color,
}: {
  label: string;
  grams: number;
  color: string;
}) {
  return (
    <Card style={st.tile}>
      <View style={[st.dot, { backgroundColor: color }]} />
      <Text style={st.macroGrams}>{grams}g</Text>
      <Text style={st.tileLabel}>{label}</Text>
    </Card>
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

function WeighInCard({
  last,
  onSave,
}: {
  last: number | null;
  onSave: (kg: number) => void;
}) {
  const [val, setVal] = useState('');
  const num = Number(val);
  const valid = val !== '' && num >= 30 && num <= 300;

  return (
    <Card style={st.weighCard}>
      <View style={st.weighRow}>
        <TextInput
          style={st.weighInput}
          placeholder={last != null ? String(last) : 'kg'}
          placeholderTextColor={palette.textDim}
          keyboardType="decimal-pad"
          inputMode="decimal"
          value={val}
          onChangeText={(t) => setVal(t.replace(/[^0-9.]/g, ''))}
        />
        <Text style={st.weighUnit}>kg</Text>
        <PrimaryButton
          label="Save"
          disabled={!valid}
          style={st.weighBtn}
          onPress={() => {
            if (!valid) return;
            onSave(Math.round(num * 10) / 10);
            setVal('');
          }}
        />
      </View>
      <Text style={st.weighHint}>
        {last != null
          ? `Last logged ${last} kg. Weigh in each morning for the best read.`
          : 'Weigh in each morning — same time, same conditions.'}
      </Text>
    </Card>
  );
}

const CONFIDENCE_COPY: Record<AdaptiveTdee['confidence'], string> = {
  none: '',
  low: 'Early read',
  medium: 'Getting confident',
  high: 'High confidence',
};

function AdaptiveCard({
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
          The formula is a starting estimate. Keep logging meals and weighing in
          — after about a week I’ll back out your true expenditure from the data
          and fine-tune this target.
        </Text>
        <View style={st.adaptiveProgressRow}>
          <Text style={st.adaptiveProgressText}>{days}/7 days logged</Text>
          <Text style={st.adaptiveProgressDot}>·</Text>
          <Text style={st.adaptiveProgressText}>
            {weighIns}/3 weigh-ins
          </Text>
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
        <Text style={st.adaptiveLead}>From your last {adaptive.intakeDays} days</Text>
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
          tone={trend < 0 ? palette.good : trend > 0 ? palette.danger : palette.textMuted}
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

const st = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editLink: { color: palette.accent, fontSize: 14, fontWeight: '600' },

  hero: { alignItems: 'center', marginTop: space.xxl, marginBottom: space.sm },
  heroNumber: { ...typo.hero, color: palette.text },
  heroUnit: {
    color: palette.textFaint,
    fontSize: 15,
    marginTop: space.xs,
    letterSpacing: 0.3,
  },

  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  tile: { flex: 1, alignItems: 'center', paddingVertical: space.lg },
  tileValue: { ...typo.stat, color: palette.text },
  tileLabel: {
    color: palette.textFaint,
    fontSize: 12,
    marginTop: space.sm,
    letterSpacing: 0.2,
  },
  macroRow: { flexDirection: 'row', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: space.sm },
  macroGrams: { ...typo.stat, fontSize: 22, color: palette.text },

  weighCard: {},
  weighRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  weighInput: {
    flex: 1,
    color: palette.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    padding: 0,
  },
  weighUnit: { color: palette.textFaint, fontSize: 16, marginRight: space.sm },
  weighBtn: { paddingHorizontal: space.xl },
  weighHint: {
    color: palette.textFaint,
    fontSize: 13,
    marginTop: space.md,
    lineHeight: 18,
  },

  adaptiveLead: {
    ...typo.heading,
    color: palette.text,
    fontSize: 16,
  },
  adaptiveBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.sm,
  },
  adaptiveProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
  adaptiveProgressText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  adaptiveProgressDot: { color: palette.textDim },
  adaptiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceChip: {
    backgroundColor: palette.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  confidenceText: { color: palette.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  adaptiveBig: { marginTop: space.lg },
  adaptiveTdee: { ...typo.stat, fontSize: 40, color: palette.text },
  adaptiveTdeeUnit: { color: palette.textFaint, fontSize: 13, marginTop: 2 },
  adaptiveStatsRow: { flexDirection: 'row', gap: space.xl, marginTop: space.lg },
  adaptiveStat: {},
  adaptiveStatValue: { fontSize: 17, fontWeight: '600' },
  adaptiveStatLabel: { color: palette.textFaint, fontSize: 12, marginTop: 2 },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.lg,
  },
  suggestLabel: { color: palette.textMuted, fontSize: 14 },
  suggestValue: { color: palette.accent, fontSize: 18, fontWeight: '700' },

  metaCard: { marginTop: space.xl, paddingHorizontal: space.xl },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.lg,
  },
  metaDivider: { marginVertical: 0 },
  metaLabel: { color: palette.textMuted, fontSize: 14 },
  metaValue: { color: palette.text, fontSize: 14, fontWeight: '600' },

  safety: {
    color: palette.warn,
    fontSize: 14,
    marginTop: space.xl,
    lineHeight: 20,
  },
  disclaimer: {
    color: palette.textDim,
    fontSize: 12,
    marginTop: space.xl,
    lineHeight: 18,
  },
});

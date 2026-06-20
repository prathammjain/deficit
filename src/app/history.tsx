import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BarChart, LineChart } from '@/components/charts';
import {
  Card,
  Eyebrow,
  GlassSurface,
  PrimaryButton,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { exportCsv } from '@/lib/export-csv';
import { gatherDailyRecords } from '@/lib/history';
import {
  dayDeficit,
  summarizeHistory,
  toCsv,
  type DayRecord,
  type HistorySummary,
  type HistoryTargets,
} from '@/lib/history-stats';
import { todayKey } from '@/lib/log-store';
import { loadProfile } from '@/lib/profile-store';
import { computeTargets } from '@/lib/targets';

const RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 365 },
];

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [targets, setTargets] = useState<HistoryTargets | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const onExport = useCallback(async () => {
    if (!targets || exporting) return;
    setExporting(true);
    try {
      await exportCsv(`deficit-history-${todayKey()}.csv`, toCsv(records, targets));
    } finally {
      setExporting(false);
    }
  }, [records, targets, exporting]);

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
      <View style={st.headerRow}>
        <Eyebrow>Deficit</Eyebrow>
        {targets && summary && summary.daysLogged > 0 ? (
          <Pressable onPress={onExport} hitSlop={10} disabled={exporting}>
            <Text style={st.exportLink}>
              {exporting ? 'Exporting…' : '↓ Export CSV'}
            </Text>
          </Pressable>
        ) : null}
      </View>
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
            Log your meals on the Log tab — your trends, deficit, and an
            exportable CSV will build up here, day by day.
          </Text>
        </Card>
      ) : (
        <Journey
          records={records}
          targets={targets}
          summary={summary}
          onExport={onExport}
          exporting={exporting}
        />
      )}
    </Screen>
  );
}

function Journey({
  records,
  targets,
  summary,
  onExport,
  exporting,
}: {
  records: DayRecord[];
  targets: HistoryTargets;
  summary: HistorySummary;
  onExport: () => void;
  exporting: boolean;
}) {
  const kcalSeries = records.map((d) => (d.logged ? d.kcal : null));
  const deficitSeries = records.map((d) => (d.logged ? dayDeficit(d, targets) : 0));
  const weightSeries = records.map((d) => d.weightKg);
  const hasWeight = summary.weightStartKg != null;

  return (
    <>
      {/* Hero — the headline of the whole journey */}
      <GlassSurface padded style={st.heroCard}>
        <Text style={st.heroLabel}>Total deficit maintained</Text>
        <View style={st.heroNumberRow}>
          <Text style={st.heroNumber}>
            {summary.totalDeficitKcal.toLocaleString()}
          </Text>
          <Text style={st.heroUnit}>kcal</Text>
        </View>
        <Text style={st.heroSub}>
          ≈ {summary.estFatLossKg.toFixed(1)} kg of fat, if it all held
        </Text>
        <View style={st.heroStatsRow}>
          <HeroStat
            value={`${summary.daysLogged}`}
            label={`of ${summary.daysInRange} days logged`}
          />
          <View style={st.heroStatDivider} />
          <HeroStat
            value={`${summary.currentStreak}🔥`}
            label="day streak"
          />
          <View style={st.heroStatDivider} />
          <HeroStat
            value={
              summary.avgDeficitKcal != null
                ? `${signed(summary.avgDeficitKcal)}`
                : '—'
            }
            label="avg / day"
          />
        </View>
      </GlassSurface>

      {/* Calories vs target */}
      <SectionLabel>Calories eaten</SectionLabel>
      <Card>
        <View style={st.cardHead}>
          <Stat big={`${summary.avgKcal?.toLocaleString() ?? '—'}`} unit="avg kcal" />
          <Legend
            items={[
              { color: palette.accent, label: 'eaten' },
              { color: palette.textFaint, label: `target ${targets.targetKcal.toLocaleString()}`, dashed: true },
            ]}
          />
        </View>
        <LineChart values={kcalSeries} target={targets.targetKcal} color={palette.accent} />
      </Card>

      {/* Deficit maintained — daily signed bars */}
      <SectionLabel>Deficit maintained</SectionLabel>
      <Card>
        <View style={st.cardHead}>
          <Stat
            big={summary.onTargetRate != null ? `${Math.round(summary.onTargetRate * 100)}%` : '—'}
            unit="days on target"
          />
          <Legend
            items={[
              { color: palette.good, label: 'deficit' },
              { color: palette.danger, label: 'surplus' },
            ]}
          />
        </View>
        <BarChart values={deficitSeries} />
      </Card>

      {/* Macros — average split */}
      <SectionLabel>Average macros</SectionLabel>
      <Card>
        <MacroSplit summary={summary} proteinTarget={targets.proteinG} />
      </Card>

      {/* Weight trend */}
      <SectionLabel>Weight trend</SectionLabel>
      <Card>
        {hasWeight ? (
          <>
            <View style={st.cardHead}>
              <Stat
                big={`${summary.weightEndKg?.toFixed(1) ?? '—'}`}
                unit="kg now"
              />
              {summary.weightChangeKg != null ? (
                <Text
                  style={[
                    st.weightDelta,
                    {
                      color:
                        summary.weightChangeKg < 0
                          ? palette.good
                          : summary.weightChangeKg > 0
                            ? palette.danger
                            : palette.textMuted,
                    },
                  ]}
                >
                  {signed(summary.weightChangeKg, 1)} kg
                </Text>
              ) : null}
            </View>
            <LineChart values={weightSeries} color={palette.protein} showDots />
          </>
        ) : (
          <Text style={st.emptyText}>
            Weigh in each morning on the Home tab to see your weight trend here.
          </Text>
        )}
      </Card>

      <PrimaryButton
        label={exporting ? 'Exporting…' : 'Export history as CSV'}
        onPress={onExport}
        disabled={exporting}
        style={st.exportBtn}
      />
      <Text style={st.footnote}>
        Deficit uses your current maintenance ({targets.maintenanceKcal.toLocaleString()} kcal)
        as the reference. Micronutrients aren’t tracked yet.
      </Text>
    </>
  );
}

/* ---------------- subcomponents ---------------- */

function RangePills({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <View style={st.rangeRow}>
      {RANGES.map((r) => {
        const active = r.days === value;
        return (
          <Pressable
            key={r.label}
            onPress={() => onChange(r.days)}
            style={[st.rangePill, active && st.rangePillActive]}
          >
            <Text style={[st.rangeText, active && st.rangeTextActive]}>
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={st.heroStat}>
      <Text style={st.heroStatValue}>{value}</Text>
      <Text style={st.heroStatLabel}>{label}</Text>
    </View>
  );
}

function Stat({ big, unit }: { big: string; unit: string }) {
  return (
    <View>
      <Text style={st.statBig}>{big}</Text>
      <Text style={st.statUnit}>{unit}</Text>
    </View>
  );
}

function Legend({
  items,
}: {
  items: { color: string; label: string; dashed?: boolean }[];
}) {
  return (
    <View style={st.legend}>
      {items.map((it) => (
        <View key={it.label} style={st.legendItem}>
          <View
            style={[
              st.legendDot,
              { backgroundColor: it.dashed ? 'transparent' : it.color },
              it.dashed && { borderWidth: 1, borderColor: it.color },
            ]}
          />
          <Text style={st.legendLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function MacroSplit({
  summary,
  proteinTarget,
}: {
  summary: HistorySummary;
  proteinTarget: number;
}) {
  const p = summary.avgProteinG ?? 0;
  const c = summary.avgCarbsG ?? 0;
  const f = summary.avgFatG ?? 0;
  const pCal = p * 4;
  const cCal = c * 4;
  const fCal = f * 9;
  const tot = pCal + cCal + fCal || 1;

  return (
    <View>
      <View style={st.splitBar}>
        <View style={{ flex: pCal / tot, backgroundColor: palette.protein }} />
        <View style={{ flex: cCal / tot, backgroundColor: palette.carb }} />
        <View style={{ flex: fCal / tot, backgroundColor: palette.fat }} />
      </View>
      <View style={st.macroRow}>
        <MacroCell
          color={palette.protein}
          label="Protein"
          value={`${p}g`}
          sub={`/ ${proteinTarget}g`}
        />
        <MacroCell color={palette.carb} label="Carbs" value={`${c}g`} />
        <MacroCell color={palette.fat} label="Fat" value={`${f}g`} />
      </View>
    </View>
  );
}

function MacroCell({
  color,
  label,
  value,
  sub,
}: {
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={st.macroCell}>
      <View style={st.macroCellHead}>
        <View style={[st.macroDot, { backgroundColor: color }]} />
        <Text style={st.macroLabel}>{label}</Text>
      </View>
      <Text style={st.macroValue}>
        {value}
        {sub ? <Text style={st.macroSub}> {sub}</Text> : null}
      </Text>
    </View>
  );
}

/** Format a signed integer with an explicit + / − and thousands separators. */
function signed(n: number, digits = 0): string {
  const v = digits ? n.toFixed(digits) : Math.round(n).toLocaleString();
  return n > 0 ? `+${v}` : `${v}`;
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
  exportLink: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  rangeRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  rangePill: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    alignItems: 'center',
  },
  rangePillActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentBorder,
  },
  rangeText: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  rangeTextActive: { color: palette.accent },

  emptyCard: { marginTop: space.xl, gap: space.sm },
  emptyTitle: { ...typo.heading, color: palette.text },
  emptyText: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },

  heroCard: {
    marginTop: space.xl,
    shadowColor: palette.accent,
    shadowOpacity: 0.3,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
  },
  heroLabel: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    marginTop: space.sm,
  },
  heroNumber: { ...typo.hero, fontSize: 48, color: palette.text },
  heroUnit: { color: palette.textFaint, fontSize: 16, fontWeight: '600' },
  heroSub: { color: palette.accent, fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xl,
  },
  heroStat: { flex: 1 },
  heroStatValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroStatLabel: { color: palette.textFaint, fontSize: 11, marginTop: 3 },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: palette.hairline,
    marginHorizontal: space.md,
  },

  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  statBig: { ...typo.stat, fontSize: 24, color: palette.text },
  statUnit: { color: palette.textFaint, fontSize: 12, marginTop: 2 },

  legend: { alignItems: 'flex-end', gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: palette.textFaint, fontSize: 11 },

  weightDelta: { fontSize: 16, fontWeight: '700' },

  splitBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: palette.surface2,
  },
  macroRow: { flexDirection: 'row', marginTop: space.lg },
  macroCell: { flex: 1 },
  macroCellHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroDot: { width: 7, height: 7, borderRadius: 4 },
  macroLabel: { color: palette.textFaint, fontSize: 12 },
  macroValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  macroSub: { color: palette.textFaint, fontSize: 12, fontWeight: '500' },

  exportBtn: { marginTop: space.xxl },
  footnote: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 17,
    marginTop: space.xl,
  },
});

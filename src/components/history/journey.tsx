import { Text, View } from 'react-native';

import { BarChart, LineChart } from '@/components/charts';
import {
  Card,
  DotMatrix,
  GlassSurface,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  dayDeficit,
  type DayRecord,
  type HistorySummary,
  type HistoryTargets,
} from '@/lib/history-stats';

import { MonthCalendar } from './month-calendar';
import { st } from './styles';

export function Journey({
  records,
  targets,
  summary,
}: {
  records: DayRecord[];
  targets: HistoryTargets;
  summary: HistorySummary;
}) {
  const kcalSeries = records.map((d) => (d.logged ? d.kcal : null));
  const deficitSeries = records.map((d) =>
    d.logged ? dayDeficit(d, targets) : 0,
  );
  const weightSeries = records.map((d) => d.weightKg);
  const hasWeight = summary.weightStartKg != null;

  return (
    <>
      {/* Hero — the headline of the whole journey */}
      <GlassSurface padded style={st.heroCard}>
        <Text style={st.heroLabel}>Total deficit maintained</Text>
        <View style={st.heroNumberRow}>
          <DotMatrix style={st.heroNumber}>
            {summary.totalDeficitKcal.toLocaleString()}
          </DotMatrix>
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
          <HeroStat value={`${summary.currentStreak}`} label="day streak" />
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
          <Stat
            big={`${summary.avgKcal?.toLocaleString() ?? '—'}`}
            unit="avg kcal"
          />
          <Legend
            items={[
              { color: palette.accent, label: 'eaten' },
              {
                color: palette.textFaint,
                label: `target ${targets.targetKcal.toLocaleString()}`,
                dashed: true,
              },
            ]}
          />
        </View>
        <LineChart
          values={kcalSeries}
          target={targets.targetKcal}
          color={palette.accent}
        />
      </Card>

      {/* Deficit maintained — daily signed bars */}
      <SectionLabel>Deficit maintained</SectionLabel>
      <Card>
        <View style={st.cardHead}>
          <Stat
            big={
              summary.onTargetRate != null
                ? `${Math.round(summary.onTargetRate * 100)}%`
                : '—'
            }
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

      {/* Calendar — pick any day to see its totals, macros, and deficit */}
      <SectionLabel>Calendar</SectionLabel>
      <MonthCalendar targets={targets} />

      <Text style={st.footnote}>
        Deficit uses your current maintenance (
        {targets.maintenanceKcal.toLocaleString()} kcal) as the reference.
        Micronutrients aren’t tracked yet.
      </Text>
    </>
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

import { Text, View } from 'react-native';

import { BarChart, ChartDates, LineChart } from '@/components/charts';
import {
  Card,
  DotMatrix,
  GlassSurface,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  balanceNote,
  dayDeficit,
  dayStatus,
  type DayRecord,
  type HistorySummary,
  type HistoryTargets,
} from '@/lib/history-stats';

import { st } from './styles';

export function Journey({
  records,
  targets,
  summary,
  complete,
}: {
  records: DayRecord[];
  targets: HistoryTargets;
  summary: HistorySummary;
  /** Low days the user confirmed as full. */
  complete: ReadonlySet<string>;
}) {
  // Only full days are drawn: a missing or unfinished day is a gap, not a 0.
  const counted = records.map(
    (d) => dayStatus(d, targets.targetKcal, complete) === 'counted',
  );
  const kcalSeries = records.map((d, i) => (counted[i] ? d.kcal : null));
  const deficitSeries = records.map((d, i) =>
    counted[i] ? dayDeficit(d, targets) : 0,
  );
  const weightSeries = records.map((d) => d.weightKg);
  const hasWeight = summary.weightStartKg != null;
  const surplus = summary.totalDeficitKcal < 0;
  const gain = targets.goal === 'gain';
  const fullDays = `${summary.daysCounted} full ${summary.daysCounted === 1 ? 'day' : 'days'}`;
  const note = balanceNote(
    targets.goal,
    summary.totalDeficitKcal,
    summary.daysOnTarget,
    summary.daysCounted,
  );
  const unfinished = summary.unfinishedDates.length;
  const dates = records.length ? (
    <ChartDates from={records[0].date} to={records[records.length - 1].date} />
  ) : null;

  return (
    <>
      {/* Hero: the headline of the whole journey */}
      <GlassSurface padded style={st.heroCard}>
        <Text style={st.heroLabel}>
          {targets.goal === 'maintain'
            ? 'Energy balance'
            : surplus
              ? 'Total surplus'
              : gain
                ? 'Total deficit'
                : 'Total deficit maintained'}
        </Text>
        <View style={st.heroNumberRow}>
          <DotMatrix style={st.heroNumber}>
            {Math.abs(summary.totalDeficitKcal).toLocaleString()}
          </DotMatrix>
          <Text style={st.heroUnit}>kcal</Text>
        </View>
        <Text style={st.heroSub}>
          {summary.daysCounted === 0
            ? 'No full days in this range yet'
            : targets.goal === 'maintain' && note
              ? note
              : `${note ?? `${surplus ? 'Worth about' : 'About'} ${Math.abs(summary.estFatLossKg).toFixed(1)} kg ${surplus ? 'gained' : 'of fat'}`}, across the ${fullDays} you logged`}
        </Text>
        <View style={st.heroStatsRow}>
          <HeroStat
            value={`${summary.daysCounted} of ${summary.daysInRange}`}
            label="Full days"
          />
          <View style={st.heroStatDivider} />
          <HeroStat value={`${summary.currentStreak}`} label="In a row" />
          <View style={st.heroStatDivider} />
          <HeroStat
            value={
              summary.avgDeficitKcal != null
                ? Math.abs(Math.round(summary.avgDeficitKcal)).toLocaleString()
                : '0'
            }
            label={
              (summary.avgDeficitKcal ?? 0) < 0
                ? 'Daily surplus'
                : 'Daily deficit'
            }
          />
        </View>
        {unfinished ? (
          <Text style={st.heroNote}>
            {unfinished === 1
              ? '1 day is under half your target, so it isn’t counted yet. Finish or confirm it in the calendar above.'
              : `${unfinished} days are under half your target, so they aren’t counted yet. Finish or confirm them in the calendar above.`}
          </Text>
        ) : null}
      </GlassSurface>

      {/* Calories vs target */}
      <SectionLabel>Calories eaten</SectionLabel>
      <Card>
        <View style={st.cardHead}>
          <Stat
            big={`${summary.avgKcal?.toLocaleString() ?? 0}`}
            unit="Average kcal"
          />
          <Legend
            items={[
              { color: palette.accent, label: 'Eaten' },
              {
                color: palette.textDim,
                label: `Target ${targets.targetKcal.toLocaleString()}`,
              },
            ]}
          />
        </View>
        <LineChart
          values={kcalSeries}
          target={targets.targetKcal}
          color={palette.accent}
          scale
        />
        {dates}
      </Card>

      {/* Deficit maintained: daily signed bars */}
      <SectionLabel>
        {gain ? 'Surplus kept' : 'Deficit maintained'}
      </SectionLabel>
      <Card>
        <View style={st.cardHead}>
          <Stat
            big={
              summary.onTargetRate != null
                ? `${Math.round(summary.onTargetRate * 100)}%`
                : '0%'
            }
            unit="Days on target"
          />
          <Legend
            items={[
              { color: gain ? palette.danger : palette.good, label: 'Deficit' },
              { color: gain ? palette.good : palette.danger, label: 'Surplus' },
            ]}
          />
        </View>
        <BarChart
          values={deficitSeries}
          scale
          // When gaining, the surplus is the goal: it gets the calm colour.
          positiveColor={gain ? palette.danger : palette.good}
          negativeColor={gain ? palette.good : palette.danger}
        />
        {dates}
      </Card>

      {/* Macros: average split */}
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
                big={`${summary.weightEndKg?.toFixed(1) ?? 0} kg`}
                unit="Now"
              />
              {summary.weightChangeKg != null ? (
                <Stat
                  big={`${Math.abs(summary.weightChangeKg).toFixed(1)} kg`}
                  unit={
                    summary.weightChangeKg < 0
                      ? 'Down'
                      : summary.weightChangeKg > 0
                        ? 'Up'
                        : 'No change'
                  }
                  align="right"
                  tone={summary.weightChangeKg > 0 ? palette.danger : undefined}
                />
              ) : null}
            </View>
            <LineChart
              values={weightSeries}
              color={palette.protein}
              showDots
              scale
            />
            {dates}
          </>
        ) : (
          <Text style={st.emptyText}>
            Weigh in each morning on the Home tab to see your weight trend here.
          </Text>
        )}
      </Card>

      <Text style={st.footnote}>
        Measured against your maintenance of{' '}
        {targets.maintenanceKcal.toLocaleString()} kcal. Only full days count; a
        day you didn’t log adds nothing, and nothing is guessed.
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

function Stat({
  big,
  unit,
  align,
  tone,
}: {
  big: string;
  unit: string;
  align?: 'right';
  tone?: string;
}) {
  const a = align === 'right' ? st.alignRight : null;
  return (
    <View>
      <Text style={[st.statBig, a, tone ? { color: tone } : null]}>{big}</Text>
      <Text style={[st.statUnit, a]}>{unit}</Text>
    </View>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={st.legend}>
      {items.map((it) => (
        <View key={it.label} style={st.legendItem}>
          <View style={[st.legendDot, { backgroundColor: it.color }]} />
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
          value={`${p} g`}
          sub={`of ${proteinTarget} g`}
        />
        <MacroCell color={palette.carb} label="Carbs" value={`${c} g`} />
        <MacroCell color={palette.fat} label="Fat" value={`${f} g`} />
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
      <Text style={st.macroValue}>{value}</Text>
      {sub ? <Text style={st.macroSub}>{sub}</Text> : null}
    </View>
  );
}

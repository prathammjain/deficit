/**
 * HYROX progress: the trend of your totals (with dips called out, not
 * hidden), your records, and every station's best and latest. All against
 * your own history, in one division.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { Card, Hairline, SectionLabel } from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import { shortDate } from '@/lib/date';
import {
  hyroxRecords,
  partsDone,
  series,
  stationBoard,
  trend,
} from '@/lib/hyrox/progress';
import {
  PARTS,
  raceClock,
  segmentName,
  summarize,
  type Division,
  type Part,
  type Sim,
} from '@/lib/hyrox/race';

import { Chip } from './bits';
import { tr } from './styles';

const partLabel = (p: Part) =>
  PARTS.find((x) => x.id === p)?.label.toLowerCase() ?? 'sim';

/** "0:12 faster", "0:08 slower", "level". */
function change(ms: number): string {
  if (Math.abs(ms) < 1000) return 'level';
  return `${raceClock(Math.abs(ms))} ${ms < 0 ? 'faster' : 'slower'}`;
}

export function HyroxProgress({
  sims,
  division,
}: {
  sims: Sim[];
  division: Division;
}) {
  const parts = partsDone(sims, division);
  const [picked, setPicked] = useState<Part | null>(null);
  if (!parts.length) return null;
  // Open on the part with the most sims, where the trend says the most.
  const most = [...parts].sort(
    (a, b) =>
      series(sims, division, b).length - series(sims, division, a).length,
  )[0];
  const part = picked && parts.includes(picked) ? picked : most;
  const t = trend(sims, division, part);
  const done = series(sims, division, part);
  const rec = hyroxRecords(sims, division);
  const stations = stationBoard(sims, division);

  return (
    <View>
      <SectionLabel>Progress</SectionLabel>
      {parts.length > 1 ? (
        <View style={[tr.chips, ps.chips]}>
          {parts.map((p) => (
            <Chip
              key={p}
              label={PARTS.find((x) => x.id === p)?.label ?? p}
              on={p === part}
              onPress={() => setPicked(p)}
            />
          ))}
        </View>
      ) : null}

      <Card>
        {t ? (
          <>
            <Text style={ps.headline}>
              {t.sinceFirstMs < -999
                ? `${raceClock(-t.sinceFirstMs)} faster`
                : t.sinceFirstMs > 999
                  ? `${raceClock(t.sinceFirstMs)} slower`
                  : 'Level'}
            </Text>
            <Text style={tr.muted}>
              since your first, over {t.count}{' '}
              {part === 'full' ? 'full sims' : `${partLabel(part)} sims`}
            </Text>
            <View style={ps.chart}>
              <LineChart
                values={t.totals.map((ms) => ms / 60000)}
                height={120}
                showDots
              />
            </View>
            <Text style={[tr.faint, ps.under]}>
              Lower is faster. Best {raceClock(t.bestMs)}.
            </Text>
            <Text style={ps.note}>
              {t.sinceLastMs > 999
                ? `Your last sim was ${raceClock(t.sinceLastMs)} slower than the one before. One sim is one day; the trend is what counts.`
                : t.sinceLastMs < -999
                  ? `Your last sim was ${raceClock(-t.sinceLastMs)} faster than the one before.`
                  : 'Your last sim matched the one before.'}
            </Text>
          </>
        ) : (
          <Text style={tr.body}>
            One {partLabel(part)} so far, in{' '}
            {raceClock(summarize(done[0]).totalMs)}. Your next one starts the
            trend.
          </Text>
        )}
      </Card>

      <SectionLabel>Records</SectionLabel>
      <Card>
        {PARTS.filter((p) => rec.totals[p.id]).map((p) => (
          <Row
            key={p.id}
            name={`Best ${p.label.toLowerCase()}`}
            value={raceClock(rec.totals[p.id]!.ms)}
            sub={shortDate(rec.totals[p.id]!.date)}
          />
        ))}
        {rec.fastestRun ? (
          <Row
            name="Fastest 1 km run"
            value={raceClock(rec.fastestRun.ms)}
            sub={shortDate(rec.fastestRun.date)}
          />
        ) : null}
      </Card>

      {stations.length ? (
        <>
          <SectionLabel>Stations</SectionLabel>
          <Card>
            {stations.map((s, i) => (
              <View key={s.key}>
                {i ? <Hairline style={ps.hair} /> : null}
                <View style={ps.row}>
                  <View style={tr.flex1}>
                    <Text style={tr.strong}>{segmentName(s.segment)}</Text>
                    <Text style={tr.muted}>
                      Best {raceClock(s.bestMs)} · {s.times.length}{' '}
                      {s.times.length === 1 ? 'time' : 'times'}
                    </Text>
                  </View>
                  <View style={ps.right}>
                    <Text style={[tr.strong, tr.num]}>
                      {raceClock(s.latestMs)}
                    </Text>
                    {s.changeMs != null ? (
                      <Text
                        style={[
                          ps.change,
                          s.changeMs > 999 ? ps.slower : ps.faster,
                        ]}
                      >
                        {change(s.changeMs)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
            <Text style={[tr.faint, ps.under]}>
              Latest time on the right, against the time before it.
            </Text>
          </Card>
        </>
      ) : null}
    </View>
  );
}

function Row({
  name,
  value,
  sub,
}: {
  name: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={ps.row}>
      <View style={tr.flex1}>
        <Text style={tr.strong}>{name}</Text>
        <Text style={tr.muted}>{sub}</Text>
      </View>
      <Text style={[tr.strong, tr.num]}>{value}</Text>
    </View>
  );
}

const ps = StyleSheet.create({
  chips: { marginBottom: space.sm },
  headline: {
    ...typo.title,
    fontSize: 34,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  chart: { marginTop: space.lg },
  under: { marginTop: space.sm },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  right: { alignItems: 'flex-end' },
  change: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  faster: { color: palette.textMuted },
  slower: { color: palette.accent },
  hair: { marginVertical: space.xs },
});

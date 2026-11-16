/**
 * A finished HYROX sim: the total, runs against stations, how the runs
 * faded, where it lost time against your own bests, and every split.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, Hairline } from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import {
  bests,
  PARTS,
  raceClock,
  segmentName,
  splits,
  summarize,
  whereYouLostTime,
  type Sim,
} from '@/lib/hyrox/race';

import { Stat } from './bits';

export function SimSummary({
  sim,
  earlier,
  showSplits = true,
}: {
  sim: Sim;
  /** Sims before this one, for bests and lost time. */
  earlier: Sim[];
  showSplits?: boolean;
}) {
  const sum = summarize(sim);
  const gaps = whereYouLostTime(sim, earlier);
  const best = bests(earlier, sim.division);
  const part = PARTS.find((p) => p.id === sim.part)?.label ?? 'Sim';

  return (
    <Card style={hs.card}>
      <Text style={hs.eyebrow}>{part.toUpperCase()}</Text>
      <Text style={hs.total}>{raceClock(sum.totalMs)}</Text>

      <View style={hs.stats}>
        <Stat value={raceClock(sum.runMs)} label="Running" />
        <Stat value={raceClock(sum.stationMs)} label="Stations" />
        {sum.runFade != null ? (
          <Stat
            value={`${sum.runFade >= 0 ? '+' : ''}${Math.round(sum.runFade * 100)}%`}
            label="Run fade"
          />
        ) : null}
      </View>

      {sum.runFade != null ? (
        <Text style={hs.note}>
          {sum.runFade > 0.05
            ? `Your later runs were ${Math.round(sum.runFade * 100)}% slower than your early ones. That is running on legs the stations already took.`
            : 'Your runs held their pace from start to finish.'}
        </Text>
      ) : null}

      <Hairline style={hs.divider} />
      <Text style={hs.label}>Where you lost time</Text>
      {gaps.length ? (
        gaps.map((g) => (
          <View key={g.key} style={hs.row}>
            <Text style={hs.rowName}>{segmentName(g.segment)}</Text>
            <Text style={hs.lost}>+{raceClock(g.lostMs)}</Text>
          </View>
        ))
      ) : (
        <Text style={hs.note}>
          {earlier.length
            ? 'Every split matched or beat your best. A clean sim.'
            : 'Your first sim. From the next one, Grain shows where you gain or lose time against your own bests.'}
        </Text>
      )}

      {showSplits ? (
        <>
          <Hairline style={hs.divider} />
          <Text style={hs.label}>Splits</Text>
          {splits(sim).map((s) => {
            const b = best.get(s.key);
            return (
              <View key={s.key} style={hs.row}>
                <Text
                  style={[hs.rowName, s.segment.kind === 'run' && hs.runName]}
                >
                  {segmentName(s.segment)}
                </Text>
                <Text style={hs.rowTime}>
                  {raceClock(s.ms)}
                  {b != null && s.ms < b ? (
                    <Text style={hs.pb}> best</Text>
                  ) : null}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}
    </Card>
  );
}

const hs = StyleSheet.create({
  card: { marginTop: space.lg },
  eyebrow: { ...typo.eyebrow, fontSize: 10.5, color: palette.accent },
  total: {
    ...typo.title,
    fontSize: 40,
    color: palette.text,
    marginTop: space.xs,
    fontVariant: ['tabular-nums'],
  },
  stats: { flexDirection: 'row', marginTop: space.lg, gap: space.md },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.md,
  },
  divider: { marginVertical: space.lg },
  label: { ...typo.label, color: palette.textMuted, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowName: { color: palette.text, fontSize: 15 },
  runName: { color: palette.textMuted },
  rowTime: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lost: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pb: { color: palette.accent, fontSize: 12, fontWeight: '700' },
});

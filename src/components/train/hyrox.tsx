/**
 * The HYROX tab in Train: pick a division, start a full or half sim, see
 * what the last one says, the race with your loads, and every sim so far.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import { shortDate } from '@/lib/date';
import {
  DIVISIONS,
  isFinished,
  PARTS,
  raceClock,
  SEASON,
  segments,
  STATIONS,
  summarize,
  type Division,
  type Part,
  type Sim,
} from '@/lib/hyrox/race';
import {
  loadLive,
  loadSettings,
  loadSims,
  newSim,
  saveDivision,
  saveLive,
} from '@/lib/hyrox/store';

import { Chip } from './bits';
import { SimSummary } from './hyrox-summary';
import { tr } from './styles';

export function HyroxView() {
  const [division, setDivision] = useState<Division | null>(null);
  const [sims, setSims] = useState<Sim[]>([]);
  const [live, setLive] = useState<Sim | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([loadSettings(), loadSims(), loadLive()]).then(
        ([settings, all, running]) => {
          if (!alive) return;
          setDivision(settings.division);
          setSims(all);
          setLive(running && !isFinished(running) ? running : null);
        },
      );
      return () => {
        alive = false;
      };
    }, []),
  );

  const pick = async (d: Division) => {
    setDivision(d);
    setNudge(false);
    await saveDivision(d);
  };

  const start = async (part: Part) => {
    if (!division) {
      setNudge(true);
      return;
    }
    await saveLive(newSim(division, part));
    router.navigate('/hyrox');
  };

  const shown = division ?? 'open_men';
  const latest = sims[0];

  return (
    <View>
      {!sims.length ? (
        <Text style={[tr.body, hx.intro]}>
          HYROX is eight 1 km runs, each followed by a station, in the same
          order at every race. Log a sim and Grain shows where your race time
          goes.
        </Text>
      ) : null}

      <SectionLabel>Your division</SectionLabel>
      <View style={tr.chips}>
        {DIVISIONS.map((d) => (
          <Chip
            key={d.id}
            label={d.label}
            on={division === d.id}
            onPress={() => void pick(d.id)}
          />
        ))}
      </View>
      {nudge ? (
        <Text style={[tr.muted, hx.nudge]}>
          Pick your division first, so the loads are right.
        </Text>
      ) : null}

      {live ? (
        <Card style={hx.card}>
          <Text style={tr.eyebrowAccent}>SIM RUNNING</Text>
          <Text style={hx.title}>
            {live.laps.length} of {segments(live.part).length} done
          </Text>
          <PrimaryButton
            label="Back to the sim"
            onPress={() => router.navigate('/hyrox')}
            style={hx.button}
          />
        </Card>
      ) : (
        <>
          <SectionLabel>Start a sim</SectionLabel>
          {PARTS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => void start(p.id)}
              style={({ pressed }) => pressed && tr.pressed}
            >
              <Card style={hx.option}>
                <View style={tr.flex1}>
                  <Text style={tr.strong}>{p.label}</Text>
                  <Text style={tr.muted}>{p.detail}</Text>
                </View>
                <Text style={[tr.linkText, tr.accentText]}>Start</Text>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      {latest ? (
        <>
          <SectionLabel>Last sim, {shortDate(latest.date)}</SectionLabel>
          <SimSummary sim={latest} earlier={sims.slice(1)} showSplits={false} />
        </>
      ) : null}

      <SectionLabel>
        The race, {DIVISIONS.find((d) => d.id === shown)?.label.toLowerCase()}
      </SectionLabel>
      <Card style={hx.card}>
        {STATIONS.map((s, i) => (
          <View key={s.id} style={hx.station}>
            <Text style={hx.n}>{i + 1}</Text>
            <View style={tr.flex1}>
              <Text style={tr.strong}>{s.name}</Text>
              <Text style={tr.muted}>After a 1 km run · {s.work[shown]}</Text>
            </View>
          </View>
        ))}
        <Text style={[tr.faint, hx.season]}>
          Season {SEASON} loads. Sled loads include the sled.
        </Text>
      </Card>

      {sims.length ? (
        <>
          <SectionLabel>All sims</SectionLabel>
          {sims.map((s, i) => (
            <View key={s.id}>
              <Pressable
                onPress={() => setOpen(open === s.id ? null : s.id)}
                style={({ pressed }) => pressed && tr.pressed}
              >
                <Card style={hx.option}>
                  <View style={tr.flex1}>
                    <Text style={tr.strong}>
                      {PARTS.find((p) => p.id === s.part)?.label}
                    </Text>
                    <Text style={tr.muted}>
                      {shortDate(s.date)} ·{' '}
                      {DIVISIONS.find((d) => d.id === s.division)?.label}
                    </Text>
                  </View>
                  <Text style={[tr.strong, tr.num]}>
                    {raceClock(summarize(s).totalMs)}
                  </Text>
                </Card>
              </Pressable>
              {open === s.id ? (
                <SimSummary sim={s} earlier={sims.slice(i + 1)} />
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const hx = StyleSheet.create({
  intro: { color: palette.textMuted, marginTop: space.lg },
  nudge: { marginTop: space.sm, color: palette.accent },
  card: { marginTop: space.sm },
  title: { ...typo.heading, color: palette.text, marginTop: space.sm },
  button: { marginTop: space.lg },
  option: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  station: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  n: {
    width: 22,
    color: palette.textFaint,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  season: { marginTop: space.md },
});

/**
 * The HYROX sim in progress: the segment you are on, its clock, the race
 * clock, and one big button to move to the next segment. Every lap is saved
 * at once, and the clocks are timestamps, so a locked phone or a reload
 * loses nothing. Finishing shows the summary.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SimSummary } from '@/components/train/hyrox-summary';
import { tr } from '@/components/train/styles';
import { DotMatrix, PrimaryButton } from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import {
  isFinished,
  raceClock,
  segmentName,
  segments,
  segmentWork,
  splits,
  type Sim,
} from '@/lib/hyrox/race';
import {
  clearLive,
  loadLive,
  loadSims,
  saveLive,
  saveSim,
} from '@/lib/hyrox/store';

/** Taps closer together than this are a double tap, not two laps. */
const MIN_LAP_MS = 1500;

export default function HyroxSimRoute() {
  const [sim, setSim] = useState<Sim | null | undefined>(undefined);
  const [done, setDone] = useState<{ sim: Sim; earlier: Sim[] } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadLive().then((s) => {
        if (alive) setSim(s);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const running = !!sim && !done;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const backToTrain = () =>
    router.navigate({
      pathname: '/train',
      params: { tab: 'hyrox', at: String(Date.now()) },
    });

  if (sim === undefined) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (done) {
    return (
      <Shell>
        <ScrollView contentContainerStyle={tr.content}>
          <Text style={st.eyebrow}>SIM FINISHED</Text>
          <SimSummary sim={done.sim} earlier={done.earlier} />
          <PrimaryButton
            label="Back to Train"
            onPress={backToTrain}
            style={{ marginTop: space.xl }}
          />
        </ScrollView>
      </Shell>
    );
  }

  if (!sim) {
    return (
      <Shell>
        <View style={st.empty}>
          <Text style={tr.muted}>No sim running.</Text>
          <PrimaryButton
            label="Back to Train"
            onPress={backToTrain}
            style={{ marginTop: space.lg }}
          />
        </View>
      </Shell>
    );
  }

  const segs = segments(sim.part);
  const i = sim.laps.length;
  const seg = segs[i];
  const next = segs[i + 1];
  const lastLap = i === 0 ? sim.startedAt : sim.laps[i - 1];
  const last = i === segs.length - 1;
  const runs = segs.filter((s) => s.kind === 'run');
  const position =
    seg.kind === 'run'
      ? `RUN ${runs.indexOf(seg) + 1} OF ${runs.length}`
      : `STATION ${seg.n} OF 8`;

  const lap = async () => {
    const t = Date.now();
    if (t - lastLap < MIN_LAP_MS) return;
    const updated = { ...sim, laps: [...sim.laps, t] };
    if (isFinished(updated)) {
      const earlier = (await loadSims()).filter((s) => s.id !== updated.id);
      await saveSim(updated);
      await clearLive();
      setDone({ sim: updated, earlier });
      setSim(updated);
      return;
    }
    setSim(updated);
    await saveLive(updated);
  };

  const undo = async () => {
    if (!sim.laps.length) return;
    const updated = { ...sim, laps: sim.laps.slice(0, -1) };
    setSim(updated);
    await saveLive(updated);
  };

  const discard = async () => {
    await clearLive();
    backToTrain();
  };

  return (
    <Shell>
      <View style={tr.topBar}>
        <Pressable
          onPress={() => setConfirmEnd(true)}
          hitSlop={8}
          style={st.side}
        >
          <Text style={tr.linkText}>End</Text>
        </Pressable>
        <View style={tr.clockWrap}>
          <DotMatrix style={tr.clock}>
            {raceClock(now - sim.startedAt)}
          </DotMatrix>
          <Text style={tr.clockLabel}>RACE CLOCK</Text>
        </View>
        <Pressable
          onPress={undo}
          disabled={!sim.laps.length}
          hitSlop={8}
          style={[st.side, st.right, !sim.laps.length && tr.disabled]}
        >
          <Text style={tr.linkText}>Undo</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={tr.content}>
        {confirmEnd ? (
          <View style={st.confirm}>
            <Text style={tr.body}>End this sim? It won’t be saved.</Text>
            <View style={st.confirmRow}>
              <Pressable onPress={discard} hitSlop={8}>
                <Text style={[tr.linkText, tr.accentText]}>Discard sim</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmEnd(false)} hitSlop={8}>
                <Text style={tr.linkText}>Keep going</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={st.eyebrow}>{position}</Text>
        <Text style={st.name}>{segmentName(seg)}</Text>
        <Text style={st.work}>{segmentWork(seg, sim.division)}</Text>
        <DotMatrix style={st.segClock}>{raceClock(now - lastLap)}</DotMatrix>

        <PrimaryButton
          label={last ? 'Finish' : `Done: ${segmentName(seg)}`}
          onPress={() => void lap()}
          style={st.lap}
        />
        {next ? (
          <Text style={st.next}>
            Next: {segmentName(next)}, {segmentWork(next, sim.division)}
          </Text>
        ) : null}

        {sim.laps.length ? (
          <View style={st.splits}>
            {splits(sim)
              .reverse()
              .map((s) => (
                <View key={s.key} style={st.splitRow}>
                  <Text style={tr.muted}>{segmentName(s.segment)}</Text>
                  <Text style={[tr.strong, tr.num]}>{raceClock(s.ms)}</Text>
                </View>
              ))}
          </View>
        ) : null}
      </ScrollView>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaView style={tr.flex1}>{children}</SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  side: { minWidth: 72 },
  right: { alignItems: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    ...typo.eyebrow,
    color: palette.accent,
    marginTop: space.xl,
  },
  name: { ...typo.title, color: palette.text, marginTop: space.sm },
  work: { color: palette.textMuted, fontSize: 16, marginTop: space.xs },
  segClock: {
    ...typo.hero,
    fontSize: 88,
    color: palette.text,
    marginTop: space.xl,
  },
  lap: { marginTop: space.xl, paddingVertical: 26 },
  next: {
    color: palette.textFaint,
    fontSize: 14,
    textAlign: 'center',
    marginTop: space.md,
  },
  splits: { marginTop: space.xxl, gap: space.sm },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
  confirm: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: space.lg,
    marginTop: space.md,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: space.xl,
    marginTop: space.md,
  },
});

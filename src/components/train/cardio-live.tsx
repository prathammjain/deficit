/**
 * cardio-live.tsx: time a session as it happens. Start, lap, pause, finish.
 * The clock is timestamps in storage, so locking the phone or reloading
 * the app keeps it running; finishing opens the form to check and save.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, DotMatrix, PrimaryButton } from '@/components/ui/primitives';
import { palette, radius, space } from '@/constants/palette';
import {
  clock,
  KINDS,
  kindOf,
  lapLive,
  movingMs,
  pauseLive,
  resumeLive,
  startLive,
  type CardioKind,
  type CardioLive,
} from '@/lib/cardio/cardio';
import { clearLive, saveLive } from '@/lib/cardio/store';

import { Chip } from './bits';
import { tr } from './styles';

/** Lap distances offered per kind, in km. */
function lapChoices(kind: CardioKind): { km: number; label: string }[] {
  if (kind === 'run' || kind === 'walk')
    return [
      { km: 0.4, label: '400 m' },
      { km: 1, label: '1 km' },
    ];
  if (kind === 'row' || kind === 'ski')
    return [
      { km: 0.5, label: '500 m' },
      { km: 1, label: '1,000 m' },
    ];
  if (kind === 'swim')
    return [
      { km: 0.025, label: '25 m' },
      { km: 0.05, label: '50 m' },
    ];
  if (kind === 'ride') return [{ km: 5, label: '5 km' }];
  return [];
}

export function LiveCard({
  live,
  defaultKind,
  onLive,
  onFinish,
}: {
  live: CardioLive | null;
  defaultKind: CardioKind;
  onLive: (l: CardioLive | null) => void;
  onFinish: (l: CardioLive) => void;
}) {
  const [kind, setKind] = useState<CardioKind>(defaultKind);
  const [now, setNow] = useState(() => Date.now());
  const running = !!live && live.pausedAt == null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const put = (l: CardioLive | null) => {
    onLive(l);
    void (l ? saveLive(l) : clearLive()).catch(() => undefined);
  };

  if (!live) {
    return (
      <Card style={ls.card}>
        <Text style={tr.strong}>Time it live</Text>
        <Text style={[tr.muted, ls.gap]}>
          Start a clock now, press Lap as you go, and save when you finish.
        </Text>
        <View style={[tr.chips, ls.gap]}>
          {KINDS.filter((k) => k.id !== 'other').map((k) => (
            <Chip
              key={k.id}
              label={k.label}
              on={k.id === kind}
              onPress={() => setKind(k.id)}
            />
          ))}
        </View>
        <PrimaryButton
          label={`Start ${kindOf(kind).label.toLowerCase()}`}
          onPress={() => {
            const t = Date.now();
            setNow(t);
            put(startLive(kind, t));
          }}
          style={ls.gapBig}
        />
      </Card>
    );
  }

  const ms = movingMs(live, now);
  const last = live.laps[live.laps.length - 1] ?? 0;
  const prevLap =
    live.laps.length > 0
      ? live.laps[live.laps.length - 1] - (live.laps[live.laps.length - 2] ?? 0)
      : null;
  const choices = lapChoices(live.kind);

  return (
    <Card style={ls.card}>
      <View style={ls.head}>
        <Text style={tr.eyebrowAccent}>
          {live.pausedAt != null ? 'PAUSED' : 'TIMING'} ·{' '}
          {kindOf(live.kind).label.toUpperCase()}
        </Text>
        <Pressable
          onPress={() => put(null)}
          hitSlop={8}
          accessibilityLabel="Discard this session"
        >
          <Text style={tr.faint}>Discard</Text>
        </Pressable>
      </View>
      <DotMatrix style={ls.clock}>{clock(ms)}</DotMatrix>
      <Text style={tr.muted}>
        Lap {live.laps.length + 1}: {clock(ms - last)}
        {prevLap != null ? ` · last lap ${clock(prevLap)}` : ''}
      </Text>

      {choices.length ? (
        <View style={[tr.chips, ls.gap]}>
          <Text style={[tr.faint, ls.lapLabel]}>Each lap is</Text>
          {choices.map((c) => (
            <Chip
              key={c.km}
              label={c.label}
              on={live.lapKm === c.km}
              onPress={() =>
                put({ ...live, lapKm: live.lapKm === c.km ? null : c.km })
              }
            />
          ))}
        </View>
      ) : null}

      <View style={ls.buttons}>
        <Pressable
          onPress={() => put(lapLive(live, Date.now()))}
          disabled={live.pausedAt != null}
          style={({ pressed }) => [
            ls.btn,
            live.pausedAt != null && tr.disabled,
            pressed && tr.pressed,
          ]}
        >
          <Text style={ls.btnText}>Lap</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const t = Date.now();
            setNow(t);
            put(
              live.pausedAt != null ? resumeLive(live, t) : pauseLive(live, t),
            );
          }}
          style={({ pressed }) => [ls.btn, pressed && tr.pressed]}
        >
          <Text style={ls.btnText}>
            {live.pausedAt != null ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const paused = pauseLive(live, Date.now());
            put(paused);
            onFinish(paused);
          }}
          style={({ pressed }) => [ls.btn, ls.finish, pressed && tr.pressed]}
        >
          <Text style={[ls.btnText, ls.finishText]}>Finish</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const ls = StyleSheet.create({
  card: { marginTop: space.md },
  gap: { marginTop: space.sm },
  gapBig: { marginTop: space.md },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clock: { fontSize: 56, color: palette.text, marginVertical: space.sm },
  lapLabel: { alignSelf: 'center' },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: palette.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700', color: palette.text },
  finish: { backgroundColor: palette.accent },
  finishText: { color: '#fff' },
});

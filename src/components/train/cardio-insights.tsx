/**
 * cardio-insights.tsx: heart rate zones for the week, and race predictions
 * from recent runs. Both say plainly what they are built on.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ProgressBar, SectionLabel } from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import {
  clock,
  distanceText,
  markName,
  maxHr,
  predictRaces,
  ZONES,
  zoneFrom,
  zoneMinutes,
  type CardioSession,
} from '@/lib/cardio/cardio';
import { saveMaxHr } from '@/lib/cardio/store';
import { shortDate } from '@/lib/date';
import type { Period } from '@/lib/train/progress';

import { NumField } from './bits';
import { tr } from './styles';

export function ZonesCard({
  cardio,
  week,
  age,
  measured,
  onMeasured,
}: {
  cardio: CardioSession[];
  week: Period;
  age: number | null;
  measured: number | null;
  onMeasured: (v: number | null) => void;
}) {
  const max = maxHr(age, measured);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState<number | null>(measured);
  if (!max) return null;
  const z = zoneMinutes(cardio, week, max);
  const top = Math.max(1, ...z.zones);
  const any = z.zones.some((m) => m > 0);

  return (
    <>
      <SectionLabel>Heart rate zones this week</SectionLabel>
      <Card>
        {ZONES.map((zone, i) => (
          <View key={zone.n} style={zs.row}>
            <Text style={zs.name}>
              {zone.n} · {zone.label}
            </Text>
            <Text style={zs.bpm}>{zoneFrom(zone.n, max)}+</Text>
            <View style={zs.bar}>
              <ProgressBar
                fraction={z.zones[i] / top}
                fillColor={zone.n >= 4 ? palette.accent : palette.text}
              />
            </View>
            <Text style={zs.min}>{z.zones[i]} min</Text>
          </View>
        ))}
        <Text style={[tr.faint, zs.under]}>
          {any
            ? 'From each lap’s heart rate where you logged it, otherwise the session average, so it’s a rough split.'
            : 'Add an average heart rate to a session to see it here.'}
          {z.untracked ? ` ${z.untracked} min had no heart rate.` : ''}
        </Text>
        <Text style={[tr.faint, zs.under]}>
          Zones follow the ACSM intensity bands. Max heart rate {max}
          {measured
            ? ', as you set it.'
            : age
              ? `, estimated from age ${age} (give or take 10).`
              : '.'}
        </Text>
        {editing ? (
          <View style={zs.editRow}>
            <NumField
              value={typed}
              placeholder="Your max"
              label="Your measured max heart rate"
              style={[tr.input, zs.input]}
              onChange={setTyped}
            />
            <Pressable
              onPress={() => {
                const v = typed && typed >= 120 && typed <= 230 ? typed : null;
                void saveMaxHr(v).catch(() => undefined);
                onMeasured(v);
                setEditing(false);
              }}
              hitSlop={8}
            >
              <Text style={[tr.linkText, tr.accentText]}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setEditing(true)}
            hitSlop={8}
            style={zs.link}
          >
            <Text style={[tr.linkText, tr.accentText]}>
              {measured ? 'Change your max' : 'Know your real max? Set it'}
            </Text>
          </Pressable>
        )}
      </Card>
    </>
  );
}

export function PredictCard({
  cardio,
  today,
}: {
  cardio: CardioSession[];
  today: string;
}) {
  const p = predictRaces(cardio, today);
  if (!p) return null;
  return (
    <>
      <SectionLabel>Race predictions</SectionLabel>
      <Card>
        {p.times.map((t) => (
          <View key={t.km} style={zs.predRow}>
            <Text style={tr.strong}>{markName(t.km, 'run')}</Text>
            <Text style={[tr.strong, tr.num]}>{clock(t.ms)}</Text>
          </View>
        ))}
        <Text style={[tr.faint, zs.under]}>
          From your {distanceText(p.from.km, 'run')} in {clock(p.from.ms)} on{' '}
          {shortDate(p.from.date)}, your strongest run in the last 12 weeks,
          using Riegel’s formula. A rough guide: it assumes you’ve trained for
          the longer distance, and most people run longer races slower than it
          says.
        </Text>
      </Card>
    </>
  );
}

const zs = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 5,
  },
  name: { width: 108, fontSize: 13, color: palette.text, fontWeight: '600' },
  bpm: { width: 36, fontSize: 12, color: palette.textFaint },
  bar: { flex: 1 },
  min: {
    width: 56,
    textAlign: 'right',
    fontSize: 13,
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  under: { marginTop: space.sm },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  input: { flex: 1, flexBasis: 0, minWidth: 0 },
  link: { alignSelf: 'flex-start', marginTop: space.md },
  predRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
});

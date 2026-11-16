/**
 * The HYROX tab in Train: count down to your race, pick a division (singles
 * or doubles), start a full or half sim, see what the last one says, the
 * race with your loads, and every sim so far.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card, PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { shortDate } from '@/lib/date';
import { countdown } from '@/lib/hyrox/countdown';
import {
  division as divisionOf,
  DIVISIONS,
  isFinished,
  PARTS,
  raceClock,
  SEASON,
  segments,
  segmentWork,
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
  saveRace,
  type HyroxSettings,
} from '@/lib/hyrox/store';
import { todayKey } from '@/lib/log-store';

import { Chip } from './bits';
import { HyroxProgress } from './hyrox-progress';
import { SimSummary } from './hyrox-summary';
import { tr } from './styles';

export function HyroxView() {
  const [division, setDivision] = useState<Division | null>(null);
  const [sims, setSims] = useState<Sim[]>([]);
  const [live, setLive] = useState<Sim | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [race, setRace] = useState<HyroxSettings['race']>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([loadSettings(), loadSims(), loadLive()]).then(
        ([settings, all, running]) => {
          if (!alive) return;
          setDivision(settings.division);
          setRace(settings.race ?? null);
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
  const formats = [
    { id: 'singles', label: 'Singles' },
    { id: 'doubles', label: 'Doubles' },
  ] as const;

  return (
    <View>
      <SectionLabel>Your race</SectionLabel>
      <RaceCard
        race={race}
        onSave={async (next) => {
          setRace(next);
          await saveRace(next);
        }}
      />

      {!sims.length ? (
        <Text style={[tr.body, hx.intro]}>
          HYROX is eight 1 km runs, each followed by a station, in the same
          order at every race. Log a sim and Grain shows where your race time
          goes.
        </Text>
      ) : null}

      <SectionLabel>Your division</SectionLabel>
      {formats.map((f) => (
        <View key={f.id} style={hx.format}>
          <Text style={[tr.label, hx.formatLabel]}>{f.label}</Text>
          <View style={tr.chips}>
            {DIVISIONS.filter((d) => d.format === f.id).map((d) => (
              <Chip
                key={d.id}
                label={d.label}
                on={division === d.id}
                onPress={() => void pick(d.id)}
              />
            ))}
          </View>
        </View>
      ))}
      {divisionOf(shown).format === 'doubles' && division ? (
        <Text style={[tr.muted, hx.nudge]}>
          You both run every kilometre and split each station’s work however you
          like. Log the sim on one phone.
        </Text>
      ) : null}
      {nudge ? (
        <Text style={[tr.muted, hx.nudge, hx.accent]}>
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

      <HyroxProgress sims={sims} division={shown} />

      <SectionLabel>
        The race, {divisionOf(shown).name.toLowerCase()}
      </SectionLabel>
      <Card style={hx.card}>
        {STATIONS.map((s, i) => (
          <View key={s.id} style={hx.station}>
            <Text style={hx.n}>{i + 1}</Text>
            <View style={tr.flex1}>
              <Text style={tr.strong}>{s.name}</Text>
              <Text style={tr.muted}>
                After a 1 km run ·{' '}
                {segmentWork({ kind: 'station', n: i + 1, id: s.id }, shown)}
              </Text>
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
                      {shortDate(s.date)} · {divisionOf(s.division).name}
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

/** The race countdown, or the form to set one. */
function RaceCard({
  race,
  onSave,
}: {
  race: HyroxSettings['race'];
  onSave: (race: NonNullable<HyroxSettings['race']> | null) => Promise<void>;
}) {
  const today = todayKey();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(race?.date ?? '');
  const [name, setName] = useState(race?.name ?? '');

  if (race && !editing) {
    const c = countdown(race.date, today);
    return (
      <Card style={hx.card}>
        <Text style={tr.eyebrowAccent}>
          {(race.name || 'Race day').toUpperCase()} · {shortDate(race.date)}
        </Text>
        <Text style={hx.countdown}>{c.headline}</Text>
        {c.detail ? <Text style={tr.muted}>{c.detail}</Text> : null}
        <View style={hx.actions}>
          <Pressable
            onPress={() => {
              setDate(c.days < 0 ? '' : race.date);
              setName(c.days < 0 ? '' : (race.name ?? ''));
              setEditing(true);
            }}
            hitSlop={8}
          >
            <Text style={[tr.linkText, tr.accentText]}>
              {c.days < 0 ? 'Set next race' : 'Change'}
            </Text>
          </Pressable>
          <Pressable onPress={() => void onSave(null)} hitSlop={8}>
            <Text style={tr.linkText}>Remove</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
  return (
    <Card style={hx.card}>
      <Text style={tr.muted}>
        Got a race booked? Add it and Grain counts down to race day.
      </Text>
      <DateField value={date} min={today} onChange={setDate} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Race name, optional (HYROX Mumbai)"
        placeholderTextColor={palette.textFaint}
        style={[tr.input, hx.field]}
      />
      <View style={hx.actions}>
        <PrimaryButton
          label="Save race"
          disabled={!valid}
          onPress={() => {
            void onSave({
              date,
              ...(name.trim() ? { name: name.trim() } : {}),
            });
            setEditing(false);
          }}
          style={tr.flex1}
        />
        {editing ? (
          <Pressable onPress={() => setEditing(false)} hitSlop={8}>
            <Text style={tr.linkText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

/** The browser's own date picker on the web; a typed date elsewhere. */
function DateField({
  value,
  min,
  onChange,
}: {
  value: string;
  min: string;
  onChange: (day: string) => void;
}) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value}
        min={min}
        aria-label="Race date"
        onChange={(e) => onChange(e.target.value)}
        style={{
          marginTop: space.md,
          padding: space.md,
          borderRadius: radius.sm,
          border: 'none',
          background: palette.surface2,
          color: palette.text,
          fontSize: 15,
          fontFamily: 'inherit',
        }}
      />
    );
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Race date, YYYY-MM-DD"
      placeholderTextColor={palette.textFaint}
      style={[tr.input, hx.field]}
    />
  );
}

const hx = StyleSheet.create({
  intro: { color: palette.textMuted, marginTop: space.lg },
  nudge: { marginTop: space.sm },
  accent: { color: palette.accent },
  format: { marginTop: space.sm },
  formatLabel: { marginBottom: space.sm },
  countdown: {
    ...typo.title,
    fontSize: 40,
    color: palette.text,
    marginTop: space.xs,
  },
  field: { marginTop: space.md },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    marginTop: space.lg,
  },
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

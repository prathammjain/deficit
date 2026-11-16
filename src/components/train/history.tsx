/**
 * history.tsx: all training, newest first, grouped by week: workouts, HYROX
 * sims and cardio in one timeline.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, SectionLabel } from '@/components/ui/primitives';
import {
  clock,
  distanceText,
  kindOf,
  recordSessions,
  sessionPace,
  type CardioSession,
} from '@/lib/cardio/cardio';
import { recordSims } from '@/lib/hyrox/progress';
import {
  division,
  PARTS,
  raceClock,
  summarize,
  type Sim,
} from '@/lib/hyrox/race';
import { periodLabel, periodOf } from '@/lib/train/progress';
import { durationText, workoutStats, type Workout } from '@/lib/train/workout';

import type { Training } from './data';
import { tr } from './styles';
import { volumeText } from '@/lib/train/units';

const PAGE = 20;

type Item =
  | { kind: 'workout'; w: Workout; at: number; date: string }
  | { kind: 'sim'; s: Sim; at: number; date: string }
  | { kind: 'cardio'; c: CardioSession; at: number; date: string };

function dayText(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function WorkoutHistory({
  data,
  today,
  records,
}: {
  data: Training;
  today: string;
  /** Records set per workout id. */
  records: Map<string, number>;
}) {
  const [shown, setShown] = useState(PAGE);
  const newest: Item[] = [
    ...data.workouts.map((w) => ({
      kind: 'workout' as const,
      w,
      at: Date.parse(w.startedAt),
      date: w.date,
    })),
    ...data.sims.map((s) => ({
      kind: 'sim' as const,
      s,
      at: s.startedAt,
      date: s.date,
    })),
    ...data.cardio.map((c) => ({
      kind: 'cardio' as const,
      c,
      at: c.startedAt,
      date: c.date,
    })),
  ].sort((a, b) => b.at - a.at);
  const simRecords = recordSims(data.sims);
  const cardioRecords = recordSessions(data.cardio);
  const groups: { label: string; items: Item[] }[] = [];
  for (const item of newest.slice(0, shown)) {
    const label = periodLabel(periodOf('week', item.date), today);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(item);
    else groups.push({ label, items: [item] });
  }

  if (!newest.length) {
    return (
      <>
        <SectionLabel>History</SectionLabel>
        <Card>
          <Text style={tr.emptyText}>
            Finished workouts land here. Each one keeps every set, so next time
            the logger already knows your numbers.
          </Text>
          <Pressable
            onPress={() => router.navigate('/import')}
            style={{ marginTop: 12 }}
          >
            <Text style={[tr.linkText, tr.accentText]}>
              Import your history from Strong, Hevy or a spreadsheet
            </Text>
          </Pressable>
        </Card>
      </>
    );
  }

  return (
    <View>
      {groups.map((g) => (
        <View key={g.label}>
          <SectionLabel>{g.label}</SectionLabel>
          <Card padded={false}>
            {g.items.map((item, i) => {
              if (item.kind === 'cardio') {
                return (
                  <CardioRow
                    key={item.c.id}
                    session={item.c}
                    first={i === 0}
                    record={cardioRecords.has(item.c.id)}
                  />
                );
              }
              if (item.kind === 'sim') {
                return (
                  <SimRow
                    key={item.s.id}
                    sim={item.s}
                    first={i === 0}
                    record={simRecords.has(item.s.id)}
                  />
                );
              }
              const w = item.w;
              const st = workoutStats(w);
              const lifts = w.exercises.map(
                (e) => data.exById.get(e.exerciseId)?.name ?? 'Unknown',
              );
              const more = lifts.length - 3;
              const prs = records.get(w.id) ?? 0;
              return (
                <Pressable
                  key={w.id}
                  onPress={() =>
                    router.navigate({
                      pathname: '/workout',
                      params: { id: w.id },
                    })
                  }
                  style={({ pressed }) => [
                    tr.histRow,
                    i === 0 && { borderTopWidth: 0 },
                    pressed && tr.pressed,
                  ]}
                >
                  <View style={tr.histTop}>
                    <Text style={tr.histName} numberOfLines={1}>
                      {w.name}
                    </Text>
                    <Text style={tr.histDate}>{dayText(w.date)}</Text>
                  </View>
                  <Text style={tr.histLifts} numberOfLines={1}>
                    {lifts.slice(0, 3).join(', ')}
                    {more > 0 ? ` and ${more} more` : ''}
                  </Text>
                  <View style={tr.histStats}>
                    <Text style={tr.histStat}>
                      {st.sets} sets · {volumeText(st.volume)}
                      {st.ms > 0 ? ` · ${durationText(st.ms)}` : ''}
                    </Text>
                    {prs ? (
                      <Text style={tr.prTag}>
                        {prs} {prs === 1 ? 'record' : 'records'}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
      {newest.length > shown ? (
        <Pressable
          onPress={() => setShown(shown + PAGE)}
          style={{ alignSelf: 'center', padding: 12, marginTop: 8 }}
        >
          <Text style={tr.linkText}>Show older training</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A HYROX sim in the timeline; opens the HYROX tab. */
function SimRow({
  sim,
  first,
  record,
}: {
  sim: Sim;
  first: boolean;
  record: boolean;
}) {
  const part = PARTS.find((p) => p.id === sim.part)?.label.toLowerCase();
  return (
    <Pressable
      onPress={() =>
        router.navigate({
          pathname: '/train',
          params: { tab: 'hyrox', at: String(Date.now()) },
        })
      }
      style={({ pressed }) => [
        tr.histRow,
        first && { borderTopWidth: 0 },
        pressed && tr.pressed,
      ]}
    >
      <View style={tr.histTop}>
        <Text style={tr.histName} numberOfLines={1}>
          HYROX {part}
        </Text>
        <Text style={tr.histDate}>{dayText(sim.date)}</Text>
      </View>
      <Text style={tr.histLifts} numberOfLines={1}>
        {division(sim.division).name}
      </Text>
      <View style={tr.histStats}>
        <Text style={tr.histStat}>{raceClock(summarize(sim).totalMs)}</Text>
        {record ? <Text style={tr.prTag}>Best time</Text> : null}
      </View>
    </Pressable>
  );
}

/** A cardio session in the timeline; opens it on the Cardio tab. */
function CardioRow({
  session,
  first,
  record,
}: {
  session: CardioSession;
  first: boolean;
  record: boolean;
}) {
  const pace = sessionPace(session);
  return (
    <Pressable
      onPress={() =>
        router.navigate({
          pathname: '/train',
          params: { tab: 'cardio', edit: session.id, at: String(Date.now()) },
        })
      }
      style={({ pressed }) => [
        tr.histRow,
        first && { borderTopWidth: 0 },
        pressed && tr.pressed,
      ]}
    >
      <View style={tr.histTop}>
        <Text style={tr.histName} numberOfLines={1}>
          {kindOf(session.kind).label}
          {session.km ? ` · ${distanceText(session.km, session.kind)}` : ''}
        </Text>
        <Text style={tr.histDate}>{dayText(session.date)}</Text>
      </View>
      <Text style={tr.histLifts} numberOfLines={1}>
        {session.effort === 'vigorous'
          ? 'Vigorous'
          : session.effort === 'moderate'
            ? 'Moderate'
            : 'Light'}
        {session.avgHr ? ` · ${session.avgHr} bpm` : ''}
      </Text>
      <View style={tr.histStats}>
        <Text style={tr.histStat}>
          {clock(session.ms)}
          {pace ? ` · ${pace}` : ''}
        </Text>
        {record ? <Text style={tr.prTag}>Best time</Text> : null}
      </View>
    </Pressable>
  );
}

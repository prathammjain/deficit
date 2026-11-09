/**
 * history.tsx: finished workouts, newest first, grouped by week.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, SectionLabel } from '@/components/ui/primitives';
import { periodLabel, periodOf } from '@/lib/train/progress';
import { durationText, workoutStats, type Workout } from '@/lib/train/workout';

import type { Training } from './data';
import { tr } from './styles';

const PAGE = 20;

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
  const newest = [...data.workouts].reverse();
  const groups: { label: string; items: Workout[] }[] = [];
  for (const w of newest.slice(0, shown)) {
    const label = periodLabel(periodOf('week', w.date), today);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(w);
    else groups.push({ label, items: [w] });
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
            {g.items.map((w, i) => {
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
                      {st.sets} sets · {st.volume.toLocaleString()} kg
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
          <Text style={tr.linkText}>Show older workouts</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

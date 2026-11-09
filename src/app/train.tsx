/**
 * The Train tab. Workouts: start, repeat, run a routine, describe one after
 * the fact, and the history. Progress: overload by week or month, joined
 * with food and bodyweight.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Tabs } from '@/components/train/bits';
import { useTraining } from '@/components/train/data';
import { DescribePanel } from '@/components/train/describe';
import { WorkoutHistory } from '@/components/train/history';
import { ProgressView } from '@/components/train/progress';
import { ResumeCard, StartCard, WeekStrip } from '@/components/train/start';
import { tr } from '@/components/train/styles';
import { Screen, Title } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { formatToday } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import { recordCounts } from '@/lib/train/progress';
import { deleteRoutine, loadSession, saveSession } from '@/lib/train/store';
import {
  newSession,
  sessionFromRoutine,
  sessionFromWorkout,
  type Session,
} from '@/lib/train/workout';

type Tab = 'workouts' | 'progress';

export default function TrainScreen() {
  const { data, setData, reload } = useTraining();
  const [tab, setTab] = useState<Tab>('workouts');
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [describing, setDescribing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const today = todayKey();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadSession().then((s) => {
        if (alive) setSession(s);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const running = !!session;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!data || session === undefined) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const start = async (s: Session) => {
    await saveSession(s);
    router.navigate('/workout');
  };

  return (
    <Screen>
      <Text style={tr.dateLine}>{formatToday()}</Text>
      <Title>Train</Title>
      <Tabs
        options={[
          { id: 'workouts', label: 'Workouts' },
          { id: 'progress', label: 'Progress' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'workouts' ? (
        <>
          {session ? (
            <ResumeCard
              session={session}
              now={now}
              onResume={() => router.navigate('/workout')}
            />
          ) : (
            <StartCard
              data={data}
              today={today}
              onStart={() => void start(newSession())}
              onRepeat={(w) => void start(sessionFromWorkout(w))}
              onRoutine={(r) => void start(sessionFromRoutine(r))}
              onDeleteRoutine={async (r) => {
                const routines = await deleteRoutine(r.id);
                setData({ ...data, routines });
              }}
              onDescribe={() => {
                setNotice(null);
                setDescribing(true);
              }}
            />
          )}

          {describing ? (
            <DescribePanel
              data={data}
              onClose={() => setDescribing(false)}
              onSaved={(w) => {
                setDescribing(false);
                setNotice(
                  `Saved ${w.name}, ${w.exercises.length} ${w.exercises.length === 1 ? 'exercise' : 'exercises'}.`,
                );
                void reload();
              }}
            />
          ) : null}

          {notice ? (
            <Text style={[tr.muted, { marginTop: 12 }]}>{notice}</Text>
          ) : null}
          {data.pending ? (
            <Text style={[tr.faint, { marginTop: 12 }]}>
              {data.pending} {data.pending === 1 ? 'change is' : 'changes are'}{' '}
              saved on this phone and will sync when you’re back online.
            </Text>
          ) : null}

          <WeekStrip
            data={data}
            today={today}
            onPress={() => setTab('progress')}
          />

          <WorkoutHistory
            data={data}
            today={today}
            records={recordCounts(data.workouts, data.exById, data.bodyKg)}
          />
        </>
      ) : (
        <ProgressView data={data} today={today} />
      )}
    </Screen>
  );
}

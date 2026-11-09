/**
 * The logger. Without an id it is the workout in progress: elapsed clock,
 * exercise cards, a rest timer that starts itself, Finish. With ?id= it is a
 * finished workout: read it, repeat it, edit it with the same cards.
 *
 * Every change is saved to the device at once and to the account a moment
 * later, so closing the app mid set loses nothing.
 */

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, DayStepper, NumField } from '@/components/train/bits';
import { recentIds, useTraining, type Training } from '@/components/train/data';
import { BlockList } from '@/components/train/editor';
import { ExercisePicker } from '@/components/train/picker';
import { RestBar } from '@/components/train/rest';
import { tr } from '@/components/train/styles';
import {
  FinishSummary,
  RecordsCard,
  StatsRow,
  workoutRecords,
} from '@/components/train/summary';
import { ChevronIcon, PlusIcon } from '@/components/ui/icons';
import { Card, DotMatrix, PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { formatToday } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import type { Exercise } from '@/lib/train/exercises';
import {
  addCustomExercise,
  clearSession,
  deleteWorkout,
  loadSession,
  rememberRest,
  saveRoutine,
  saveSession,
  saveWorkout,
} from '@/lib/train/store';
import {
  DEFAULT_REST,
  allBests,
  clock,
  durationText,
  exerciseBlocks,
  finishSession,
  lastSets,
  newSession,
  patchBlock,
  routineFromWorkout,
  sessionFromWorkout,
  tally,
  tickable,
  tickRemaining,
  type Session,
  type Workout,
  type WorkoutExercise,
} from '@/lib/train/workout';

export default function WorkoutRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? <SavedWorkout key={id} id={id} /> : <LiveWorkout />;
}

function TopBar({
  left,
  middle,
  right,
}: {
  left: React.ReactNode;
  middle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={tr.topBar}>
      <View style={{ minWidth: 72, alignItems: 'flex-start' }}>{left}</View>
      <View style={tr.clockWrap}>{middle}</View>
      <View style={{ minWidth: 72, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

function BackButton({
  onPress,
  label,
}: {
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      style={({ pressed }) => [
        tr.iconBtn,
        tr.iconBtnRing,
        pressed && tr.pressed,
      ]}
    >
      <ChevronIcon color={palette.text} />
    </Pressable>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaView style={tr.flex1}>{children}</SafeAreaView>
    </View>
  );
}

/** What the cards need from history, kept in one place. */
function useHistory(data: Training | null, before?: string, skipId?: string) {
  const workouts = data?.workouts;
  const previous = useMemo(
    () => lastSets(workouts ?? [], before, skipId),
    [workouts, before, skipId],
  );
  const bests = useMemo(
    () =>
      data
        ? allBests(data.workouts, data.exById, data.bodyKg, before, skipId)
        : new Map(),
    [data, before, skipId],
  );
  const recent = useMemo(() => recentIds(workouts ?? []), [workouts]);
  return { previous, bests, recent };
}

// The workout in progress
function LiveWorkout() {
  const { data, setData, reload } = useTraining();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [finished, setFinished] = useState<Workout | null>(null);
  const [picker, setPicker] = useState<{ replace: string | null } | null>(null);
  const [confirm, setConfirm] = useState<'finish' | 'empty' | 'discard' | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const latest = useRef<Session | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buzzed = useRef(0);
  const { previous, bests, recent } = useHistory(data);

  const flush = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    if (latest.current) void saveSession(latest.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadSession().then((s) => {
        if (!alive) return;
        latest.current = s;
        setSession(s);
        if (s) setFinished(null);
      });
      return () => {
        alive = false;
        flush();
      };
    }, [flush]),
  );

  const active = !!session;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // The screen stays on while a rest counts down, so the timer is in view
  // when the phone is set down between sets.
  const resting = !!session?.rest && now < session.rest.endsAt;
  useEffect(() => {
    if (!resting || Platform.OS !== 'web' || typeof navigator === 'undefined') {
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    navigator.wakeLock
      ?.request('screen')
      .then((l) => {
        if (alive) lock = l;
        else void l.release();
      })
      .catch(() => {});
    return () => {
      alive = false;
      void lock?.release().catch(() => {});
    };
  }, [resting]);

  // A short buzz when the rest is up, where the phone can.
  useEffect(() => {
    const r = session?.rest;
    if (r && now >= r.endsAt && buzzed.current !== r.endsAt) {
      buzzed.current = r.endsAt;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        navigator.vibrate?.([180, 80, 180]);
      }
    }
  }, [now, session]);

  /** Shows a change now, stores it on the device and account shortly. */
  const commit = useCallback((next: Session, immediate = false) => {
    const stamped = { ...next, updatedAt: Date.now() };
    latest.current = stamped;
    setSession(stamped);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        void saveSession(stamped);
      },
      immediate ? 0 : 400,
    );
  }, []);

  const back = () => {
    flush();
    router.navigate('/train');
  };

  if (session === undefined || !data) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (finished) {
    return (
      <Shell>
        <ScrollView contentContainerStyle={[tr.content, { paddingTop: 24 }]}>
          <FinishSummary
            workout={finished}
            exById={data.exById}
            bests={allBests(
              data.workouts,
              data.exById,
              data.bodyKg,
              finished.startedAt,
              finished.id,
            )}
            bodyKg={data.bodyKg}
            onDone={() => {
              setFinished(null);
              router.navigate('/train');
            }}
            onSaveRoutine={async (name) => {
              await saveRoutine(routineFromWorkout(finished, name));
            }}
          />
        </ScrollView>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <TopBar left={<BackButton onPress={back} label="Back to Train" />} />
        <View style={[tr.content, { paddingTop: 48, gap: 16 }]}>
          <Text style={tr.nameInput}>No workout running</Text>
          <Text style={tr.emptyText}>
            Start one here, or pick a routine or a past workout on the Train
            tab.
          </Text>
          <PrimaryButton
            label="Start a workout"
            onPress={() => {
              const s = newSession();
              commit(s, true);
            }}
          />
        </View>
      </Shell>
    );
  }

  const restFor = (b: WorkoutExercise) =>
    b.restSec ?? data.settings.rest[b.exerciseId] ?? DEFAULT_REST;
  const count = tally(session.exercises);
  const showRest = session.rest && now < session.rest.endsAt + 15000;

  const finish = async (tickRest: boolean) => {
    setBusy(true);
    const blocks = tickRest
      ? tickRemaining(session.exercises, previous, data.exById)
      : session.exercises;
    const w = finishSession({ ...session, exercises: blocks }, data.exById);
    if (!w) {
      setBusy(false);
      setConfirm('empty');
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await saveWorkout(w);
    await clearSession();
    latest.current = null;
    setConfirm(null);
    setBusy(false);
    setSession(null);
    setFinished(w);
    void reload();
  };

  const askFinish = () => {
    const extra = tickable(session.exercises, previous, data.exById);
    if (count.done === 0 && extra === 0) setConfirm('empty');
    else if (extra > 0) setConfirm('finish');
    else void finish(false);
  };

  const discard = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await clearSession();
    latest.current = null;
    setConfirm(null);
    setSession(null);
    router.navigate('/train');
  };

  const extra =
    confirm === 'finish'
      ? tickable(session.exercises, previous, data.exById)
      : 0;

  return (
    <Shell>
      <TopBar
        left={
          <BackButton
            onPress={back}
            label="Back to Train, keep logging later"
          />
        }
        middle={
          <>
            <Text style={tr.clockLabel}>ELAPSED</Text>
            <DotMatrix style={tr.clock}>
              {clock(now - Date.parse(session.startedAt))}
            </DotMatrix>
          </>
        }
        right={
          <Pressable
            onPress={askFinish}
            disabled={busy}
            style={({ pressed }) => [tr.smallPill, pressed && tr.pressed]}
          >
            <Text style={tr.smallPillText}>Finish</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={tr.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={tr.nameInput}
          value={session.name}
          onChangeText={(name) => commit({ ...session, name, named: true })}
          accessibilityLabel="Workout name"
          maxLength={60}
        />
        <Text style={tr.sessionMeta}>
          {session.exercises.length}{' '}
          {session.exercises.length === 1 ? 'exercise' : 'exercises'} ·{' '}
          {count.done} of {count.total} sets ·{' '}
          {Math.round(count.volume).toLocaleString()} kg
        </Text>

        {confirm ? (
          <View style={tr.banner}>
            <Text style={tr.bannerText}>
              {confirm === 'finish'
                ? `${extra} ${extra === 1 ? 'set has' : 'sets have'} numbers but no tick.`
                : confirm === 'empty'
                  ? 'Nothing is ticked yet, so there is nothing to save.'
                  : 'Discard this workout? Nothing from it will be saved.'}
            </Text>
            <View style={tr.chips}>
              {confirm === 'finish' ? (
                <>
                  <Chip
                    label="Tick them and finish"
                    on
                    onPress={() => void finish(true)}
                  />
                  <Chip
                    label="Finish without them"
                    onPress={() => void finish(false)}
                  />
                </>
              ) : (
                <Chip
                  label="Discard workout"
                  danger
                  onPress={() => void discard()}
                />
              )}
              <Chip label="Keep going" onPress={() => setConfirm(null)} />
            </View>
          </View>
        ) : null}

        <BlockList
          blocks={session.exercises}
          exById={data.exById}
          previous={previous}
          bests={bests}
          bodyKg={data.bodyKg}
          editable
          restFor={restFor}
          onChange={(blocks, ticked) => {
            let next: Session = { ...session, exercises: blocks };
            if (ticked) {
              const sec = restFor(ticked);
              next = {
                ...next,
                rest:
                  sec > 0
                    ? { endsAt: Date.now() + sec * 1000, total: sec * 1000 }
                    : null,
              };
              setNow(Date.now());
            }
            commit(next, !!ticked);
          }}
          onRest={(b, sec) => {
            commit({
              ...session,
              exercises: patchBlock(session.exercises, b.id, { restSec: sec }),
            });
            void rememberRest(b.exerciseId, sec);
            setData({
              ...data,
              settings: {
                ...data.settings,
                rest: { ...data.settings.rest, [b.exerciseId]: sec },
              },
            });
          }}
          onReplace={(blockId) => setPicker({ replace: blockId })}
          onHistory={(exerciseId) => {
            flush();
            router.navigate({
              pathname: '/exercise',
              params: { id: exerciseId, from: 'workout' },
            });
          }}
        />

        {session.exercises.length === 0 ? (
          <Text style={[tr.emptyText, { marginTop: 24 }]}>
            Add your first exercise. Last time’s numbers fill in on their own,
            so a repeat set is one tap.
          </Text>
        ) : null}

        <Pressable
          onPress={() => setPicker({ replace: null })}
          style={({ pressed }) => [
            tr.ghostBtn,
            { marginTop: 16 },
            pressed && tr.pressed,
          ]}
        >
          <PlusIcon />
          <Text style={tr.ghostText}>Add exercise</Text>
        </Pressable>

        <Pressable
          onPress={() => setConfirm('discard')}
          hitSlop={8}
          style={{ alignSelf: 'center', marginTop: 24, padding: 8 }}
        >
          <Text style={[tr.linkText, { color: palette.textFaint }]}>
            Discard workout
          </Text>
        </Pressable>
      </ScrollView>

      {showRest && session.rest ? (
        <RestBar
          rest={session.rest}
          now={now}
          onAdjust={(sec) => {
            const r = session.rest!;
            const endsAt = Math.max(Date.now(), r.endsAt + sec * 1000);
            commit(
              {
                ...session,
                rest: { endsAt, total: Math.max(1000, r.total + sec * 1000) },
              },
              true,
            );
          }}
          onClose={() => commit({ ...session, rest: null }, true)}
        />
      ) : null}

      {picker ? (
        <ExercisePicker
          exercises={data.exercises}
          recent={recent}
          last={previous}
          bodyKg={data.bodyKg}
          single={picker.replace != null}
          onClose={() => setPicker(null)}
          onCreate={async (ex: Exercise) => {
            const custom = await addCustomExercise(ex);
            const exercises = [
              ...data.exercises.filter((e) => !e.custom),
              ...custom,
            ];
            setData({
              ...data,
              exercises,
              exById: new Map(exercises.map((e) => [e.id, e])),
            });
          }}
          onPick={(ids) => {
            const blocks =
              picker.replace != null
                ? patchBlock(session.exercises, picker.replace, {
                    exerciseId: ids[0],
                  })
                : [
                    ...session.exercises,
                    ...exerciseBlocks(ids, (id) => data.settings.rest[id]),
                  ];
            commit({ ...session, exercises: blocks }, true);
            setPicker(null);
          }}
        />
      ) : null}
    </Shell>
  );
}

// A finished workout
const DAY = 86_400_000;
const shiftIso = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * DAY).toISOString();

function SavedWorkout({ id }: { id: string }) {
  const { data, setData, reload } = useTraining();
  const [draft, setDraft] = useState<Workout | null>(null);
  const [picker, setPicker] = useState<{ replace: string | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [routineSaved, setRoutineSaved] = useState(false);
  const w = data?.workouts.find((x) => x.id === id) ?? null;
  const shown = draft ?? w;
  const { previous, bests, recent } = useHistory(data, w?.startedAt, w?.id);

  if (!data) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!w || !shown) {
    return (
      <Shell>
        <TopBar
          left={
            <BackButton
              onPress={() => router.navigate('/train')}
              label="Back to Train"
            />
          }
        />
        <View style={[tr.content, { paddingTop: 48, gap: 12 }]}>
          <Text style={tr.nameInput}>Workout not found</Text>
          <Text style={tr.emptyText}>
            It may have been deleted on another device.
          </Text>
        </View>
      </Shell>
    );
  }

  const records = workoutRecords(shown, data.exById, bests, data.bodyKg);
  const minutes = Math.round(
    Math.max(0, Date.parse(shown.endedAt) - Date.parse(shown.startedAt)) /
      60000,
  );

  const repeat = async () => {
    const running = await loadSession();
    if (running) {
      setNotice('A workout is already running. Finish or discard it first.');
      return;
    }
    await saveSession(sessionFromWorkout(w));
    router.navigate('/workout');
  };

  const save = async () => {
    if (!draft) return;
    // Same rule as finishing: only ticked sets are kept.
    const exercises = draft.exercises
      .map((we) => ({
        ...we,
        sets: we.sets.filter((s) => s.done && (s.reps ?? 0) > 0),
      }))
      .filter((we) => we.sets.length > 0);
    if (!exercises.length) {
      setNotice(
        'Nothing is ticked. Tick a set, or delete the workout instead.',
      );
      return;
    }
    await saveWorkout({ ...draft, exercises }, w.date);
    setDraft(null);
    setNotice(null);
    await reload();
  };

  if (draft) {
    return (
      <Shell>
        <TopBar
          left={
            <Pressable onPress={() => setDraft(null)} hitSlop={8}>
              <Text style={tr.linkText}>Cancel</Text>
            </Pressable>
          }
          middle={<Text style={tr.strong}>Edit workout</Text>}
          right={
            <Pressable
              onPress={() => void save()}
              style={({ pressed }) => [tr.smallPill, pressed && tr.pressed]}
            >
              <Text style={tr.smallPillText}>Save</Text>
            </Pressable>
          }
        />
        <ScrollView
          contentContainerStyle={tr.content}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={tr.nameInput}
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            accessibilityLabel="Workout name"
            maxLength={60}
          />
          <Card style={{ marginTop: 16, gap: 14 }}>
            <DayStepper
              value={draft.date}
              today={todayKey()}
              onChange={(day) => {
                const days = Math.round(
                  (Date.parse(`${day}T00:00:00Z`) -
                    Date.parse(`${draft.date}T00:00:00Z`)) /
                    DAY,
                );
                setDraft({
                  ...draft,
                  date: day,
                  startedAt: shiftIso(draft.startedAt, days),
                  endedAt: shiftIso(draft.endedAt, days),
                });
              }}
            />
            <View style={[tr.row, { gap: 12 }]}>
              <Text style={[tr.label, tr.flex1]}>Duration in minutes</Text>
              <NumField
                value={minutes || null}
                placeholder="0"
                label="Duration in minutes"
                onChange={(m) =>
                  setDraft({
                    ...draft,
                    endedAt: new Date(
                      Date.parse(draft.startedAt) + (m ?? 0) * 60000,
                    ).toISOString(),
                  })
                }
                style={[tr.cell, { width: 72 }]}
              />
            </View>
          </Card>
          <BlockList
            blocks={draft.exercises}
            exById={data.exById}
            previous={previous}
            bests={bests}
            bodyKg={data.bodyKg}
            editable
            onChange={(blocks) => setDraft({ ...draft, exercises: blocks })}
            onReplace={(blockId) => setPicker({ replace: blockId })}
            onHistory={() => {}}
          />
          <Pressable
            onPress={() => setPicker({ replace: null })}
            style={({ pressed }) => [
              tr.ghostBtn,
              { marginTop: 16 },
              pressed && tr.pressed,
            ]}
          >
            <PlusIcon />
            <Text style={tr.ghostText}>Add exercise</Text>
          </Pressable>
          <Text style={[tr.faint, { marginTop: 16, textAlign: 'center' }]}>
            Only ticked sets are kept when you save.
          </Text>
          {notice ? (
            <Text style={[tr.readWarn, { marginTop: 8, textAlign: 'center' }]}>
              {notice}
            </Text>
          ) : null}
        </ScrollView>
        {picker ? (
          <ExercisePicker
            exercises={data.exercises}
            recent={recent}
            last={previous}
            bodyKg={data.bodyKg}
            single={picker.replace != null}
            onClose={() => setPicker(null)}
            onCreate={async (ex: Exercise) => {
              const custom = await addCustomExercise(ex);
              const exercises = [
                ...data.exercises.filter((e) => !e.custom),
                ...custom,
              ];
              setData({
                ...data,
                exercises,
                exById: new Map(exercises.map((e) => [e.id, e])),
              });
            }}
            onPick={(ids) => {
              const blocks =
                picker.replace != null
                  ? patchBlock(draft.exercises, picker.replace, {
                      exerciseId: ids[0],
                    })
                  : [
                      ...draft.exercises,
                      ...exerciseBlocks(ids, () => undefined),
                    ];
              setDraft({ ...draft, exercises: blocks });
              setPicker(null);
            }}
          />
        ) : null}
      </Shell>
    );
  }

  return (
    <Shell>
      <TopBar
        left={
          <BackButton
            onPress={() => router.navigate('/train')}
            label="Back to Train"
          />
        }
        right={
          <Pressable
            onPress={() => {
              setNotice(null);
              setDraft(w);
            }}
            hitSlop={8}
          >
            <Text style={[tr.linkText, { color: palette.text }]}>Edit</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={tr.content}>
        <Text style={tr.nameInput}>{w.name}</Text>
        <Text style={tr.sessionMeta}>
          {formatToday(new Date(w.startedAt))}
          {minutes > 0 ? ` · ${durationText(minutes * 60000)}` : ''}
          {w.source === 'described' ? ' · written up' : ''}
          {w.source === 'imported'
            ? ` · imported${w.importedFrom === 'strong' ? ' from Strong' : w.importedFrom === 'hevy' ? ' from Hevy' : ''}`
            : ''}
        </Text>

        <Card style={{ marginTop: 20 }}>
          <StatsRow w={w} records={records.length} />
        </Card>

        <RecordsCard lines={records} />

        <BlockList
          blocks={w.exercises}
          exById={data.exById}
          previous={previous}
          bests={bests}
          bodyKg={data.bodyKg}
          editable={false}
          onChange={() => {}}
          onReplace={() => {}}
          onHistory={(exerciseId) =>
            router.navigate({
              pathname: '/exercise',
              params: { id: exerciseId },
            })
          }
        />

        {notice ? (
          <Text style={[tr.readWarn, { marginTop: 16 }]}>{notice}</Text>
        ) : null}

        <View style={{ gap: 12, marginTop: 24 }}>
          <PrimaryButton
            label="Do this workout again"
            onPress={() => void repeat()}
          />
          {routineSaved ? null : (
            <Pressable
              onPress={async () => {
                await saveRoutine(routineFromWorkout(w, w.name));
                setRoutineSaved(true);
                setNotice(
                  w.routineId
                    ? 'Routine updated to match this workout.'
                    : `Saved as the routine “${w.name}”.`,
                );
              }}
              style={({ pressed }) => [tr.ghostBtn, pressed && tr.pressed]}
            >
              <Text style={tr.ghostText}>
                {w.routineId
                  ? 'Update its routine to match'
                  : 'Save as a routine'}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={async () => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              await deleteWorkout(w);
              router.navigate('/train');
            }}
            style={{ alignSelf: 'center', padding: 8 }}
          >
            <Text style={[tr.linkText, confirmDelete && tr.accentText]}>
              {confirmDelete
                ? 'Tap again to delete for good'
                : 'Delete workout'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Shell>
  );
}

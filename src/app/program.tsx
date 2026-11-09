/**
 * A program, opened by its share link (?code=) or from a list (?id=).
 * Three views of the same page: someone deciding whether to follow, a
 * follower running it, and the author sharing it and watching how their
 * followers are doing.
 */

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Check } from '@/components/consent';
import { Chip } from '@/components/train/bits';
import { useTraining, type Training } from '@/components/train/data';
import {
  shareProgress,
  startProgramDay,
  useAccountName,
  useFollowing,
} from '@/components/train/follow';
import {
  FollowerRow,
  MealPlanView,
  ProgramDays,
  ProgramHeader,
  ago,
  namer,
} from '@/components/train/program';
import { tr } from '@/components/train/styles';
import { ChevronIcon } from '@/components/ui/icons';
import {
  Card,
  DotMatrix,
  GlassSurface,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import { todayKey } from '@/lib/log-store';
import { useAuth } from '@/lib/supabase/auth';
import {
  cachedFollowing,
  findProgram,
  followerCounts,
  followProgram,
  getProgram,
  leaveProgram,
  saveProgram,
  sharingFollowers,
  updateFollow,
  type Following,
} from '@/lib/supabase/programs';
import {
  cleanCode,
  position,
  shareLink,
  type Follow,
  type Program,
} from '@/lib/train/program';
import { loadSession } from '@/lib/train/store';

const OFFLINE =
  'Couldn’t reach your account. Check your connection and try again.';

export default function ProgramScreen() {
  const { id, code } = useLocalSearchParams<{ id?: string; code?: string }>();
  const { data } = useTraining();
  const { following, setFollowing, signedIn } = useFollowing();
  const { session } = useAuth();
  const [loaded, setLoaded] = useState<{
    key: string;
    program: Program | null;
    failed: boolean;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const key = id ? `id:${id}` : `code:${cleanCode(code ?? '')}`;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const k = id ? `id:${id}` : `code:${cleanCode(code ?? '')}`;
      const load = !signedIn
        ? Promise.resolve(null)
        : id
          ? getProgram(id)
          : findProgram(code ?? '');
      load
        .then((program) => {
          if (alive) setLoaded({ key: k, program, failed: false });
        })
        .catch(() => {
          // Offline: a followed program is still on the device.
          const f = cachedFollowing();
          const mine =
            f &&
            (f.program.id === id || f.program.code === cleanCode(code ?? ''));
          if (alive)
            setLoaded({
              key: k,
              program: mine ? f.program : null,
              failed: !mine,
            });
        });
      loadSession().then((s) => {
        if (alive) setRunning(!!s);
      });
      return () => {
        alive = false;
      };
    }, [id, code, signedIn]),
  );

  if (!signedIn) {
    return (
      <Screen>
        <BackLink />
        <Text style={[tr.nameInput, { marginTop: space.lg }]}>Programs</Text>
        <Text style={[tr.emptyText, { marginTop: space.md }]}>
          Programs are shared between people, so they need an account. Sign in
          to follow one or write your own.
        </Text>
      </Screen>
    );
  }

  if (!data || !loaded || loaded.key !== key) {
    return (
      <View style={tr.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const program = loaded.program;
  if (!program) {
    return (
      <Screen>
        <BackLink />
        <Text style={[tr.nameInput, { marginTop: space.lg }]}>
          {loaded.failed ? 'Couldn’t load it' : 'No program found'}
        </Text>
        <Text style={[tr.emptyText, { marginTop: space.md }]}>
          {loaded.failed
            ? OFFLINE
            : 'No published program has that code. Check it with the person who shared it; they may have stopped new followers.'}
        </Text>
        <PrimaryButton
          label="Enter a code"
          style={{ marginTop: space.xl }}
          onPress={() => router.navigate('/programs')}
        />
      </Screen>
    );
  }

  const today = todayKey();
  const mine = program.ownerId === session?.user.id;
  const followingThis = following?.program.id === program.id;
  const name = namer(program, data.exById);
  const start = (p: Program, day: number) =>
    void startProgramDay(p, day, data.exById).catch(() => undefined);

  return (
    <Screen>
      <BackLink />
      {mine ? (
        <AuthorView
          key={program.id}
          program={program}
          today={today}
          name={name}
          onProgram={(p) => setLoaded({ ...loaded, program: p })}
        />
      ) : followingThis && following ? (
        <FollowerView
          key={program.id}
          f={{ ...following, program }}
          data={data}
          running={running}
          name={name}
          onStart={(day) => start(program, day)}
          onChange={setFollowing}
        />
      ) : (
        <>
          <ProgramHeader program={program} eyebrow="PROGRAM" />
          <FollowCard
            key={program.id}
            program={program}
            current={following}
            data={data}
            onFollowed={setFollowing}
          />
          <SectionLabel>Days</SectionLabel>
          <ProgramDays program={program} name={name} />
          {program.nutrition ? (
            <>
              <SectionLabel>Meal plan</SectionLabel>
              <MealPlanView plan={program.nutrition} />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function BackLink() {
  return (
    <Pressable
      onPress={() => router.navigate('/programs')}
      hitSlop={8}
      style={({ pressed }) => [
        tr.row,
        { gap: 4, alignSelf: 'flex-start' },
        pressed && tr.pressed,
      ]}
    >
      <ChevronIcon color={palette.textMuted} />
      <Text style={tr.linkText}>Programs</Text>
    </Pressable>
  );
}

const shareWhat = (author: string) =>
  `Share my progress with ${author || 'the author'}: workouts done against the plan, days with food logged, average calories and protein, and weight change. Never your meals, sets or notes. You can stop any time.`;

function FollowCard({
  program,
  current,
  data,
  onFollowed,
}: {
  program: Program;
  current: Following | null;
  data: Training;
  onFollowed: (f: Following) => void;
}) {
  const accountName = useAccountName();
  const [share, setShare] = useState(false);
  const [shownAs, setShownAs] = useState(accountName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const follow = async () => {
    setBusy(true);
    setError(null);
    try {
      const f = await followProgram(program.code, share, shownAs);
      onFollowed(f);
      if (share) void shareProgress(f, data.workouts).catch(() => undefined);
    } catch {
      setError(OFFLINE);
      setBusy(false);
    }
  };

  return (
    <GlassSurface padded style={[tr.startCard, { gap: space.md }]}>
      <Check bare on={share} onPress={() => setShare(!share)}>
        {shareWhat(program.authorName)}
      </Check>
      {share ? (
        <TextInput
          style={tr.input}
          value={shownAs}
          onChangeText={setShownAs}
          placeholder={`Your name, as ${program.authorName || 'the author'} sees it`}
          placeholderTextColor={palette.textDim}
          maxLength={60}
          accessibilityLabel="Your name for the author"
        />
      ) : null}
      {current ? (
        <Text style={tr.muted}>
          You follow {current.program.title}. Following this one replaces it;
          your workouts stay.
        </Text>
      ) : null}
      {error ? (
        <Text style={[tr.readWarn, { fontSize: 13 }]}>{error}</Text>
      ) : null}
      {busy ? (
        <ActivityIndicator color={palette.accent} />
      ) : (
        <PrimaryButton
          label="Follow this program"
          onPress={() => void follow()}
        />
      )}
    </GlassSurface>
  );
}

function FollowerView({
  f,
  data,
  running,
  name,
  onStart,
  onChange,
}: {
  f: Following;
  data: Training;
  running: boolean;
  name: (id: string) => string;
  onStart: (day: number) => void;
  onChange: (f: Following | null) => void;
}) {
  const { program, follow } = f;
  const pos = position(program, data.workouts, follow.startedAt);
  const [pick, setPick] = useState<number | null>(null);
  const [shownAs, setShownAs] = useState(follow.displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const day = pick ?? pos.dayIndex;
  const total = program.days.length * program.weeks;

  const setSharing = async (share: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await updateFollow(follow.id, { share, name: shownAs });
      const next = cachedFollowing() ?? {
        ...f,
        follow: { ...follow, shareStats: share },
      };
      if (share) await shareProgress(next, data.workouts);
      onChange(cachedFollowing() ?? next);
    } catch {
      setError(OFFLINE);
    }
    setBusy(false);
  };

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await leaveProgram(follow.id);
      onChange(null);
    } catch {
      setError(OFFLINE);
      setBusy(false);
    }
  };

  return (
    <>
      <ProgramHeader
        program={program}
        eyebrow={
          pos.complete
            ? 'FOLLOWING · COMPLETE'
            : `FOLLOWING · WEEK ${pos.week} OF ${program.weeks}`
        }
      />

      <GlassSurface padded style={tr.startCard}>
        {running ? (
          <>
            <Text style={tr.emptyText}>
              A workout is in progress. Finish it before starting a program day.
            </Text>
            <PrimaryButton
              label="Resume workout"
              onPress={() => router.navigate('/workout')}
            />
          </>
        ) : (
          <>
            <View>
              <Text style={tr.eyebrow}>
                {pick == null ? 'NEXT UP' : 'YOUR PICK'}
              </Text>
              <Text style={tr.resumeName}>{program.days[day]?.name}</Text>
            </View>
            {program.days.length > 1 ? (
              <View style={tr.chips}>
                {program.days.map((d, i) => (
                  <Chip
                    key={d.id}
                    label={i === pos.dayIndex ? `${d.name} (next)` : d.name}
                    on={i === day}
                    onPress={() => setPick(i === pos.dayIndex ? null : i)}
                  />
                ))}
              </View>
            ) : null}
            <PrimaryButton
              label={`Start ${program.days[day]?.name ?? 'workout'}`}
              onPress={() => onStart(day)}
            />
          </>
        )}
        <View style={{ gap: space.sm }}>
          <Text style={tr.muted}>
            {Math.min(pos.done, total)} of {total} workouts done
          </Text>
          <ProgressBar fraction={total ? pos.done / total : 0} />
        </View>
      </GlassSurface>

      <SectionLabel>Days</SectionLabel>
      <ProgramDays program={program} name={name} next={pos.dayIndex} />

      {program.nutrition ? (
        <>
          <SectionLabel>Meal plan</SectionLabel>
          <MealPlanView plan={program.nutrition} />
          {program.nutrition.meals.length ? (
            <Text style={[tr.faint, { marginTop: space.sm }]}>
              These meals are on Today, ready to log in one tap.
            </Text>
          ) : null}
        </>
      ) : null}

      <SectionLabel>Sharing</SectionLabel>
      <Card style={{ gap: space.md }}>
        <Check
          bare
          on={follow.shareStats}
          onPress={() => void setSharing(!follow.shareStats)}
        >
          {shareWhat(program.authorName)}
        </Check>
        {follow.shareStats ? (
          <>
            <TextInput
              style={tr.input}
              value={shownAs}
              onChangeText={setShownAs}
              onBlur={() => {
                if (shownAs.trim() !== follow.displayName) {
                  void updateFollow(follow.id, { name: shownAs })
                    .then(() => onChange(cachedFollowing()))
                    .catch(() => setError(OFFLINE));
                }
              }}
              placeholder={`Your name, as ${program.authorName || 'the author'} sees it`}
              placeholderTextColor={palette.textDim}
              maxLength={60}
              accessibilityLabel="Your name for the author"
            />
            <Text style={tr.faint}>
              {follow.statsAt
                ? `Last sent ${ago(follow.statsAt)}. It refreshes when you open Grain.`
                : 'Your summary goes the next time you open Grain.'}
            </Text>
          </>
        ) : null}
        {busy ? <ActivityIndicator color={palette.accent} /> : null}
        {error ? (
          <Text style={[tr.readWarn, { fontSize: 13 }]}>{error}</Text>
        ) : null}
      </Card>

      <View
        style={{ marginTop: space.xl, alignItems: 'center', gap: space.sm }}
      >
        {confirmLeave ? (
          <>
            <Text style={[tr.emptyText, { textAlign: 'center' }]}>
              Stop following {program.title}? Your workouts stay in your
              history.
            </Text>
            <View style={tr.chips}>
              <Chip
                label="Leave program"
                danger
                on
                onPress={() => void leave()}
              />
              <Chip
                label="Keep following"
                onPress={() => setConfirmLeave(false)}
              />
            </View>
          </>
        ) : (
          <Pressable
            onPress={() => setConfirmLeave(true)}
            hitSlop={6}
            style={{ padding: space.sm }}
          >
            <Text style={[tr.linkText, tr.accentText]}>Leave program</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}

function AuthorView({
  program,
  today,
  name,
  onProgram,
}: {
  program: Program;
  today: string;
  name: (id: string) => string;
  onProgram: (p: Program) => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [sharing, setSharing] = useState<Follow[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = shareLink(program.code);
  const canShare =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'share' in navigator;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([followerCounts(), sharingFollowers(program.id)])
        .then(([counts, list]) => {
          if (!alive) return;
          setCount(counts.get(program.id) ?? 0);
          setSharing(list);
        })
        .catch(() => {
          if (alive) setSharing([]);
        });
      return () => {
        alive = false;
      };
    }, [program.id]),
  );

  const setPublished = async (published: boolean) => {
    setBusy(true);
    setError(null);
    try {
      onProgram(await saveProgram({ ...program, published }));
    } catch {
      setError(OFFLINE);
    }
    setBusy(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Copying didn’t work here. The link is ${link}`);
    }
  };

  const share = () => {
    void navigator
      .share({
        title: program.title,
        text: `Follow ${program.title} on Grain. Code ${program.code}.`,
        url: link,
      })
      .catch(() => undefined);
  };

  return (
    <>
      <ProgramHeader
        program={program}
        eyebrow={
          program.published
            ? 'YOUR PROGRAM · PUBLISHED'
            : 'YOUR PROGRAM · DRAFT'
        }
      />

      <GlassSurface padded style={tr.startCard}>
        {program.published ? (
          <>
            <Text style={tr.eyebrow}>SHARE CODE</Text>
            <DotMatrix style={{ fontSize: 44, letterSpacing: 6 }}>
              {program.code}
            </DotMatrix>
            <Text style={tr.muted}>
              Anyone with the code or the link can see the program and follow
              it.
            </Text>
            <View style={[tr.row, { gap: space.sm }]}>
              {Platform.OS === 'web' ? (
                <Pressable
                  onPress={() => void copy()}
                  style={({ pressed }) => [
                    tr.ghostBtn,
                    tr.flex1,
                    pressed && tr.pressed,
                  ]}
                >
                  <Text style={tr.ghostText}>
                    {copied ? 'Copied' : 'Copy link'}
                  </Text>
                </Pressable>
              ) : null}
              {canShare ? (
                <Pressable
                  onPress={share}
                  style={({ pressed }) => [
                    tr.ghostBtn,
                    tr.flex1,
                    pressed && tr.pressed,
                  ]}
                >
                  <Text style={tr.ghostText}>Share</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Text style={tr.emptyText}>
              Only you can see this draft. Publish it to get a share code anyone
              can follow it with.
            </Text>
            {busy ? (
              <ActivityIndicator color={palette.accent} />
            ) : (
              <PrimaryButton
                label="Publish"
                onPress={() => void setPublished(true)}
              />
            )}
          </>
        )}
        {error ? (
          <Text style={[tr.readWarn, { fontSize: 13 }]}>{error}</Text>
        ) : null}
      </GlassSurface>

      <SectionLabel>Followers</SectionLabel>
      {sharing == null ? (
        <ActivityIndicator color={palette.accent} />
      ) : (
        <>
          <Text style={[tr.faint, { marginBottom: space.sm }]}>
            {count == null
              ? 'Couldn’t count followers right now.'
              : count === 0
                ? program.published
                  ? 'No one follows it yet. Share the code to get started.'
                  : 'Publish it to start taking followers.'
                : `${count} following · ${sharing.length} ${sharing.length === 1 ? 'shares' : 'share'} their progress with you`}
          </Text>
          {sharing.length ? (
            <Card padded={false}>
              {sharing.map((f, i) => (
                <FollowerRow
                  key={f.id}
                  follow={f}
                  today={today}
                  first={i === 0}
                />
              ))}
            </Card>
          ) : null}
        </>
      )}

      <SectionLabel>Days</SectionLabel>
      <ProgramDays program={program} name={name} />
      {program.nutrition ? (
        <>
          <SectionLabel>Meal plan</SectionLabel>
          <MealPlanView plan={program.nutrition} />
        </>
      ) : null}

      <View style={{ marginTop: space.xl, gap: space.md }}>
        <Pressable
          onPress={() =>
            router.navigate({ pathname: '/write', params: { id: program.id } })
          }
          style={({ pressed }) => [tr.ghostBtn, pressed && tr.pressed]}
        >
          <Text style={tr.ghostText}>Edit program</Text>
        </Pressable>
        {program.published && !busy ? (
          <Pressable
            onPress={() => void setPublished(false)}
            hitSlop={6}
            style={{ alignSelf: 'center', padding: space.sm }}
          >
            <Text style={tr.linkText}>
              Stop new followers (people following keep it)
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

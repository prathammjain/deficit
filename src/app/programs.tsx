/**
 * Programs: follow one with a share code, get back to the one you follow,
 * and the ones you've written.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTraining } from '@/components/train/data';
import { useFollowing } from '@/components/train/follow';
import { daysAWeek, weeksText } from '@/components/train/program';
import { tr } from '@/components/train/styles';
import { ChevronIcon } from '@/components/ui/icons';
import {
  Card,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette, radius, space } from '@/constants/palette';
import { followerCounts, myPrograms } from '@/lib/supabase/programs';
import { cleanCode, position, type Program } from '@/lib/train/program';

export default function ProgramsScreen() {
  const { data } = useTraining();
  const { following, signedIn } = useFollowing();
  const [code, setCode] = useState('');
  const [mine, setMine] = useState<Program[] | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      let alive = true;
      myPrograms()
        .then((list) => {
          if (!alive) return;
          setMine(list);
          setFailed(false);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
      followerCounts()
        .then((c) => {
          if (alive) setCounts(c);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [signedIn]),
  );

  const clean = cleanCode(code);
  const open = () => {
    if (clean.length !== 6) return;
    setCode('');
    router.navigate({ pathname: '/program', params: { code: clean } });
  };

  return (
    <Screen>
      <Pressable
        onPress={() => router.navigate('/train')}
        hitSlop={8}
        style={({ pressed }) => [
          tr.row,
          { gap: 4, alignSelf: 'flex-start' },
          pressed && tr.pressed,
        ]}
      >
        <ChevronIcon color={palette.textMuted} />
        <Text style={tr.linkText}>Train</Text>
      </Pressable>
      <Text style={[tr.nameInput, { marginTop: space.lg }]}>Programs</Text>
      <Text style={tr.sessionMeta}>
        Run a plan a coach or athlete wrote, with every set logged against it.
        Or write your own and share it with a code.
      </Text>

      {!signedIn ? (
        <Card style={{ marginTop: space.xl }}>
          <Text style={tr.emptyText}>
            Programs are shared between people, so they need an account. Sign in
            to follow one or write your own.
          </Text>
        </Card>
      ) : (
        <>
          <SectionLabel>Follow with a code</SectionLabel>
          <Card style={{ gap: space.md }}>
            <View style={[tr.row, { gap: space.sm }]}>
              <TextInput
                style={[tr.input, pr.code, tr.flex1]}
                value={clean}
                onChangeText={(t) => setCode(cleanCode(t))}
                placeholder="ABC123"
                placeholderTextColor={palette.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={open}
                accessibilityLabel="Program code"
              />
              <Pressable
                onPress={open}
                disabled={clean.length !== 6}
                style={({ pressed }) => [
                  tr.smallPill,
                  pr.go,
                  clean.length !== 6 && tr.disabled,
                  pressed && tr.pressed,
                ]}
              >
                <Text style={tr.smallPillText}>Open</Text>
              </Pressable>
            </View>
            <Text style={tr.faint}>
              Six letters and numbers, from whoever shared the program. A link
              they sent opens it directly.
            </Text>
          </Card>

          {following ? (
            <>
              <SectionLabel>Following</SectionLabel>
              <Card padded={false}>
                <ProgramRow
                  program={following.program}
                  meta={(() => {
                    const pos = data
                      ? position(
                          following.program,
                          data.workouts,
                          following.follow.startedAt,
                        )
                      : null;
                    return [
                      pos
                        ? pos.complete
                          ? 'Complete'
                          : `Week ${pos.week} of ${following.program.weeks}`
                        : null,
                      following.program.authorName
                        ? `by ${following.program.authorName}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                  })()}
                  first
                />
              </Card>
            </>
          ) : null}

          <SectionLabel>Yours</SectionLabel>
          {mine == null ? (
            failed ? (
              <Text style={tr.emptyText}>
                Couldn’t load your programs. Check your connection and try
                again.
              </Text>
            ) : (
              <ActivityIndicator color={palette.accent} />
            )
          ) : mine.length ? (
            <Card padded={false}>
              {mine.map((p, i) => {
                const n = counts.get(p.id) ?? 0;
                return (
                  <ProgramRow
                    key={p.id}
                    program={p}
                    first={i === 0}
                    meta={[
                      p.published
                        ? `Published · ${n} ${n === 1 ? 'follower' : 'followers'}`
                        : 'Draft',
                      weeksText(p),
                      daysAWeek(p),
                    ].join(' · ')}
                  />
                );
              })}
            </Card>
          ) : (
            <Card>
              <Text style={tr.emptyText}>
                Write your training down once, then share the code. Followers
                log every set against it, and anyone who chooses to share shows
                you how they’re getting on.
              </Text>
            </Card>
          )}
          <PrimaryButton
            label="Write a program"
            style={{ marginTop: space.lg }}
            onPress={() => router.navigate('/write')}
          />
        </>
      )}
    </Screen>
  );
}

function ProgramRow({
  program,
  meta,
  first,
}: {
  program: Program;
  meta: string;
  first: boolean;
}) {
  return (
    <Pressable
      onPress={() =>
        router.navigate({ pathname: '/program', params: { id: program.id } })
      }
      style={({ pressed }) => [
        tr.histRow,
        first && { borderTopWidth: 0 },
        pressed && tr.pressed,
      ]}
    >
      <View style={[tr.row, { gap: space.md }]}>
        <View style={tr.flex1}>
          <Text style={tr.histName} numberOfLines={1}>
            {program.title}
          </Text>
          <Text style={tr.histLifts} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <ChevronIcon direction="right" color={palette.textFaint} />
      </View>
    </Pressable>
  );
}

const pr = StyleSheet.create({
  code: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    borderRadius: radius.sm,
  },
  go: { paddingVertical: 13 },
});

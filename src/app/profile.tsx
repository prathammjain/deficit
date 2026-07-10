/**
 * profile.tsx — the account surface: who is signed in, the plan they built,
 * profile editing (the questionnaire), sign out, and the app version. This is
 * also the only place the user can log out. In local, no-account mode the
 * account block says so and Sign out is hidden.
 */

import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';

import { OnboardingFlow } from '@/components/onboarding-flow';
import { Monogram } from '@/components/ui/monogram';
import {
  Card,
  Eyebrow,
  Hairline,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import {
  loadProfile,
  saveProfile,
  type StoredProfile,
} from '@/lib/profile-store';
import { useAuth } from '@/lib/supabase/auth';
import {
  computeTargets,
  type ActivityLevel,
  type ProfileInput,
} from '@/lib/targets';

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  very_active: 'Very active',
};

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const p = await loadProfile();
        if (!alive) return;
        setProfile(p);
        setLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const handleComplete = useCallback(async (input: ProfileInput) => {
    const saved = await saveProfile(input);
    setProfile(saved);
    setEditing(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    // The auth gate swaps to the sign-in screen once the session clears.
    await signOut();
  }, [signOut, signingOut]);

  if (loading) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (editing && profile) {
    return (
      <OnboardingFlow
        initial={profile}
        onComplete={handleComplete}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const email = session?.user?.email ?? null;
  const t = profile ? computeTargets(profile) : null;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>
      <Eyebrow>Account</Eyebrow>
      <Title>Profile</Title>

      {/* Who — the account block */}
      <Card padded style={s.accountCard}>
        <View style={s.accountRow}>
          <Monogram letter={email} size={56} />
          <View style={s.accountText}>
            <Text style={s.accountEmail} numberOfLines={1}>
              {email ?? 'Local device'}
            </Text>
            <Text style={s.accountSub}>
              {email
                ? 'Signed in. Your data syncs to this account.'
                : 'No account. Your data stays on this device.'}
            </Text>
          </View>
        </View>
      </Card>

      {/* The plan they built */}
      <SectionLabel>Your plan</SectionLabel>
      {profile && t ? (
        <Card padded={false} style={s.planCard}>
          <PlanRow label="Age" value={`${profile.age} years`} />
          <PlanRow label="Height" value={`${profile.heightCm} cm`} />
          <PlanRow label="Weight" value={`${profile.weightKg} kg`} />
          <PlanRow
            label="Activity"
            value={ACTIVITY_LABEL[profile.activityLevel]}
          />
          <PlanRow
            label="Goal pace"
            value={`${profile.goalRateKgWeek.toFixed(2)} kg per week`}
          />
          <PlanRow
            label="Daily target"
            value={`${t.targetKcal.toLocaleString()} kcal`}
            last
          />
        </Card>
      ) : (
        <Card padded>
          <Text style={s.emptyText}>
            No profile yet. Set one up on the Home tab.
          </Text>
        </Card>
      )}

      {profile ? (
        <Pressable
          onPress={() => setEditing(true)}
          style={({ pressed }) => [s.editBtn, pressed && s.pressed]}
        >
          <Text style={s.editText}>Edit profile</Text>
        </Pressable>
      ) : null}

      {/* Leaving is not an alarm: quiet outlined button, ink text. */}
      {email ? (
        <>
          <SectionLabel>Session</SectionLabel>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ pressed }) => [s.signOutBtn, pressed && s.pressed]}
          >
            <Text style={s.signOutText}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </>
      ) : null}

      <Text style={s.version}>Deficit v{version}</Text>
    </Screen>
  );
}

function PlanRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <>
      <View style={s.planRow}>
        <Text style={s.planLabel}>{label}</Text>
        <Text style={s.planValue}>{value}</Text>
      </View>
      {!last ? <Hairline style={s.planDivider} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: space.md },
  backText: { color: palette.textMuted, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },

  accountCard: { marginTop: space.lg },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  accountText: { flex: 1, minWidth: 0 },
  accountEmail: { color: palette.text, fontSize: 16, fontWeight: '700' },
  accountSub: {
    color: palette.textFaint,
    fontSize: 12,
    marginTop: space.xxs,
    lineHeight: 17,
  },

  planCard: { overflow: 'hidden' },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
  },
  planDivider: { marginHorizontal: space.xl },
  planLabel: { ...typo.label, color: palette.textMuted },
  planValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  emptyText: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },

  editBtn: {
    marginTop: space.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  editText: { color: palette.text, fontSize: 15, fontWeight: '600' },

  signOutBtn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  signOutText: { color: palette.text, fontSize: 15, fontWeight: '600' },

  version: {
    color: palette.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: space.xxl,
  },
});

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
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';

import { goalLine, OnboardingFlow } from '@/components/onboarding-flow';
import { AddToHomeScreenButton } from '@/components/add-to-home-screen';
import { Monogram } from '@/components/ui/monogram';
import { ChevronIcon } from '@/components/ui/icons';
import {
  Card,
  Hairline,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { planLine, type Access } from '@/lib/access';
import {
  loadProfile,
  saveProfile,
  type StoredProfile,
} from '@/lib/profile-store';
import { loadRoastMode, saveRoastMode } from '@/lib/roast-setting';
import { fetchAccess } from '@/lib/supabase/access';
import { deleteMyAccount, exportMyData } from '@/lib/supabase/account';
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
  const [roastOn, setRoastOn] = useState(true);
  const [access, setAccess] = useState<Access | null>(null);
  const [dataBusy, setDataBusy] = useState<'export' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [p, roast, a] = await Promise.all([
          loadProfile(),
          loadRoastMode(),
          fetchAccess(),
        ]);
        if (!alive) return;
        setProfile(p);
        setRoastOn(roast);
        setAccess(a);
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

  const handleExport = async () => {
    if (dataBusy) return;
    setDataBusy('export');
    setDataError(null);
    try {
      const json = await exportMyData(session?.user?.email ?? null);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(
          new Blob([json], { type: 'application/json' }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = `grain_data_${new Date().toISOString().slice(0, 10).replace(/\D/g, '')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      setDataError('Couldn’t prepare your data. Check your connection.');
    }
    setDataBusy(null);
  };

  const handleDelete = async () => {
    if (dataBusy) return;
    setDataBusy('delete');
    setDataError(null);
    try {
      await deleteMyAccount();
      // The account is gone; the gate returns to the sign in screen.
      await signOut();
    } catch {
      setDataError('Couldn’t delete the account. Check your connection.');
      setDataBusy(null);
    }
  };

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
  const plan = access ? planLine(access) : null;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
        <ChevronIcon color={palette.textMuted} />
        <Text style={s.backText}>Back</Text>
      </Pressable>
      <Title>Profile</Title>

      {/* Who: the account block */}
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
            {plan ? <Text style={s.accountPlan}>{plan}</Text> : null}
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
            label="Goal"
            value={goalLine(t).replace(/^./, (c) => c.toUpperCase())}
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

      <SectionLabel>GrainAI</SectionLabel>
      <Card padded={false}>
        <Pressable
          onPress={() => {
            setRoastOn(!roastOn);
            void saveRoastMode(!roastOn);
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: roastOn }}
          style={s.planRow}
        >
          <View style={s.roastText}>
            <Text style={s.planValue}>Roasts</Text>
            <Text style={s.roastSub}>
              One brutal line from GrainAI about every meal.
            </Text>
          </View>
          <Text style={[s.roastState, roastOn && s.roastStateOn]}>
            {roastOn ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </Card>

      {access?.admin ? (
        <>
          <SectionLabel>Admin</SectionLabel>
          <Pressable
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [s.signOutBtn, pressed && s.pressed]}
          >
            <Text style={s.signOutText}>Creators, users and stats</Text>
          </Pressable>
        </>
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
              {signingOut ? 'Signing out' : 'Sign out'}
            </Text>
          </Pressable>
        </>
      ) : null}

      {email ? (
        <>
          <SectionLabel>Your data</SectionLabel>
          <Card padded={false}>
            <Pressable
              onPress={() => void handleExport()}
              disabled={dataBusy != null}
              style={({ pressed }) => [s.planRow, pressed && s.pressed]}
            >
              <View style={s.roastText}>
                <Text style={s.planValue}>Download my data</Text>
                <Text style={s.roastSub}>
                  Everything you’ve logged, in one file.
                </Text>
              </View>
              <Text style={s.roastState}>
                {dataBusy === 'export' ? 'Preparing' : 'Download'}
              </Text>
            </Pressable>
            <Hairline style={s.planDivider} />
            <Pressable
              onPress={() => setConfirmDelete(!confirmDelete)}
              disabled={dataBusy != null}
              style={({ pressed }) => [s.planRow, pressed && s.pressed]}
            >
              <View style={s.roastText}>
                <Text style={s.planValue}>Delete my account</Text>
                <Text style={s.roastSub}>
                  Removes the account and everything in it.
                </Text>
              </View>
            </Pressable>
            {confirmDelete ? (
              <View style={s.confirm}>
                <Text style={s.confirmText}>
                  This deletes your meals, weigh ins, workouts, programs and
                  your account. It can’t be undone.
                </Text>
                <View style={s.confirmRow}>
                  <Pressable
                    onPress={() => void handleDelete()}
                    disabled={dataBusy != null}
                    style={({ pressed }) => [s.dangerBtn, pressed && s.pressed]}
                  >
                    <Text style={s.dangerText}>
                      {dataBusy === 'delete' ? 'Deleting' : 'Delete everything'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirmDelete(false)}
                    style={({ pressed }) => [s.keepBtn, pressed && s.pressed]}
                  >
                    <Text style={s.keepText}>Keep my account</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Card>
          {dataError ? <Text style={s.dataError}>{dataError}</Text> : null}
        </>
      ) : null}

      <AddToHomeScreenButton />

      <Text style={s.version}>Grain v{version}</Text>
      <Text style={s.privacy}>
        Meals you describe are saved without your name, to make Grain’s
        estimates better.
      </Text>
      <View style={s.legal}>
        <Text
          style={s.legalLink}
          accessibilityRole="link"
          onPress={() => void Linking.openURL('https://getgrain.fit/terms')}
        >
          Terms
        </Text>
        <Text
          style={s.legalLink}
          accessibilityRole="link"
          onPress={() => void Linking.openURL('https://getgrain.fit/privacy')}
        >
          Privacy
        </Text>
      </View>
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
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
    marginBottom: space.md,
  },
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
  accountPlan: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: space.xs,
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
  roastText: { flex: 1, marginRight: space.lg },
  roastSub: { color: palette.textFaint, fontSize: 13, marginTop: 2 },
  roastState: { color: palette.textFaint, fontSize: 15, fontWeight: '600' },
  roastStateOn: { color: palette.accent },

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
  privacy: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: space.sm,
  },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
    marginTop: space.md,
  },
  legalLink: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },

  confirm: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
  },
  confirmText: { color: palette.text, fontSize: 14, lineHeight: 20 },
  confirmRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  dangerBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  dangerText: { color: palette.accentText, fontSize: 14, fontWeight: '700' },
  keepBtn: {
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  keepText: { color: palette.text, fontSize: 14, fontWeight: '600' },
  dataError: {
    color: palette.accent,
    fontSize: 13,
    marginTop: space.sm,
  },
});

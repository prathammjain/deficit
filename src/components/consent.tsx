/**
 * consent.tsx: shown once after sign in, before anything else. Three
 * plain confirmations, each its own tap, nothing pre ticked.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CheckIcon } from '@/components/ui/icons';
import { PrimaryButton, Screen } from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';

const TERMS_URL = 'https://getgrain.fit/terms';
const PRIVACY_URL = 'https://getgrain.fit/privacy';

/** A checkbox row with its explanation. Also used for program sharing. */
export function Check({
  on,
  onPress,
  bare,
  children,
}: {
  on: boolean;
  onPress: () => void;
  /** Without its own card, for use inside one. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      aria-checked={on}
      role="checkbox"
      style={({ pressed }) => [
        st.check,
        bare && st.checkBare,
        pressed && st.pressed,
      ]}
    >
      <View style={[st.box, on && st.boxOn]}>
        {on ? <CheckIcon size={13} color={palette.surface} /> : null}
      </View>
      <Text style={st.checkText}>{children}</Text>
    </Pressable>
  );
}

export function ConsentScreen({
  onAgree,
  onSignOut,
}: {
  /** Saves the agreement; rejects when it couldn't be saved. */
  onAgree: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = adult && terms && health && !busy;

  const link = (url: string, label: string) => (
    <Text
      style={st.link}
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
    >
      {label}
    </Text>
  );

  return (
    <Screen contentStyle={st.grow}>
      <View style={st.wrap}>
        <Text style={st.brand}>GRAIN</Text>
        <Text style={st.title}>Before you start</Text>
        <Text style={st.body}>
          Grain keeps what you log so it can work out your targets and show your
          progress. Please confirm each of these.
        </Text>

        <View style={st.checks}>
          <Check on={adult} onPress={() => setAdult(!adult)}>
            I am 18 or older.
          </Check>
          <Check on={terms} onPress={() => setTerms(!terms)}>
            I agree to the Terms and the Privacy Policy.
          </Check>
          <Check on={health} onPress={() => setHealth(!health)}>
            Grain may use my health and fitness data (body measurements, food
            and training) to give me targets and insights.
          </Check>
        </View>

        <View style={st.links}>
          {link(TERMS_URL, 'Read the Terms')}
          {link(PRIVACY_URL, 'Read the Privacy Policy')}
        </View>

        <Text style={st.note}>
          Meals you describe are stored without your name to improve Grain’s
          estimates. You can download or delete everything from Profile at any
          time.
        </Text>

        {error ? <Text style={st.error}>{error}</Text> : null}

        {busy ? (
          <ActivityIndicator color={palette.accent} style={{ marginTop: 24 }} />
        ) : (
          <PrimaryButton
            label="Agree and continue"
            disabled={!ready}
            style={st.cta}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await onAgree();
              } catch {
                setError(
                  'Couldn’t save that. Check your connection and try again.',
                );
                setBusy(false);
              }
            }}
          />
        )}

        <Pressable onPress={onSignOut} hitSlop={8} style={st.signOut}>
          <Text style={st.signOutText}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={st.footer}>
        Grain is built for adults. Anyone under 18 shouldn’t use it.
      </Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  grow: { flexGrow: 1, justifyContent: 'space-between' },
  wrap: { paddingTop: space.xxl },
  brand: { ...typo.eyebrow, color: palette.accent },
  title: { ...typo.title, color: palette.text, marginTop: space.md },
  body: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: space.md,
  },
  checks: { marginTop: space.xl, gap: space.sm },
  check: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  checkBare: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.7 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: palette.textDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: palette.text, borderColor: palette.text },
  checkText: { flex: 1, color: palette.text, fontSize: 15, lineHeight: 22 },
  links: { flexDirection: 'row', gap: space.xl, marginTop: space.lg },
  link: { color: palette.accent, fontSize: 14, fontWeight: '600' },
  note: {
    color: palette.textFaint,
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.lg,
  },
  error: { color: palette.accent, fontSize: 14, marginTop: space.md },
  cta: { marginTop: space.xl },
  signOut: { alignSelf: 'center', padding: space.md, marginTop: space.md },
  signOutText: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
  footer: {
    color: palette.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: space.xl,
  },
});

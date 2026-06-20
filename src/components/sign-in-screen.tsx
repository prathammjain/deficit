/**
 * sign-in-screen.tsx — the magic-link sign-in (white paper §13).
 * Premium, minimal: one field, one button, a calm confirmation state.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, Screen, webBlur } from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { useAuth } from '@/lib/supabase/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL_RE.test(email.trim());

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await signIn(email);
    setBusy(false);
    if (error) setError(error);
    else setSent(true);
  };

  return (
    <Screen>
      <View style={st.wrap}>
        <Text style={st.brand}>DEFICIT</Text>

        {sent ? (
          <>
            <Text style={st.title}>Check your inbox</Text>
            <Text style={st.body}>
              We sent a sign-in link to{'\n'}
              <Text style={st.email}>{email.trim()}</Text>. Open it on this
              device to continue.
            </Text>
            <Text
              style={st.resend}
              onPress={() => {
                setSent(false);
                setEmail('');
              }}
            >
              Use a different email
            </Text>
          </>
        ) : (
          <>
            <Text style={st.title}>Sign in</Text>
            <Text style={st.body}>
              Enter your email and we’ll send a magic link — no password needed.
            </Text>
            <TextInput
              style={st.input}
              placeholder="you@email.com"
              placeholderTextColor={palette.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              onSubmitEditing={submit}
            />
            {error ? <Text style={st.error}>{error}</Text> : null}
            <PrimaryButton
              label={busy ? 'Sending…' : 'Send magic link'}
              disabled={!valid || busy}
              onPress={submit}
              style={st.btn}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', minHeight: 420 },
  brand: {
    ...typo.eyebrow,
    color: palette.accent,
    marginBottom: space.xxl,
  },
  title: { ...typo.title, color: palette.text },
  body: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: space.md,
  },
  email: { color: palette.text, fontWeight: '600' },
  input: {
    marginTop: space.xxl,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    color: palette.text,
    fontSize: 16,
    ...webBlur(16),
  },
  error: { color: palette.danger, fontSize: 13, marginTop: space.md },
  btn: { marginTop: space.lg },
  resend: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: space.xxl,
  },
});

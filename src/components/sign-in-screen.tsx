/**
 * sign-in-screen.tsx — the magic-link sign-in (white paper §13).
 * Premium, minimal: one field, one button, a calm confirmation state.
 */

import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PrimaryButton, Screen } from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { useAuth } from '@/lib/supabase/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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

  // On success the browser navigates away to Google, so the busy state only
  // ever clears on an immediate failure.
  const google = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error);
      setGoogleBusy(false);
    }
  };

  return (
    <Screen contentStyle={st.grow}>
      <View style={st.wrap}>
        <Text style={st.brand}>DEFICIT</Text>
        <Text style={st.tagline}>Calorie tracking you can trust.</Text>

        {sent ? (
          <>
            <Text style={st.title}>Check your inbox</Text>
            <Text style={st.body}>
              We sent a sign-in link to{'\n'}
              <Text style={st.email}>{email.trim()}</Text>. Open it on this
              device to continue.
            </Text>
            <Text style={st.sentHint}>
              Didn’t get it? Check your spam folder.
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
            {Platform.OS === 'web' ? (
              <>
                <Pressable
                  onPress={google}
                  disabled={googleBusy}
                  style={({ pressed }) => [
                    st.googleBtn,
                    pressed && st.googlePressed,
                  ]}
                >
                  <GoogleLogo />
                  <Text style={st.googleText}>
                    {googleBusy ? 'Opening Google…' : 'Continue with Google'}
                  </Text>
                </Pressable>
                <View style={st.dividerRow}>
                  <View style={st.dividerLine} />
                  <Text style={st.dividerText}>or</Text>
                  <View style={st.dividerLine} />
                </View>
              </>
            ) : null}
            <Text style={st.body}>
              Enter your email and we’ll send a magic link. No password needed.
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
      <Text style={st.footer}>
        Deficit provides estimates, not medical advice.
      </Text>
    </Screen>
  );
}

/** The official four-colour Google "G" (branding requires the real mark). */
function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const st = StyleSheet.create({
  grow: { flexGrow: 1 },
  wrap: { flex: 1, justifyContent: 'center', minHeight: 420 },
  brand: {
    ...typo.eyebrow,
    color: palette.accent,
  },
  tagline: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginTop: space.sm,
    marginBottom: space.xxl,
  },
  sentHint: {
    color: palette.textFaint,
    fontSize: 13,
    marginTop: space.lg,
  },
  footer: {
    color: palette.textDim,
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: space.lg,
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
    borderColor: palette.hairline,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    color: palette.text,
    fontSize: 16,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm + 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    marginTop: space.xxl,
  },
  googlePressed: { opacity: 0.85 },
  googleText: { color: '#1F1F1F', fontSize: 15, fontWeight: '600' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.hairline },
  dividerText: { color: palette.textFaint, fontSize: 13 },
  error: { color: palette.danger, fontSize: 13, marginTop: space.md },
  btn: { marginTop: space.lg },
  resend: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: space.xxl,
  },
});

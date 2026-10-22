/**
 * sign-in-screen.tsx — sign in with Google (white paper §13).
 * Premium, minimal: one button.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Screen } from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { useAuth } from '@/lib/supabase/auth';

export function SignInScreen() {
  const { signInWithGoogle } = useAuth();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Text style={st.brand}>GRAIN</Text>
        <Text style={st.tagline}>
          Calorie tracking that does not lie to you.
        </Text>
        <Text style={st.pitch}>
          A hybrid engine checks AI against real food data, so every number is
          one you can trust, not one it made up.
        </Text>

        <Text style={st.title}>Sign in</Text>
        <Pressable
          onPress={google}
          disabled={googleBusy}
          style={({ pressed }) => [st.googleBtn, pressed && st.googlePressed]}
        >
          <GoogleLogo />
          <Text style={st.googleText}>
            {googleBusy ? 'Opening Google…' : 'Continue with Google'}
          </Text>
        </Pressable>
        {error ? <Text style={st.error}>{error}</Text> : null}
      </View>
      <Text style={st.footer}>
        Grain provides estimates, not medical advice.{'\n'}
        Meals you describe are saved without your name, to make Grain’s
        estimates better.
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
  },
  pitch: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.sm,
    marginBottom: space.xxl,
  },
  footer: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingBottom: space.lg,
  },
  title: { ...typo.title, color: palette.text },
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
  error: { color: palette.danger, fontSize: 13, marginTop: space.md },
});

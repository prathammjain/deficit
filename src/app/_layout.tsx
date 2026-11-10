import '@/global.css';

import {
  DefaultTheme,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ConsentScreen } from '@/components/consent';
import { SignInScreen } from '@/components/sign-in-screen';
import { PrimaryButton } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { AuthProvider, useAuth } from '@/lib/supabase/auth';
import {
  checkConsent,
  consentCached,
  recordConsent,
  sendPendingConsent,
} from '@/lib/supabase/consent';
import { StatusBar } from 'expo-status-bar';

// "Warm Instrument": light-only — bone canvas, warm ink, one orange accent.
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.accent,
    background: palette.bg,
    card: palette.surface,
    text: palette.text,
    border: palette.hairline,
  },
};

export default function RootLayout() {
  // Register the service worker on web so the browser can prompt "Add to Home Screen".
  useEffect(() => {
    if (Platform.OS !== 'web' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  // Light-only skin, fixed regardless of the device's light/dark setting.
  return (
    <AuthProvider>
      <Head>
        <title>Grain: food tracking for people who care about every gram</title>
      </Head>
      <ThemeProvider value={NavTheme}>
        <StatusBar style="dark" />
        <AnimatedSplashOverlay />
        <AuthGate>
          <AppTabs />
        </AuthGate>
      </ThemeProvider>
    </AuthProvider>
  );
}

/**
 * Any screen that crashes lands here instead of a blank page. Rendering
 * never touches stored data, so trying again is always safe.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
      }}
    >
      <Text style={{ color: palette.text, fontSize: 20, fontWeight: '700' }}>
        Something went wrong
      </Text>
      <Text
        style={{
          color: palette.textMuted,
          fontSize: 15,
          lineHeight: 22,
          textAlign: 'center',
          maxWidth: 360,
        }}
      >
        This screen hit an error. Everything you’ve logged is safe. Try again,
        and if it keeps happening, close and reopen Grain.
      </Text>
      <PrimaryButton
        label="Try again"
        onPress={() => void retry()}
        style={{ alignSelf: 'stretch', maxWidth: 360, width: '100%' }}
      />
    </View>
  );
}

/**
 * Shows the app when signed in (or when cloud accounts are off — local mode),
 * the sign-in screen when accounts are on but there's no session.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { enabled, loading, session } = useAuth();

  if (!enabled) return <>{children}</>;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!session) return <SignInScreen />;

  return <ConsentGate key={session.user.id}>{children}</ConsentGate>;
}

/**
 * Asks for consent (18+, terms and privacy, health data) once per account
 * and per consent version, before the app opens.
 */
function ConsentGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const [state, setState] = useState<'checking' | 'needed' | 'ok'>(() =>
    consentCached() ? 'ok' : 'checking',
  );

  useEffect(() => {
    if (state !== 'checking') return;
    let alive = true;
    checkConsent().then((ok) => {
      if (alive) setState(ok ? 'ok' : 'needed');
    });
    return () => {
      alive = false;
    };
  }, [state]);

  // An agreement given while the account couldn't store it goes now.
  useEffect(() => {
    void sendPendingConsent();
  }, []);

  if (state === 'ok') return <>{children}</>;
  if (state === 'needed') {
    return (
      <ConsentScreen
        onAgree={async () => {
          await recordConsent();
          setState('ok');
        }}
        onSignOut={() => void signOut()}
      />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

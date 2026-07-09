import '@/global.css';

import { DefaultTheme, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { SignInScreen } from '@/components/sign-in-screen';
import { palette } from '@/constants/palette';
import { AuthProvider, useAuth } from '@/lib/supabase/auth';

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
  // Light-only skin, fixed regardless of the device's light/dark setting.
  return (
    <AuthProvider>
      <Head>
        <title>Deficit — calorie tracking that doesn’t make up numbers</title>
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

  return <>{children}</>;
}

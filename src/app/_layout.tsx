import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { SignInScreen } from '@/components/sign-in-screen';
import { palette } from '@/constants/palette';
import { AuthProvider, useAuth } from '@/lib/supabase/auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!session) return <SignInScreen />;

  return <>{children}</>;
}

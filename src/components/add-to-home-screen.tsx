import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { palette, radius, space } from '@/constants/palette';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectIOS(): boolean {
  if (Platform.OS !== 'web') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && 'ontouchend' in window)
  );
}

/**
 * addTo-home-screen.tsx — a button that creates a home-screen shortcut to the
 * PWA. Web-only, renders nothing on native.
 *
 * - Android / Chrome: triggers the browser's native install prompt.
 * - iOS / Safari: shows a one-line instruction ("Share -> Add to Home Screen").
 * - Desktop browsers: same as Android when supported, otherwise the instruction.
 */
export function AddToHomeScreenButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const isIOS = useMemo(() => detectIOS(), []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handlePress = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
    }
  }, [deferred]);

  if (Platform.OS !== 'web') return null;
  if (installed) return null;

  // iOS / Safari: no beforeinstallprompt — show the manual instruction.
  if (isIOS && !deferred) {
    return (
      <Text style={s.iosHint}>
        {'Tap the Share button below, then "Add to Home Screen".'}
      </Text>
    );
  }

  // Android / desktop with install prompt support.
  if (deferred) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [s.btn, pressed && s.pressed]}
      >
        <Text style={s.btnText}>Add to Home Screen</Text>
      </Pressable>
    );
  }

  return null;
}

const s = StyleSheet.create({
  btn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  btnText: { color: palette.text, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  iosHint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: space.lg,
  },
});

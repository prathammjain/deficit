import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { palette, radius, space } from '@/constants/palette';
import { promptInstall, useInstallPrompt } from '@/lib/install-prompt';

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function isIOS(): boolean {
  if (!isWeb()) return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in window)
  );
}

/**
 * add-to-home-screen.tsx — a button that creates a home-screen shortcut to the
 * PWA.
 *
 * - Android / Chrome: triggers the browser's native install prompt.
 * - iOS / Safari: shows a one-line instruction ("Share -> Add to Home Screen").
 *   Safari implements no install prompt at all, so this is the only route.
 * - Desktop / unsupported: the same manual instruction.
 *
 * The prompt itself is captured at page load by an inline script in +html.tsx
 * and read through lib/install-prompt.ts. This component must not listen for
 * `beforeinstallprompt` itself: it mounts on the Profile screen, long after
 * Chrome has fired and discarded that event.
 */
export function AddToHomeScreenButton() {
  const { prompt, installed } = useInstallPrompt();

  const handlePress = useCallback(() => {
    void promptInstall();
  }, []);

  if (!isWeb() || installed) return null;

  // The browser has offered a native install prompt (Android Chrome, Edge).
  if (prompt) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [s.btn, pressed && s.pressed]}
      >
        <Text style={s.btnText}>Add to Home Screen</Text>
      </Pressable>
    );
  }

  // No prompt available — iOS, Safari, an already-dismissed prompt, or a
  // browser that does not support installing. Say how to do it by hand.
  return (
    <Text style={s.hint}>
      {isIOS()
        ? 'Tap the Share button below, then “Add to Home Screen”.'
        : 'Open in Chrome or Edge, then use the browser menu: “Install app” or “Add to Home Screen”.'}
    </Text>
  );
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
  hint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: space.lg,
  },
});

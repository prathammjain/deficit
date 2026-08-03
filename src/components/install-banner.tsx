import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { palette, radius, shadow, space, type } from '@/constants/palette';

const DISMISS_KEY = 'deficit.install-banner-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * install-banner.tsx — a floating "Add to Home Screen" banner for the PWA.
 *
 * Listens for the browser's `beforeinstallprompt` event and shows a small
 * non-intrusive banner at the bottom of the screen. Dismissal is persisted
 * in localStorage so it doesn't reappear on reload.
 *
 * Web-only — renders nothing on native.
 */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      setDeferred(null);
    }
  }, [deferred]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  }, []);

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <View style={s.banner}>
      <View style={s.content}>
        <View style={s.textWrap}>
          <Text style={s.title}>Install Deficit</Text>
          <Text style={s.subtitle}>Add to your home screen for quick access</Text>
        </View>
        <View style={s.actions}>
          <Pressable onPress={handleDismiss} style={s.dismissBtn} hitSlop={8}>
            <Text style={s.dismissText}>Not now</Text>
          </Pressable>
          <Pressable
            onPress={handleInstall}
            style={({ pressed }) => [s.installBtn, pressed && s.pressed]}
          >
            <Text style={s.installText}>Install</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
    ...shadow.raised,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  textWrap: {
    flex: 1,
    marginRight: space.md,
  },
  title: {
    ...type.heading,
    color: palette.text,
    marginBottom: 2,
  },
  subtitle: {
    ...type.label,
    color: palette.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dismissBtn: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  dismissText: {
    ...type.label,
    color: palette.textMuted,
  },
  installBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  installText: {
    color: palette.accentText,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: { opacity: 0.7 },
});

/**
 * app-lifecycle.tsx: keeps an installed Grain current. Web only.
 *
 * - Registers the service worker, always fetching sw.js fresh.
 * - On every return to the screen (and every 30 minutes while open) it
 *   asks the server which bundle is live. A new one, or a new day since
 *   the page loaded, reloads quietly when that can't interrupt anything;
 *   during a workout, sim or while typing it offers a refresh instead.
 * - Asks the browser to keep Grain's storage once installed, so offline
 *   changes waiting to sync are never evicted.
 */

import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, space } from '@/constants/palette';
import { todayKey } from '@/lib/log-store';
import { entryBundle, isLiveRoute, onResume } from '@/lib/pwa';

const CHECK_EVERY_MS = 30 * 60 * 1000;

const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
};

export function AppLifecycle() {
  const path = usePathname();
  const pathRef = useRef(path);
  const [offer, setOffer] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    navigator.serviceWorker
      ?.register('/sw.js', { updateViaCache: 'none' })
      .catch(() => {});

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) navigator.storage?.persist?.().catch(() => {});

    const loaded =
      Array.from(document.scripts)
        .map((s) => entryBundle(s.getAttribute('src') ?? ''))
        .find(Boolean) ?? null;
    const day = todayKey();
    let updateReady = false;
    let checking: Promise<void> | null = null;

    const check = () => {
      if (!loaded || updateReady) return Promise.resolve();
      checking ??= fetch('/', { cache: 'no-store' })
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          const live = entryBundle(html);
          if (live && live !== loaded) updateReady = true;
        })
        .catch(() => {
          // Offline: try again next time.
        })
        .finally(() => {
          checking = null;
        });
      return checking;
    };

    const resume = async () => {
      if (document.visibilityState !== 'visible') return;
      await check();
      const action = onResume({
        updateReady,
        dayChanged: todayKey() !== day,
        path: pathRef.current,
        typing: isTyping(),
      });
      if (action === 'reload') window.location.reload();
      else if (action === 'offer') setOffer(true);
    };

    // A page restored from the back/forward cache is a resume too.
    const pageshow = (e: PageTransitionEvent) => {
      if (e.persisted) void resume();
    };

    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', pageshow);
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      // While someone is using the app, never reload under them: offer.
      void check().then(() => {
        if (updateReady) setOffer(true);
      });
    }, CHECK_EVERY_MS);

    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', pageshow);
      clearInterval(timer);
    };
  }, []);

  if (!offer) return null;
  return (
    <View
      // Live screens keep End, Undo and the clock in their top bar.
      style={[
        styles.wrap,
        { top: insets.top + (isLiveRoute(path) ? 72 : space.sm) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        <Text style={styles.text}>A new version of Grain is ready</Text>
        <Pressable onPress={() => window.location.reload()} hitSlop={8}>
          <Text style={styles.action}>Refresh</Text>
        </Pressable>
        <Pressable onPress={() => setOffer(false)} hitSlop={8}>
          <Text style={styles.later}>Later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.text,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    maxWidth: 480,
  },
  text: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  action: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  later: { color: 'rgba(247,245,241,0.6)', fontSize: 13, fontWeight: '600' },
});

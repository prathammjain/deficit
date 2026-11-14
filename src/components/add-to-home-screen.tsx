import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AddBoxIcon,
  CheckIcon,
  CloseIcon,
  DotsIcon,
  ShareIcon,
} from '@/components/ui/icons';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import {
  maxContentWidth,
  palette,
  radius,
  space,
  type as typo,
} from '@/constants/palette';
import {
  browserLink,
  installGuide,
  isStandalone,
  promptInstall,
  useInstallPrompt,
  type InstallGuide,
} from '@/lib/install-prompt';
import { localStore } from '@/lib/kv';

/**
 * add-to-home-screen.tsx — getting Grain onto the phone's home screen.
 *
 * - Android / Chrome: one tap opens the browser's native install prompt.
 * - iPhone: Safari implements no install prompt at all, so nothing can be
 *   triggered from here. The best an app can do is ask at a moment people
 *   will see it and walk them through the taps for the browser they are
 *   actually in. That is `InstallCard` (Home) plus the steps sheet.
 * - Inside another app's browser (Instagram, Facebook): nothing can be added
 *   from there, so the sheet offers to open Grain in Safari or Chrome.
 * - Desktop / unsupported: a one line hint on Profile.
 *
 * The prompt itself is captured at page load by an inline script in +html.tsx
 * and read through lib/install-prompt.ts. This component must not listen for
 * `beforeinstallprompt` itself: it mounts long after Chrome has fired and
 * discarded that event.
 */

const ICON = { uri: '/icons/apple-touch-icon.png?v=3' };

/** Set once someone closes the Home card. This phone only, never synced. */
const DISMISSED_KEY = 'grain.install.dismissed.v1';

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function currentGuide(): InstallGuide {
  if (!isWeb()) return 'other';
  return installGuide(navigator.userAgent, 'ontouchend' in window);
}

type Step = { icon: ReactNode; before: string; bold: string; after?: string };

const ADD: Step[] = [
  {
    icon: <AddBoxIcon size={18} />,
    before: 'Scroll down and tap ',
    bold: 'Add to Home Screen',
  },
  {
    icon: <CheckIcon size={18} />,
    before: 'Tap ',
    bold: 'Add',
    after: ' at the top right',
  },
];

/** The guides that are a list of taps. */
type StepGuide = Exclude<InstallGuide, 'other' | 'ios-in-app'>;

const STEPS: Record<StepGuide, Step[]> = {
  'ios-safari': [
    {
      icon: <DotsIcon size={18} color={palette.text} />,
      before: 'Tap the ',
      bold: 'three dots',
      after: ' at the bottom of Safari',
    },
    { icon: <ShareIcon size={18} />, before: 'Tap ', bold: 'Share' },
    ...ADD,
  ],
  'ios-safari-old': [
    {
      icon: <ShareIcon size={18} />,
      before: 'Tap the ',
      bold: 'Share',
      after: ' button in Safari’s bar',
    },
    ...ADD,
  ],
  'ios-chrome': [
    {
      icon: <ShareIcon size={18} />,
      before: 'Tap the ',
      bold: 'Share',
      after: ' button in Chrome’s address bar',
    },
    ...ADD,
  ],
  'ios-other': [
    {
      icon: <DotsIcon size={18} color={palette.text} />,
      before: 'Open the browser’s ',
      bold: 'menu',
      after: ' and tap Share',
    },
    ...ADD,
  ],
};

/** What to try when the first step is not where the steps say it is. */
const FALLBACK: Record<StepGuide, string> = {
  'ios-safari': 'No three dots? Tap the Share button in Safari’s bar instead.',
  'ios-safari-old': 'The Share button is the square with an arrow pointing up.',
  'ios-chrome': 'The Share button is the square with an arrow pointing up.',
  'ios-other':
    'Not there? Open app.getgrain.fit in Safari and add it from there.',
};

/**
 * The way out of another app's browser: one tap to Safari or Chrome, at the
 * same address. Neither tap can be confirmed from the page (Safari's needs
 * iOS 17, Chrome's needs Chrome installed, and some apps block both), so the
 * manual route is always spelled out underneath.
 */
export function OpenInBrowser() {
  const open = (browser: 'safari' | 'chrome') => {
    window.location.href = browserLink(browser, window.location.href);
  };
  return (
    <View>
      <View style={s.openRow}>
        <Pressable
          onPress={() => open('safari')}
          style={({ pressed }) => [s.openBtn, pressed && s.pressed]}
        >
          <Text style={s.btnText}>Open in Safari</Text>
        </Pressable>
        <Pressable
          onPress={() => open('chrome')}
          style={({ pressed }) => [s.openBtn, pressed && s.pressed]}
        >
          <Text style={s.btnText}>Open in Chrome</Text>
        </Pressable>
      </View>
      <Text style={s.fallback}>
        Nothing happened? Tap the three dots at the top of this screen and
        choose Open in browser. Or type app.getgrain.fit into Safari or Chrome.
      </Text>
    </View>
  );
}

/** The taps, one per row, each beside the icon to look for on screen. */
function InstallSheet({
  guide,
  visible,
  onClose,
}: {
  guide: Exclude<InstallGuide, 'other'>;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={s.backdrop}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={s.sheet}>
        <View style={s.sheetHead}>
          <Image source={ICON} style={s.icon} />
          <View style={s.flex}>
            <Text style={s.title}>Add Grain to your home screen</Text>
            <Text style={s.sub}>
              {guide === 'ios-in-app'
                ? 'This app’s browser can’t do it. Open Grain in a real one first.'
                : `${STEPS[guide].length} taps. It then opens like any other app.`}
            </Text>
          </View>
        </View>
        {guide === 'ios-in-app' ? (
          <OpenInBrowser />
        ) : (
          <>
            {STEPS[guide].map((step, i) => (
              <View key={step.bold} style={s.step}>
                <Text style={s.stepNumber}>{i + 1}</Text>
                <Text style={s.stepText}>
                  {step.before}
                  <Text style={s.stepBold}>{step.bold}</Text>
                  {step.after}
                </Text>
                <View style={s.stepIcon}>{step.icon}</View>
              </View>
            ))}
            <Text style={s.fallback}>{FALLBACK[guide]}</Text>
          </>
        )}
        <PrimaryButton label="Got it" onPress={onClose} style={s.done} />
      </View>
    </Modal>
  );
}

/**
 * The ask on Home: shown to everyone who can install and has not yet, until
 * they install or close it. Profile keeps the button for later.
 */
export function InstallCard() {
  const { prompt, installed } = useInstallPrompt();
  // Hidden until storage answers, so a closed card never flashes back.
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void localStore.get(DISMISSED_KEY).then((v) => setDismissed(v != null));
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void localStore.set(DISMISSED_KEY, '1');
  }, []);

  const guide = currentGuide();
  if (dismissed || installed || isStandalone()) return null;
  // Nothing to offer here: desktop Safari, Firefox, a prompt already used.
  if (!prompt && guide === 'other') return null;

  return (
    <Card style={s.card}>
      <View style={s.sheetHead}>
        <Image source={ICON} style={s.icon} />
        <View style={s.flex}>
          <Text style={s.title}>Add Grain to your home screen</Text>
          <Text style={s.sub}>Opens like an app, one tap from your day.</Text>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={12}
          accessibilityLabel="Not now"
          style={({ pressed }) => pressed && s.pressed}
        >
          <CloseIcon />
        </Pressable>
      </View>
      <PrimaryButton
        label={prompt ? 'Install Grain' : 'Show me how'}
        onPress={() => (prompt ? void promptInstall() : setOpen(true))}
        style={s.cardButton}
      />
      {guide !== 'other' ? (
        <InstallSheet
          guide={guide}
          visible={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Card>
  );
}

/** The standing entry on Profile, for anyone who closed the Home card. */
export function AddToHomeScreenButton() {
  const { prompt, installed } = useInstallPrompt();
  const [open, setOpen] = useState(false);

  if (!isWeb() || installed || isStandalone()) return null;

  const guide = currentGuide();

  // A native install prompt (Android Chrome, Edge), or the steps on iPhone.
  if (prompt || guide !== 'other') {
    return (
      <>
        <Pressable
          onPress={() => (prompt ? void promptInstall() : setOpen(true))}
          style={({ pressed }) => [s.btn, pressed && s.pressed]}
        >
          <Text style={s.btnText}>Add to Home Screen</Text>
        </Pressable>
        {guide !== 'other' ? (
          <InstallSheet
            guide={guide}
            visible={open}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </>
    );
  }

  // No prompt available: an already dismissed prompt, or a browser that does
  // not support installing. Say how to do it by hand.
  return (
    <Text style={s.hint}>
      Open in Chrome or Edge, then use the browser menu: “Install app” or “Add
      to Home Screen”.
    </Text>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  card: { marginTop: space.xl },
  cardButton: { marginTop: space.lg },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 10 },
  title: { ...typo.value, color: palette.text },
  sub: { fontSize: 13, color: palette.textMuted, marginTop: space.xxs },

  backdrop: { flex: 1, backgroundColor: 'rgba(25,23,21,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: maxContentWidth,
    marginHorizontal: 'auto',
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xl,
    paddingBottom: space.xxl,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
  },
  stepNumber: {
    width: 24,
    height: 24,
    lineHeight: 24,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: palette.surface,
    backgroundColor: palette.text,
  },
  stepText: { flex: 1, fontSize: 15, lineHeight: 21, color: palette.textMuted },
  stepBold: { fontWeight: '700', color: palette.text },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface2,
  },
  fallback: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.textFaint,
    marginTop: space.lg,
  },
  done: { marginTop: space.lg },
  openRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  openBtn: {
    flex: 1,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
  },

  btn: {
    marginTop: space.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  btnText: { color: palette.text, fontSize: 15, fontWeight: '600' },
  hint: {
    color: palette.textFaint,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: space.xl,
  },
});

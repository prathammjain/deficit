/**
 * primitives.tsx — the small set of premium building blocks every screen uses.
 * Keeping these in one place is what makes the app feel like one product:
 * identical spacing, hairlines, radii, and the single accent everywhere.
 */

import { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import {
  maxContentWidth,
  palette,
  radius,
  shadow,
  space,
  type,
} from '@/constants/palette';

/** True only where Apple's Liquid Glass renders natively (iOS 26+). */
const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

/** Web backdrop-blur (no-op off web). `any`: these keys aren't in RN's style
 *  types, and the result is spread into both View and TextInput styles. */
export const webBlur = (px: number) =>
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${px}px)`,
        WebkitBackdropFilter: `blur(${px}px)`,
      } as any)
    : null;

/** Soft blur on the element itself — used for the decorative background blobs. */
const webFilterBlur = (px: number) =>
  Platform.OS === 'web'
    ? ({ filter: `blur(${px}px)` } as any)
    : { opacity: 0.5 };

/**
 * The soft color wash that frosted surfaces refract — blurred accent blobs
 * painted over the cream canvas (web blurs them with `filter`, native softens
 * with opacity). Sits behind every screen's content.
 */
export function GlassBackdrop() {
  return (
    <View pointerEvents="none" style={s.backdrop}>
      <View style={[s.blob, s.blobA]} />
      <View style={[s.blob, s.blobB]} />
      <View style={[s.blob, s.blobC]} />
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = <View style={[s.screenInner, contentStyle]}>{children}</View>;
  return (
    <View style={s.screenRoot}>
      <GlassBackdrop />
      <SafeAreaView style={s.flex}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
      </SafeAreaView>
    </View>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={s.eyebrow}>{String(children).toUpperCase()}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.sectionLabelWrap, style]}>
      <Text style={s.sectionLabel}>{String(children).toUpperCase()}</Text>
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[s.card, padded && s.cardPadded, style]}>{children}</View>
  );
}

/**
 * A frosted glass surface for floating chrome (tab bar, search/add bar, hero).
 * Uses Apple's Liquid Glass on iOS 26+, and a translucent + backdrop-blur
 * fallback everywhere else (the web PWA path).
 */
export function GlassSurface({
  children,
  style,
  dark = false,
  padded = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Dark glass (e.g. the bottom tab bar). */
  dark?: boolean;
  padded?: boolean;
}) {
  if (LIQUID_GLASS && !dark) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="light"
        style={[s.glassShape, padded && s.cardPadded, style]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        s.glassShape,
        dark ? s.glassFillDark : s.glassFill,
        padded && s.cardPadded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[s.hairline, style]} />;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.primaryBtn,
        disabled && s.primaryBtnDisabled,
        pressed && !disabled && s.pressed,
        style,
      ]}
    >
      <Text style={[s.primaryBtnText, disabled && s.primaryBtnTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.ghostBtn, pressed && s.pressed, style]}
    >
      <Text style={s.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({
  fraction,
  over,
  trackColor = palette.hairline,
  fillColor = palette.accent,
}: {
  fraction: number;
  over?: boolean;
  trackColor?: string;
  fillColor?: string;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={[s.track, { backgroundColor: trackColor }]}>
      <View
        style={[
          s.fill,
          {
            width: `${pct}%`,
            backgroundColor: over ? palette.danger : fillColor,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  // Opaque cream canvas; GlassBackdrop paints the color wash on top of it and
  // frosted surfaces refract that wash.
  screenRoot: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { flexGrow: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 460,
    height: 460,
    borderRadius: radius.pill,
    ...webFilterBlur(100),
  },
  blobA: { top: -160, right: -120, backgroundColor: palette.blobA },
  blobB: { top: '34%', left: -170, backgroundColor: palette.blobB },
  blobC: { bottom: -160, right: -90, backgroundColor: palette.blobC },
  screenInner: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xxxl,
    maxWidth: maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { ...type.eyebrow, color: palette.textFaint },
  title: { ...type.title, color: palette.text, marginTop: space.sm },
  sectionLabelWrap: { marginTop: space.xxl, marginBottom: space.md },
  sectionLabel: { ...type.eyebrow, color: palette.textFaint },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    ...webBlur(26),
    ...shadow.card,
  },
  cardPadded: { padding: space.xl },
  glassShape: { borderRadius: radius.lg, ...shadow.card },
  glassFill: {
    backgroundColor: palette.glass,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    ...webBlur(20),
  },
  glassFillDark: {
    backgroundColor: palette.glassDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...webBlur(24),
  },
  hairline: { height: 1, backgroundColor: palette.hairline },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    // accent glow instead of a drop shadow — reads premium on dark
    shadowColor: palette.accent,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryBtnDisabled: {
    backgroundColor: palette.surface2Solid,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: palette.accentText,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryBtnTextDisabled: { color: palette.textFaint },
  ghostBtn: {
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: palette.textMuted, fontSize: 15, fontWeight: '500' },
  pressed: { opacity: 0.75 },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius.pill },
});

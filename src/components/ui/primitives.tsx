/**
 * primitives.tsx — the small set of premium building blocks every screen uses.
 * Keeping these in one place is what makes the app feel like one product:
 * identical spacing, hairlines, radii, and the single accent everywhere.
 */

import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { maxContentWidth, palette, radius, space, type } from '@/constants/palette';

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <View style={[s.screenInner, contentStyle]}>{children}</View>
  );
  return (
    <View style={s.screenRoot}>
      <SafeAreaView style={s.flex}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
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
      ]}>
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
      style={({ pressed }) => [s.ghostBtn, pressed && s.pressed, style]}>
      <Text style={s.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({
  fraction,
  over,
  trackColor = palette.bg,
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
          { width: `${pct}%`, backgroundColor: over ? palette.danger : fillColor },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  screenRoot: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { flexGrow: 1 },
  screenInner: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
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
    borderColor: palette.hairline,
  },
  cardPadded: { padding: space.xl },
  hairline: { height: 1, backgroundColor: palette.hairline },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: palette.surface2 },
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

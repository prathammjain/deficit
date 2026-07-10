/**
 * primitives.tsx — the small set of building blocks every screen uses.
 * Keeping these in one place is what makes the app feel like one product:
 * identical spacing, hairlines, radii, and the single accent everywhere.
 *
 * Skin: "Warm Instrument" — soft outlined warm-white cards on a bone canvas,
 * one orange action pill, thin tracks, dot-matrix hero numerals (DotMatrix).
 */

import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  maxContentWidth,
  palette,
  radius,
  shadow,
  space,
  type,
} from '@/constants/palette';

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

/**
 * Hero numeral in the dot-matrix display face (Doto, loaded in global.css).
 * Use for the few signature numbers only — everything else stays Inter.
 */
export function DotMatrix({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      // RN-web renders dataSet as data-* attributes; CSS keys off [data-font].
      {...({ dataSet: { font: 'doto' } } as any)}
      style={[s.dotMatrix, style]}
    >
      {children}
    </Text>
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
 * The raised surface for headline cards and floating chrome (hero, search
 * bar, tab bar). Same outlined-card language as Card, one step more lifted.
 */
export function GlassSurface({
  children,
  style,
  padded = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[s.raised, padded && s.cardPadded, style]}>{children}</View>
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

export function ProgressBar({
  fraction,
  over,
  trackColor = palette.surface2,
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
  screenRoot: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { flexGrow: 1 },
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
  dotMatrix: { ...type.hero, color: palette.text },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.hairline,
    ...shadow.soft,
  },
  cardPadded: { padding: space.xl },
  raised: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.hairline,
    ...shadow.card,
  },
  hairline: { height: 1, backgroundColor: palette.hairline },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  primaryBtnDisabled: {
    backgroundColor: palette.surface2,
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
  pressed: { opacity: 0.7 },
  track: {
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: radius.pill },
});

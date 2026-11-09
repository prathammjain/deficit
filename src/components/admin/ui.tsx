/**
 * ui.tsx: the few pieces the admin screens share. Same skin as the rest of
 * Grain: inset wells for inputs, hairline cards, ink for what is selected,
 * orange only where something needs attention.
 */

import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ChevronIcon } from '@/components/ui/icons';
import { palette, radius, space, type as typo } from '@/constants/palette';
import { addDays } from '@/lib/admin/format';
import { shortDate } from '@/lib/date';

/** A readable message from whatever was thrown (Postgrest errors included). */
export function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' ? m : 'Something went wrong.';
}

/** Text tabs, ink when selected: the section switch and list filters. */
export function TextTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={ui.tabsRow}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={ui.tab}
        >
          <Text style={[ui.tabText, o.value === value && ui.tabTextOn]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Pills for picking one option. Pass null as value for none selected. */
export function Chips<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View style={ui.chipsRow}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[ui.chip, on && ui.chipOn]}
          >
            <Text style={[ui.chipText, on && ui.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  style,
  ...input
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[ui.field, style]}>
      {label ? <Text style={ui.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={palette.textDim}
        autoCorrect={false}
        {...input}
        style={[ui.input, input.multiline && ui.inputMulti]}
      />
    </View>
  );
}

/** The outlined pill for secondary actions. */
export function QuietButton({
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
        ui.quiet,
        disabled && ui.disabled,
        pressed && ui.pressed,
        style,
      ]}
    >
      <Text style={ui.quietText}>{label}</Text>
    </Pressable>
  );
}

export function ErrorLine({ text }: { text: string | null }) {
  return text ? <Text style={ui.error}>{text}</Text> : null;
}

export function Loading() {
  return (
    <View style={ui.loading}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

/**
 * A day, stepped one at a time, with a few jumps back. No typing, so no
 * date formats to get wrong.
 */
export function DayPicker({
  value,
  today,
  onChange,
}: {
  value: string;
  today: string;
  onChange: (day: string) => void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={ui.dayRow}>
        <Pressable
          onPress={() => onChange(addDays(value, -1))}
          hitSlop={10}
          accessibilityLabel="A day earlier"
        >
          <ChevronIcon color={palette.textMuted} />
        </Pressable>
        <Text style={ui.dayText}>{shortDate(value)}</Text>
        <Pressable
          onPress={() => onChange(addDays(value, 1))}
          disabled={value >= today}
          hitSlop={10}
          accessibilityLabel="A day later"
          style={value >= today && ui.disabled}
        >
          <ChevronIcon color={palette.textMuted} direction="right" />
        </Pressable>
      </View>
      <Chips
        options={[
          { value: today, label: 'Today' },
          { value: addDays(today, -7), label: 'A week ago' },
          { value: addDays(today, -30), label: 'A month ago' },
        ]}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

/** A label over a strong value, for stat rows. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={ui.stat}>
      <Text style={ui.statLabel}>{label}</Text>
      <Text style={ui.statValue}>{value}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.xl,
    rowGap: space.sm,
    marginTop: space.lg,
  },
  tab: { paddingVertical: space.xs },
  tabText: { color: palette.textFaint, fontSize: 15, fontWeight: '600' },
  tabTextOn: { color: palette.text },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    backgroundColor: palette.surface,
  },
  chipOn: { backgroundColor: palette.text, borderColor: palette.text },
  chipText: { color: palette.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: palette.surface },

  field: { gap: space.xs },
  fieldLabel: { ...typo.label, color: palette.textMuted },
  input: {
    minWidth: 0,
    backgroundColor: palette.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: palette.text,
    fontSize: 15,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },

  quiet: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  quietText: { color: palette.text, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },

  error: { color: palette.danger, fontSize: 13, lineHeight: 18 },
  loading: { paddingVertical: space.xxl, alignItems: 'center' },

  stat: { flex: 1, minWidth: 0, gap: space.xxs },
  statLabel: { ...typo.label, color: palette.textMuted },
  statValue: {
    ...typo.value,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },

  // Shared layout bits for the admin views.
  card: { marginTop: space.md, gap: space.md },
  cardTitle: { ...typo.eyebrow, color: palette.textFaint },
  big: { ...typo.stat, color: palette.text, fontVariant: ['tabular-nums'] },
  line: { color: palette.text, fontSize: 14, lineHeight: 20 },
  sub: { color: palette.textFaint, fontSize: 13, lineHeight: 18 },
  caption: { color: palette.textFaint, fontSize: 12 },
  statRow: { flexDirection: 'row', gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  badge: { color: palette.accent, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dayText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 110,
    textAlign: 'center',
  },
});

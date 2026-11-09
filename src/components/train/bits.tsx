/**
 * bits.tsx: the small controls the training screens share.
 */

import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { ChevronIcon } from '@/components/ui/icons';
import { palette } from '@/constants/palette';
import { addDays } from '@/lib/train/progress';
import { formatKg } from '@/lib/train/workout';

import { tr } from './styles';

/** Keeps "80 × 8" on one line when a list of sets wraps. */
export const nb = (text: string) => text.replace(/ /g, '\u00A0');

export function Chip({
  label,
  on,
  danger,
  disabled,
  onPress,
}: {
  label: string;
  on?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      aria-selected={!!on}
      aria-disabled={!!disabled}
      style={({ pressed }) => [
        tr.chip,
        on && tr.chipOn,
        disabled && tr.disabled,
        pressed && tr.pressed,
      ]}
    >
      <Text style={[tr.chipText, on && tr.chipTextOn, danger && tr.chipDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Text tabs: the active one in ink, the rest faint. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={tr.tabs} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onChange(o.id)}
          hitSlop={6}
          accessibilityRole="tab"
          aria-selected={o.id === value}
          style={tr.tab}
        >
          <Text style={[tr.tabText, o.id === value && tr.tabTextActive]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A label under a strong value. */
export function Stat({
  value,
  label,
  flex = 1,
}: {
  value: string;
  label: string;
  /** Share of the row, for values that run long ("13,935 kg"). */
  flex?: number;
}) {
  return (
    <View style={[tr.stat, { flex }]}>
      <Text style={tr.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={tr.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * A day, stepped with the arrows. Yesterday is one tap back; tapping the
 * day itself jumps back to today.
 */
export function DayStepper({
  value,
  today,
  onChange,
}: {
  value: string;
  today: string;
  onChange: (day: string) => void;
}) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
  });
  const named =
    value === today
      ? 'Today'
      : value === addDays(today, -1)
        ? 'Yesterday'
        : null;
  return (
    <View style={[tr.row, { justifyContent: 'space-between' }]}>
      <Pressable
        onPress={() => onChange(addDays(value, -1))}
        hitSlop={8}
        accessibilityLabel="A day earlier"
        style={({ pressed }) => [
          tr.iconBtn,
          tr.iconBtnRing,
          pressed && tr.pressed,
        ]}
      >
        <ChevronIcon color={palette.text} />
      </Pressable>
      <Pressable
        onPress={() => onChange(today)}
        disabled={value === today}
        accessibilityLabel={
          value === today ? 'Today' : `${date}, tap for today`
        }
        style={{ alignItems: 'center' }}
      >
        <Text style={tr.strong}>{named ?? date}</Text>
        <Text style={tr.faint}>{named ? date : 'Back to today'}</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(addDays(value, 1))}
        disabled={value >= today}
        hitSlop={8}
        accessibilityLabel="A day later"
        style={({ pressed }) => [
          tr.iconBtn,
          tr.iconBtnRing,
          value >= today && tr.disabled,
          pressed && tr.pressed,
        ]}
      >
        <ChevronIcon color={palette.text} direction="right" />
      </Pressable>
    </View>
  );
}

/**
 * A number box that lets you type "62." on the way to "62.5". It shows the
 * stored value until focused, then the text as typed.
 */
export function NumField({
  value,
  placeholder,
  decimal = false,
  label,
  style,
  maxLength,
  onChange,
}: {
  value: number | null;
  placeholder?: string;
  decimal?: boolean;
  label: string;
  style?: StyleProp<TextStyle>;
  /** Characters allowed; 6 for decimals and 3 otherwise unless set. */
  maxLength?: number;
  onChange: (n: number | null) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value == null ? '' : formatKg(value));
  return (
    <TextInput
      value={shown}
      placeholder={placeholder}
      placeholderTextColor={palette.textFaint}
      inputMode={decimal ? 'decimal' : 'numeric'}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      maxLength={maxLength ?? (decimal ? 6 : 3)}
      accessibilityLabel={label}
      onFocus={() => setText(shown)}
      onBlur={() => setText(null)}
      onChangeText={(t) => {
        const clean = decimal
          ? t
              .replace(',', '.')
              .replace(/[^0-9.]/g, '')
              .replace(/(\..*)\./g, '$1')
          : t.replace(/[^0-9]/g, '');
        setText(clean);
        const n = clean === '' || clean === '.' ? null : Number(clean);
        onChange(n != null && Number.isFinite(n) ? n : null);
      }}
      style={style}
    />
  );
}

import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { fonts, palettes, type Palette } from '@/lib/theme';
import { useStore } from '@/state/store';

export function usePalette(): Palette {
  return palettes[useStore().settings.theme];
}

type Weight = keyof typeof fonts;

interface AppTextProps extends TextProps {
  weight?: Weight;
  size?: number;
  muted?: boolean;
  color?: string;
}

/** Text that always uses Open Sans and the current palette. */
export function AppText({ weight = 'regular', size = 15, muted, color, style, ...rest }: AppTextProps) {
  const p = usePalette();
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts[weight], fontSize: size, color: color ?? (muted ? p.muted : p.text) }, style]}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }, style]}>{children}</View>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <View style={styles.field}>
      <AppText weight="semibold" size={13} muted style={styles.label}>
        {label}
      </AppText>
      {children}
      {hint ? (
        <AppText size={12} muted style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Input({ style, ...rest }: TextInputProps) {
  const p = usePalette();
  return (
    <TextInput
      placeholderTextColor={p.muted}
      {...rest}
      style={[
        styles.input,
        { backgroundColor: p.card, borderColor: p.border, color: p.text, fontFamily: fonts.regular },
        style,
      ]}
    />
  );
}

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = 'primary', style, disabled, ...rest }: ButtonProps) {
  const p = usePalette();
  const bg = variant === 'primary' ? p.primary : 'transparent';
  const fg = variant === 'primary' ? p.onPrimary : variant === 'danger' ? p.danger : p.primary;
  const border = variant === 'primary' ? p.primary : variant === 'danger' ? p.danger : p.border;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <AppText weight="semibold" color={fg}>
        {title}
      </AppText>
    </Pressable>
  );
}

/** Row of mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={[styles.segmented, { borderColor: p.border, backgroundColor: p.card }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: p.primary }]}
          >
            <AppText weight="semibold" size={14} color={selected ? p.onPrimary : p.text}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? p.primary : p.border, backgroundColor: selected ? p.chip : p.card },
      ]}
    >
      <AppText size={14} weight={selected ? 'semibold' : 'regular'} color={selected ? p.primary : p.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  field: { marginBottom: 18 },
  label: { marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
});

import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import type { ThemeMode } from './types';

export const fonts = {
  regular: 'OpenSans_400Regular',
  semibold: 'OpenSans_600SemiBold',
  bold: 'OpenSans_700Bold',
} as const;

export interface Palette {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
  chip: string;
}

export const palettes: Record<ThemeMode, Palette> = {
  light: {
    background: '#F4F5F7',
    card: '#FFFFFF',
    text: '#1B1D21',
    muted: '#6B7280',
    border: '#E3E5E8',
    primary: '#0F7B6C',
    onPrimary: '#FFFFFF',
    danger: '#C62828',
    chip: '#E8F3F1',
  },
  dark: {
    background: '#111315',
    card: '#1C1F22',
    text: '#ECEEF0',
    muted: '#9AA1A9',
    border: '#2C3035',
    primary: '#3CC2AC',
    onPrimary: '#0B1F1C',
    danger: '#EF6A6A',
    chip: '#1E3531',
  },
};

/** React Navigation theme so headers and the tab bar follow the palette and use Open Sans. */
export function navigationTheme(mode: ThemeMode): Theme {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const p = palettes[mode];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: p.primary,
      background: p.background,
      card: p.card,
      text: p.text,
      border: p.border,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' },
      medium: { fontFamily: fonts.semibold, fontWeight: '600' },
      bold: { fontFamily: fonts.bold, fontWeight: '700' },
      heavy: { fontFamily: fonts.bold, fontWeight: '700' },
    },
  };
}

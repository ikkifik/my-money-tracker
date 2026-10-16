import {
  OpenSans_400Regular,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  useFonts,
} from '@expo-google-fonts/open-sans';
import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DialogProvider } from '@/components/Dialog';
import { fonts, navigationTheme } from '@/lib/theme';
import { StoreProvider, useStore } from '@/state/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}

function AppShell() {
  const { ready, settings } = useStore();
  const [fontsLoaded, fontError] = useFonts({ OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold });
  const loaded = ready && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={navigationTheme(settings.theme)}>
      <DialogProvider>
        <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerTitleStyle: { fontFamily: fonts.semibold }, headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="expense/new" options={{ title: 'New expense', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="expense/[id]" options={{ title: 'Expense details' }} />
          <Stack.Screen name="report/[month]" options={{ title: 'Monthly report' }} />
          <Stack.Screen name="expense/edit/[id]" options={{ title: 'Edit expense', animation: 'slide_from_bottom' }} />
        </Stack>
      </DialogProvider>
    </ThemeProvider>
  );
}

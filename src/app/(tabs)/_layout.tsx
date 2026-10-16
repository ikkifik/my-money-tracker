import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { usePalette } from '@/components/ui';
import { fonts } from '@/lib/theme';

export default function TabLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: p.primary,
        tabBarInactiveTintColor: p.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold },
        headerTitleStyle: { fontFamily: fonts.semibold },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Expenses',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add expense"
              hitSlop={8}
              onPress={() => router.push('/expense/new')}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="add-circle-outline" size={26} color={p.primary} />
            </Pressable>
          ),
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="wallet-outline" size={size} color={focused ? p.primary : p.muted} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="settings-outline" size={size} color={focused ? p.primary : p.muted} />
          ),
        }}
      />
    </Tabs>
  );
}

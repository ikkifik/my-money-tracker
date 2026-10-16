import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button } from './ui';

export function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <AppText weight="semibold" size={17}>
        This expense no longer exists.
      </AppText>
      <Button title="Back to expenses" variant="secondary" onPress={() => router.dismissTo('/')} />
    </View>
  );
}

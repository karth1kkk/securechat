import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { preferencesService, DEFAULT_THEME } from '../services/preferencesService';
import { sessionService } from '../services/sessionService';
import { pinService } from '../services/pinService';
import { sentMessagePlaintextService } from '../services/sentMessagePlaintextService';
import { threadCachePersistence } from '../services/threadCachePersistence';
import { useTheme } from '../theme/ThemeContext';

const BULLETS = [
  'Display name, profile photo, and theme preferences',
  'Cached threads and message previews stored on this device',
  'Your secure session, encryption keys, and JWT',
  'App PIN used to unlock SecureChat'
];

function showNotice(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export const ClearDataScreen: React.FC = () => {
  const { palette } = useTheme();
  const [busy, setBusy] = useState(false);

  const performClear = async () => {
    setBusy(true);
    try {
      await AsyncStorage.clear();
      await preferencesService.setUsername(null);
      await preferencesService.setThemePreference(DEFAULT_THEME);
      await sentMessagePlaintextService.clear();
      await threadCachePersistence.clearAll();
      await sessionService.clearSession();
      await pinService.clearPin();
      await preferencesService.clearProfilePhoto();
      showNotice(
        'All data cleared',
        'Close and reopen the app (or refresh the browser tab on web) to create a new session.'
      );
    } catch (error) {
      console.error('Clear data failed', error);
      showNotice('Unable to clear data', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm(
        'Clear all local data?\n\nThis cannot be undone. You will need to set up the app again.'
      );
      if (ok) {
        void performClear();
      }
      return;
    }
    Alert.alert(
      'Clear all local data?',
      'This cannot be undone. You will need to set up the app again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear everything', style: 'destructive', onPress: () => void performClear() }
      ]
    );
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 32, backgroundColor: palette.background }}
    >
      <Text className="mb-3 text-base leading-6" style={{ color: palette.text }}>
        Clearing data removes everything SecureChat keeps on this device. Your contacts on the server are not deleted,
        but you will lose access to this session until you register again.
      </Text>
      <Text className="mb-4 text-sm font-semibold" style={{ color: palette.muted }}>
        This will remove:
      </Text>
      {BULLETS.map((line) => (
        <View key={line} className="mb-2 flex-row">
          <Text className="mr-2" style={{ color: palette.action }}>
            •
          </Text>
          <Text className="flex-1 text-sm leading-5" style={{ color: palette.muted }}>
            {line}
          </Text>
        </View>
      ))}
      <Pressable
        className="mt-8 items-center rounded-xl py-4"
        style={{ backgroundColor: '#dc2626', opacity: busy ? 0.6 : 1 }}
        onPress={confirm}
        disabled={busy}
      >
        <Text className="font-semibold text-white">{busy ? 'Clearing…' : 'Clear all local data'}</Text>
      </Pressable>
    </ScrollView>
  );
};

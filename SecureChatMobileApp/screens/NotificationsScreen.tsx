import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import {
  preferencesService,
  NotificationPreferences,
  DEFAULT_NOTIFICATIONS
} from '../services/preferencesService';
import { useTheme } from '../theme/ThemeContext';

export const NotificationsScreen: React.FC = () => {
  const { palette } = useTheme();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);

  useEffect(() => {
    preferencesService.getNotificationPreferences().then(setPrefs);
  }, []);

  const patch = async (partial: Partial<NotificationPreferences>) => {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    await preferencesService.setNotificationPreferences(partial);
  };

  return (
    <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-2 text-2xl font-semibold" style={{ color: palette.text }}>
        Notifications
      </Text>
      <Text className="mb-6 text-sm leading-5" style={{ color: palette.muted }}>
        Choose how alerts behave. Push delivery will connect here in a future update; your choices are saved on this
        device.
      </Text>

      <View
        className="mb-4 rounded-[20px] p-5"
        style={{
          backgroundColor: palette.surface,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 25,
          elevation: 8
        }}
      >
        <View className="mb-5 flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-base font-semibold" style={{ color: palette.text }}>
              Push alerts
            </Text>
            <Text className="mt-1 text-[13px]" style={{ color: palette.muted }}>
              When enabled, we will request permission once push is supported.
            </Text>
          </View>
          <Switch
            value={prefs.pushAlerts}
            onValueChange={(v) => void patch({ pushAlerts: v })}
            thumbColor="#fff"
            trackColor={{ false: '#37576b', true: '#a5b4fc' }}
          />
        </View>
        <View className="mb-5 flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-base font-semibold" style={{ color: palette.text }}>
              In-app sounds
            </Text>
            <Text className="mt-1 text-[13px]" style={{ color: palette.muted }}>
              Play a sound for new activity while the app is open.
            </Text>
          </View>
          <Switch
            value={prefs.soundInApp}
            onValueChange={(v) => void patch({ soundInApp: v })}
            thumbColor="#fff"
            trackColor={{ false: '#37576b', true: '#a5b4fc' }}
          />
        </View>
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-base font-semibold" style={{ color: palette.text }}>
              Show message preview
            </Text>
            <Text className="mt-1 text-[13px]" style={{ color: palette.muted }}>
              When notifications are shown, include sender or snippet text.
            </Text>
          </View>
          <Switch
            value={prefs.showMessagePreview}
            onValueChange={(v) => void patch({ showMessagePreview: v })}
            thumbColor="#fff"
            trackColor={{ false: '#37576b', true: '#a5b4fc' }}
          />
        </View>
      </View>
    </View>
  );
};

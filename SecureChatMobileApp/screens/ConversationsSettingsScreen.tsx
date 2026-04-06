import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export const ConversationsSettingsScreen: React.FC = () => {
  const { palette } = useTheme();
  return (
    <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-4 text-2xl font-semibold" style={{ color: palette.text }}>
        Conversations
      </Text>
      <View className="rounded-2xl border p-[18px]" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
        <Text className="text-sm leading-5" style={{ color: palette.muted }}>
          Auto-delete policies coming soon so you can control.
        </Text>
      </View>
    </View>
  );
};

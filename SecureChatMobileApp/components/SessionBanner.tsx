import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  sessionId: string;
  displayName?: string | null;
}

export const SessionBanner: React.FC<Props> = ({ sessionId, displayName }) => {
  const { palette } = useTheme();
  const compact = `${sessionId.slice(0, 6)}…${sessionId.slice(-6)}`;
  const label = displayName ? 'Display name' : 'Session ID';
  const value = displayName ?? compact;

  return (
    <View
      className="mb-4 rounded-xl border p-3"
      style={{ backgroundColor: palette.card, borderColor: palette.border }}
    >
      <Text className="text-xs" style={{ color: palette.muted }}>
        {label}
      </Text>
      <Text className="mt-1 text-base font-semibold" style={{ color: palette.text }}>
        {value}
      </Text>
    </View>
  );
};

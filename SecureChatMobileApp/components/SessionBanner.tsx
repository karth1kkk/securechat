import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
    <View style={[styles.container, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.session, { color: palette.text }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1
  },
  label: {
    fontSize: 12
  },
  session: {
    fontSize: 16,
    marginTop: 4,
    fontWeight: '600'
  }
});

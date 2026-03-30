import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export const ConversationsSettingsScreen: React.FC = () => {
  const { palette } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <Text style={[styles.heading, { color: palette.text }]}>Conversations</Text>
      <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
        <Text style={[styles.body, { color: palette.muted }]}>Auto-delete policies coming soon so you can control.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18
  },
  body: {
    fontSize: 14,
    lineHeight: 20
  }
});

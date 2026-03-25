import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  sessionId: string;
}

export const SessionBanner: React.FC<Props> = ({ sessionId }) => {
  const compact = `${sessionId.slice(0, 6)}…${sessionId.slice(-6)}`;
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Session ID</Text>
      <Text style={styles.session}>{compact}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16
  },
  label: {
    fontSize: 12,
    color: '#a0a0a0'
  },
  session: {
    fontSize: 16,
    color: '#ffffff',
    marginTop: 4
  }
});

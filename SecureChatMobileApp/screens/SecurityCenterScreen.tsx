import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { sessionService, SessionRecord } from '../services/sessionService';
import { encryptionService } from '../services/encryptionService';

export const SecurityCenterScreen: React.FC = () => {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    sessionService.getSession().then(setSession);
  }, []);

  const rotateKeys = async () => {
    const current = await sessionService.getSession();
    if (!current) {
      return;
    }
    const keys = encryptionService.generateSessionKeys();
    const updated = { ...current, publicKey: keys.publicKey, privateKey: keys.privateKey, createdAt: Date.now() };
    await sessionService.updateSession(updated);
    setSession(updated);
    setFeedback('Keys rotated locally. Upload the new public key to the backend when ready.');
  };

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading security details…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Security Center</Text>
      <Text style={styles.label}>Session ID</Text>
      <Text style={styles.value}>{session.sessionId}</Text>
      <Text style={styles.label}>Public Key</Text>
      <Text style={styles.value}>{session.publicKey.slice(0, 40)}…</Text>
      <Text style={styles.label}>Device</Text>
      <Text style={styles.value}>{session.deviceName}</Text>
      <Text style={styles.label}>Created At</Text>
      <Text style={styles.value}>{new Date(session.createdAt).toLocaleString()}</Text>
      <Pressable style={styles.button} onPress={rotateKeys}>
        <Text style={styles.buttonText}>Rotate Keys</Text>
      </Pressable>
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#0b0b0d',
    flexGrow: 1
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    marginBottom: 16
  },
  label: {
    color: '#a0a0a0',
    marginTop: 16
  },
  value: {
    color: '#ffffff',
    marginTop: 4
  },
  button: {
    marginTop: 24,
    backgroundColor: '#1a9cff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  feedback: {
    color: '#8efc8d',
    marginTop: 12
  },
  text: {
    color: '#ffffff'
  }
});

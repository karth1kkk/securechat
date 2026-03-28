import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { sessionService, SessionRecord } from '../services/sessionService';
import { encryptionService } from '../services/encryptionService';
import { apolloClient } from '../graphql/client';
import { REGISTER_ANONYMOUS } from '../graphql/mutations';
import { useTheme } from '../theme/ThemeContext';
import { preferencesService } from '../services/preferencesService';
import { SessionBanner } from '../components/SessionBanner';

export const SecurityCenterScreen: React.FC = () => {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [feedback, setFeedback] = useState('');
  const [localUsername, setLocalUsername] = useState<string | null>(null);
  const { palette } = useTheme();

  useEffect(() => {
    sessionService.getSession().then(setSession);
    preferencesService.getUsername().then(setLocalUsername);
  }, []);

  const rotateKeys = async () => {
    const current = await sessionService.getSession();
    if (!current) {
      return;
    }
    const keys = encryptionService.generateSessionKeys();
    const updatedLocal: SessionRecord = { ...current, publicKey: keys.publicKey, privateKey: keys.privateKey, createdAt: Date.now() };
    await sessionService.updateSession(updatedLocal);
    setSession(updatedLocal);
    setFeedback('Uploading new public key…');

    try {
      const { data } = await apolloClient.mutate<
        { registerAnonymous: { userId: string; sessionId: string; publicKey: string; token: string } },
        { input: { publicKey: string; deviceName: string } }
      >({
        mutation: REGISTER_ANONYMOUS,
        variables: {
          input: {
            publicKey: updatedLocal.publicKey,
            deviceName: updatedLocal.deviceName
          }
        },
        fetchPolicy: 'no-cache'
      });

      const result = data?.registerAnonymous;
      if (!result) {
        setFeedback('Keys rotated locally, but upload failed. Try again.');
        return;
      }

      const updatedRemote: SessionRecord = {
        ...updatedLocal,
        sessionId: result.sessionId,
        publicKey: result.publicKey,
        jwtToken: result.token
      };
      await sessionService.updateSession(updatedRemote);
      setSession(updatedRemote);
      setFeedback('Keys rotated and uploaded. New public key is active.');
    } catch (e) {
      console.error('Key upload failed', e);
      setFeedback('Keys rotated locally, but upload failed. Try again.');
    }
  };

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={[styles.text, { color: palette.text }]}>Loading security details…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      {/* <Text style={[styles.title, { color: palette.text }]}>Security Center</Text> */}
      <SessionBanner sessionId={session.sessionId} displayName={localUsername} />
      <Text style={[styles.label, { color: palette.muted }]}>Session ID</Text>
      <Text style={[styles.value, { color: palette.text }]}>{session.sessionId}</Text>
      <Text style={[styles.label, { color: palette.muted }]}>Public Key</Text>
      <Text style={[styles.value, { color: palette.text }]}>{session.publicKey.slice(0, 40)}…</Text>
      <Text style={[styles.label, { color: palette.muted }]}>Device</Text>
      <Text style={[styles.value, { color: palette.text }]}>{session.deviceName}</Text>
      <Text style={[styles.label, { color: palette.muted }]}>Created At</Text>
      <Text style={[styles.value, { color: palette.text }]}>{new Date(session.createdAt).toLocaleString()}</Text>
      <Pressable style={[styles.button, { backgroundColor: palette.action }]} onPress={rotateKeys}>
        <Text style={[styles.buttonText, { color: '#ffffff' }]}>Rotate Keys</Text>
      </Pressable>
      {feedback ? <Text style={[styles.feedback, { color: palette.action }]}>{feedback}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1
  },
  title: {
    fontSize: 24,
    marginBottom: 16
  },
  label: {
    marginTop: 16
  },
  value: {
    marginTop: 4
  },
  button: {
    marginTop: 24,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center'
  },
  buttonText: {
    fontWeight: '600'
  },
  feedback: {
    marginTop: 12,
    fontSize: 14
  },
  text: {
    fontSize: 16
  }
});

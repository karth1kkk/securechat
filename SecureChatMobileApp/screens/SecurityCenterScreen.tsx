import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
      <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
        <Text className="text-base" style={{ color: palette.text }}>
          Loading security details…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, padding: 16, backgroundColor: palette.background }}>
      <SessionBanner sessionId={session.sessionId} displayName={localUsername} />
      <Text className="mt-4 text-sm" style={{ color: palette.muted }}>
        Session ID
      </Text>
      <Text className="mt-1" style={{ color: palette.text }}>
        {session.sessionId}
      </Text>
      <Text className="mt-4 text-sm" style={{ color: palette.muted }}>
        Public Key
      </Text>
      <Text className="mt-1" style={{ color: palette.text }}>
        {session.publicKey.slice(0, 40)}…
      </Text>
      <Text className="mt-4 text-sm" style={{ color: palette.muted }}>
        Device
      </Text>
      <Text className="mt-1" style={{ color: palette.text }}>
        {session.deviceName}
      </Text>
      <Text className="mt-4 text-sm" style={{ color: palette.muted }}>
        Created At
      </Text>
      <Text className="mt-1" style={{ color: palette.text }}>
        {new Date(session.createdAt).toLocaleString()}
      </Text>
      <Pressable className="mt-6 items-center rounded-xl p-3.5" style={{ backgroundColor: palette.action }} onPress={rotateKeys}>
        <Text className="font-semibold text-white">Rotate Keys</Text>
      </Pressable>
      {feedback ? (
        <Text className="mt-3 text-sm" style={{ color: palette.action }}>
          {feedback}
        </Text>
      ) : null}
    </ScrollView>
  );
};

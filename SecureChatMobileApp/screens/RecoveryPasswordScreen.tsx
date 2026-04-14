import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { sessionService, SessionRecord } from '../services/sessionService';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'RecoveryPassword'>;

export const RecoveryPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { palette } = useTheme();
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    sessionService.getSession().then(setSession);
  }, []);

  const copySessionId = async () => {
    if (!session?.sessionId) {
      return;
    }
    await Clipboard.setStringAsync(session.sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 32, backgroundColor: palette.background }}
    >
      <Text className="mb-3 text-base leading-6" style={{ color: palette.text }}>
        SecureChat does not use a traditional account password on the server. Your identity is this device’s
        cryptographic session, bound to your Session ID and keys.
      </Text>
      <Text className="mb-4 text-base leading-6" style={{ color: palette.muted }}>
        To stay reachable, keep a copy of your Session ID somewhere safe. The app PIN you set locks this device only;
        it does not replace backing up your Session ID if you reinstall or change devices.
      </Text>

      <View
        className="mb-4 rounded-[18px] border p-4"
        style={{ borderColor: palette.border, backgroundColor: palette.surface }}
      >
        <Text className="mb-2 text-sm font-semibold" style={{ color: palette.muted }}>
          Current Session ID
        </Text>
        <Text className="text-sm leading-5" style={{ color: palette.text }} selectable>
          {session?.sessionId ?? 'Loading…'}
        </Text>
        <Pressable
          className="mt-3 flex-row items-center justify-center rounded-xl py-3"
          style={{ backgroundColor: palette.action }}
          onPress={copySessionId}
          disabled={!session?.sessionId}
        >
          <Feather name="copy" size={18} color="#fff" />
          <Text className="ml-2 font-semibold text-white">{copied ? 'Copied' : 'Copy Session ID'}</Text>
        </Pressable>
      </View>

      <Pressable
        className="mb-3 flex-row items-center justify-between rounded-[14px] border p-4"
        style={{ borderColor: palette.border, backgroundColor: palette.card }}
        onPress={() => navigation.navigate('SecurityCenter')}
      >
        <View className="flex-row items-center">
          <Feather name="shield" size={20} color={palette.text} style={{ marginRight: 12 }} />
          <View>
            <Text className="text-base font-semibold" style={{ color: palette.text }}>
              Privacy &amp; keys
            </Text>
            <Text className="mt-0.5 text-xs" style={{ color: palette.muted }}>
              Rotate keys and review session details
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={palette.muted} />
      </Pressable>
    </ScrollView>
  );
};

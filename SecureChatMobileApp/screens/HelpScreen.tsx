import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type HelpBlock = { title: string; body: string };

const TOPICS: HelpBlock[] = [
  {
    title: 'Starting a chat',
    body: 'Tap the + button on the chat list, enter your contact’s Session ID, and send a request. They must accept before messages sync.'
  },
  {
    title: 'Message requests',
    body: 'Open Settings → Message Requests (or the Requests section on the chat list) to accept or decline incoming chat requests.'
  },
  {
    title: 'Encryption',
    body: 'Messages are encrypted end-to-end on your device. The server stores ciphertext only; your private keys stay on this device.'
  },
  {
    title: 'Session ID',
    body: 'Your Session ID is your public handle. Share it so others can find you. Store a copy if you need to recover your identity after reinstalling.'
  }
];

export const HelpScreen: React.FC = () => {
  const { palette } = useTheme();

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 32, backgroundColor: palette.background }}
    >
      <Text className="mb-6 text-2xl font-semibold" style={{ color: palette.text }}>
        Help
      </Text>
      {TOPICS.map((topic) => (
        <View
          key={topic.title}
          className="mb-4 rounded-[18px] border p-4"
          style={{ borderColor: palette.border, backgroundColor: palette.surface }}
        >
          <Text className="mb-2 text-base font-semibold" style={{ color: palette.text }}>
            {topic.title}
          </Text>
          <Text className="text-sm leading-5" style={{ color: palette.muted }}>
            {topic.body}
          </Text>
        </View>
      ))}
      <Text className="mt-2 text-xs leading-5" style={{ color: palette.muted }}>
        For server status and updates, check with your SecureChat administrator or release notes for this build.
      </Text>
    </ScrollView>
  );
};

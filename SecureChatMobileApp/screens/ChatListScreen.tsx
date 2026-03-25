import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SessionBanner } from '../components/SessionBanner';
import { sessionService, SessionRecord } from '../services/sessionService';
import { RootStackParamList } from '../navigation/types';

type ChatListScreenProps = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

const mockChats = [
  { id: 'conversation-1', label: 'Personal Vault' },
  { id: 'conversation-2', label: 'Secure Research' }
];

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ navigation }) => {
  const [session, setSession] = useState<SessionRecord | null>(null);

  useEffect(() => {
    sessionService.ensureSession().then(setSession);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SecureChat</Text>
      {session && <SessionBanner sessionId={session.sessionId} />}
      <FlatList
        data={mockChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.chatCard} onPress={() => navigation.navigate('Chat', { conversationId: item.id })}>
            <Text style={styles.chatLabel}>{item.label}</Text>
            <Text style={styles.chatMeta}>Ends in 3 days</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('NewChat')}>
          <Text style={styles.secondaryText}>+ New Chat</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('SecurityCenter')}>
          <Text style={styles.secondaryText}>Security Center</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#0b0b0d',
    flex: 1
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 16
  },
  chatCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  chatLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500'
  },
  chatMeta: {
    color: '#9a9a9a',
    marginTop: 6
  },
  actions: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-between'
  },
  secondaryButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4
  },
  secondaryText: {
    color: '#ffffff'
  }
});

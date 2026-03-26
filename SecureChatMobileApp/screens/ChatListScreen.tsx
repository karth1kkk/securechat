import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient, useQuery } from '@apollo/client';
import { SessionBanner } from '../components/SessionBanner';
import { sessionService, SessionRecord } from '../services/sessionService';
import { MY_CONVERSATIONS, MY_CONVERSATION_REQUESTS } from '../graphql/queries';
import {
  ACCEPT_CONVERSATION_REQUEST,
  DECLINE_CONVERSATION_REQUEST
} from '../graphql/mutations';
import { RootStackParamList } from '../navigation/types';

type ChatListScreenProps = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ navigation }) => {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const client = useApolloClient();

  useEffect(() => {
    sessionService.ensureSession().then(setSession);
  }, []);

  const {
    data: requestData,
    refetch: refetchRequests
  } = useQuery(MY_CONVERSATION_REQUESTS, {
    pollInterval: 10000,
    fetchPolicy: 'network-only'
  });

  const {
    data: conversationsData,
    refetch: refetchConversations
  } = useQuery(MY_CONVERSATIONS, {
    pollInterval: 10000,
    fetchPolicy: 'network-only'
  });

  const requests = useMemo(() => requestData?.myConversationRequestsAsync ?? [], [requestData]);
  const conversations = useMemo(() => conversationsData?.myConversationsAsync ?? [], [conversationsData]);

  const getOtherParticipant = (conversation: any) => {
    if (!session) {
      return conversation?.participants?.[0];
    }
    return conversation.participants.find((p: any) => p.sessionId !== session.sessionId) ?? conversation.participants[0];
  };

  const handleAccept = async (conversationId: string) => {
    try {
      await client.mutate({
        mutation: ACCEPT_CONVERSATION_REQUEST,
        variables: { input: { conversationId } }
      });
      navigation.navigate('Chat', { conversationId });
    } catch {
      // Keep UI quiet for now; errors will show in console for debugging.
      console.error('Unable to accept conversation request');
    }
  };

  const handleDecline = async (conversationId: string) => {
    try {
      await client.mutate({
        mutation: DECLINE_CONVERSATION_REQUEST,
        variables: { input: { conversationId } }
      });
    } catch {
      console.error('Unable to decline conversation request');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SecureChat</Text>
      {session && <SessionBanner sessionId={session.sessionId} />}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Requests</Text>
        {requests.length === 0 ? (
          <Text style={styles.emptyText}>No pending requests.</Text>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const other = getOtherParticipant(item);
              return (
                <View style={styles.requestCard}>
                  <Text style={styles.cardTitle}>Chat request</Text>
                  <Text style={styles.cardMeta}>From: {other?.sessionId ?? 'Unknown'}</Text>
                  <View style={styles.requestActions}>
                    <Pressable style={styles.acceptButton} onPress={() => handleAccept(item.id)}>
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </Pressable>
                    <Pressable style={styles.declineButton} onPress={() => handleDecline(item.id)}>
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chats</Text>
        {conversations.length === 0 ? (
          <Text style={styles.emptyText}>No active chats yet.</Text>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const other = getOtherParticipant(item);
              return (
                <Pressable style={styles.chatCard} onPress={() => navigation.navigate('Chat', { conversationId: item.id })}>
                  <Text style={styles.chatLabel}>{other?.sessionId ?? 'Unknown session'}</Text>
                  <Text style={styles.chatMeta}>Encrypted session ready</Text>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}
      </View>

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
  requestCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)'
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
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  cardMeta: {
    color: '#b0b0b0',
    marginTop: 6
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: 12
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#1a9cff',
    alignItems: 'center'
  },
  acceptButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  declineButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center'
  },
  declineButtonText: {
    color: '#ffcccb',
    fontWeight: '600'
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
  },
  section: {
    marginTop: 14
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10
  },
  emptyText: {
    color: '#9a9a9a',
    fontSize: 14
  }
});

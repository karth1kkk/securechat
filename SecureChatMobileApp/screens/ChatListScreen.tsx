import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient, useQuery } from '@apollo/client';
import { SessionBanner } from '../components/SessionBanner';
import { sessionService, SessionRecord } from '../services/sessionService';
import { MY_CONVERSATIONS, MY_CONVERSATION_REQUESTS } from '../graphql/queries';
import {
  ACCEPT_CONVERSATION_REQUEST,
  DECLINE_CONVERSATION_REQUEST,
  DELETE_CONVERSATION
} from '../graphql/mutations';
import { RootStackParamList } from '../navigation/types';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { preferencesService } from '../services/preferencesService';
import { Ionicons } from '@expo/vector-icons';

type ChatListScreenProps = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

type ConversationParticipant = {
  userId: string;
  publicKey?: string | null;
  sessionId?: string | null;
  username?: string | null;
};

type ConversationRecord = {
  id: string;
  isGroup?: boolean;
  createdAt: string;
  lastMessageAt?: string | null;
  participants: ConversationParticipant[];
};

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ navigation }) => {
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [localUsername, setLocalUsername] = useState<string | null>(null);
  const client = useApolloClient();
  const { palette } = useTheme();
  const isFocused = useIsFocused();

  useEffect(() => {
    sessionService.ensureSession().then(setSession);
  }, []);

  useEffect(() => {
    if (isFocused) {
      preferencesService.getUsername().then(setLocalUsername);
    }
  }, [isFocused]);

  const {
    data: requestData,
    refetch: refetchRequests
  } = useQuery<{ myConversationRequestsAsync: ConversationRecord[] }>(MY_CONVERSATION_REQUESTS, {
    pollInterval: 10000,
    fetchPolicy: 'network-only'
  });

  const {
    data: conversationsData,
    refetch: refetchConversations
  } = useQuery<{ myConversationsAsync: ConversationRecord[] }>(MY_CONVERSATIONS, {
    pollInterval: 10000,
    fetchPolicy: 'network-only'
  });

  const formatSession = (value?: string | null) =>
    value ? `${value.slice(0, 6)}…${value.slice(-6)}` : 'Unknown';

  const getOtherParticipant = (conversation: ConversationRecord) => {
    if (!session) {
      return conversation.participants[0];
    }
    return conversation.participants.find((p) => p.userId !== session.userId) ?? conversation.participants[0];
  };

  const getDisplayName = (participant?: ConversationParticipant | null) => {
    if (!participant) {
      return 'Unknown';
    }
    if (participant.userId === session?.userId && localUsername) {
      return localUsername;
    }
    return participant.username ?? formatSession(participant?.sessionId);
  };

  const requests = useMemo<ConversationRecord[]>(() => requestData?.myConversationRequestsAsync ?? [], [requestData]);
  const conversations = useMemo<ConversationRecord[]>(() => conversationsData?.myConversationsAsync ?? [], [conversationsData]);
  const filteredConversations = useMemo<ConversationRecord[]>(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return conversations;
    }
    return conversations.filter((item) => {
      const other = getOtherParticipant(item);
      const displayName = getDisplayName(other);
      const target = `${displayName ?? ''} ${item.id ?? ''}`.toLowerCase();
      return target.includes(normalized);
    });
  }, [conversations, searchQuery, session, localUsername]);

  const handleAccept = async (conversationId: string) => {
    try {
      await client.mutate({
        mutation: ACCEPT_CONVERSATION_REQUEST,
        variables: { input: { conversationId } }
      });
      navigation.navigate('Chat', { conversationId });
    } catch {
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

  const handleDelete = async (conversationId: string) => {
    try {
      await client.mutate({
        mutation: DELETE_CONVERSATION,
        variables: { input: { conversationId } }
      });
      refetchConversations();
    } catch (error) {
      console.error('Unable to delete conversation', error);
    }
  };

  const containerStyles = [styles.container, { backgroundColor: palette.background }];
  const chatCardStyles = [styles.chatCard, { borderColor: palette.border, backgroundColor: palette.card }];
  const requestCardStyles = [styles.requestCard, { borderColor: palette.border, backgroundColor: palette.card }];

  useLayoutEffect(() => {
    const toggleSearch = () => {
      setSearchActive((current) => {
        if (current) {
          setSearchQuery('');
        }
        return !current;
      });
    };

    navigation.setOptions({
      headerRight: () => (
        <Pressable style={[styles.headerIcon, { borderColor: palette.border }]} onPress={toggleSearch}>
          <Ionicons name={searchActive ? 'close' : 'search'} size={18} color={palette.text} />
        </Pressable>
      )
    });
  }, [navigation, palette.border, palette.text, searchActive]);

  useEffect(() => {
    if (!isFocused) {
      setSearchActive(false);
      setSearchQuery('');
    }
  }, [isFocused]);

  return (
    <View style={containerStyles}>
      {/* {session && <SessionBanner sessionId={session.sessionId} displayName={localUsername} />} */}

      <View style={styles.content}>
        {searchActive && (
          <View style={[styles.searchBar, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Ionicons name="search" size={18} color={palette.muted} />
            <TextInput
              style={[styles.searchInput, { color: palette.text }]}
              placeholder="Search conversations"
              placeholderTextColor={palette.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={palette.action} />
              </Pressable>
            ) : null}
          </View>
        )}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Requests</Text>
          {requests.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.muted }]}>No pending requests.</Text>
          ) : (
            <FlatList<ConversationRecord>
              data={requests}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const other = getOtherParticipant(item);
                return (
                  <View style={requestCardStyles}>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>Chat request</Text>
                    <Text style={[styles.cardMeta, { color: palette.muted }]}>From: {getDisplayName(other)}</Text>
                    <View style={styles.requestActions}>
                      <Pressable
                        style={[styles.acceptButton, { backgroundColor: palette.action }]}
                        onPress={() => handleAccept(item.id)}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.declineButton, { borderColor: palette.border }]}
                        onPress={() => handleDecline(item.id)}
                      >
                        <Text style={[styles.declineButtonText, { color: palette.text }]}>Decline</Text>
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
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Chats</Text>
          {conversations.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.muted }]}>No active chats yet.</Text>
          ) : (
            <FlatList<ConversationRecord>
              data={filteredConversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const other = getOtherParticipant(item);
                const lastActivity = new Date(item.lastMessageAt ?? item.createdAt);
                const preview = item.lastMessageAt ? 'Encrypted message' : 'Start a new secure chat';
                return (
                  <Pressable
                    style={chatCardStyles}
                    onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
                  >
                    <View>
                      <Text style={[styles.chatLabel, { color: palette.text }]}>{getDisplayName(other)}</Text>
                      <Text style={[styles.chatMeta, { color: palette.muted }]}>{preview}</Text>
                    </View>
                    <View style={styles.chatFooter}>
                      <Text style={[styles.chatMeta, { color: palette.muted }]}> 
                        {lastActivity.toLocaleString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                      <Pressable onPress={() => handleDelete(item.id)} accessibilityLabel="Delete conversation">
                        <Ionicons name="trash-outline" size={18} color={palette.action} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
          )}
        </View>
      </View>

      <Pressable
        style={[styles.fab, { backgroundColor: palette.action }]}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerBadgeText: {
    fontSize: 16,
    fontWeight: '700'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchBar: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16
  },
  headerIconText: {
    fontSize: 18
  },
  content: {
    flex: 1,
    paddingBottom: 120
  },
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10
  },
  emptyText: {
    fontSize: 14
  },
  chatCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  requestCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1
  },
  chatLabel: {
    fontSize: 16,
    fontWeight: '500'
  },
  chatMeta: {
    fontSize: 12,
    marginTop: 6,
    flexShrink: 1
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  cardMeta: {
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
    borderWidth: 1,
    alignItems: 'center'
  },
  declineButtonText: {
    fontWeight: '600'
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16
  },
  bottomSpacer: {
    width: 90
  },
  bottomTabText: {
    fontWeight: '600'
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
      },
      android: {
        elevation: 8
      },
      web: {
        boxShadow: '0px 4px 6px rgba(0,0,0,0.3)'
      }
    })
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700'
  }
});

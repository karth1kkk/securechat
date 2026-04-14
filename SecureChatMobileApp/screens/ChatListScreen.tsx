import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient, useQuery } from '@apollo/client';
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
import { ConversationParticipant, ConversationRecord } from '../types/conversation';
import { cn } from '../lib/cn';

type ChatListScreenProps = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ navigation }) => {
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [localUsername, setLocalUsername] = useState<string | null>(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const client = useApolloClient();
  const { palette } = useTheme();
  const isFocused = useIsFocused();

  useEffect(() => {
    sessionService.ensureSession().then(setSession);
  }, []);

  useEffect(() => {
    if (isFocused) {
      void preferencesService.getUsername().then(setLocalUsername);
      void preferencesService.getProfilePhotoUri().then(setProfilePhotoUri);
    }
  }, [isFocused]);

  const { data: requestData } = useQuery<{ myConversationRequestsAsync: ConversationRecord[] }>(MY_CONVERSATION_REQUESTS, {
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

  const confirmDeleteConversation = (conversationId: string, displayName: string) => {
    const message = `Are you sure you want to delete your chat with ${displayName}? This cannot be undone.`;
    if (Platform.OS === 'web') {
      const ok = typeof globalThis !== 'undefined' && globalThis.confirm ? globalThis.confirm(message) : false;
      if (ok) {
        void handleDelete(conversationId);
      }
      return;
    }
    Alert.alert('Delete conversation?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void handleDelete(conversationId)
      }
    ]);
  };

  useLayoutEffect(() => {
    const toggleSearch = () => {
      setSearchActive((current) => {
        if (current) {
          setSearchQuery('');
        }
        return !current;
      });
    };

    const initial = localUsername?.trim().charAt(0).toUpperCase() ?? 'S';

    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          className={cn('mx-3.5 h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full border')}
          style={{ borderColor: palette.border }}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          {profilePhotoUri ? (
            <Image source={{ uri: profilePhotoUri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="font-bold" style={{ color: palette.text }}>
              {initial}
            </Text>
          )}
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          className="mr-2.5 h-10 w-10 items-center justify-center rounded-full border"
          style={{ borderColor: palette.border }}
          onPress={toggleSearch}
        >
          <Ionicons name={searchActive ? 'close' : 'search'} size={18} color={palette.text} />
        </Pressable>
      )
    });
  }, [navigation, palette.border, palette.text, searchActive, localUsername, profilePhotoUri]);

  useEffect(() => {
    if (!isFocused) {
      setSearchActive(false);
      setSearchQuery('');
    }
  }, [isFocused]);

  const fabShadow =
    Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 }
      : Platform.OS === 'android'
        ? { elevation: 8 }
        : { boxShadow: '0px 4px 6px rgba(0,0,0,0.3)' };

  return (
    <View className="flex-1 px-4 pt-5" style={{ backgroundColor: palette.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searchActive && (
          <View
            className="mb-4 flex-row items-center rounded-[14px] border px-3 py-2"
            style={{ borderColor: palette.border, backgroundColor: palette.card }}
          >
            <Ionicons name="search" size={18} color={palette.muted} />
            <TextInput
              className="ml-2.5 flex-1 text-base"
              style={{ color: palette.text }}
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
        <View className="mb-[18px]">
          <Text className="mb-2.5 text-base font-semibold" style={{ color: palette.text }}>
            Requests
          </Text>
          {requests.length === 0 ? (
            <Text className="text-sm" style={{ color: palette.muted }}>
              No pending requests.
            </Text>
          ) : (
            requests.map((item) => {
              const other = getOtherParticipant(item);
              return (
                <View key={item.id} className="mb-2.5">
                  <View
                    className="rounded-[14px] border p-4"
                    style={{ borderColor: palette.border, backgroundColor: palette.card }}
                  >
                    <Text className="text-base font-semibold" style={{ color: palette.text }}>
                      Chat request
                    </Text>
                    <Text className="mt-1.5" style={{ color: palette.muted }}>
                      From: {getDisplayName(other)}
                    </Text>
                    <View className="mt-3 flex-row">
                      <Pressable
                        className="mr-2 flex-1 items-center rounded-xl py-2.5"
                        style={{ backgroundColor: palette.action }}
                        onPress={() => handleAccept(item.id)}
                      >
                        <Text className="font-semibold text-white">Accept</Text>
                      </Pressable>
                      <Pressable
                        className="flex-1 items-center rounded-xl border py-2.5"
                        style={{ borderColor: palette.border }}
                        onPress={() => handleDecline(item.id)}
                      >
                        <Text className="font-semibold" style={{ color: palette.text }}>
                          Decline
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View className="mb-[18px]">
          <Text className="mb-2.5 text-base font-semibold" style={{ color: palette.text }}>
            Chats
          </Text>
          {conversations.length === 0 ? (
            <Text className="text-sm" style={{ color: palette.muted }}>
              No active chats yet.
            </Text>
          ) : (
            filteredConversations.map((item) => {
              const other = getOtherParticipant(item);
              const lastActivity = new Date(item.lastMessageAt ?? item.createdAt);
              const preview = item.lastMessageAt ? 'Encrypted message' : 'Start a new secure chat';
              const openChat = () => navigation.navigate('Chat', { conversationId: item.id });
              return (
                <View key={item.id} className="mb-2.5">
                  <View
                    className="rounded-[14px] border p-4"
                    style={{ borderColor: palette.border, backgroundColor: palette.card }}
                  >
                    <Pressable onPress={openChat}>
                      <Text className="text-base font-medium" style={{ color: palette.text }}>
                        {getDisplayName(other)}
                      </Text>
                      <Text className="mt-1.5 text-xs" style={{ color: palette.muted }}>
                        {preview}
                      </Text>
                    </Pressable>
                    <View className="mt-2.5 flex-row items-center" style={{ zIndex: 1 }}>
                      <Pressable onPress={openChat} style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <Text className="text-xs" style={{ color: palette.muted }}>
                          {lastActivity.toLocaleString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmDeleteConversation(item.id, getDisplayName(other))}
                        accessibilityLabel="Delete conversation"
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={({ pressed }) => ({
                          padding: 10,
                          zIndex: 2,
                          elevation: 2,
                          opacity: pressed ? 0.65 : 1
                        })}
                      >
                        <Ionicons name="trash-outline" size={20} color={palette.action} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Pressable
        className="absolute bottom-5 h-[70px] w-[70px] items-center justify-center self-center rounded-[35px]"
        style={[{ backgroundColor: palette.action }, fabShadow]}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Text className="text-[32px] font-bold text-white">+</Text>
      </Pressable>
    </View>
  );
};

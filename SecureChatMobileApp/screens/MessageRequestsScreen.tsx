import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient, useQuery } from '@apollo/client';
import { sessionService, SessionRecord } from '../services/sessionService';
import { MY_CONVERSATION_REQUESTS } from '../graphql/queries';
import { ACCEPT_CONVERSATION_REQUEST, DECLINE_CONVERSATION_REQUEST } from '../graphql/mutations';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { preferencesService } from '../services/preferencesService';
import { ConversationParticipant, ConversationRecord } from '../types/conversation';

type Props = NativeStackScreenProps<RootStackParamList, 'MessageRequests'>;

export const MessageRequestsScreen: React.FC<Props> = ({ navigation }) => {
  const client = useApolloClient();
  const { palette } = useTheme();
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [localUsername, setLocalUsername] = useState<string | null>(null);

  useEffect(() => {
    sessionService.ensureSession().then(setSession);
    preferencesService.getUsername().then(setLocalUsername);
  }, []);

  const { data, loading, refetch } = useQuery<{ myConversationRequestsAsync: ConversationRecord[] }>(
    MY_CONVERSATION_REQUESTS,
    { fetchPolicy: 'network-only' }
  );

  const requests = useMemo<ConversationRecord[]>(() => data?.myConversationRequestsAsync ?? [], [data]);

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

  const handleAccept = async (conversationId: string) => {
    try {
      await client.mutate({
        mutation: ACCEPT_CONVERSATION_REQUEST,
        variables: { input: { conversationId } }
      });
      await refetch();
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
      await refetch();
    } catch {
      console.error('Unable to decline conversation request');
    }
  };

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.action} />
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 pt-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-3 text-sm leading-5" style={{ color: palette.muted }}>
        When someone starts a chat with you, their request appears here until you accept or decline.
      </Text>
      {loading && requests.length === 0 ? (
        <ActivityIndicator className="mt-8" color={palette.action} />
      ) : requests.length === 0 ? (
        <Text className="mt-4 text-base" style={{ color: palette.muted }}>
          No pending requests.
        </Text>
      ) : (
        <FlatList<ConversationRecord>
          data={requests}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.action} />}
          renderItem={({ item }) => {
            const other = getOtherParticipant(item);
            return (
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
            );
          }}
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
};

import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient } from '@apollo/client';
import { CREATE_CONVERSATION_REQUEST } from '../graphql/mutations';
import { GET_USER_BY_SESSION_ID } from '../graphql/queries';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';

export const NewChatScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'NewChat'>> = ({ navigation, route }) => {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const prefilled = route.params?.prefilledSessionId?.trim();
    if (prefilled) {
      setSessionId(prefilled);
    }
  }, [route.params?.prefilledSessionId]);
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const client = useApolloClient();
  const { palette } = useTheme();

  const handleCreate = async () => {
    const trimmed = sessionId.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Enter a Session ID' });
      return;
    }

    if (!/^[A-Za-z0-9]{66}$/.test(trimmed)) {
      setStatus({ type: 'error', message: 'Session ID looks invalid.' });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await client.query({
        query: GET_USER_BY_SESSION_ID,
        variables: { sessionId: trimmed },
        fetchPolicy: 'network-only'
      });
      const targetUser = userData?.userBySessionId;
      if (!targetUser) {
        setStatus({ type: 'error', message: 'No user found for that Session ID.' });
        return;
      }
      if (targetUser.sessionId === trimmed) {
        const response = await client.mutate({
          mutation: CREATE_CONVERSATION_REQUEST,
          variables: {
            input: {
              targetUserId: targetUser.id
            }
          }
        });
        if (response?.data?.createConversationRequest?.id) {
          setStatus({ type: 'success', message: 'Conversation request sent.' });
          return;
        }
      }
      setStatus({ type: 'error', message: 'Unable to start chat. Try again.' });
    } catch (error) {
      console.error('Unable to start chat', error);
      setStatus({ type: 'error', message: 'Unable to start chat yet, try again later.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-4 text-2xl" style={{ color: palette.text }}>
        New Chat
      </Text>
      <TextInput
        className="rounded-xl border p-3"
        style={{ borderColor: palette.border, color: palette.text }}
        placeholder="Paste friend's Session ID"
        placeholderTextColor={palette.placeholder}
        value={sessionId}
        onChangeText={setSessionId}
      />
      {status ? (
        <Text
          className="mt-2 text-sm"
          style={{ color: status.type === 'error' ? '#ff8f8f' : palette.action }}
        >
          {status.message}
        </Text>
      ) : null}
      <Pressable
        className="mt-4 items-center rounded-xl p-3.5"
        style={{ backgroundColor: palette.action }}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text className="font-semibold text-white">{loading ? 'Starting…' : 'Request Secure Chat'}</Text>
      </Pressable>
    </View>
  );
};

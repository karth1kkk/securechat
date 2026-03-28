import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient } from '@apollo/client';
import { CREATE_CONVERSATION_REQUEST } from '../graphql/mutations';
import { GET_USER_BY_SESSION_ID } from '../graphql/queries';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';

export const NewChatScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'NewChat'>> = ({ navigation }) => {
  const [sessionId, setSessionId] = useState('');
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
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <Text style={[styles.title, { color: palette.text }]}>New Chat</Text>
      <TextInput
        style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        placeholder="Paste friend's Session ID"
        placeholderTextColor={palette.placeholder}
        value={sessionId}
        onChangeText={setSessionId}
      />
      {status ? (
        <Text
          style={[
            styles.status,
            { color: status.type === 'error' ? '#ff8f8f' : palette.action }
          ]}
        >
          {status.message}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, { backgroundColor: palette.action }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Starting…' : 'Request Secure Chat'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff'
  },
  status: {
    marginTop: 8,
    fontSize: 14
  },
  button: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600'
  }
});

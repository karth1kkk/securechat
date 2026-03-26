import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient } from '@apollo/client';
import { CREATE_CONVERSATION } from '../graphql/mutations';
import { GET_USER_BY_SESSION_ID } from '../graphql/queries';
import { RootStackParamList } from '../navigation/types';

export const NewChatScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'NewChat'>> = ({ navigation }) => {
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const client = useApolloClient();

  const handleCreate = async () => {
    const trimmed = sessionId.trim();
    if (!trimmed) {
      setStatus('Enter a Session ID');
      return;
    }

    try {
      const { data: userData } = await client.query({
        query: GET_USER_BY_SESSION_ID,
        variables: { sessionId: trimmed },
        fetchPolicy: 'no-cache'
      });
      const target = userData?.userBySessionId;
      if (!target) {
        setStatus('No account found for that Session ID.');
        return;
      }

      const { data: mutationData } = await client.mutate({
        mutation: CREATE_CONVERSATION,
        variables: {
          input: {
            participantIds: [target.id],
            isGroup: false
          }
        }
      });
      const conversationId = mutationData?.createConversation?.id;
      navigation.navigate('Chat', { conversationId: conversationId ?? `session-${trimmed}` });
    } catch (error) {
      setStatus('Unable to start chat yet, try again later.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Chat</Text>
      <TextInput
        style={styles.input}
        placeholder="Paste friend's Session ID"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={sessionId}
        onChangeText={setSessionId}
      />
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>Start Encrypted Session</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    padding: 16
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
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
    color: '#ffcccb',
    marginTop: 8
  },
  button: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1a9cff',
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600'
  }
});

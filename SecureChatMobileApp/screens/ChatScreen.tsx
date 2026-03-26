import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient } from '@apollo/client';
import { sessionService, SessionRecord } from '../services/sessionService';
import { encryptionService } from '../services/encryptionService';
import { SEND_MESSAGE } from '../graphql/mutations';
import { ChatBubble } from '../components/ChatBubble';
import { SignalRService } from '../services/signalrService';
import { RootStackParamList } from '../navigation/types';
import { SessionBanner } from '../components/SessionBanner';
import { useQuery } from '@apollo/client';
import { CONVERSATION_BY_ID } from '../graphql/queries';

type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;

interface ThreadMessage {
  id: string;
  content: string;
  isOutgoing: boolean;
  createdAt: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ route }) => {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState('');
  const [expiry, setExpiry] = useState(0);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const client = useApolloClient();
  const signalR = useRef(new SignalRService());
  const {
    data: conversationData,
    loading: conversationLoading,
    error: conversationError,
    refetch: refetchConversation
  } = useQuery(CONVERSATION_BY_ID, {
    variables: { conversationId },
    fetchPolicy: 'network-only'
  });

  const decodeJwtSub = (token: string): string | null => {
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
      // @ts-ignore - atob exists in browser/web builds.
      const json = atob(normalized + padding);
      const parsed = JSON.parse(json);
      return parsed?.sub ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let canceled = false;

    (async () => {
      const current = await sessionService.ensureSession();
      if (canceled) {
        return;
      }
      setSession(current);
      if (!current.jwtToken) {
        console.error('SignalR start skipped: missing jwtToken in session.');
        return;
      }

      const currentUserId = current.userId ?? decodeJwtSub(current.jwtToken);

      await signalR.current.start(current.jwtToken);
      await signalR.current.joinConversation(conversationId);

      const privateKey = current.privateKey;
      signalR.current.onEncryptedMessage((payload) => {
        // Skip messages we already optimistically rendered.
        if (currentUserId && payload.senderId === currentUserId) {
          return;
        }

        let plaintext = '[unable to decrypt]';
        try {
          plaintext = encryptionService.decryptMessage(payload, privateKey);
        } catch (e) {
          console.error('Decrypt failed', e);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: payload.id ?? `${payload.senderId}-${Date.now()}-${Math.random()}`,
            content: plaintext,
            isOutgoing: false,
            createdAt: new Date().toISOString()
          }
        ]);
      });
    })();

    return () => {
      canceled = true;
      signalR.current.stop();
    };
  }, [conversationId]);

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }

    const current = await sessionService.getSession();
    if (!current) {
      return;
    }

    if (!current.jwtToken) {
      console.error('Missing jwtToken; cannot determine recipient participant.');
      return;
    }

    // Ensure we have the participant key material before encrypting.
    let currentConversation = conversationData?.conversationById;
    if (!currentConversation && refetchConversation) {
      try {
        const res = await refetchConversation();
        currentConversation = res.data?.conversationById;
      } catch (e) {
        console.error('Failed to refetch conversationById before send', e);
      }
    }

    const currentUserId = current.userId ?? decodeJwtSub(current.jwtToken);
    const conversation = currentConversation;

    let recipientPublicKey: string | null = null;
    if (conversation) {
      if (currentUserId) {
        recipientPublicKey = conversation.participants.find((p: any) => p.userId !== currentUserId)?.publicKey ?? null;
      }
      if (!recipientPublicKey && current.sessionId) {
        // Fallback: some dev flows can cause sessionId drift; this only applies if we couldn't parse JWT.
        recipientPublicKey =
          conversation.participants.find((p: any) => p.sessionId !== current.sessionId)?.publicKey ?? null;
      }
    }
    if (!recipientPublicKey) {
      console.error('Missing recipient public key for conversation.', {
        conversationLoaded: !!conversation,
        conversationLoading,
        conversationError,
        currentUserId,
        currentSessionId: current.sessionId
      });
      return;
    }

    // Encrypt to the *other* participant so they can decrypt with their private key.
    const encrypted = encryptionService.encryptMessage(input.trim(), recipientPublicKey, current.privateKey);
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        content: input.trim(),
        isOutgoing: true,
        createdAt: new Date().toISOString()
      }
    ]);

    setInput('');

    client.mutate({
      mutation: SEND_MESSAGE,
      variables: {
        input: {
          conversationId,
          encryptedContent: encrypted.ciphertext,
          encryptedKey: encrypted.encryptedKey,
          nonce: encrypted.nonce,
          tag: encrypted.tag,
          signature: encrypted.signature,
          expiryTime: expiry > 0 ? new Date(Date.now() + expiry * 1000).toISOString() : null
        }
      }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Conversation</Text>
      {session && <SessionBanner sessionId={session.sessionId} />}
      <FlatList
        data={messages}
        keyExtractor={(msg) => msg.id}
        renderItem={({ item }) => (
          <ChatBubble key={item.id} text={item.content} isOutgoing={item.isOutgoing} />
        )}
        contentContainerStyle={styles.thread}
      />
      <View style={styles.expiryRow}>
        <Text style={styles.expiryLabel}>Expiry (seconds)</Text>
        <View style={styles.expiryButtons}>
          {[0, 30, 60, 300].map((value) => (
            <Pressable key={value} style={[styles.expiryButton, expiry === value && styles.expiryButtonActive]} onPress={() => setExpiry(value)}>
              <Text style={styles.expiryButtonText}>{value === 0 ? 'Off' : value}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.composeRow}>
        <TextInput
          placeholder="Type a private message"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
          value={input}
          onChangeText={setInput}
        />
        <Pressable
          style={[styles.sendButton, (conversationLoading || !session || !!conversationError) && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={conversationLoading || !!conversationError}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    padding: 16
  },
  header: {
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 12
  },
  thread: {
    paddingBottom: 16
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12
  },
  input: {
    flex: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: '#ffffff'
  },
  sendButton: {
    marginLeft: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1a9cff'
  },
  sendText: {
    color: '#ffffff'
  },
  expiryRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  expiryLabel: {
    color: '#c0c0c0'
  },
  expiryButtons: {
    flexDirection: 'row'
  },
  expiryButton: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginLeft: 6
  },
  expiryButtonActive: {
    backgroundColor: '#1a9cff'
  },
  expiryButtonText: {
    color: '#ffffff'
  }
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient, useQuery } from '@apollo/client';
import { useIsFocused } from '@react-navigation/native';
import { SessionBanner } from '../components/SessionBanner';
import { ChatBubble } from '../components/ChatBubble';
import { sessionService, SessionRecord } from '../services/sessionService';
import { encryptionService } from '../services/encryptionService';
import { SignalRService } from '../services/signalrService';
import { GET_MESSAGES, CONVERSATION_BY_ID } from '../graphql/queries';
import { SEND_MESSAGE } from '../graphql/mutations';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { preferencesService } from '../services/preferencesService';

type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;

interface ThreadMessage {
  id: string;
  content: string;
  isOutgoing: boolean;
  createdAt: string;
  status?: 'sending' | 'sent';
}

const threadCache = new Map<string, ThreadMessage[]>();

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const { palette } = useTheme();
  const [messages, setMessages] = useState<ThreadMessage[]>(() => threadCache.get(conversationId) ?? []);
  const [input, setInput] = useState('');
  const [expiry, setExpiry] = useState(0);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [localUsername, setLocalUsername] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<ThreadMessage>>(null);
  const signalR = useRef(new SignalRService());
  const client = useApolloClient();
  const isFocused = useIsFocused();

  const { data: conversationData } = useQuery(CONVERSATION_BY_ID, {
    variables: { conversationId },
    fetchPolicy: 'network-only'
  });

  const { data: messagesData, refetch: refetchMessages } = useQuery(GET_MESSAGES, {
    variables: { conversationId, limit: 200 },
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    sessionService.ensureSession().then(setSession);
  }, []);

  useEffect(() => {
    if (isFocused) {
      preferencesService.getUsername().then(setLocalUsername);
    }
  }, [isFocused]);

  const decodeJwtSub = useCallback((token: string | undefined): string | null => {
    if (!token) {
      return null;
    }
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`;
      const json = atob(padded);
      const parsed = JSON.parse(json);
      return parsed?.sub ?? null;
    } catch (error) {
      console.error('Unable to decode jwt sub', error);
      return null;
    }
  }, []);

  const currentUserId = useMemo(() => {
    return session?.userId ?? decodeJwtSub(session?.jwtToken);
  }, [session, decodeJwtSub]);

  const formatSession = (value?: string) => (value ? `${value.slice(0, 6)}…${value.slice(-6)}` : 'Unknown');

  const addMessage = useCallback((message: ThreadMessage) => {
    setMessages((previous) => {
      if (previous.some((item) => item.id === message.id)) {
        return previous;
      }
      return [...previous, message];
    });
  }, []);

  const hasRefetchedOnFocus = useRef(false);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    if (!hasRefetchedOnFocus.current) {
      hasRefetchedOnFocus.current = true;
      return;
    }
    refetchMessages();
  }, [isFocused, refetchMessages]);

  useEffect(() => {
    hasRefetchedOnFocus.current = false;
    const cached = threadCache.get(conversationId);
    if (
      cached &&
      cached.length === messages.length &&
      cached.every((msg, index) => msg.id === messages[index]?.id)
    ) {
      return;
    }
    setMessages(cached ?? []);
  }, [conversationId]);

  useEffect(() => {
    threadCache.set(conversationId, messages);
  }, [conversationId, messages]);

  useEffect(() => {
    if (!session?.jwtToken) {
      return;
    }

    (async () => {
      await signalR.current.start(session.jwtToken);
      await signalR.current.joinConversation(conversationId);
      signalR.current.onEncryptedMessage((payload) => {
        if (payload.senderId === currentUserId) {
          return;
        }
        if (!session?.privateKey) {
          return;
        }
        let plaintext = '[unable to decrypt]';
        try {
          plaintext = encryptionService.decryptMessage(payload, session.privateKey);
        } catch (error) {
          console.error('Decrypt failed', error);
        }

        addMessage({
          id: payload.id,
          content: plaintext,
          isOutgoing: false,
          createdAt: new Date().toISOString(),
          status: 'sent'
        });
      });
    })();

    return () => {
      signalR.current.stop();
    };
  }, [conversationId, currentUserId, session, addMessage]);

  useEffect(() => {
    if (!messagesData?.getMessagesAsync || !session?.privateKey) {
      return;
    }

    const decrypted = messagesData.getMessagesAsync.map((payload: any) => {
      let plaintext = '[unable to decrypt]';
      try {
        plaintext = encryptionService.decryptMessage(payload, session.privateKey);
      } catch (error) {
        console.error('Decrypt failed', error);
      }

      return {
        id: payload.id,
        content: plaintext,
        isOutgoing: payload.senderId === currentUserId,
        createdAt: payload.createdAt,
        status: payload.senderId === currentUserId ? 'sent' : undefined
      } as ThreadMessage;
    });

    setMessages(decrypted);
  }, [messagesData, session?.privateKey, currentUserId]);

  useEffect(() => {
    if (!conversationData?.conversationById) {
      return;
    }
    const partner = conversationData.conversationById.participants.find(
      (participant: any) => participant.userId !== currentUserId
    );
    const title = partner ? partner.username ?? formatSession(partner.sessionId) : 'Conversation';
    navigation.setOptions({ title });
  }, [conversationData, currentUserId, navigation]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const loadPartnerName = useMemo(() => {
    const partner = conversationData?.conversationById?.participants.find(
      (participant: any) => participant.userId !== currentUserId
    );
    return partner ? partner.username ?? formatSession(partner.sessionId) : 'Conversation';
  }, [conversationData, currentUserId]);

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }

    const current = await sessionService.getSession();
    if (!current) {
      return;
    }

    const recipient = conversationData?.conversationById?.participants.find(
      (p: any) => p.userId !== currentUserId
    );

    if (!recipient?.publicKey) {
      console.error('Missing recipient public key for conversation.');
      return;
    }

    const encrypted = encryptionService.encryptMessage(input.trim(), recipient.publicKey, current.privateKey);
    const optimisticId = `${Date.now()}-${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        content: input.trim(),
        isOutgoing: true,
        createdAt: new Date().toISOString(),
        status: 'sending'
      }
    ]);
    setInput('');

    try {
      const { data } = await client.mutate({
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

      const serverMessage = data?.sendMessage;
      if (serverMessage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticId
              ? { ...msg, id: serverMessage.id ?? msg.id, createdAt: serverMessage.createdAt, status: 'sent' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Send message failed', error);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticId ? { ...msg, status: 'sent' } : msg))
      );
    }
  };

  return (
    <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(msg) => msg.id}
        renderItem={({ item }) => (
          <ChatBubble
            text={item.content}
            isOutgoing={item.isOutgoing}
            timestamp={new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            status={item.status}
          />
        )}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-sm" style={{ color: palette.muted }}>
          Expiry (seconds)
        </Text>
        <View className="flex-row">
          {[0, 30, 60, 300].map((value) => (
            <Pressable
              key={value}
              className="ml-1.5 rounded-lg border p-1.5"
              style={[
                { borderColor: palette.border },
                expiry === value && { backgroundColor: palette.action, borderColor: palette.action }
              ]}
              onPress={() => setExpiry(value)}
            >
              <Text className="text-xs" style={{ color: palette.text }}>
                {value === 0 ? 'Off' : value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View className="mt-3 flex-row items-center">
        <TextInput
          placeholder="Type a private message"
          placeholderTextColor={palette.placeholder}
          className="flex-1 rounded-xl border p-3"
          style={{ borderColor: palette.border, color: palette.text }}
          value={input}
          onChangeText={setInput}
        />
        <Pressable
          className="ml-2 items-center rounded-xl px-4 py-3"
          style={{ backgroundColor: palette.action }}
          onPress={handleSend}
        >
          <Text className="font-semibold text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
};

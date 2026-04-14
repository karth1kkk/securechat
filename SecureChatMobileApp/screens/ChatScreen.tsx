import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient, useQuery } from '@apollo/client';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ChatBubble } from '../components/ChatBubble';
import { TicTacToeChatModal, bubbleTextForMessage } from '../components/TicTacToeChatModal';
import { sessionService, SessionRecord } from '../services/sessionService';
import { encryptionService } from '../services/encryptionService';
import { SignalRService } from '../services/signalrService';
import { GET_MESSAGES, CONVERSATION_BY_ID } from '../graphql/queries';
import { SEND_MESSAGE } from '../graphql/mutations';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { sentMessagePlaintextService } from '../services/sentMessagePlaintextService';
import { threadCachePersistence, PersistedThreadMessage } from '../services/threadCachePersistence';
import { ThreadMessage } from '../types/threadMessage';

type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const threadCache = new Map<string, ThreadMessage[]>();

const mergeById = (server: ThreadMessage[], local: ThreadMessage[]): ThreadMessage[] => {
  const byId = new Map<string, ThreadMessage>();
  for (const m of server) {
    byId.set(m.id, m);
  }
  for (const m of local) {
    if (!byId.has(m.id)) {
      byId.set(m.id, m);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

/** Case-insensitive GUID comparison (JWT sub vs GraphQL UUID strings can differ in casing). */
const normalizeUserId = (id: string | null | undefined) => (id ?? '').trim().toLowerCase();

const sameUserId = (a: string | null | undefined, b: string | null | undefined) => {
  const na = normalizeUserId(a);
  const nb = normalizeUserId(b);
  return na.length > 0 && na === nb;
};

type ChatScreenContentProps = {
  conversationId: string;
  navigation: ChatScreenProps['navigation'];
};

const ChatScreenContent: React.FC<ChatScreenContentProps> = ({ conversationId, navigation }) => {
  const { palette } = useTheme();
  const [messages, setMessages] = useState<ThreadMessage[]>(() => threadCache.get(conversationId) ?? []);
  const [input, setInput] = useState('');
  const [expiry, setExpiry] = useState(0);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const flatListRef = useRef<FlatList<ThreadMessage>>(null);
  const signalR = useRef(new SignalRService());
  const client = useApolloClient();
  const hydratedRef = useRef(false);

  const { data: conversationData } = useQuery(CONVERSATION_BY_ID, {
    variables: { conversationId },
    fetchPolicy: 'network-only',
    errorPolicy: 'all'
  });

  const {
    data: messagesData,
    loading: messagesLoading,
    refetch: refetchMessages
  } = useQuery(GET_MESSAGES, {
    variables: { conversationId, limit: 200 },
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all'
  });

  const refreshSessionFromStorage = useCallback(async () => {
    const next = await sessionService.getSession();
    setSession(next);
    return next;
  }, []);

  useEffect(() => {
    void refreshSessionFromStorage();
  }, [refreshSessionFromStorage]);

  useFocusEffect(
    useCallback(() => {
      void refreshSessionFromStorage().then((s) => {
        if (s?.jwtToken) {
          void refetchMessages();
        }
      });
    }, [refreshSessionFromStorage, refetchMessages])
  );

  useEffect(() => {
    if (!session?.jwtToken) {
      return;
    }
    void refetchMessages();
  }, [session?.jwtToken, conversationId, refetchMessages]);

  useEffect(() => {
    if (!hydratedRef.current && !threadCache.get(conversationId)?.length) {
      threadCachePersistence.get(conversationId).then((stored) => {
        if (stored?.length) {
          threadCache.set(conversationId, stored as ThreadMessage[]);
          setMessages(stored as ThreadMessage[]);
        }
        hydratedRef.current = true;
      });
    } else {
      hydratedRef.current = true;
    }
  }, [conversationId]);

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

  const sessionRef = useRef(session);
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    threadCache.set(conversationId, messages);
    const persist = setTimeout(() => {
      threadCachePersistence.set(conversationId, messages as PersistedThreadMessage[]);
    }, 400);
    return () => clearTimeout(persist);
  }, [conversationId, messages]);

  useEffect(() => {
    if (!session?.jwtToken) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await signalR.current.start(session.jwtToken);
        if (cancelled) {
          return;
        }
        await signalR.current.joinConversation(conversationId);
        if (cancelled) {
          return;
        }
        signalR.current.onEncryptedMessage((payload) => {
          if (cancelled) {
            return;
          }
          const payloadConv = payload.conversationId?.trim().toLowerCase();
          const activeConv = conversationId.trim().toLowerCase();
          if (payloadConv && payloadConv !== activeConv) {
            return;
          }
          if (sameUserId(payload.senderId, currentUserIdRef.current)) {
            return;
          }
          const privateKey = sessionRef.current?.privateKey;
          if (!privateKey) {
            return;
          }
          let plaintext = '[unable to decrypt]';
          try {
            plaintext = encryptionService.decryptMessage(payload, privateKey);
          } catch (error) {
            console.error('Decrypt failed', error);
          }

          addMessage({
            id: payload.id,
            content: plaintext,
            isOutgoing: false,
            senderId: payload.senderId,
            createdAt: payload.createdAt ?? new Date().toISOString(),
            status: 'sent'
          });
        });
      } catch (error) {
        console.error('SignalR conversation join failed', error);
      }
    })();

    return () => {
      cancelled = true;
      void signalR.current.stop();
    };
  }, [conversationId, session?.jwtToken, addMessage]);

  useEffect(() => {
    const rows = messagesData?.getMessagesAsync;
    if (messagesLoading || !Array.isArray(rows) || !session?.privateKey) {
      return;
    }

    let cancelled = false;

    (async () => {
      const decrypted: ThreadMessage[] = [];
      for (const payload of rows as any[]) {
        const isOutgoing = sameUserId(payload.senderId, currentUserId);
        let plaintext = '[unable to decrypt]';
        if (isOutgoing) {
          const stored = await sentMessagePlaintextService.get(payload.id);
          plaintext = stored ?? '[unable to decrypt]';
        } else {
          try {
            plaintext = encryptionService.decryptMessage(payload, session.privateKey!);
          } catch (error) {
            console.error('Decrypt failed', error);
          }
        }

        decrypted.push({
          id: payload.id,
          content: plaintext,
          isOutgoing,
          senderId: payload.senderId,
          createdAt: payload.createdAt,
          status: isOutgoing ? 'sent' : undefined
        });
      }

      if (cancelled) {
        return;
      }

      setMessages((prev) => mergeById(decrypted, prev));
    })();

    return () => {
      cancelled = true;
    };
  }, [messagesData, messagesLoading, session?.privateKey, currentUserId]);

  useEffect(() => {
    if (!conversationData?.conversationById || !normalizeUserId(currentUserId)) {
      return;
    }
    const partner = conversationData.conversationById.participants.find(
      (participant: any) => !sameUserId(participant.userId, currentUserId)
    );
    const title = partner ? partner.username ?? formatSession(partner.sessionId) : 'Conversation';
    navigation.setOptions({ title });
  }, [conversationData, currentUserId, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="flex-row items-center pr-1">
          <Pressable
            accessibilityLabel="Play game in chat"
            className="p-2"
            onPress={() => setGameModalOpen(true)}
          >
            <Ionicons name="game-controller-outline" size={22} color={palette.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Voice call"
            className="p-2"
            onPress={() => navigation.navigate('Call', { conversationId, media: 'audio', callRole: 'caller' })}
          >
            <Ionicons name="call" size={22} color={palette.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Video call"
            className="p-2"
            onPress={() => navigation.navigate('Call', { conversationId, media: 'video', callRole: 'caller' })}
          >
            <Ionicons name="videocam" size={22} color={palette.text} />
          </Pressable>
        </View>
      )
    });
  }, [conversationId, navigation, palette.text]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const sendPlaintextMessage = useCallback(
    async (plain: string) => {
      const trimmed = plain.trim();
      if (!trimmed) {
        return;
      }

      const current = await sessionService.getSession();
      if (!current) {
        return;
      }

      const recipient = conversationData?.conversationById?.participants.find(
        (p: any) => !sameUserId(p.userId, currentUserId)
      );

      if (!normalizeUserId(currentUserId)) {
        console.error('Missing current user id for send.');
        return;
      }

      if (!recipient?.publicKey) {
        console.error('Missing recipient public key for conversation.');
        return;
      }

      const encrypted = encryptionService.encryptMessage(trimmed, recipient.publicKey, current.privateKey);
      const optimisticId = `${Date.now()}-${Math.random()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          content: trimmed,
          isOutgoing: true,
          senderId: currentUserId ?? undefined,
          createdAt: new Date().toISOString(),
          status: 'sending'
        }
      ]);

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
        if (serverMessage?.id) {
          await sentMessagePlaintextService.set(serverMessage.id, trimmed);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === optimisticId
                    ? {
                    ...msg,
                    id: serverMessage.id,
                    createdAt: serverMessage.createdAt ?? msg.createdAt,
                    status: 'sent',
                    senderId: currentUserId ?? undefined
                  }
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
    },
    [client, conversationData?.conversationById?.participants, conversationId, currentUserId, expiry]
  );

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }
    const next = input.trim();
    setInput('');
    await sendPlaintextMessage(next);
  };

  return (
    <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
      <TicTacToeChatModal
        visible={gameModalOpen}
        onClose={() => setGameModalOpen(false)}
        conversationId={conversationId}
        messages={messages}
        currentUserId={currentUserId ?? undefined}
        sendPlaintext={sendPlaintextMessage}
      />
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(msg) => msg.id}
        renderItem={({ item }) => (
          <ChatBubble
            text={bubbleTextForMessage(item)}
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

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  return <ChatScreenContent key={conversationId} conversationId={conversationId} navigation={navigation} />;
};

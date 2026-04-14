import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApolloClient, useQuery } from '@apollo/client';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { EncodingType, getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ChatBubble } from '../components/ChatBubble';
import { ChatGameModal, bubbleTextForMessage } from '../components/ChatGameModal';
import { sessionService, SessionRecord } from '../services/sessionService';
import { encryptionService } from '../services/encryptionService';
import { SignalRService } from '../services/signalrService';
import { GET_MESSAGES, CONVERSATION_BY_ID, GET_USER_BY_SESSION_ID } from '../graphql/queries';
import { SEND_MESSAGE } from '../graphql/mutations';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { sentMessagePlaintextService } from '../services/sentMessagePlaintextService';
import { threadCachePersistence, PersistedThreadMessage } from '../services/threadCachePersistence';
import { ThreadMessage } from '../types/threadMessage';
import { recordFinishedGameStats } from '../services/gameStatsRecorder';
import { serializeRichMessage } from '../lib/chatRichMessage';
import { decodeJwtSub } from '../lib/jwtDecode';
import { normalizeUserId, sameUserId } from '../lib/userIds';

type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const threadCache = new Map<string, ThreadMessage[]>();

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

function approxBytesFromBase64(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

function isLikelySizeOrOOMError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.toLowerCase();
  return (
    m.includes('memory') ||
    m.includes('too large') ||
    m.includes('file is too big') ||
    m.includes('out of memory') ||
    m.includes('space') ||
    m.includes('allocat') ||
    m.includes('enomem') ||
    m.includes('entity too large')
  );
}

const STICKER_EMOJIS = [
  '👍', '❤️', '😂', '🎉', '🔥', '😍', '🙏', '💯', '✨', '😊', '😢', '🤔', '👏', '🎂', '🎈', '🥳',
  '😎', '🤝', '💪', '🙌', '💔', '😴', '👋', '🎁', '🤣', '😭', '👀', '💀', '🫶', '🙈'
];

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
  const [stickerModalOpen, setStickerModalOpen] = useState(false);
  const [gifModalOpen, setGifModalOpen] = useState(false);
  const [gifUrlInput, setGifUrlInput] = useState('');
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

  const currentUserId = useMemo(() => {
    return session?.userId ?? decodeJwtSub(session?.jwtToken);
  }, [session]);

  const formatSession = (value?: string) => (value ? `${value.slice(0, 6)}…${value.slice(-6)}` : 'Unknown');

  const partnerParticipant = useMemo(() => {
    const parts = conversationData?.conversationById?.participants;
    if (!parts?.length || !normalizeUserId(currentUserId)) {
      return null;
    }
    return parts.find((p: { userId: string }) => !sameUserId(p.userId, currentUserId)) ?? null;
  }, [conversationData, currentUserId]);

  const { data: peerUserLookup } = useQuery(GET_USER_BY_SESSION_ID, {
    variables: { sessionId: partnerParticipant?.sessionId ?? '' },
    skip: !partnerParticipant?.sessionId || !!partnerParticipant?.username,
    fetchPolicy: 'network-only'
  });

  const resolvedPeerTitle = useMemo(() => {
    if (!partnerParticipant) {
      return 'Conversation';
    }
    return (
      partnerParticipant.username ??
      peerUserLookup?.userBySessionId?.username ??
      (partnerParticipant.sessionId ? formatSession(partnerParticipant.sessionId) : 'Conversation')
    );
  }, [partnerParticipant, peerUserLookup]);

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
    if (!normalizeUserId(currentUserId)) {
      return;
    }
    navigation.setOptions({ title: resolvedPeerTitle });
  }, [currentUserId, navigation, resolvedPeerTitle]);

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
            onPress={() =>
              navigation.navigate('Call', {
                conversationId,
                media: 'audio',
                callRole: 'caller',
                peerDisplayName:
                  resolvedPeerTitle !== 'Conversation' ? resolvedPeerTitle : undefined
              })
            }
          >
            <Ionicons name="call" size={22} color={palette.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Video call"
            className="p-2"
            onPress={() =>
              navigation.navigate('Call', {
                conversationId,
                media: 'video',
                callRole: 'caller',
                peerDisplayName:
                  resolvedPeerTitle !== 'Conversation' ? resolvedPeerTitle : undefined
              })
            }
          >
            <Ionicons name="videocam" size={22} color={palette.text} />
          </Pressable>
        </View>
      )
    });
  }, [conversationId, navigation, palette.text, resolvedPeerTitle]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  useEffect(() => {
    recordFinishedGameStats(messages, currentUserId ?? undefined);
  }, [messages, currentUserId]);

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

  const pickAndSendImage = useCallback(async () => {
    const tooLargeImage = () =>
      Alert.alert(
        'File too large',
        'File size too big to send. Images must be about 2.5 MB or smaller.'
      );
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission', 'Photo library access is needed to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.65,
        base64: true
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];

      if (asset.fileSize != null && asset.fileSize > MAX_IMAGE_BYTES) {
        tooLargeImage();
        return;
      }

      let b64 = asset.base64;
      if (b64) {
        if (approxBytesFromBase64(b64) > MAX_IMAGE_BYTES) {
          tooLargeImage();
          return;
        }
      } else if (asset.uri) {
        const info = await getInfoAsync(asset.uri);
        if (
          info.exists &&
          'size' in info &&
          typeof info.size === 'number' &&
          info.size > MAX_IMAGE_BYTES
        ) {
          tooLargeImage();
          return;
        }
        try {
          b64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
        } catch (readErr) {
          if (isLikelySizeOrOOMError(readErr)) {
            tooLargeImage();
            return;
          }
          throw readErr;
        }
      }
      if (!b64) {
        Alert.alert('Error', 'Could not read the image.');
        return;
      }
      if (approxBytesFromBase64(b64) > MAX_IMAGE_BYTES) {
        tooLargeImage();
        return;
      }
      const mime = asset.mimeType ?? 'image/jpeg';
      await sendPlaintextMessage(serializeRichMessage({ type: 'image', mime, base64: b64 }));
    } catch (e) {
      console.error('pickAndSendImage', e);
      if (isLikelySizeOrOOMError(e)) {
        tooLargeImage();
        return;
      }
      Alert.alert('Error', 'Could not send the image.');
    }
  }, [sendPlaintextMessage]);

  const pickAndSendVideo = useCallback(async () => {
    const tooLargeVideo = () =>
      Alert.alert(
        'File too large',
        'File size too big to send. Videos must be about 8 MB or smaller.'
      );
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission', 'Photo library access is needed to send video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 120,
        quality: 0.6
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];
      if (!asset.uri) {
        return;
      }

      if (asset.fileSize != null && asset.fileSize > MAX_VIDEO_BYTES) {
        tooLargeVideo();
        return;
      }

      const info = await getInfoAsync(asset.uri);
      if (
        info.exists &&
        'size' in info &&
        typeof info.size === 'number' &&
        info.size > MAX_VIDEO_BYTES
      ) {
        tooLargeVideo();
        return;
      }

      let b64: string;
      try {
        b64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
      } catch (readErr) {
        if (isLikelySizeOrOOMError(readErr)) {
          tooLargeVideo();
          return;
        }
        throw readErr;
      }

      if (approxBytesFromBase64(b64) > MAX_VIDEO_BYTES) {
        tooLargeVideo();
        return;
      }
      const mime = asset.mimeType ?? 'video/mp4';
      await sendPlaintextMessage(serializeRichMessage({ type: 'video', mime, base64: b64 }));
    } catch (e) {
      console.error('pickAndSendVideo', e);
      if (isLikelySizeOrOOMError(e)) {
        tooLargeVideo();
        return;
      }
      Alert.alert('Error', 'Could not send the video (try a shorter clip under 8 MB).');
    }
  }, [sendPlaintextMessage]);

  const sendGifFromModal = useCallback(async () => {
    const u = gifUrlInput.trim();
    if (!/^https?:\/\//i.test(u)) {
      Alert.alert('Invalid URL', 'Paste a GIF link starting with http:// or https://');
      return;
    }
    setGifUrlInput('');
    setGifModalOpen(false);
    await sendPlaintextMessage(serializeRichMessage({ type: 'gif', url: u }));
  }, [gifUrlInput, sendPlaintextMessage]);

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
      <ChatGameModal
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
            rawContent={item.content}
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
      <View className="mt-2 flex-row flex-wrap items-center gap-1">
        <Pressable
          accessibilityLabel="Stickers"
          className="rounded-xl border p-2.5"
          style={{ borderColor: palette.border }}
          onPress={() => setStickerModalOpen(true)}
        >
          <Ionicons name="happy-outline" size={22} color={palette.action} />
        </Pressable>
        <Pressable
          accessibilityLabel="Photo"
          className="rounded-xl border p-2.5"
          style={{ borderColor: palette.border }}
          onPress={() => void pickAndSendImage()}
        >
          <Ionicons name="image-outline" size={22} color={palette.action} />
        </Pressable>
        <Pressable
          accessibilityLabel="Video"
          className="rounded-xl border p-2.5"
          style={{ borderColor: palette.border }}
          onPress={() => void pickAndSendVideo()}
        >
          <Ionicons name="videocam-outline" size={22} color={palette.action} />
        </Pressable>
        <Pressable
          accessibilityLabel="GIF link"
          className="rounded-xl border px-3 py-2.5"
          style={{ borderColor: palette.border }}
          onPress={() => setGifModalOpen(true)}
        >
          <Text className="text-xs font-semibold" style={{ color: palette.action }}>
            GIF
          </Text>
        </Pressable>
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

      <Modal visible={stickerModalOpen} transparent animationType="fade" onRequestClose={() => setStickerModalOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setStickerModalOpen(false)}>
          <Pressable
            className="rounded-t-3xl p-4"
            style={{ backgroundColor: palette.background }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-3 text-base font-semibold" style={{ color: palette.text }}>
              Stickers
            </Text>
            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 }}>
              {STICKER_EMOJIS.map((emoji, idx) => (
                <Pressable
                  key={`sticker-${idx}-${emoji}`}
                  className="m-1 h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: palette.card }}
                  onPress={() => {
                    setStickerModalOpen(false);
                    void sendPlaintextMessage(serializeRichMessage({ type: 'sticker', emoji }));
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={gifModalOpen} transparent animationType="fade" onRequestClose={() => setGifModalOpen(false)}>
        <Pressable className="flex-1 justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable
            className="rounded-2xl border p-4"
            style={{ backgroundColor: palette.background, borderColor: palette.border }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-2 text-base font-semibold" style={{ color: palette.text }}>
              Send a GIF
            </Text>
            <Text className="mb-2 text-xs" style={{ color: palette.muted }}>
              Paste a direct link to a GIF image (e.g. from Giphy → Copy image address).
            </Text>
            <TextInput
              placeholder="https://..."
              placeholderTextColor={palette.placeholder}
              className="mb-3 rounded-xl border p-3"
              style={{ borderColor: palette.border, color: palette.text }}
              value={gifUrlInput}
              onChangeText={setGifUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="flex-row justify-end gap-2">
              <Pressable className="rounded-xl px-4 py-2" onPress={() => setGifModalOpen(false)}>
                <Text style={{ color: palette.muted }}>Cancel</Text>
              </Pressable>
              <Pressable
                className="rounded-xl px-4 py-2"
                style={{ backgroundColor: palette.action }}
                onPress={() => void sendGifFromModal()}
              >
                <Text className="font-semibold text-white">Send</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  return <ChatScreenContent key={conversationId} conversationId={conversationId} navigation={navigation} />;
};

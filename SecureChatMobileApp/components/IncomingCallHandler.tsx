import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { navigationRef } from '../navigation/navigationRef';
import { useIncomingCallRingtone } from '../hooks/useIncomingCallRingtone';
import { getCallSignalService } from '../services/callSignalRService';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  /** Session credentials — used to connect and register for invites immediately (not after PIN unlock). */
  jwtToken: string | null;
  selfUserId: string | null;
  /** When true, incoming UI stays hidden but signaling still registers so the call can ring after unlock. */
  pinLocked: boolean;
};

const sameSessionUser = (a: string | undefined | null, b: string | undefined | null) => {
  if (!a || !b) {
    return false;
  }
  return a.trim().toLowerCase().replace(/-/g, '') === b.trim().toLowerCase().replace(/-/g, '');
};

type Pending = {
  conversationId: string;
  media: 'audio' | 'video';
};

/**
 * Listens for call invites and shows answer/decline before the callee opens the chat.
 * Requires {@link getCallSignalService} + hub method RegisterForIncomingCalls.
 */
export const IncomingCallHandler: React.FC<Props> = ({ jwtToken, selfUserId, pinLocked }) => {
  const { palette } = useTheme();
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  /** Ring for any incoming invite — including while PIN lock is on so you hear before unlocking. */
  useIncomingCallRingtone(!!pending);

  useEffect(() => {
    if (!jwtToken || !selfUserId) {
      return;
    }

    const svc = getCallSignalService();
    let cancelled = false;
    let unsub: (() => void) | undefined;

    void (async () => {
      try {
        await svc.start(jwtToken);
        if (cancelled) {
          return;
        }
        unsub = svc.onReceiveSignal((sig) => {
          if (sameSessionUser(sig.senderId, selfUserId)) {
            return;
          }

          const convId = sig.conversationId ?? sig.callId;
          if (!convId) {
            return;
          }

          const t = (sig.type ?? '').toLowerCase();
          if (t === 'hangup') {
            setPending((p) => (p && p.conversationId === convId ? null : p));
            return;
          }

          if (t === 'invite') {
            setPending({
              conversationId: convId,
              media: sig.media === 'video' ? 'video' : 'audio'
            });
          }
        });
      } catch (e) {
        console.warn('Incoming call listener failed', e);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [jwtToken, selfUserId]);

  const decline = async () => {
    const p = pendingRef.current;
    if (!p) {
      return;
    }
    setPending(null);
    try {
      await getCallSignalService().sendSignal(p.conversationId, {
        type: 'decline',
        callId: p.conversationId
      });
    } catch {
      /* ignore */
    }
  };

  const answer = () => {
    const p = pendingRef.current;
    if (!p) {
      return;
    }
    setPending(null);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Call', {
        conversationId: p.conversationId,
        media: p.media,
        callRole: 'callee'
      });
    }
  };

  if (!pending) {
    return null;
  }

  return (
    <Modal visible={!pinLocked} transparent animationType="fade" onRequestClose={decline}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <View
          className="w-full max-w-md rounded-2xl border p-6"
          style={{ backgroundColor: palette.background, borderColor: palette.border }}
        >
          <Text className="text-center text-lg font-semibold" style={{ color: palette.text }}>
            Incoming {pending.media === 'video' ? 'video' : 'voice'} call
          </Text>
          <Text className="mt-2 text-center text-xs" style={{ color: palette.muted }}>
            Conversation {pending.conversationId.slice(0, 8)}…
          </Text>
          <View className="mt-6 flex-row items-center justify-center">
            <Pressable
              accessibilityLabel="Decline"
              className="items-center justify-center rounded-full p-5"
              style={{ backgroundColor: '#c0392b' }}
              onPress={decline}
            >
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
            <Pressable
              accessibilityLabel="Answer"
              className="ml-10 items-center justify-center rounded-full p-5"
              style={{ backgroundColor: '#27ae60' }}
              onPress={answer}
            >
              <Ionicons name="call" size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

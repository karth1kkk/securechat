import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { createElement } from 'react';
import { RootStackParamList } from '../navigation/types';
import { sessionService } from '../services/sessionService';
import { CallSignalRService } from '../services/callSignalRService';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Call'>;

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

type WrtcModule = {
  RTCPeerConnection: typeof RTCPeerConnection;
  RTCSessionDescription: typeof RTCSessionDescription;
  RTCIceCandidate: typeof RTCIceCandidate;
  mediaDevices: MediaDevices;
  RTCView: React.ComponentType<{ streamURL: string; style?: object }>;
};

const loadWebRtc = (): WrtcModule => {
  if (Platform.OS === 'web') {
    const g = globalThis as typeof globalThis & {
      RTCPeerConnection: typeof RTCPeerConnection;
      RTCSessionDescription: typeof RTCSessionDescription;
      RTCIceCandidate: typeof RTCIceCandidate;
    };
    const Stub = () => null;
    return {
      RTCPeerConnection: g.RTCPeerConnection,
      RTCSessionDescription: g.RTCSessionDescription,
      RTCIceCandidate: g.RTCIceCandidate,
      mediaDevices: navigator.mediaDevices,
      RTCView: Stub
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-webrtc') as WrtcModule;
};

const shouldInitiate = (selfId: string, peerId: string) => selfId.localeCompare(peerId) > 0;

export const CallScreen: React.FC<Props> = ({ route, navigation }) => {
  const { conversationId, media } = route.params;
  const { palette } = useTheme();
  const [status, setStatus] = useState<'connecting' | 'active' | 'ended' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);

  const signalR = useRef(new CallSignalRService());
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wrtcRef = useRef<WrtcModule | null>(null);
  const makingOfferRef = useRef(false);
  const selfIdRef = useRef<string | null>(null);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStreamUrl(null);
  }, []);

  const hangUp = useCallback(async () => {
    try {
      await signalR.current.sendSignal(conversationId, { type: 'hangup', callId: conversationId });
    } catch {
      /* ignore */
    }
    cleanupMedia();
    await signalR.current.stop();
    setStatus('ended');
    navigation.goBack();
  }, [cleanupMedia, conversationId, navigation]);

  useEffect(() => {
    let presenceTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const setupIceHandlers = (pc: RTCPeerConnection) => {
      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          void signalR.current.sendSignal(conversationId, {
            type: 'ice',
            candidateJson: JSON.stringify(event.candidate.toJSON()),
            callId: conversationId
          });
        }
      };

      pc.ontrack = (event: RTCTrackEvent) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) {
          return;
        }
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const el = document.getElementById('remote-video') as HTMLVideoElement | null;
          if (el) {
            el.srcObject = remoteStream;
          }
        } else if (Platform.OS !== 'web') {
          // react-native-webrtc MediaStream
          const url = (remoteStream as unknown as { toURL: () => string }).toURL();
          setRemoteStreamUrl(url);
        }
      };
    };

    const ensureLocalStream = async (wrtc: WrtcModule) => {
      if (localStreamRef.current) {
        return localStreamRef.current;
      }
      const stream = await wrtc.mediaDevices.getUserMedia({
        audio: true,
        video: media === 'video'
      });
      localStreamRef.current = stream as unknown as MediaStream;
      return localStreamRef.current;
    };

    const ensurePc = async (wrtc: WrtcModule) => {
      if (pcRef.current) {
        return pcRef.current;
      }
      const stream = await ensureLocalStream(wrtc);
      const pc = new wrtc.RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream as unknown as MediaStream);
      });
      setupIceHandlers(pc);
      return pc;
    };

    (async () => {
      try {
        const session = await sessionService.getSession();
        if (!session?.jwtToken || !session.userId) {
          setErrorMessage('No session');
          setStatus('error');
          return;
        }

        selfIdRef.current = session.userId;

        if (Platform.OS !== 'web') {
          const audio = await Audio.requestPermissionsAsync();
          if (!audio.granted) {
            setErrorMessage('Microphone permission is required for calls.');
            setStatus('error');
            return;
          }
        }

        const wrtc = loadWebRtc();
        wrtcRef.current = wrtc;

        await signalR.current.start(session.jwtToken);

        const sendOffer = async (wrtcLocal: WrtcModule) => {
          if (makingOfferRef.current) {
            return;
          }
          makingOfferRef.current = true;
          try {
            const pc = await ensurePc(wrtcLocal);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await signalR.current.sendSignal(conversationId, {
              type: 'offer',
              sdp: offer.sdp ?? '',
              callId: conversationId
            });
            setStatus('active');
          } catch (e) {
            console.error('sendOffer failed', e);
            setErrorMessage('Unable to start media.');
            setStatus('error');
          } finally {
            makingOfferRef.current = false;
          }
        };

        signalR.current.onReceiveSignal(async (sig) => {
          if (cancelled) {
            return;
          }
          if (sig.type === 'hangup') {
            cleanupMedia();
            setStatus('ended');
            navigation.goBack();
            return;
          }

          const wrtcLocal = wrtcRef.current ?? loadWebRtc();

          if (sig.type === 'present' || sig.type === 'ready') {
            if (selfIdRef.current && shouldInitiate(selfIdRef.current, sig.senderId)) {
              await sendOffer(wrtcLocal);
            }
            return;
          }

          try {
            if (sig.type === 'offer' && sig.sdp) {
              const pc = await ensurePc(wrtcLocal);
              await pc.setRemoteDescription(
                new wrtcLocal.RTCSessionDescription({ type: 'offer', sdp: sig.sdp })
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await signalR.current.sendSignal(conversationId, {
                type: 'answer',
                sdp: answer.sdp ?? '',
                callId: conversationId
              });
              setStatus('active');
            } else if (sig.type === 'answer' && sig.sdp) {
              const pc = pcRef.current;
              if (pc) {
                await pc.setRemoteDescription(
                  new wrtcLocal.RTCSessionDescription({ type: 'answer', sdp: sig.sdp })
                );
              }
            } else if (sig.type === 'ice' && sig.candidateJson) {
              const pc = pcRef.current;
              if (pc) {
                const parsed = JSON.parse(sig.candidateJson);
                await pc.addIceCandidate(new wrtcLocal.RTCIceCandidate(parsed));
              }
            }
          } catch (e) {
            console.error('Call signal handling failed', e);
            setErrorMessage('Call negotiation failed.');
            setStatus('error');
          }
        });

        signalR.current.onPeerJoined((userId) => {
          if (cancelled || !session.userId) {
            return;
          }
          if (shouldInitiate(session.userId, userId)) {
            void sendOffer(wrtc);
          }
        });

        await signalR.current.joinCall(conversationId);

        presenceTimer = setInterval(() => {
          void signalR.current.sendSignal(conversationId, { type: 'present', callId: conversationId });
        }, 2000);
      } catch (e) {
        console.error('Call setup failed', e);
        setErrorMessage('Unable to connect call signaling.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (presenceTimer) {
        clearInterval(presenceTimer);
      }
      signalR.current.offHandlers();
      cleanupMedia();
      void signalR.current.stop();
    };
  }, [cleanupMedia, conversationId, media, navigation]);

  const wrtc = wrtcRef.current ?? loadWebRtc();
  const RTCView = wrtc.RTCView;

  return (
    <View className="flex-1 px-4 pt-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-2 text-center text-lg font-semibold" style={{ color: palette.text }}>
        {media === 'video' ? 'Video call' : 'Voice call'}
      </Text>
      <Text className="mb-4 text-center text-sm" style={{ color: palette.muted }}>
        Conversation {conversationId.slice(0, 8)}…
      </Text>

      {status === 'connecting' && !errorMessage && (
        <View className="mb-6 items-center">
          <ActivityIndicator size="large" color={palette.action} />
          <Text className="mt-2" style={{ color: palette.muted }}>
            Connecting…
          </Text>
        </View>
      )}

      {errorMessage && (
        <Text className="mb-4 text-center" style={{ color: palette.muted }}>
          {errorMessage}
        </Text>
      )}

      {Platform.OS === 'web' && media === 'video' && (
        <>
          {createElement('video', {
            id: 'remote-video',
            autoPlay: true,
            playsInline: true,
            style: { width: '100%', minHeight: 220, backgroundColor: '#000', borderRadius: 12 }
          })}
        </>
      )}

      {Platform.OS !== 'web' && remoteStreamUrl && (
        <RTCView streamURL={remoteStreamUrl} style={{ width: '100%', height: 280, borderRadius: 12 }} />
      )}

      <View className="mt-8 flex-row items-center justify-center">
        <Pressable
          className="items-center justify-center rounded-full p-4"
          style={{ backgroundColor: '#c0392b' }}
          onPress={hangUp}
        >
          <Ionicons name="call" size={28} color="#fff" />
        </Pressable>
      </View>

      <Text className="mt-6 text-center text-xs" style={{ color: palette.muted }}>
        WebRTC with STUN. Restrictive networks may need TURN. Use a development build for full native WebRTC.
      </Text>
    </View>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { createElement } from 'react';
import { RootStackParamList } from '../navigation/types';
import { sessionService } from '../services/sessionService';
import { getCallSignalService } from '../services/callSignalRService';
import { useTheme } from '../theme/ThemeContext';
import { buildRtcConfiguration } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'Call'>;

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
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-webrtc') as WrtcModule;
  } catch {
    throw new Error(
      'Native WebRTC is not available. Build and run a development client (npx expo run:ios / run:android), not Expo Go.'
    );
  }
};

export const CallScreen: React.FC<Props> = ({ route, navigation }) => {
  const { conversationId, media, callRole = 'caller' } = route.params;
  const { palette } = useTheme();
  const [status, setStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended' | 'error'>(
    callRole === 'caller' ? 'ringing' : 'connecting'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);

  const signalR = getCallSignalService();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wrtcRef = useRef<WrtcModule | null>(null);
  const makingOfferRef = useRef(false);
  const selfIdRef = useRef<string | null>(null);
  const callRoleRef = useRef(callRole);
  callRoleRef.current = callRole;
  const exitedCleanlyRef = useRef(false);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStreamUrl(null);
  }, []);

  const hangUp = useCallback(async () => {
    exitedCleanlyRef.current = true;
    try {
      await signalR.sendSignal(conversationId, { type: 'hangup', callId: conversationId });
    } catch {
      /* ignore */
    }
    cleanupMedia();
    await signalR.leaveCall(conversationId);
    setStatus('ended');
    navigation.goBack();
  }, [cleanupMedia, conversationId, navigation]);

  useEffect(() => {
    exitedCleanlyRef.current = false;
    let cancelled = false;
    let offReceive: (() => void) | undefined;

    const setupIceHandlers = (pc: RTCPeerConnection) => {
      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          void signalR.sendSignal(conversationId, {
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
          if (media === 'video') {
            const el = document.getElementById('remote-video') as HTMLVideoElement | null;
            if (el) {
              el.srcObject = remoteStream;
            }
          } else {
            const el = document.getElementById('remote-audio') as HTMLAudioElement | null;
            if (el) {
              el.srcObject = remoteStream;
              void el.play?.().catch(() => undefined);
            }
          }
        } else if (Platform.OS !== 'web') {
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
      const pc = new wrtc.RTCPeerConnection(buildRtcConfiguration());
      pcRef.current = pc;
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream as unknown as MediaStream);
      });
      setupIceHandlers(pc);
      return pc;
    };

    const sendOffer = async (wrtcLocal: WrtcModule) => {
      if (makingOfferRef.current) {
        return;
      }
      makingOfferRef.current = true;
      try {
        const pc = await ensurePc(wrtcLocal);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: media === 'video'
        });
        await pc.setLocalDescription(offer);
        await signalR.sendSignal(conversationId, {
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

    (async () => {
      try {
        const session = await sessionService.getSession();
        if (!session?.jwtToken || !session.userId) {
          setErrorMessage('No session');
          setStatus('error');
          return;
        }

        selfIdRef.current = session.userId;

        if (Platform.OS !== 'web' && Constants.appOwnership === 'expo') {
          setErrorMessage(
            'Calls need a development build with WebRTC (run npx expo run:ios or npx expo run:android). Expo Go cannot load native WebRTC.'
          );
          setStatus('error');
          return;
        }

        if (Platform.OS !== 'web') {
          const audio = await Audio.requestPermissionsAsync();
          if (!audio.granted) {
            setErrorMessage('Microphone permission is required for calls.');
            setStatus('error');
            return;
          }
          if (media === 'video') {
            const cam = await Camera.requestCameraPermissionsAsync();
            if (!cam.granted) {
              setErrorMessage('Camera permission is required for video calls.');
              setStatus('error');
              return;
            }
          }
          // WebRTC remote playback is often silent until the audio session allows play + record (iOS / Android).
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            // false = route to main speaker (more reliable for hearing than earpiece, esp. on emulators).
            playThroughEarpieceAndroid: false
          });
        }

        const wrtc = loadWebRtc();
        wrtcRef.current = wrtc;

        await signalR.start(session.jwtToken);

        offReceive = signalR.onReceiveSignal(async (sig) => {
          if (cancelled) {
            return;
          }
          const conv = sig.conversationId ?? sig.callId;
          if (conv && conv !== conversationId) {
            return;
          }

          const t = (sig.type ?? '').toLowerCase();

          if (t === 'hangup') {
            exitedCleanlyRef.current = true;
            cleanupMedia();
            void signalR.leaveCall(conversationId);
            setStatus('ended');
            navigation.goBack();
            return;
          }

          if (t === 'decline' && callRoleRef.current === 'caller') {
            exitedCleanlyRef.current = true;
            setErrorMessage('Call declined.');
            setStatus('ended');
            cleanupMedia();
            await signalR.leaveCall(conversationId);
            navigation.goBack();
            return;
          }

          const wrtcLocal = wrtcRef.current ?? loadWebRtc();

          try {
            if (
              t === 'accepted' &&
              callRoleRef.current === 'caller' &&
              (sig.senderId ?? '').trim().toLowerCase().replace(/-/g, '') !==
                (selfIdRef.current ?? '').trim().toLowerCase().replace(/-/g, '')
            ) {
              await sendOffer(wrtcLocal);
              return;
            }

            if (t === 'offer' && sig.sdp) {
              const pc = await ensurePc(wrtcLocal);
              await pc.setRemoteDescription(
                new wrtcLocal.RTCSessionDescription({ type: 'offer', sdp: sig.sdp })
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await signalR.sendSignal(conversationId, {
                type: 'answer',
                sdp: answer.sdp ?? '',
                callId: conversationId
              });
              setStatus('active');
            } else if (t === 'answer' && sig.sdp) {
              const pc = pcRef.current;
              if (pc) {
                await pc.setRemoteDescription(
                  new wrtcLocal.RTCSessionDescription({ type: 'answer', sdp: sig.sdp })
                );
              }
            } else if (t === 'ice' && sig.candidateJson) {
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

        await signalR.joinCall(conversationId);

        if (callRole === 'caller') {
          await signalR.sendSignal(conversationId, {
            type: 'invite',
            media,
            callId: conversationId
          });
        } else {
          setStatus('connecting');
          await signalR.sendSignal(conversationId, {
            type: 'accepted',
            callId: conversationId
          });
        }
      } catch (e) {
        console.error('Call setup failed', e);
        setErrorMessage('Unable to connect call signaling.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      offReceive?.();
      if (Platform.OS !== 'web') {
        void Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false
        }).catch(() => undefined);
      }
      if (!exitedCleanlyRef.current) {
        void signalR.sendSignal(conversationId, { type: 'hangup', callId: conversationId }).catch(() => undefined);
      }
      cleanupMedia();
      void signalR.leaveCall(conversationId);
    };
  }, [cleanupMedia, conversationId, media, navigation, callRole]);

  const wrtc = wrtcRef.current ?? loadWebRtc();
  const RTCView = wrtc.RTCView;

  const statusLabel =
    status === 'ringing'
      ? 'Ringing…'
      : status === 'connecting'
        ? 'Connecting…'
        : status === 'active'
          ? ''
          : '';

  return (
    <View className="flex-1 px-4 pt-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-2 text-center text-lg font-semibold" style={{ color: palette.text }}>
        {media === 'video' ? 'Video call' : 'Voice call'}
      </Text>
      <Text className="mb-4 text-center text-sm" style={{ color: palette.muted }}>
        Conversation {conversationId.slice(0, 8)}…
      </Text>

      {(status === 'connecting' || status === 'ringing') && !errorMessage && (
        <View className="mb-6 items-center">
          <ActivityIndicator size="large" color={palette.action} />
          <Text className="mt-2" style={{ color: palette.muted }}>
            {statusLabel}
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

      {Platform.OS === 'web' && media === 'audio' && (
        <>
          {createElement('audio', {
            id: 'remote-audio',
            autoPlay: true,
            playsInline: true,
            style: { width: 0, height: 0, opacity: 0, position: 'absolute' as const }
          })}
        </>
      )}

      {Platform.OS !== 'web' && remoteStreamUrl && (
        <RTCView
          streamURL={remoteStreamUrl}
          style={
            media === 'video'
              ? { width: '100%', height: 280, borderRadius: 12, objectFit: 'cover' }
              : { width: '100%', height: 1, opacity: 0, borderRadius: 12 }
          }
        />
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
        Dev build required (not Expo Go). Hosted: set EXPO_PUBLIC_API_URL to your HTTPS API. Cross-network calls
        often need EXPO_PUBLIC_ICE_TURN_* in .env at build time.
      </Text>
    </View>
  );
};

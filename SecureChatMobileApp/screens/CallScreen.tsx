import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@apollo/client';
import { createElement } from 'react';
import { RootStackParamList } from '../navigation/types';
import { CONVERSATION_BY_ID, GET_USER_BY_SESSION_ID } from '../graphql/queries';
import { decodeJwtSub } from '../lib/jwtDecode';
import { normalizeUserId, sameUserId } from '../lib/userIds';
import { sessionService, SessionRecord } from '../services/sessionService';
import { getCallSignalService } from '../services/callSignalRService';
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

/** WhatsApp-style voice call screen (dark teal) */
const WA_CALL_BG = '#0b141a';
const WA_AVATAR_INNER = '#2a3942';
const WA_SUBTEXT = 'rgba(233,237,239,0.65)';
const WA_END_RED = '#ea0038';
const WA_VIDEO_SCRIM_TOP = 'rgba(0,0,0,0.42)';
const WA_VIDEO_SCRIM_BOTTOM = 'rgba(0,0,0,0.55)';

function formatSessionShort(value?: string | null) {
  return value ? `${value.slice(0, 6)}…${value.slice(-6)}` : '';
}

/** First letter for avatar when we have a display name. */
function initialFromDisplayName(name: string | null | undefined): string {
  const t = (name ?? '').trim();
  if (!t) {
    return '?';
  }
  const ch = [...t][0] ?? '?';
  return ch.toUpperCase();
}

function fallbackInitialFromConversationId(id: string): string {
  const c = id.replace(/-/g, '').charAt(0);
  return /[a-f0-9]/i.test(c) ? c.toUpperCase() : '?';
}

function formatCallDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const CallScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    conversationId,
    media,
    callRole = 'caller',
    peerDisplayName: paramPeerName,
    peerAvatarUri
  } = route.params;
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended' | 'error'>(
    callRole === 'caller' ? 'ringing' : 'connecting'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [callStartMs, setCallStartMs] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [session, setSession] = useState<SessionRecord | null>(null);

  useEffect(() => {
    void sessionService.getSession().then(setSession);
  }, []);

  const currentUserId = useMemo(
    () => session?.userId ?? decodeJwtSub(session?.jwtToken),
    [session]
  );

  const hasParamPeerName =
    typeof paramPeerName === 'string' && paramPeerName.trim().length > 0;

  const { data: convData } = useQuery(CONVERSATION_BY_ID, {
    variables: { conversationId },
    skip: hasParamPeerName,
    fetchPolicy: 'cache-first'
  });

  const partner = useMemo(() => {
    const parts = convData?.conversationById?.participants;
    if (!parts?.length || !normalizeUserId(currentUserId)) {
      return null;
    }
    return parts.find((p: { userId: string }) => !sameUserId(p.userId, currentUserId)) ?? null;
  }, [convData, currentUserId]);

  const { data: peerUserLookup } = useQuery(GET_USER_BY_SESSION_ID, {
    variables: { sessionId: partner?.sessionId ?? '' },
    skip: hasParamPeerName || !partner?.sessionId || !!partner?.username,
    fetchPolicy: 'network-only'
  });

  const resolvedPeerName = useMemo(() => {
    if (hasParamPeerName) {
      return paramPeerName!.trim();
    }
    if (!partner) {
      return null;
    }
    return (
      partner.username ??
      peerUserLookup?.userBySessionId?.username ??
      (partner.sessionId ? formatSessionShort(partner.sessionId) : null)
    );
  }, [hasParamPeerName, paramPeerName, partner, peerUserLookup]);

  const avatarLetter = useMemo(() => {
    if (resolvedPeerName?.trim()) {
      return initialFromDisplayName(resolvedPeerName);
    }
    return fallbackInitialFromConversationId(conversationId);
  }, [conversationId, resolvedPeerName]);

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
    setLocalStreamUrl(null);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const loc = document.getElementById('local-video') as HTMLVideoElement | null;
      const rem = document.getElementById('remote-video') as HTMLVideoElement | null;
      if (loc) {
        loc.srcObject = null;
      }
      if (rem) {
        rem.srcObject = null;
      }
    }
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

  const toggleMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  const toggleSpeakerRoute = useCallback(async () => {
    if (Platform.OS === 'web') {
      return;
    }
    const next = !speakerOn;
    setSpeakerOn(next);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: !next
    });
  }, [speakerOn]);

  const toggleCamera = useCallback(() => {
    if (Platform.OS === 'web') {
      return;
    }
    setCameraOff((prev) => {
      const next = !prev;
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

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
        if (Platform.OS !== 'web' && media === 'video') {
          const url = (localStreamRef.current as unknown as { toURL?: () => string }).toURL?.();
          if (url) {
            setLocalStreamUrl(url);
          }
        }
        return localStreamRef.current;
      }
      const stream = await wrtc.mediaDevices.getUserMedia({
        audio: true,
        video: media === 'video'
      });
      localStreamRef.current = stream as unknown as MediaStream;
      if (Platform.OS !== 'web' && media === 'video') {
        const url = (stream as unknown as { toURL?: () => string }).toURL?.();
        if (url) {
          setLocalStreamUrl(url);
        }
      }
      if (Platform.OS === 'web' && typeof document !== 'undefined' && media === 'video') {
        const el = document.getElementById('local-video') as HTMLVideoElement | null;
        if (el) {
          el.srcObject = stream as unknown as MediaStream;
          void el.play?.().catch(() => undefined);
        }
      }
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

  useEffect(() => {
    if (status === 'active' && callStartMs === null) {
      setCallStartMs(Date.now());
    }
  }, [status, callStartMs]);

  useEffect(() => {
    if (status !== 'active' || callStartMs === null) {
      return;
    }
    const tick = () => setElapsedSec(Math.floor((Date.now() - callStartMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, callStartMs]);

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

  if (media === 'audio') {
    return (
      <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: WA_CALL_BG }}>
        <StatusBar barStyle="light-content" />
        <View className="flex-1 px-5">
          <View className="min-h-[44px] flex-row items-center justify-end">
            {status === 'active' ? (
              <Text
                className="text-base font-medium tabular-nums"
                style={{ color: '#e9edef' }}
              >
                {formatCallDuration(elapsedSec)}
              </Text>
            ) : null}
          </View>

          <View className="flex-1 items-center justify-center pb-8">
            <View
              className="mb-5 h-[148px] w-[148px] items-center justify-center overflow-hidden rounded-full"
              style={{
                backgroundColor: WA_AVATAR_INNER,
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.07)'
              }}
            >
              {peerAvatarUri ? (
                <Image
                  source={{ uri: peerAvatarUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 52, fontWeight: '600', color: '#e9edef' }}>{avatarLetter}</Text>
              )}
            </View>
            <Text className="mb-2 text-center text-2xl font-medium" style={{ color: '#e9edef' }}>
              {resolvedPeerName ?? 'Voice call'}
            </Text>
            <Text className="mb-1 text-center text-base" style={{ color: WA_SUBTEXT }}>
              {errorMessage
                ? errorMessage
                : status === 'ringing'
                  ? 'Ringing…'
                  : status === 'connecting'
                    ? 'Connecting…'
                    : status === 'active'
                      ? 'On call'
                      : status === 'ended'
                        ? 'Call ended'
                        : ''}
            </Text>
            {(status === 'connecting' || status === 'ringing') && !errorMessage && (
              <View className="mt-8 items-center">
                <ActivityIndicator size="large" color="rgba(233,237,239,0.85)" />
              </View>
            )}
          </View>

          <View className="pb-8">
            <View className="mb-8 flex-row items-center justify-center" style={{ gap: 40 }}>
              <Pressable
                accessibilityLabel={speakerOn ? 'Speaker on' : 'Earpiece'}
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                onPress={() => void toggleSpeakerRoute()}
              >
                <Ionicons
                  name={speakerOn ? 'volume-high' : 'phone-portrait-outline'}
                  size={28}
                  color="#e9edef"
                />
              </Pressable>
              <Pressable
                accessibilityLabel={micMuted ? 'Unmute' : 'Mute'}
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: micMuted ? 'rgba(234,0,56,0.25)' : 'rgba(255,255,255,0.12)'
                }}
                onPress={toggleMic}
              >
                <Ionicons
                  name={micMuted ? 'mic-off' : 'mic'}
                  size={28}
                  color="#e9edef"
                />
              </Pressable>
            </View>
            <View className="items-center">
              <Pressable
                accessibilityLabel="End call"
                className="h-[72px] w-[72px] items-center justify-center rounded-full"
                style={{ backgroundColor: WA_END_RED }}
                onPress={hangUp}
              >
                <Ionicons
                  name="call"
                  size={32}
                  color="#fff"
                  style={{ transform: [{ rotate: '135deg' }] }}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {Platform.OS === 'web' && (
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
            style={{ width: '100%', height: 1, opacity: 0, borderRadius: 12 }}
          />
        )}
      </SafeAreaView>
    );
  }

  const videoTopRight =
    status === 'active'
      ? formatCallDuration(elapsedSec)
      : status === 'ringing' || status === 'connecting'
        ? statusLabel
        : '';

  const videoControlBtn = {
    size: 56 as const,
    bg: 'rgba(255,255,255,0.14)' as const
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: WA_CALL_BG }} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: WA_CALL_BG }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 24,
            paddingBottom: 14,
            backgroundColor: WA_VIDEO_SCRIM_TOP
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              {resolvedPeerName ? (
                <>
                  <Text style={{ color: '#e9edef', fontSize: 19, fontWeight: '600' }}>{resolvedPeerName}</Text>
                  <Text style={{ color: WA_SUBTEXT, fontSize: 13, marginTop: 3 }}>Video call</Text>
                </>
              ) : (
                <>
                  <Text style={{ color: '#e9edef', fontSize: 19, fontWeight: '600' }}>Video call</Text>
                  <Text style={{ color: WA_SUBTEXT, fontSize: 13, marginTop: 3 }}>
                    {partner?.sessionId ? formatSessionShort(partner.sessionId) : ''}
                  </Text>
                </>
              )}
            </View>
            {videoTopRight ? (
              <Text
                style={{
                  color: '#e9edef',
                  fontSize: 17,
                  fontWeight: '500',
                  fontVariant: ['tabular-nums']
                }}
              >
                {videoTopRight}
              </Text>
            ) : null}
          </View>
        </View>

        {errorMessage ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: 'rgba(234,0,56,0.2)'
            }}
          >
            <Text style={{ color: '#ffc9c9', textAlign: 'center', fontSize: 14 }}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
          {Platform.OS !== 'web' ? (
            <>
              {remoteStreamUrl ? (
                <RTCView
                  streamURL={remoteStreamUrl}
                  style={
                    {
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: '#000'
                    } as object
                  }
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: WA_CALL_BG
                    }
                  ]}
                >
                  <View
                    style={{
                      width: 128,
                      height: 128,
                      borderRadius: 64,
                      backgroundColor: WA_AVATAR_INNER,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 3,
                      borderColor: 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <Text style={{ fontSize: 48, fontWeight: '600', color: '#e9edef' }}>{avatarLetter}</Text>
                  </View>
                  <Text style={{ marginTop: 18, color: WA_SUBTEXT, fontSize: 16 }}>
                    {status === 'ringing' ? 'Ringing…' : 'Waiting for their video…'}
                  </Text>
                  {(status === 'connecting' || status === 'ringing') && !errorMessage ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color="#e9edef" />
                  ) : null}
                </View>
              )}
              {localStreamUrl ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 118,
                    height: 158,
                    borderRadius: 14,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    backgroundColor: '#000'
                  }}
                >
                  {!cameraOff ? (
                    <RTCView
                      streamURL={localStreamUrl}
                      style={
                        {
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: [{ scaleX: -1 }]
                        } as object
                      }
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: WA_AVATAR_INNER,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <Ionicons name="videocam-off" size={34} color="#e9edef" />
                    </View>
                  )}
                </View>
              ) : null}
            </>
          ) : (
            <View style={{ flex: 1, position: 'relative', backgroundColor: '#000' }}>
              {createElement('video', {
                id: 'remote-video',
                autoPlay: true,
                playsInline: true,
                style: {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: '#000'
                }
              })}
              {createElement('video', {
                id: 'local-video',
                autoPlay: true,
                playsInline: true,
                muted: true,
                style: {
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 118,
                  height: 158,
                  borderRadius: 14,
                  objectFit: 'cover',
                  border: '2px solid #fff',
                  backgroundColor: '#000'
                }
              })}
            </View>
          )}
        </View>

        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 20,
            paddingBottom: insets.bottom + 16,
            backgroundColor: WA_VIDEO_SCRIM_BOTTOM
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16
            }}
          >
            <Pressable
              accessibilityLabel={speakerOn ? 'Speaker' : 'Earpiece'}
              onPress={() => void toggleSpeakerRoute()}
              style={{
                width: videoControlBtn.size,
                height: videoControlBtn.size,
                borderRadius: videoControlBtn.size / 2,
                backgroundColor: videoControlBtn.bg,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <Ionicons
                name={speakerOn ? 'volume-high' : 'phone-portrait-outline'}
                size={26}
                color="#e9edef"
              />
            </Pressable>
            <Pressable
              accessibilityLabel={micMuted ? 'Unmute' : 'Mute'}
              onPress={toggleMic}
              style={{
                width: videoControlBtn.size,
                height: videoControlBtn.size,
                borderRadius: videoControlBtn.size / 2,
                backgroundColor: micMuted ? 'rgba(234,0,56,0.35)' : videoControlBtn.bg,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={26} color="#e9edef" />
            </Pressable>
            {Platform.OS !== 'web' ? (
              <Pressable
                accessibilityLabel={cameraOff ? 'Turn camera on' : 'Turn camera off'}
                onPress={toggleCamera}
                style={{
                  width: videoControlBtn.size,
                  height: videoControlBtn.size,
                  borderRadius: videoControlBtn.size / 2,
                  backgroundColor: cameraOff ? 'rgba(234,0,56,0.35)' : videoControlBtn.bg,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Ionicons
                  name={cameraOff ? 'videocam-off' : 'videocam'}
                  size={26}
                  color="#e9edef"
                />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="End call"
              onPress={hangUp}
              style={{
                width: videoControlBtn.size,
                height: videoControlBtn.size,
                borderRadius: videoControlBtn.size / 2,
                backgroundColor: WA_END_RED,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <Ionicons
                name="call"
                size={28}
                color="#fff"
                style={{ transform: [{ rotate: '135deg' }] }}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

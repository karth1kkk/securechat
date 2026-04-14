import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { CALL_HUB_URL } from '../config';

export type CallSignalPayload = {
  type: string;
  sdp?: string;
  candidateJson?: string;
  callId?: string;
  /** Set on invite (audio | video). */
  media?: 'audio' | 'video';
  /** Populated server-side; present on incoming signals. */
  conversationId?: string;
};

export type CallSignalWithSender = CallSignalPayload & { senderId: string };

type IncomingSignal = {
  type?: string;
  Type?: string;
  sdp?: string;
  Sdp?: string;
  candidateJson?: string;
  CandidateJson?: string;
  callId?: string;
  CallId?: string;
  senderId?: string;
  SenderId?: string;
  conversationId?: string;
  ConversationId?: string;
  media?: string;
  Media?: string;
};

const pick = <T>(...values: (T | undefined)[]) => {
  for (const v of values) {
    if (v !== undefined && v !== null) {
      return v;
    }
  }
  return undefined;
};

const normalizeSignal = (dto: IncomingSignal): CallSignalWithSender | null => {
  const type = pick(dto.type, dto.Type) ?? '';
  const sdp = pick(dto.sdp, dto.Sdp);
  const candidateJson = pick(dto.candidateJson, dto.CandidateJson);
  const callId = pick(dto.callId, dto.CallId);
  const rawSender = pick(dto.senderId, dto.SenderId);
  const senderId =
    rawSender !== undefined && rawSender !== null ? String(rawSender).trim() : undefined;
  const conversationId = pick(dto.conversationId, dto.ConversationId)?.trim();
  const rawMedia = pick(dto.media, dto.Media);
  const media = rawMedia === 'video' || rawMedia === 'audio' ? rawMedia : undefined;

  if (!senderId?.length) {
    console.warn('Call signal missing senderId', dto);
    return null;
  }

  return {
    type,
    sdp,
    candidateJson,
    callId,
    conversationId,
    media,
    senderId
  };
};

/**
 * Shared call hub connection (incoming invites + active call). Do not create multiple instances.
 */
export class CallSignalRService {
  private connection: HubConnection | null = null;
  private readonly receiveHandlers = new Set<(signal: CallSignalWithSender) => void>();
  private readonly peerJoinedHandlers = new Set<(userId: string) => void>();
  private receiveHooked = false;
  private peerJoinedHooked = false;
  /** Server responded that RegisterForIncomingCalls does not exist (old API). Skip further invokes. */
  private skipRegisterIncomingCalls = false;
  private loggedMissingRegisterMethod = false;

  async start(token?: string) {
    if (this.connection?.state === HubConnectionState.Connected) {
      this.ensureReceiveHook();
      this.ensurePeerJoinedHook();
      await this.registerForIncomingCallsInternal();
      return;
    }

    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.receiveHooked = false;
      this.peerJoinedHooked = false;
      this.skipRegisterIncomingCalls = false;
      this.loggedMissingRegisterMethod = false;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(CALL_HUB_URL, {
        accessTokenFactory: () => token ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.onreconnected(() => {
      void this.registerForIncomingCallsInternal();
    });

    await this.connection.start();

    this.ensureReceiveHook();
    this.ensurePeerJoinedHook();
    await this.registerForIncomingCallsInternal();
  }

  /** Joins per-user listen group (required for invite / early hangup). Called automatically from start(). */
  async registerForIncomingCalls() {
    await this.registerForIncomingCallsInternal();
  }

  private async registerForIncomingCallsInternal() {
    if (!this.connection || this.skipRegisterIncomingCalls) {
      return;
    }
    try {
      await this.connection.invoke('RegisterForIncomingCalls');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/does not exist|Unknown hub method|Method does not exist/i.test(msg)) {
        this.skipRegisterIncomingCalls = true;
        if (!this.loggedMissingRegisterMethod) {
          this.loggedMissingRegisterMethod = true;
          console.warn(
            `[CallHub] The API at ${CALL_HUB_URL} does not expose RegisterForIncomingCalls (deployed backend is older than this app). Incoming calls will not ring until you redeploy SecureChatBackend from this repo, or point EXPO_PUBLIC_API_URL / API_URL to a server that includes the latest CallHub.`
          );
        }
        return;
      }
      console.warn('[CallHub] RegisterForIncomingCalls failed — incoming calls may not ring.', e);
    }
  }

  async joinCall(conversationId: string) {
    if (!this.connection) {
      throw new Error('Call hub connection is not ready.');
    }
    await this.connection.invoke('JoinCall', conversationId);
  }

  async leaveCall(conversationId: string) {
    if (!this.connection) {
      return;
    }
    try {
      await this.connection.invoke('LeaveCall', conversationId);
    } catch {
      /* best-effort */
    }
  }

  async sendSignal(conversationId: string, payload: CallSignalPayload) {
    if (!this.connection) {
      throw new Error('Call hub connection is not ready.');
    }
    await this.connection.invoke('SendSignal', conversationId, {
      type: payload.type,
      sdp: payload.sdp,
      candidateJson: payload.candidateJson,
      callId: payload.callId,
      media: payload.media
    });
  }

  /** Returns unsubscribe. Safe to call before start(); handlers run once connected. */
  onReceiveSignal(callback: (signal: CallSignalWithSender) => void): () => void {
    this.receiveHandlers.add(callback);
    this.ensureReceiveHook();
    return () => {
      this.receiveHandlers.delete(callback);
    };
  }

  onPeerJoined(callback: (userId: string) => void): () => void {
    this.peerJoinedHandlers.add(callback);
    this.ensurePeerJoinedHook();
    return () => {
      this.peerJoinedHandlers.delete(callback);
    };
  }

  private ensureReceiveHook() {
    if (this.receiveHooked || !this.connection) {
      return;
    }
    this.receiveHooked = true;
    this.connection.on('ReceiveSignal', (dto: IncomingSignal) => {
      const sig = normalizeSignal(dto);
      if (!sig) {
        return;
      }
      for (const h of this.receiveHandlers) {
        h(sig);
      }
    });
  }

  private ensurePeerJoinedHook() {
    if (this.peerJoinedHooked || !this.connection) {
      return;
    }
    this.peerJoinedHooked = true;
    this.connection.on('PeerJoined', (userId: string) => {
      for (const h of this.peerJoinedHandlers) {
        h(userId);
      }
    });
  }

  getState(): HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  async stop() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
    this.receiveHooked = false;
    this.peerJoinedHooked = false;
    this.skipRegisterIncomingCalls = false;
    this.loggedMissingRegisterMethod = false;
  }
}

let sharedCallSignal: CallSignalRService | null = null;

export function getCallSignalService(): CallSignalRService {
  if (!sharedCallSignal) {
    sharedCallSignal = new CallSignalRService();
  }
  return sharedCallSignal;
}

import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { CALL_HUB_URL } from '../config';

export type CallSignalPayload = {
  type: string;
  sdp?: string;
  candidateJson?: string;
  callId?: string;
};

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
};

const pick = <T>(...values: (T | undefined)[]) => {
  for (const v of values) {
    if (v !== undefined && v !== null) {
      return v;
    }
  }
  return undefined;
};

export class CallSignalRService {
  private connection: HubConnection | null = null;

  async start(token?: string) {
    if (this.connection) {
      return;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(CALL_HUB_URL, {
        accessTokenFactory: () => token ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    await this.connection.start();
  }

  async joinCall(conversationId: string) {
    if (!this.connection) {
      throw new Error('Call hub connection is not ready.');
    }
    await this.connection.invoke('JoinCall', conversationId);
  }

  async sendSignal(conversationId: string, payload: CallSignalPayload) {
    if (!this.connection) {
      throw new Error('Call hub connection is not ready.');
    }
    await this.connection.invoke('SendSignal', conversationId, {
      type: payload.type,
      sdp: payload.sdp,
      candidateJson: payload.candidateJson,
      callId: payload.callId
    });
  }

  onReceiveSignal(callback: (signal: CallSignalPayload & { senderId: string }) => void) {
    this.connection?.on('ReceiveSignal', (dto: IncomingSignal) => {
      const type = pick(dto.type, dto.Type) ?? '';
      const sdp = pick(dto.sdp, dto.Sdp);
      const candidateJson = pick(dto.candidateJson, dto.CandidateJson);
      const callId = pick(dto.callId, dto.CallId);
      const senderId = pick(dto.senderId, dto.SenderId);
      if (!senderId) {
        console.warn('Call signal missing senderId', dto);
        return;
      }
      callback({
        type,
        sdp,
        candidateJson,
        callId,
        senderId
      });
    });
  }

  onPeerJoined(callback: (userId: string) => void) {
    this.connection?.on('PeerJoined', (userId: string) => {
      callback(userId);
    });
  }

  offHandlers() {
    if (this.connection) {
      this.connection.off('ReceiveSignal');
      this.connection.off('PeerJoined');
    }
  }

  getState(): HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  async stop() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}

import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { EncryptedMessage } from './encryptionService';
import { SIGNALR_URL } from '../config';

// SignalR serializes DTOs with `System.Text.Json` (Web defaults). There can still be
// casing drift (Pascal vs camel), so normalize both conventions before decrypting.
type IncomingMessageDto = {
  id?: string;
  Id?: string;
  senderId?: string;
  SenderId?: string;
  encryptedContent?: string;
  EncryptedContent?: string;
  encryptedKey?: string;
  EncryptedKey?: string;
  nonce?: string;
  Nonce?: string;
  tag?: string;
  Tag?: string;
  signature?: string | null;
  Signature?: string | null;
  conversationId?: string;
  ConversationId?: string;
  createdAt?: string;
  CreatedAt?: string;
};

export type RealtimeEncryptedPayload = EncryptedMessage & {
  id: string;
  senderId: string;
  /** ISO time from server — use for ordering (don't use client clock). */
  createdAt?: string;
  conversationId?: string;
};

const normalize = (value: string | undefined | null) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const pickFirst = (...values: Array<string | undefined | null>): string | undefined => {
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
};

export class SignalRService {
  private connection: HubConnection | null = null;

  async start(token?: string) {
    if (this.connection) {
      return;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(SIGNALR_URL, {
        accessTokenFactory: () => token ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    await this.connection.start();
  }

  async joinConversation(conversationId: string) {
    if (!this.connection) {
      throw new Error('SignalR connection is not ready.');
    }

    await this.connection.invoke('JoinConversation', conversationId);
  }

  /**
   * Subscribes to ReceiveEncryptedMessage. Re-registers the handler (previous handler
   * is removed) so React effects do not stack duplicate listeners on the same connection.
   */
  onEncryptedMessage(callback: (message: RealtimeEncryptedPayload) => void) {
    if (!this.connection) {
      return;
    }

    this.connection.off('ReceiveEncryptedMessage');
    this.connection.on('ReceiveEncryptedMessage', (dto: IncomingMessageDto) => {
      const ciphertext = pickFirst(dto.encryptedContent, dto.EncryptedContent);
      const encryptedKey = pickFirst(dto.encryptedKey, dto.EncryptedKey);
      const nonce = pickFirst(dto.nonce, dto.Nonce);
      const tag = pickFirst(dto.tag, dto.Tag);
      const senderId = pickFirst(dto.senderId, dto.SenderId);
      const id = pickFirst(dto.id, dto.Id) ?? `${senderId ?? 'unknown'}-${Date.now()}-${Math.random()}`;

      if (!ciphertext || !encryptedKey || !nonce || !tag || !senderId) {
        console.error('Received malformed encrypted payload; missing required fields.', dto);
        return;
      }

      const createdAt = pickFirst(dto.createdAt, dto.CreatedAt);
      const conversationId = pickFirst(dto.conversationId, dto.ConversationId);

      callback({
        id,
        senderId,
        ciphertext,
        encryptedKey,
        nonce,
        tag,
        signature: pickFirst(dto.signature ?? undefined, dto.Signature ?? undefined),
        createdAt,
        conversationId
      });
    });
  }

  getState(): HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  async stop() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}
